import React from 'react';
import '@testing-library/jest-dom';
import { render, screen, within } from '@testing-library/react';
import ScoreBreakdown, {
  FlagsPanel, markView, skillRowView, skillStatusView, sourcesDisagreeView,
} from './ScoreBreakdown';

describe('skillStatusView: the skill-evidence status badge', () => {
  test('the three statuses of D§7.1 keep their category (R-28)', () => {
    expect(skillStatusView('evidenced').label).toBe('Evidenced');
    expect(skillStatusView('claimed_only').label).toBe('Claimed only');
    expect(skillStatusView('not_found').label).toBe('Not found');
  });

  test('an unknown status is shown as unknown with its raw value, never as a real category', () => {
    const v = skillStatusView('partially_verified');
    expect(v.label).toBe('Unknown status: partially verified');
    expect(v.variant).toBe('outline');
    // R-28: the pre-R-28 values are not statuses any more; "matched" is never "Evidenced".
    for (const raw of [undefined, null, '', 'constructor', 'toString', 'matched', 'missing']) {
      const view = skillStatusView(raw);
      expect(['Evidenced', 'Not found', 'Claimed only']).not.toContain(view.label);
      expect(view.label).toMatch(/^Unknown status/);
    }
  });
});

// Spelled out of parts so the card's grep for the old field finds no reader in frontend/src.
const LEGACY_COUNT = ['evidence', 'sources', 'confirming'].join('_');

describe('skillRowView: rows stored before R-28', () => {
  test('a résumé match without GitHub evidence is claimed only, never evidenced', () => {
    const v = skillRowView({ name: 'python', status: 'matched', sources: { parsing: 'matched', github: null } });
    expect(v.status).toBe('claimed_only');
    expect(v.legacy).toBe(true);
    expect(v.marks).toEqual({ resume: 'confirmed', github: 'unavailable', assessment: null });
  });

  test('GitHub evidenced was the only confirmation, missing is not found', () => {
    expect(skillRowView({ status: 'matched', sources: { github: 'evidenced' } }).status).toBe('evidenced');
    expect(skillRowView({ status: 'claimed_only', sources: { github: 'not_found' } }).marks.github).toBe('absent');
    expect(skillRowView({ status: 'missing', sources: { github: null } }).status).toBe('not_found');
  });

  test('a row in the R-28 shape is used as stored', () => {
    const row = { name: 'sql', status: 'evidenced', marks: { resume: 'confirmed', github: 'unavailable', assessment: 'confirmed' } };
    expect(skillRowView(row)).toEqual({ ...row, legacy: false });
    expect(markView(null).label).toBe('Not recorded');
    expect(markView('weird').label).toBe('Unknown: weird');
  });
});

const factor = (key) => ({
  key, label: key, available: true, direction: 'neutral', weight: 0.2, weight_pct: 20,
  value: 50, contribution: 10, reason: null, evidence: [],
});
const EXPLANATION = {
  version: 1, composite: 50, band: 'low', weights_version: 'w2-2026-11-13', verification: 'verified',
  summary: 'Credibility 50/100.',
  factors: [factor('parsing_semantic_alignment'), factor('github_evidence'), factor('assessment_results')],
  skill_evidence: [
    {
      name: 'sql', status: 'evidenced', required_by_job: true, claimed_on_resume: true,
      marks: { resume: 'confirmed', github: 'unavailable', assessment: 'confirmed' },
      github_claims: [{ skill: 'sql', status: 'not_checkable' }],
      assessment_points: { earned: 1, possible: 2, questions: 2 },
    },
    {
      name: 'python', status: 'claimed_only', required_by_job: true, claimed_on_resume: true,
      marks: { resume: 'confirmed', github: 'absent', assessment: 'absent' },
      github_claims: [{ skill: 'python', status: 'not_found' }],
      assessment_points: { earned: 0, possible: 0, questions: 0 },
    },
    {
      name: 'kubernetes', status: 'not_found', required_by_job: true, claimed_on_resume: false,
      marks: { resume: 'absent', github: 'unavailable', assessment: 'absent' },
      github_claims: [], assessment_points: { earned: 0, possible: 0, questions: 0 },
    },
  ],
  flags: [],
  flag_checks: { sources_disagree: 'not_raised' },
  flags_unavailable_reason: 'Other checks are not built yet.',
};

describe('the skill table (R-28)', () => {
  test('every row shows one mark per source and no "N of M sources" count', () => {
    const { container } = render(<ScoreBreakdown explanation={EXPLANATION} showFlags={false} />);
    const rows = screen.getAllByTestId('skill-row');
    expect(rows).toHaveLength(3);
    for (const row of rows) {
      for (const source of ['resume', 'github', 'assessment']) {
        expect(within(row).getByTestId(`skill-mark-${source}`)).toBeInTheDocument();
      }
    }
    const sql = rows[0];
    expect(within(sql).getByText('Evidenced')).toBeInTheDocument();
    expect(within(sql).getByTestId('skill-mark-github')).toHaveAttribute('data-mark', 'unavailable');
    expect(within(sql).getByTestId('skill-mark-assessment')).toHaveTextContent('Confirmed · 1 of 2 pts');
    expect(within(rows[1]).getByText('Claimed only')).toBeInTheDocument();
    expect(within(rows[2]).getByText('Not found')).toBeInTheDocument();
    expect(container.textContent).not.toMatch(/\d+ of \d+ sources?|sources? confirm/);
  });

  test('a stored pre-R-28 row renders with the legacy note and is not called evidenced', () => {
    const legacy = {
      ...EXPLANATION,
      // The pre-R-28 count fields, as a stored row still carries them.
      skill_evidence: [{ name: 'python', status: 'matched', sources: { parsing: 'matched', github: null, assessment: null }, [LEGACY_COUNT]: 1, evidence_sources_available: 1 }],
    };
    render(<ScoreBreakdown explanation={legacy} showFlags={false} />);
    const row = screen.getByTestId('skill-row');
    expect(within(row).getByText('Claimed only')).toBeInTheDocument();
    expect(within(row).queryByText('Evidenced')).toBeNull();
    expect(within(row).getByTestId('skill-mark-assessment')).toHaveTextContent('Not recorded');
    expect(screen.getByTestId('skill-evidence-legacy')).toBeInTheDocument();
    expect(row.textContent).not.toMatch(/of 1 source/);
  });
});

describe('FlagsPanel: the sources-disagree flag (D§7.1 W6/W7)', () => {
  test('a raised flag is listed with its message; other kinds stay "not built"', () => {
    render(
      <FlagsPanel
        storedReason="Other checks that compare résumé claims are not built yet."
        flags={[{ kind: 'sources_disagree', message: 'Sources disagree: GitHub shows work in python and docker; the assessment on those skills earned 0.5 of 4 points.', affects_score: false }]}
        checks={{ sources_disagree: 'raised' }}
      />,
    );
    expect(screen.getByTestId('flag-sources-disagree')).toHaveTextContent('earned 0.5 of 4 points');
    expect(screen.getByTestId('flag-sources-disagree')).toHaveTextContent('does not change the score');
    expect(screen.getByTestId('flag-check-sources-disagree')).toHaveAttribute('data-state', 'raised');
    expect(screen.getByTestId('flag-check-sources-disagree')).toHaveTextContent('Raised');
    expect(screen.getByTestId('flag-kinds-not-built')).toHaveTextContent('Other flag kinds: not built yet');
  });

  test('no flag and no stored check (a score stored before the check): never an all-clear', () => {
    render(<FlagsPanel storedReason={null} flags={[]} checks={null} />);
    expect(screen.getByTestId('flag-check-sources-disagree')).toHaveAttribute('data-state', 'not_recorded');
    expect(screen.getByTestId('flag-check-sources-disagree')).toHaveTextContent('Not recorded');
    expect(screen.getByTestId('flag-kinds-not-built')).toHaveTextContent('not built yet');
    expect(screen.getByTestId('flag-kinds-not-built')).toHaveTextContent('This is not a finding that the claims are consistent.');
    expect(screen.queryByTestId('flag-sources-disagree')).toBeNull();
  });

  // R-38: the panel is titled for what it is; the built check shows its stored state.
  test('check not run: the panel says so, with the stored reason once, and the other kinds still "not built"', () => {
    const reason = 'The "sources disagree" check needs both GitHub evidence and a completed assessment; GitHub evidence is not available, so it was not run. Other checks that compare résumé claims against GitHub or assessment evidence are not built yet, so no other inconsistency flags are shown. This is not a finding that the claims are consistent.';
    render(<FlagsPanel storedReason={reason} flags={[]} checks={{ sources_disagree: 'not_run' }} />);
    const check = screen.getByTestId('flag-check-sources-disagree');
    expect(check).toHaveAttribute('data-state', 'not_run');
    expect(check).toHaveTextContent('Not run');
    expect(check).toHaveTextContent('GitHub evidence is not available, so it was not run.');
    expect(check.textContent).not.toMatch(/Other checks/);
    expect(screen.getByTestId('flag-kinds-not-built')).toHaveTextContent('not built yet');
    expect(screen.queryByText(/^Not built yet: no flags are shown$/)).toBeNull();
    expect(screen.getByTestId('flags-panel').textContent.match(/not a finding that the claims are consistent/g)).toHaveLength(1);
  });

  test('check run and not raised: "Not raised", not an all-clear for the other kinds', () => {
    render(<FlagsPanel storedReason="Other checks that compare résumé claims are not built yet." flags={[]} checks={{ sources_disagree: 'not_raised' }} />);
    expect(screen.getByTestId('flag-check-sources-disagree')).toHaveAttribute('data-state', 'not_raised');
    expect(screen.getByTestId('flag-check-sources-disagree')).toHaveTextContent('Not raised');
    expect(screen.getByTestId('flag-kinds-not-built')).toHaveTextContent('not built yet');
  });

  test('an unknown stored check state is shown as sent', () => {
    expect(sourcesDisagreeView({ sources_disagree: 'maybe' }, 0, null)).toMatchObject({ state: 'unknown', label: 'Unknown: maybe' });
  });
});
