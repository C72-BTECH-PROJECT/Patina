// R-27 (REBUILD/DECISIONS.md §7.1): the verification state, the weights version and the
// "Awaiting assessment" state as the recruiter and candidate views render them.
import React from 'react';
import '@testing-library/jest-dom';
import { render, screen, waitFor, within } from '@testing-library/react';
import {
  LEGACY_WEIGHTS_LABEL, partialScoreLabel, showEvidenceLimited, verificationView, weightsVersionLabel,
} from '../ScoreBadge';
import ScoreBreakdown from './ScoreBreakdown';
import { ScoreCell } from './ApplicationsTable';
import CandidateModal from './CandidateModal';
import { api } from '../../lib/api';

jest.mock('../../lib/api', () => {
  const actual = jest.requireActual('../../lib/api');
  return { ...actual, api: { ...actual.api, get: jest.fn(), post: jest.fn() } };
});

const P = 'parsing_semantic_alignment';
const G = 'github_evidence';
const A = 'assessment_results';

const factor = (key, available, value, weight) => ({
  key, label: key, available, direction: available ? 'neutral' : 'unavailable', weight,
  weight_pct: Math.round(weight * 100), value: available ? value : null,
  contribution: available ? Math.round(value * weight * 100) / 100 : 0, reason: available ? null : 'Not available.', evidence: [],
});

// A row scored before R-27: no weights_version, v1 weights, renormalised.
const V1_EXPLANATION = {
  version: 1, composite: 84.84, band: 'high', summary: 'Credibility 84.84/100.',
  factors: [factor(P, true, 84.84, 1), factor(G, false, null, 0), factor(A, false, null, 0)],
  weighting_scheme: { base_weights: { [P]: 0.4, [G]: 0.35, [A]: 0.25 } },
  evidence_limited: true, skill_evidence: [],
};

// A row scored under w2: GitHub answered, no assessment yet.
const W2_EXPLANATION = {
  version: 1, composite: 47.25, band: 'low', weights_version: 'w2-2026-11-13',
  verification: 'partly_verified', unearned_weight: 0.45,
  verification_note: 'Partly verified by GitHub activity. Completing the assessment would verify it further.',
  summary: 'Credibility 47.25/100. Partly verified by GitHub activity.',
  factors: [factor(P, true, 60, 0.2), factor(G, true, 100, 0.35), factor(A, false, null, 0)],
  weighting_scheme: { version: 'w2-2026-11-13', base_weights: { [P]: 0.2, [G]: 0.35, [A]: 0.45 } },
  evidence_limited: true, skill_evidence: [],
};

describe('ScoreBadge helpers', () => {
  test('verification values have their own labels; an unknown one is shown as sent', () => {
    expect(verificationView('unverified').label).toBe('Unverified');
    expect(verificationView('partly_verified').label).toBe('Partly verified');
    expect(verificationView('verified').label).toBe('Verified');
    expect(verificationView('mostly').label).toBe('Unknown verification: mostly');
    expect(verificationView(null)).toBeNull();
  });

  test('a stored row with no weights version is labelled v1 (0.40 / 0.35 / 0.25)', () => {
    expect(LEGACY_WEIGHTS_LABEL).toBe('v1 (0.40 / 0.35 / 0.25)');
    expect(weightsVersionLabel(V1_EXPLANATION)).toBe('v1 (0.40 / 0.35 / 0.25)');
    expect(weightsVersionLabel(null)).toBe('v1 (0.40 / 0.35 / 0.25)');
    expect(weightsVersionLabel(W2_EXPLANATION)).toBe('w2-2026-11-13');
  });

  test('the partial-score label names the sources the partial score is made of', () => {
    expect(partialScoreLabel({ [P]: { available: true }, [G]: { available: false } })).toBe('partial score, résumé');
    expect(partialScoreLabel({ [P]: { available: true }, [G]: { available: true } })).toBe('partial score, résumé and GitHub');
  });
});

describe('ScoreBreakdown and the weights version', () => {
  test('a row scored before R-27 renders with the v1 label and its own redistribution note', () => {
    render(<ScoreBreakdown explanation={V1_EXPLANATION} evidenceLimited showFlags={false} />);
    expect(screen.getByTestId('breakdown-weights-version')).toHaveTextContent('weights v1 (0.40 / 0.35 / 0.25)');
    expect(screen.getByTestId('evidence-limited')).toBeInTheDocument();
    expect(screen.queryByTestId('verification-state')).toBeNull();
  });

  test('a w2 row renders its version, verification badge and unearned share', () => {
    render(<ScoreBreakdown explanation={W2_EXPLANATION} evidenceLimited showFlags={false} />);
    expect(screen.getByTestId('breakdown-weights-version')).toHaveTextContent('weights w2-2026-11-13');
    const state = screen.getByTestId('verification-state');
    expect(within(state).getByTestId('verification-badge')).toHaveTextContent('Partly verified');
    expect(state).toHaveTextContent('45% of the score is not earned');
    expect(screen.queryByTestId('evidence-limited')).toBeNull();
  });
});

describe('recruiter table: Awaiting assessment (D§7.1 W4)', () => {
  const score = {
    id: 's1', composite: 47.25, band: 'low', verification: 'partly_verified', evidence_limited: true,
    subscores: { [P]: { available: true }, [G]: { available: true }, [A]: { available: false } },
  };

  test('an awaiting row leads with the state; the composite is smaller, labelled, the first span, with no band', () => {
    const { container } = render(<ScoreCell item={{ id: 'a1', score, score_state: 'awaiting_assessment' }} />);
    const cell = screen.getByTestId('application-score');
    expect(cell).toHaveAttribute('data-state', 'scored');
    expect(cell).toHaveAttribute('data-score-state', 'awaiting_assessment');
    expect(cell.firstChild).toHaveTextContent('Awaiting assessment');
    expect(cell.querySelector('span')).toHaveTextContent(/^47\.25$/);
    expect(screen.getByTestId('partial-score-label')).toHaveTextContent('partial score, résumé and GitHub');
    expect(container.querySelector('[title^="Score band"]')).toBeNull();
    expect(screen.getByTestId('verification-badge')).toHaveTextContent('Partly verified');
  });

  test('a final row shows the composite with its band and verification', () => {
    const { container } = render(<ScoreCell item={{ id: 'a2', score: { ...score, composite: 76, band: 'medium', verification: 'verified' }, score_state: 'final' }} />);
    expect(screen.queryByTestId('awaiting-assessment')).toBeNull();
    expect(screen.getByTestId('application-score').querySelector('span')).toHaveTextContent(/^76$/);
    expect(container.querySelector('[title^="Score band"]')).toHaveTextContent('Medium');
    expect(screen.getByTestId('verification-badge')).toHaveTextContent('Verified');
  });

  // R-38: "Evidence-limited" beside "Partly verified" read as two verdicts.
  test('a final evidence-limited row with a verification state shows the verification badge, not "Evidence-limited"', () => {
    render(<ScoreCell item={{ id: 'a3', score: { ...score, composite: 52, band: 'low' }, score_state: 'final' }} />);
    expect(screen.getByTestId('verification-badge')).toHaveTextContent('Partly verified');
    expect(screen.queryByText('Evidence-limited')).toBeNull();
  });

  test('an evidence-limited row with no verification state still says "Evidence-limited"', () => {
    render(<ScoreCell item={{ id: 'a4', score: { ...score, composite: 52, band: 'low', verification: null }, score_state: 'final' }} />);
    expect(screen.queryByTestId('verification-badge')).toBeNull();
    expect(screen.getByText('Evidence-limited')).toBeInTheDocument();
  });

  test('showEvidenceLimited: only when evidence-limited and no verification state is shown', () => {
    expect(showEvidenceLimited(true, 'partly_verified')).toBe(false);
    expect(showEvidenceLimited(true, 'unverified')).toBe(false);
    expect(showEvidenceLimited(true, null)).toBe(true);
    expect(showEvidenceLimited(false, null)).toBe(false);
  });
});

describe('recruiter drill-down', () => {
  const detail = (overrides) => ({
    id: 'app-1', status: 'submitted', applied_at: '2026-11-13T10:00:00.000Z',
    job: { id: 'job-1', title: 'Backend engineer' },
    candidate: { id: 'c1', name: 'Asha Rao', email: 'asha@example.test' },
    score: {
      id: 's1', composite: 47.25, band: 'low', verification: 'partly_verified', evidence_limited: true,
      subscores: { [P]: { available: true, value: 60, weight: 0.2 }, [G]: { available: true, value: 100, weight: 0.35 }, [A]: { available: false, value: null, weight: 0, reason: 'x' } },
      created_at: '2026-11-13T10:00:00.000Z',
    },
    scoring: { state: 'scored' },
    score_state: 'awaiting_assessment',
    assessment: { state: 'ready', assessment_id: null, attempts: { used: 0, max: 1 }, score_of_record: null, voided: [], items: [] },
    explanation: W2_EXPLANATION,
    weights: { [P]: 0.2, [G]: 0.35, [A]: 0 },
    score_history: [],
    notes: {},
    ...overrides,
  });

  afterEach(() => api.get.mockReset());

  test('awaiting: "Awaiting assessment" leads; the composite is labelled partial; the unearned share and version are shown', async () => {
    api.get.mockResolvedValue(detail());
    render(<CandidateModal applicationId="app-1" onClose={() => {}} />);
    await waitFor(() => expect(screen.getByTestId('drilldown')).toHaveAttribute('data-state', 'ready'));
    const awaiting = screen.getByTestId('drilldown-awaiting');
    expect(awaiting).toHaveTextContent('Awaiting assessment');
    expect(awaiting).toHaveTextContent('Ready, not started');
    const composite = screen.getByTestId('drilldown-composite');
    expect(composite).toHaveAttribute('data-value', '47.25');
    expect(composite.querySelector('span')).toHaveTextContent(/^47\.25$/);
    expect(within(composite).getByTestId('partial-score-label')).toHaveTextContent('partial score, résumé and GitHub');
    expect(within(composite).queryByTitle(/^Score band/)).toBeNull();
    expect(screen.getByTestId('weight-unearned')).toHaveTextContent('0.45');
    expect(screen.getByTestId('weights-version')).toHaveTextContent('Weights version: w2-2026-11-13');
  });

  test('a row scored before R-27 shows "v1 (0.40 / 0.35 / 0.25)" in the weights section', async () => {
    api.get.mockResolvedValue(detail({
      score_state: 'final',
      assessment: { state: 'completed', assessment_id: null, attempts: { used: 1, max: 1 }, score_of_record: null, voided: [], items: [] },
      score: { id: 's0', composite: 84.84, band: 'high', verification: 'unverified', evidence_limited: true, subscores: {}, created_at: null },
      explanation: V1_EXPLANATION,
      weights: { [P]: 1, [G]: 0, [A]: 0 },
    }));
    render(<CandidateModal applicationId="app-1" onClose={() => {}} />);
    await waitFor(() => expect(screen.getByTestId('drilldown')).toHaveAttribute('data-state', 'ready'));
    expect(screen.queryByTestId('drilldown-awaiting')).toBeNull();
    expect(screen.getByTestId('weights-version')).toHaveTextContent('Weights version: v1 (0.40 / 0.35 / 0.25)');
    expect(screen.queryByTestId('weight-unearned')).toBeNull();
  });
});
