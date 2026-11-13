import {
  SUBSCORES, assessmentStateText, countsByJob, dashboardCounts, describeVoid, filterByStatus,
  resettableAttempt, scoringFailureText, statusFilterOptions, statusText, subscoreTestId, withStatus,
} from './applicationsLogic';

// Rows in the GET /api/recruiter/applications list-item shape (analysis.controller.js R-13 header).
const row = (over = {}) => ({
  id: 'a1',
  status: 'submitted',
  applied_at: '2026-11-13T10:00:00.000Z',
  job: { id: 'j1', title: 'Backend' },
  candidate: { id: 'c1', name: 'Ada', email: 'ada@example.com' },
  score: null,
  scoring: { state: 'pending' },
  assessment: { state: 'not_prepared', assessment_id: null, attempts: { used: 0, max: 1 }, score_of_record: null, voided: [] },
  ...over,
});

const scored = (composite, extra = {}) => ({
  score: { id: 's', composite, band: 'medium', evidence_limited: false, subscores: {}, skills: [], created_at: null, ...extra },
  scoring: { state: 'scored' },
});

describe('status vocabulary and filter', () => {
  test('filter always offers the written statuses, plus any other status present, with counts', () => {
    const items = [row({ id: 'a', status: 'submitted' }), row({ id: 'b', status: 'shortlisted' }), row({ id: 'c', status: 'withdrawn' })];
    const opts = statusFilterOptions(items);
    expect(opts.map((o) => o.value)).toEqual(['all', 'submitted', 'shortlisted', 'rejected', 'withdrawn']);
    expect(opts.find((o) => o.value === 'rejected').count).toBe(0);
    expect(opts.find((o) => o.value === 'all').count).toBe(3);
  });

  test('filterByStatus keeps server order and "all" returns everything', () => {
    const items = [row({ id: 'a', status: 'rejected' }), row({ id: 'b', status: 'submitted' }), row({ id: 'c', status: 'rejected' })];
    expect(filterByStatus(items, 'rejected').map((i) => i.id)).toEqual(['a', 'c']);
    expect(filterByStatus(items, 'all')).toBe(items);
  });

  test('withStatus changes only the status of the named row', () => {
    const items = [row({ id: 'a' }), row({ id: 'b' })];
    const next = withStatus(items, 'b', 'shortlisted');
    expect(next[1].status).toBe('shortlisted');
    expect(next[0]).toBe(items[0]);
    expect(items[1].status).toBe('submitted');
  });

  test('an unknown status is shown as sent', () => {
    expect(statusText('mystery').label).toBe('mystery');
  });
});

describe('assessment state words', () => {
  test.each([
    ['not_prepared', 'Not prepared yet'],
    ['preparing', 'Being prepared'],
    ['unavailable', 'Not ready'],
    ['ready', 'Ready, not started'],
    ['in_progress', 'In progress'],
    ['grading_pending', 'Submitted, grading pending'],
    ['attempts_used', 'Attempts used, no result'],
  ])('%s reads "%s"', (state, label) => {
    expect(assessmentStateText({ state }).label).toBe(label);
  });

  test('completed names the score of record exactly as sent', () => {
    expect(assessmentStateText({ state: 'completed', score_of_record: { score: 72.5 } }).label).toBe('Completed: 72.5');
    expect(assessmentStateText({ state: 'completed', score_of_record: null }).label).toBe('Completed');
  });

  test('unavailable names the reason code, never an invented cause', () => {
    expect(assessmentStateText({ state: 'unavailable', reason: 'llm_unavailable' }).hint).toBe('Not ready: reason code llm_unavailable.');
    expect(assessmentStateText({ state: 'unavailable', reason: 'pool_missing' }).hint).toMatch(/question set is missing/);
  });
});

describe('reset records', () => {
  const v = { by: 'u-1', role: 'recruiter', at: '2026-11-13T12:00:00.000Z', reason: 'Lost connection', prior_state: 'in_progress' };

  test('who is "you" for the current recruiter, else role and account id', () => {
    expect(describeVoid(v, 'u-1').who).toBe('you');
    expect(describeVoid(v, 'u-2').who).toBe('recruiter (account u-1)');
    expect(describeVoid({ ...v, role: 'system', reason: 'pool_missing' }, 'u-1').who).toBe('the system (automatic)');
  });

  test('why and when come from the record', () => {
    const d = describeVoid(v, null);
    expect(d.reason).toBe('Lost connection');
    expect(d.at).toBe(v.at);
    expect(d.prior).toBe('in progress');
  });

  test('the reset target is the newest started attempt that is not voided', () => {
    const items = [
      { assessmentId: 'x1', state: 'voided', voided: v },
      { assessmentId: 'x2', state: 'completed', voided: null },
      { assessmentId: 'x3', state: 'ready', voided: null },
    ];
    expect(resettableAttempt(items).assessmentId).toBe('x2');
    expect(resettableAttempt([{ assessmentId: 'x3', state: 'ready', voided: null }])).toBeNull();
    expect(resettableAttempt([])).toBeNull();
  });
});

describe('dashboard counts come from the list only', () => {
  test('each count is a plain count of list rows', () => {
    const items = [
      row({ id: 'a', status: 'shortlisted', ...scored(81.2, { evidence_limited: true }) }),
      row({ id: 'b', status: 'submitted', ...scored(55) }),
      row({ id: 'c', status: 'rejected', job: { id: 'j2', title: 'Data' } }),
      row({
        id: 'd',
        status: 'submitted',
        assessment: { state: 'completed', attempts: { used: 1, max: 1 }, score_of_record: { score: 60 }, voided: [{ by: 'u', role: 'recruiter', at: null, reason: 'r' }] },
      }),
    ];
    expect(dashboardCounts(items)).toEqual({
      total: 4,
      scored: 2,
      notScored: 2,
      evidenceLimited: 1,
      submitted: 2,
      shortlisted: 1,
      rejected: 1,
      assessmentsCompleted: 1,
      withReset: 1,
    });
    expect(countsByJob(items)).toEqual([
      { jobId: 'j1', title: 'Backend', total: 3, scored: 2, shortlisted: 1 },
      { jobId: 'j2', title: 'Data', total: 1, scored: 0, shortlisted: 0 },
    ]);
  });

  test('an empty list counts zero everywhere', () => {
    expect(dashboardCounts([]).total).toBe(0);
    expect(countsByJob([])).toEqual([]);
  });
});

describe('scoring and sub-score labels', () => {
  test('a failed scoring reason is named; an unknown code is shown as sent', () => {
    expect(scoringFailureText('parser_unavailable')).toBe('Scoring did not complete: the resume parser is not available.');
    expect(scoringFailureText('new_code')).toBe('Scoring did not complete: reason code new_code.');
  });

  test('sub-score test ids map the three backend keys', () => {
    expect(SUBSCORES.map((s) => s.key)).toEqual(['parsing_semantic_alignment', 'github_evidence', 'assessment_results']);
    expect(subscoreTestId('github_evidence')).toBe('subscore-github');
    expect(subscoreTestId('other')).toBeNull();
  });
});
