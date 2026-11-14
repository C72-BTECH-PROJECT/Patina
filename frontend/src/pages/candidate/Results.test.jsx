// R-38: the candidate result page shows the parser's figure as "résumé match to the job
// description" (never its "Strong Match" label as a verdict beside a low or unverified
// composite), the GitHub-account note only when the résumé has a GitHub link, the stored
// summary once, and "Evidence-limited" only where no verification state is shown.
import React from 'react';
import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import Results, { resumeMatchFigure, showGithubOwnershipNote } from './Results';
import { api } from '../../lib/api';

// Jest 27 (react-scripts 5) cannot resolve react-router-dom 7's package exports (as in
// Login.test.jsx): a stand-in Link and the route parameter.
jest.mock('react-router-dom', () => ({
  // eslint-disable-next-line jsx-a11y/anchor-has-content
  Link: ({ to, children, ...rest }) => <a href={to} {...rest}>{children}</a>,
  useParams: () => ({ applicationId: 'app-1' }),
}), { virtual: true });
jest.mock('../../lib/api', () => ({ api: { get: jest.fn(), post: jest.fn() } }));

const NOTE = 'The GitHub account was taken from the link on the résumé. Ownership of that account is not verified, so its evidence may not be the candidate\'s own work.';
const SUMMARY = 'Credibility 14.99/100. Parsing & semantic alignment contributes 20% of the score at 74.95/100 — Matched 5 of 6 job skills (from the listed skills); missing: jira. Unverified: résumé claims only.';

const factor = (key, label, available, value, weight, reason = null) => ({
  key, label, available, direction: available ? 'sole' : 'unavailable', weight, weight_pct: Math.round(weight * 100),
  value, contribution: available ? Math.round(value * weight * 100) / 100 : 0, reason, evidence: [],
});

const scoreWith = ({ github = null, githubSub = { available: false, value: null, weight: 0, reason: 'No GitHub link on the résumé.', components: { reason_code: 'no_github_link' } }, verification = 'unverified', weightsVersion = 'w2-2026-11-13' } = {}) => ({
  id: 'score-1',
  jobId: 'job-1',
  candidate: { name: 'Sam Support', email: null, phone: null, github, linkedin: null, links: [] },
  extractedSkills: ['linux'],
  experience: [],
  education: [],
  projects: [],
  credibilityScore: 14.99,
  band: 'low',
  verification,
  weightsVersion,
  matchLevel: 'Strong Match',
  evidenceLimited: true,
  subScores: {
    parsing_semantic_alignment: { available: true, value: 74.95, weight: 0.2, components: { match_level: 'Strong Match' } },
    github_evidence: githubSub,
    assessment_results: { available: false, value: null, weight: 0, reason: 'No completed assessment.' },
  },
  explanation: {
    version: 1,
    summary: SUMMARY,
    verification,
    weights_version: weightsVersion,
    unearned_weight: 0.45,
    github_account: { source: 'resume_link', ownership_verified: false, note: NOTE },
    factors: [
      factor('parsing_semantic_alignment', 'Parsing & semantic alignment', true, 74.95, 0.2),
      factor('github_evidence', 'GitHub evidence', githubSub.available === true, githubSub.value, githubSub.weight, githubSub.reason),
      factor('assessment_results', 'Assessment results', false, null, 0, 'No completed assessment.'),
    ],
    flags: [],
    flag_checks: { sources_disagree: 'not_run' },
    flags_unavailable_reason: 'The "sources disagree" check needs both GitHub evidence and a completed assessment; GitHub evidence is not available, so it was not run.',
  },
});

const showResult = async (score) => {
  api.get.mockResolvedValueOnce({
    application: { id: 'app-1', job_id: 'job-1', job_title: 'IT support analyst', status: 'submitted', submitted_at: null },
    scoring: { state: 'scored' },
    score,
  });
  render(<Results />);
  await screen.findByTestId('application-score');
};

afterEach(() => jest.clearAllMocks());

test('no "Strong Match" verdict beside a low, unverified composite; the figure is the résumé match to the job description', async () => {
  await showResult(scoreWith());
  expect(screen.queryByText(/Strong Match/i)).toBeNull();
  expect(screen.getByTestId('resume-match')).toHaveTextContent('Résumé match to the job description: 74.95/100');
  expect(screen.getByTestId('resume-match')).toHaveTextContent('not a verdict');
});

test('the stored summary is printed once', async () => {
  await showResult(scoreWith());
  expect(screen.getAllByText(SUMMARY)).toHaveLength(1);
});

test('no GitHub link on the résumé -> no GitHub-account note', async () => {
  await showResult(scoreWith());
  expect(screen.queryByTestId('github-ownership-note')).toBeNull();
  expect(screen.queryByText(NOTE)).toBeNull();
});

test('a GitHub link on the résumé (evidence unavailable for another reason) -> the note is shown', async () => {
  await showResult(scoreWith({
    github: 'https://github.com/example-sam',
    githubSub: { available: false, value: null, weight: 0, reason: 'The GitHub evidence service did not answer.', components: { reason_code: 'service_error' } },
  }));
  expect(screen.getByTestId('github-ownership-note')).toHaveTextContent(NOTE);
});

test('"Evidence-limited" is not shown beside a verification state', async () => {
  await showResult(scoreWith());
  expect(screen.getAllByTestId('verification-badge')[0]).toHaveTextContent('Unverified');
  expect(screen.queryByText('Evidence-limited')).toBeNull();
});

test('a v1 row with no verification state still shows "Evidence-limited"', async () => {
  await showResult(scoreWith({ verification: null, weightsVersion: null }));
  expect(screen.queryByTestId('verification-badge')).toBeNull();
  expect(screen.getAllByText('Evidence-limited').length).toBeGreaterThan(0);
});

test('helpers: the figure is null when parsing has no value; the note needs a link or GitHub evidence', () => {
  expect(resumeMatchFigure({ subScores: { parsing_semantic_alignment: { available: false, value: null } } })).toBeNull();
  expect(resumeMatchFigure({ subScores: {} })).toBeNull();
  expect(resumeMatchFigure({ subScores: { parsing_semantic_alignment: { available: true, value: 0 } } })).toBe(0);
  const base = { explanation: { github_account: { note: NOTE } } };
  expect(showGithubOwnershipNote({ ...base, subScores: { github_evidence: { available: true, value: 60 } }, candidate: { github: null } })).toBe(true);
  expect(showGithubOwnershipNote({ ...base, subScores: { github_evidence: { available: false, components: { reason_code: 'no_github_link' } } }, candidate: { github: 'https://github.com/x' } })).toBe(false);
  expect(showGithubOwnershipNote({ ...base, subScores: { github_evidence: { available: false, components: { reason_code: 'service_disabled' } } }, candidate: { github: null } })).toBe(false);
  expect(showGithubOwnershipNote({ subScores: { github_evidence: { available: true } } })).toBe(false);
});
