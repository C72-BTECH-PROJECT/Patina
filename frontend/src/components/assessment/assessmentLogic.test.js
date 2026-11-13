// R-17: the assessment page's pure logic. Run from frontend/:
//   CI=true npx react-scripts test --watchAll=false src/components/assessment
import {
  answersFromSaved, answersPayload, canStart, candidateResultView, clockAnchor, formatClock,
  isTimeUp, limitMinutes, outcomeOf, pollDelayFor, questionView, remainingMs, saveErrorAction,
  screenFor, shouldAutoSubmit, timeLimitOf,
} from './assessmentLogic';

describe('remaining time from expires_at and server_time', () => {
  test('is expires_at - server_time, whatever the browser clock says', () => {
    const anchor = clockAnchor('2026-11-13T10:15:00.000Z', '2026-11-13T10:05:30.000Z', 1000);
    expect(remainingMs(anchor, 1000)).toBe(9.5 * 60 * 1000);
  });

  test('counts down with the monotonic timer between responses', () => {
    const anchor = clockAnchor('2026-11-13T10:15:00.000Z', '2026-11-13T10:14:00.000Z', 5000);
    expect(remainingMs(anchor, 5000 + 20000)).toBe(40000);
    expect(formatClock(remainingMs(anchor, 5000 + 20000))).toBe('00:40');
  });

  test('never goes below zero', () => {
    const anchor = clockAnchor('2026-11-13T10:15:00.000Z', '2026-11-13T10:14:59.000Z', 0);
    expect(remainingMs(anchor, 60000)).toBe(0);
  });

  test('a server_time already past expires_at reads as zero', () => {
    const anchor = clockAnchor('2026-11-13T10:15:00.000Z', '2026-11-13T10:16:00.000Z', 0);
    expect(remainingMs(anchor, 0)).toBe(0);
  });

  test('missing or unreadable times give no anchor and no clock', () => {
    expect(clockAnchor(null, '2026-11-13T10:00:00Z', 0)).toBeNull();
    expect(clockAnchor('2026-11-13T10:00:00Z', 'nonsense', 0)).toBeNull();
    expect(remainingMs(null, 0)).toBeNull();
    expect(formatClock(null)).toBe('--:--');
  });

  test('formatClock rounds up so 00:00 appears only at zero', () => {
    expect(formatClock(15 * 60 * 1000)).toBe('15:00');
    expect(formatClock(1)).toBe('00:01');
    expect(formatClock(0)).toBe('00:00');
  });

  test('the start screen limit is the one status reports, never a default', () => {
    expect(timeLimitOf({ state: 'ready', time_limit_minutes: 25 })).toBe(25);
    expect(timeLimitOf({ state: 'ready' })).toBeNull();
    expect(timeLimitOf({ time_limit_minutes: null })).toBeNull();
    expect(timeLimitOf(null)).toBeNull();
  });

  test('the whole limit comes from the server times', () => {
    expect(limitMinutes('2026-11-13T10:00:00Z', '2026-11-13T10:15:00Z')).toBe(15);
    expect(limitMinutes(null, '2026-11-13T10:15:00Z')).toBeNull();
  });
});

describe('automatic submit at zero', () => {
  const anchor = clockAnchor('2026-11-13T10:15:00.000Z', '2026-11-13T10:14:50.000Z', 0);

  test('not before zero', () => {
    expect(isTimeUp(anchor, 9999)).toBe(false);
    expect(shouldAutoSubmit({ anchor, monoNow: 9999, submitStarted: false })).toBe(false);
  });

  test('at zero, once', () => {
    expect(isTimeUp(anchor, 10000)).toBe(true);
    expect(shouldAutoSubmit({ anchor, monoNow: 10000, submitStarted: false })).toBe(true);
    expect(shouldAutoSubmit({ anchor, monoNow: 10000, submitStarted: true })).toBe(false);
  });

  test('never without a clock', () => {
    expect(shouldAutoSubmit({ anchor: null, monoNow: 1e9, submitStarted: false })).toBe(false);
  });

  test('a save answered 409 time_expired leads to submit, not an error', () => {
    expect(saveErrorAction({ status: 409, error: 'time_expired' })).toBe('submit');
  });
});

describe('state to screen', () => {
  test.each([
    ['not_applied', 'not_applied'],
    ['preparing', 'preparing'],
    ['unavailable', 'unavailable'],
    ['ready', 'start'],
    ['in_progress', 'questions'],
    ['grading_pending', 'grading_pending'],
    ['completed', 'result'],
    ['attempts_used', 'attempts_used'],
  ])('%s -> %s', (state, screen) => {
    expect(screenFor(state)).toBe(screen);
  });

  test('an unrecognised state is shown as unrecognised, never guessed', () => {
    expect(screenFor('not_prepared')).toBe('unknown');
    expect(screenFor(undefined)).toBe('unknown');
    expect(screenFor('toString')).toBe('unknown');
  });

  test('Start is offered only on ready', () => {
    expect(canStart('ready')).toBe(true);
    for (const s of ['preparing', 'unavailable', 'in_progress', 'completed', 'attempts_used', 'not_applied']) {
      expect(canStart(s)).toBe(false);
    }
  });

  test('polling: preparing every few seconds, unavailable after the server gate, none when settled', () => {
    expect(pollDelayFor('preparing')).toBe(3000);
    expect(pollDelayFor('unavailable', { retry_after_seconds: 42 })).toBe(42000);
    expect(pollDelayFor('unavailable', { retry_after_seconds: 0.2 })).toBe(5000);
    expect(pollDelayFor('unavailable', {})).toBe(30000);
    expect(pollDelayFor('grading_pending')).toBe(10000);
    for (const s of ['ready', 'in_progress', 'completed', 'attempts_used', 'not_applied']) {
      expect(pollDelayFor(s)).toBeNull();
    }
  });
});

describe('answers', () => {
  test('saved answers restore by question id', () => {
    expect(answersFromSaved([{ question_id: 'q1', response: 'B' }, { question_id: 'q2', response: 'text' }, null]))
      .toEqual({ q1: 'B', q2: 'text' });
    expect(answersFromSaved(undefined)).toEqual({});
  });

  test('the evaluate payload covers every served question, empty when unanswered', () => {
    expect(answersPayload({ q1: 'A' }, [{ question_id: 'q1' }, { question_id: 'q2' }]))
      .toEqual([{ question_id: 'q1', response: 'A' }, { question_id: 'q2', response: '' }]);
  });

  test('save errors: retry what may pass, stop on a closed attempt, fail a bad request', () => {
    expect(saveErrorAction({ status: 0, error: 'network_error' })).toBe('retry');
    expect(saveErrorAction({ status: 502, error: 'upstream_unavailable' })).toBe('retry');
    expect(saveErrorAction({ status: 409, error: 'save_conflict' })).toBe('retry');
    expect(saveErrorAction({ status: 409, error: 'already_submitted' })).toBe('closed');
    expect(saveErrorAction({ status: 409, error: 'attempt_voided' })).toBe('closed');
    expect(saveErrorAction({ status: 400, error: 'unknown_question' })).toBe('fail');
  });
});

describe('nothing that reveals an answer is ever rendered', () => {
  const leaky = {
    assessmentId: 'a1',
    state: 'completed',
    score: 70,
    points_earned: 7,
    points_possible: 10,
    correct_option: 'LEAK-OPTION',
    answer_key: [{ question_id: 'q1', correct_option: 'LEAK-KEY' }],
    skills: [{ skill: 'react', questions: 2, correct: 1, points_earned: 1.5, points_possible: 2, ideal_answer: 'LEAK-SKILL' }],
    results: [
      { question_id: 'q1', question_type: 'mcq', question: 'Which hook runs after render?', skill: 'react', correct: true, points: 1, max_points: 1,
        candidate_feedback: 'Right.', correct_option: 'LEAK-C', correct_answer: 'LEAK-CA', explanation: 'LEAK-E',
        options: [{ label: 'A', text: 'LEAK-OPT', is_correct: true }] },
      { question_id: 'q2', question_type: 'short_answer', skill: 'react', correct: false, points: 0.5, max_points: 1,
        candidate_feedback: 'Partly.', ideal_answer: 'LEAK-I', key_points: ['LEAK-K'], recruiter_feedback: 'LEAK-R' },
    ],
    scoring: { status: 'scored', reason: null },
  };

  test('the result view keeps the candidate-safe fields only', () => {
    const view = candidateResultView(leaky);
    expect(JSON.stringify(view)).not.toMatch(/LEAK|correct_option|correct_answer|ideal|key_points|explanation|recruiter|answer_key/);
    expect(view.score).toBe(70);
    expect(view.results.map(outcomeOf)).toEqual(['right', 'partly right']);
    expect(view.results[1].candidate_feedback).toBe('Partly.');
    expect(view.skills[0]).toEqual({ skill: 'react', questions: 2, correct: 1, points_earned: 1.5, points_possible: 2 });
  });

  test('a completed status result (same shape as evaluate, no scoring) renders through the same whitelist', () => {
    const { scoring, ...fromStatus } = leaky;
    const view = candidateResultView(fromStatus);
    expect(JSON.stringify(view)).not.toMatch(/LEAK|correct_option|ideal|key_points|recruiter/);
    expect(view.scoring).toBeNull();
    expect(view.results).toHaveLength(2);
    // The question text comes with the result (it survives a reload); options never do.
    expect(view.results[0].question).toBe('Which hook runs after render?');
    expect(view.results[1].question).toBeNull();
    expect(JSON.stringify(view)).not.toMatch(/options|is_correct/);
  });

  test('the question view drops any key field a question carried', () => {
    const q = questionView({
      question_id: 'q1', question_type: 'mcq', question: 'Which?', skill: 'react',
      correct_option: 'LEAK', options: [{ label: 'A', text: 'one', is_correct: true }],
    });
    expect(JSON.stringify(q)).not.toMatch(/LEAK|correct/);
    expect(q.options).toEqual([{ label: 'A', text: 'one' }]);
  });
});
