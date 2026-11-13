// T-0014 criteria 4-9 (offline): the explainability layer with GitHub evidence.
// Inputs are the f1 NLP snapshot (tests/nlp/snapshots/current/f1_dev_github.json)
// and the synthetic service response (fixtures/github-evidence-example-mokafor.json).
//
//   node --test tests/backend/explainability.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { REPO_DIR, TESTS_DIR } from './lib/env.mjs';

// BASE_WEIGHTS is read once at import; these assertions are about the defaults.
delete process.env.CREDIBILITY_WEIGHTS;
const X = await import(
  new URL(`file:///${join(REPO_DIR, 'backend', 'Services', 'explainability.js').replace(/\\/g, '/')}`)
);
const { buildScoreRecord, buildGithubSubScore, GITHUB_REASONS, SUBSCORE_KEYS } = X;
const { buildParsingSubScore, scoreBand, SCORE_BAND_THRESHOLDS, PARSING_REASONS, GITHUB_OWNERSHIP_NOTE } = X;

const NLP = JSON.parse(readFileSync(join(TESTS_DIR, 'nlp', 'snapshots', 'current', 'f1_dev_github.json'), 'utf8'));
const FIXTURE = JSON.parse(readFileSync(join(TESTS_DIR, 'backend', 'fixtures', 'github-evidence-example-mokafor.json'), 'utf8'));
const GITHUB_OK = { ok: true, evidence: FIXTURE, requestId: 't0014-unit' };

// ROADMAP §1.3, plus insufficient_evidence (owner decision D1, I-0047).
const REASON_CODES = [
  'no_github_link', 'invalid_github_link', 'github_user_not_found', 'no_public_repositories',
  'insufficient_evidence', 'github_rate_limited', 'service_unavailable', 'timeout', 'service_error',
  'service_disabled',
  // R-06's code, mapped through by core since R-10 (was service_error).
  'no_recent_public_activity',
];

const P = SUBSCORE_KEYS.PARSING;
const G = SUBSCORE_KEYS.GITHUB;
const A = SUBSCORE_KEYS.ASSESSMENT;
const round2 = (n) => Math.round(n * 100) / 100;
const near = (actual, expected, eps, msg) =>
  assert.ok(Math.abs(actual - expected) <= eps, `${msg}: ${actual} vs ${expected}`);

test('redistributes weights over available sources', () => {
  for (const record of [buildScoreRecord(NLP), buildScoreRecord(NLP, { github: { ok: false, reasonCode: 'timeout' } })]) {
    assert.equal(record.weights[P], 1);
    assert.equal(record.weights[G], 0);
    assert.equal(record.weights[A], 0);
    assert.equal(record.evidence_limited, true);
    assert.equal(record.composite, record.subscores[P].value);
  }

  const both = buildScoreRecord(NLP, { github: GITHUB_OK });
  near(both.weights[P], 0.40 / 0.75, 1e-4, 'parsing weight');
  near(both.weights[G], 0.35 / 0.75, 1e-4, 'github weight');
  assert.equal(both.weights[A], 0);
  assert.equal(both.subscores[G].available, true);
  const expected = both.subscores[P].value * both.weights[P] + both.subscores[G].value * both.weights[G];
  near(both.composite, expected, 0.01, 'composite is the weighted sum');
  assert.equal(both.evidence_limited, true, 'assessment is still missing');
});

test('every GitHub reason is unavailable, never zero', () => {
  const parsingOnly = buildScoreRecord(NLP).composite;
  const texts = new Set();
  for (const code of REASON_CODES) {
    const sub = buildGithubSubScore({ ok: false, reasonCode: code });
    assert.equal(sub.available, false, code);
    assert.equal(sub.value, null, code);
    assert.equal(sub.weight, 0, code);
    assert.ok(typeof sub.reason === 'string' && sub.reason.trim().length > 0, `${code}: empty reason`);
    assert.equal(sub.components?.reason_code, code);
    texts.add(sub.reason);

    const record = buildScoreRecord(NLP, { github: { ok: false, reasonCode: code } });
    assert.equal(record.subscores[G].components.reason_code, code);
    assert.equal(record.composite, parsingOnly, `${code}: an unavailable source must not lower the composite`);
  }
  assert.equal(texts.size, REASON_CODES.length, 'each reason has its own text');

  const legacy = buildScoreRecord(NLP).subscores[G];
  assert.equal(legacy.components.reason_code, 'service_disabled', 'no github argument = service_disabled');
  assert.match(legacy.reason, /not part of this deployment/);
});

test('builds the GitHub sub-score', () => {
  const sub = buildGithubSubScore(GITHUB_OK);
  assert.equal(sub.key, G);
  assert.equal(sub.available, true);
  assert.equal(sub.reason, null);
  assert.equal(sub.value, round2(FIXTURE.sub_score.value * 100));

  const c = sub.components;
  assert.equal(c.username, 'example-mokafor');
  assert.equal(c.request_id, 't0014-unit');
  assert.equal(c.fetched_at, FIXTURE.fetched_at);
  assert.equal(c.contract_version, FIXTURE.contract_version);
  assert.equal(c.status, 'complete');
  for (const k of ['listed', 'owned', 'forked', 'archived', 'considered', 'truncated']) {
    assert.equal(c.repositories[k], FIXTURE.repositories[k], `repositories.${k}`);
  }
  assert.deepEqual(c.repositories.items.map((r) => r.name), FIXTURE.repositories.items.map((r) => r.name));
  assert.deepEqual(c.languages, FIXTURE.languages);
  assert.deepEqual(c.commit_activity, FIXTURE.commit_activity);
  assert.deepEqual(c.claims, FIXTURE.claims);
  assert.deepEqual(c.limitations, FIXTURE.limitations);
  assert.deepEqual(
    c.component_weights,
    Object.fromEntries(FIXTURE.sub_score.components.map((x) => [x.key, x.weight]))
  );
  assert.ok(!('_source' in c), 'the fixture marker is not part of the snapshot');

  assert.ok(Array.isArray(sub.evidence) && sub.evidence.length > 0);
  for (const item of sub.evidence) {
    assert.ok(item.type === 'metric' || item.type === 'skill_set', `type: ${item.type}`);
    assert.ok(typeof item.label === 'string' && item.label, 'label');
    if (item.type === 'metric') {
      assert.ok(typeof item.value === 'number' && item.value >= 0 && item.value <= 1, `${item.key}: ${item.value}`);
    } else {
      assert.ok(Array.isArray(item.items) && item.count === item.items.length, item.key);
    }
  }
  const notes = sub.evidence.map((e) => e.note || '').join('\n');
  assert.match(notes, /public repositories only/i, '2.10: public repositories only');
  assert.match(notes, /private/i, '2.10: private work is mentioned');
  assert.match(notes, /not counted against/i, '2.10: private work is not counted against the candidate');

  const evidenced = sub.evidence.find((e) => e.key === 'github_claims_evidenced');
  const notFound = sub.evidence.find((e) => e.key === 'github_claims_not_found');
  assert.deepEqual(evidenced.items, ['python']);
  assert.equal(evidenced.direction, 'positive');
  assert.deepEqual(notFound.items, ['javascript']);
  assert.equal(notFound.direction, 'negative');

  // A partial answer is still available, and its explanation names what is missing.
  const partial = buildGithubSubScore({
    ...GITHUB_OK,
    evidence: {
      ...FIXTURE,
      status: 'partial',
      limitations: [...FIXTURE.limitations, 'repo_detail_failed:lib-core'],
      sub_score: { ...FIXTURE.sub_score, partial: true },
    },
  });
  assert.equal(partial.available, true);
  assert.equal(partial.components.status, 'partial');
  assert.match(partial.evidence.map((e) => e.note || '').join('\n'), /lib-core/);
});

test('fills the GitHub source per skill', () => {
  const rows = buildScoreRecord(NLP, { github: GITHUB_OK }).explanation.skill_evidence;
  const by = Object.fromEntries(rows.map((r) => [r.name, r]));

  assert.equal(by.python.sources.github, 'evidenced');
  assert.equal(by.python.evidence_sources_confirming, 2, 'parsing match + GitHub evidenced');
  assert.equal(by.javascript.sources.github, 'not_found');
  assert.equal(by.javascript.evidence_sources_confirming, 0);
  assert.equal(by.react.sources.github, 'not_checkable');
  assert.equal(by.react.evidence_sources_confirming, 1, 'not_checkable does not confirm');
  assert.equal(by.kubernetes.sources.github, null, 'not claimed, so not checked');
  for (const r of rows) assert.equal(r.evidence_sources_available, 2);

  for (const record of [buildScoreRecord(NLP), buildScoreRecord(NLP, { github: { ok: false, reasonCode: 'timeout' } })]) {
    for (const r of record.explanation.skill_evidence) {
      assert.equal(r.sources.github, null, `${r.name}: GitHub unavailable`);
      assert.equal(r.evidence_sources_available, 1);
    }
  }
});

test('does not claim there are no contradictions', () => {
  const record = buildScoreRecord(NLP, { github: GITHUB_OK });
  assert.equal(record.explanation.flags_available, false);
  assert.deepEqual(record.explanation.flags, []);
  assert.match(record.explanation.flags_unavailable_reason, /not built yet/i);
  for (const r of [record, buildScoreRecord(NLP)]) {
    assert.doesNotMatch(JSON.stringify(r), /no contradictions/i);
  }
});

// T-0023: GitHub and assessment together. Shape of a completed assessment's
// `assessments.evaluation` as assessment-service returns it (T-0025).
const EVALUATION = {
  score: 62.5,
  points_earned: 2.5,
  points_possible: 4,
  short_answer_graded: true,
  results: [
    { question_type: 'mcq', points: 1, max_points: 1 },
    { question_type: 'mcq', points: 0, max_points: 1 },
    { question_type: 'mcq', points: 1, max_points: 1 },
    { question_type: 'short_answer', points: 0.5, max_points: 1 },
  ],
};
const weightSum = (record) => Object.values(record.weights).reduce((sum, w) => sum + w, 0);
const weightedSum = (record) =>
  Object.values(record.subscores).reduce((sum, s) => sum + (s.available ? s.value * s.weight : 0), 0);

test('combines parsing, GitHub and assessment when each is available', () => {
  const all = buildScoreRecord(NLP, { github: GITHUB_OK, assessmentEvaluation: EVALUATION });
  for (const key of [P, G, A]) assert.equal(all.subscores[key].available, true, key);
  near(all.weights[P], 0.40, 1e-4, 'parsing weight');
  near(all.weights[G], 0.35, 1e-4, 'github weight');
  near(all.weights[A], 0.25, 1e-4, 'assessment weight');
  assert.equal(all.subscores[A].value, 62.5);
  assert.equal(all.evidence_limited, false, 'all three sources present');
  assert.equal(all.explanation.factors.length, 3);

  const githubOnly = buildScoreRecord(NLP, { github: GITHUB_OK });
  assert.equal(githubOnly.subscores[A].available, false);
  assert.equal(githubOnly.weights[A], 0);

  const assessmentOnly = buildScoreRecord(NLP, { github: { ok: false, reasonCode: 'timeout' }, assessmentEvaluation: EVALUATION });
  assert.equal(assessmentOnly.subscores[G].available, false);
  assert.equal(assessmentOnly.subscores[G].components.reason_code, 'timeout');
  near(assessmentOnly.weights[P], 0.40 / 0.65, 1e-4, 'parsing weight');
  near(assessmentOnly.weights[A], 0.25 / 0.65, 1e-4, 'assessment weight');

  for (const [name, record] of Object.entries({ all, githubOnly, assessmentOnly })) {
    near(weightSum(record), 1, 1e-3, `${name}: weights sum to 1`);
    near(record.composite, weightedSum(record), 0.01, `${name}: composite is the weighted sum`);
  }
});

// R-11: rebuildScoreRecord (in-place UPDATE of a stored score) is gone; a graded
// attempt inserts a new row through the scoring pipeline.
test('R-11: rebuildScoreRecord no longer exists', () => {
  assert.equal(X.rebuildScoreRecord, undefined);
});

// R-11 (lead's ruling 2026-11-14): parsing unavailable at grading time.
test('R-11: parsingUnavailable -> parsing unavailable with the pipeline code; composite from the rest, evidence-limited', () => {
  const record = buildScoreRecord(NLP, {
    github: { ok: false, reasonCode: 'no_github_link' },
    assessmentEvaluation: EVALUATION,
    parsingUnavailable: 'parser_unavailable',
  });
  const p = record.subscores[P];
  assert.equal(p.available, false);
  assert.equal(p.value, null);
  assert.equal(p.weight, 0);
  assert.equal(p.components.reason_code, 'parser_unavailable');
  assert.equal(p.reason, PARSING_REASONS.parser_unavailable);
  assert.equal(record.weights[A], 1);
  assert.equal(record.composite, record.subscores[A].value);
  assert.equal(record.evidence_limited, true);
  assert.equal(record.band, scoreBand(record.composite));

  const withGithub = buildScoreRecord(null, { github: GITHUB_OK, assessmentEvaluation: EVALUATION, parsingUnavailable: 'storage_error' });
  near(withGithub.weights[G], 0.35 / 0.60, 1e-4, 'github weight');
  near(withGithub.weights[A], 0.25 / 0.60, 1e-4, 'assessment weight');
  assert.equal(withGithub.subscores[P].components.reason_code, 'storage_error');

  const unknown = buildScoreRecord(null, { assessmentEvaluation: EVALUATION, parsingUnavailable: 'not_a_code' });
  assert.equal(unknown.subscores[P].components.reason_code, 'parser_failed');
});

// R-11: recruiter-facing explanation gains per-question outcomes, with only the
// fields a candidate may also see (candidates read their own score rows).
test('R-11: per-question outcomes in the explanation carry no key material', () => {
  const evaluation = {
    ...EVALUATION,
    results: [
      { question_id: 'q1', question_type: 'mcq', skill: 'python', correct: true, points: 1, max_points: 1,
        candidate_feedback: 'Correct.', recruiter_feedback: 'Correct answer: B. KEY-EXPLANATION-q1', correct_option: 'B' },
      { question_id: 'q2', question_type: 'short_answer', skill: 'sql', correct: false, points: 0.5, max_points: 1,
        candidate_feedback: 'Partially correct.', recruiter_feedback: '0.5/1. IDEAL-ANSWER-q2', ideal_answer: 'IDEAL-ANSWER-q2' },
    ],
  };
  const record = buildScoreRecord(NLP, { assessmentEvaluation: evaluation });
  const factor = record.explanation.factors.find((f) => f.key === A);
  const item = factor.evidence.find((e) => e.key === 'assessment_question_outcomes');
  assert.ok(item, 'per-question outcomes are in the explanation');
  assert.deepEqual(item.items, [
    { question_id: 'q1', question_type: 'mcq', skill: 'python', correct: true, points: 1, max_points: 1 },
    { question_id: 'q2', question_type: 'short_answer', skill: 'sql', correct: false, points: 0.5, max_points: 1 },
  ]);
  assert.equal(item.count, 2);
  assert.match(item.display, /1 of 2/);
  assert.deepEqual(record.subscores[A].components.question_outcomes, item.items);
  assert.equal(record.subscores[A].components.proctoring, 'unproctored_online');
  assert.match(factor.evidence[0].note, /Unproctored online assessment/);
  const text = JSON.stringify(record);
  for (const s of ['KEY-EXPLANATION', 'IDEAL-ANSWER', 'recruiter_feedback', 'candidate_feedback', 'correct_option', 'ideal_answer']) {
    assert.ok(!text.includes(s), `score record carries ${s}`);
  }
});

test('every factor has an evidence array', () => {
  const partial = { ...GITHUB_OK, evidence: { ...FIXTURE, status: 'partial', sub_score: { ...FIXTURE.sub_score, partial: true } } };
  const githubInputs = [undefined, GITHUB_OK, partial, ...REASON_CODES.map((reasonCode) => ({ ok: false, reasonCode }))];
  for (const github of githubInputs) {
    for (const nlp of [NLP, { semantic_analysis: {} }, null]) {
      const record = buildScoreRecord(nlp, { github });
      assert.equal(record.explanation.factors.length, 3);
      for (const f of record.explanation.factors) {
        assert.ok(Array.isArray(f.evidence), `${f.key} evidence is not an array (github=${JSON.stringify(github)?.slice(0, 40)})`);
      }
    }
  }
});

// R-06 (REBUILD/DECISIONS.md §5): linking an inactive GitHub account (repositories, zero
// commits in the window) gives exactly the composite of linking none, for the same parsing
// input, whatever its claims show. The bodies are github-evidence's R-06 answers
// (github-evidence/README.md "No recent activity"; tests/github/snapshots/octocat.json),
// served by a local stub and read through core's real client, so core's reason-code
// mapping is exercised too.
test('R-06: an inactive linked account gives the same composite as no account', async () => {
  const { fetchGithubEvidence } = await import(
    new URL(`file:///${join(REPO_DIR, 'backend', 'Services', 'githubEvidence.js').replace(/\\/g, '/')}`)
  );
  const { json, startStub } = await import('./lib/stub-server.mjs');

  const off = (reason) => ({ value: null, weight: 0, available: false, reason });
  const idle = {
    ...FIXTURE,
    commit_activity: { available: true, window_days: 365, authored_commits: 0, active_weeks: 0, weeks: 52, weekly: Array(52).fill(0) },
    repositories: { ...FIXTURE.repositories, with_authored_commits: 0 },
  };
  const inactiveSub = {
    available: false, value: null, reason_code: 'no_recent_public_activity', weights_source: 'default', partial: false,
    components: ['activity', 'consistency', 'ownership', 'corroboration'].map((key) => ({ key, ...off('no_recent_public_activity') })),
  };
  // Mokafor-style claims: python evidenced, javascript not_found, the rest not_checkable.
  const mixedClaims = { ...idle, sub_score: inactiveSub };
  assert.ok(mixedClaims.claims.some((c) => c.status === 'not_found'), 'fixture has a not_found claim');
  // Every checkable claim evidenced (the octocat case).
  const allEvidenced = { ...idle, claims: FIXTURE.claims.filter((c) => c.status !== 'not_found'), sub_score: inactiveSub };

  const saved = process.env.GITHUB_EVIDENCE_URL;
  let body;
  const stub = await startStub({ handler: (_req, res) => json(res, 200, body) });
  process.env.GITHUB_EVIDENCE_URL = stub.url;
  try {
    const none = buildScoreRecord(NLP, { github: await fetchGithubEvidence({ githubLink: '' }) });
    assert.equal(none.subscores[G].components.reason_code, 'no_github_link');
    const fetchFor = async (b) => {
      body = b;
      return fetchGithubEvidence({ githubLink: 'github.com/example-mokafor', claimedSkills: ['python'] });
    };

    for (const [name, b] of Object.entries({ mixedClaims, allEvidenced })) {
      const record = buildScoreRecord(NLP, { github: await fetchFor(b) });
      assert.equal(record.subscores[G].available, false, name);
      assert.equal(record.weights[G], 0, name);
      assert.deepEqual(record.weights, none.weights, `${name}: same weights as no account`);
      assert.equal(record.composite, none.composite, `${name}: composite must equal the no-account composite`);
      // R-10: core maps the code through instead of service_error, with its own text.
      assert.equal(record.subscores[G].components.reason_code, 'no_recent_public_activity', name);
      assert.equal(record.subscores[G].reason, GITHUB_REASONS.no_recent_public_activity, name);
    }
  } finally {
    await stub.close();
    if (saved === undefined) delete process.env.GITHUB_EVIDENCE_URL;
    else process.env.GITHUB_EVIDENCE_URL = saved;
  }

  // Control: the pre-R-06 answer (activity components an available 0.0) broke the rule.
  const before = {
    ...allEvidenced,
    sub_score: { ...inactiveSub, available: true, reason_code: null, value: 0.3, components: [
      ...['activity', 'consistency', 'ownership'].map((key, i) => ({ key, value: 0, weight: [0.25, 0.25, 0.2][i], available: true, reason: null })),
      { key: 'corroboration', value: 1, weight: 0.3, available: true, reason: null }] },
  };
  const old = buildScoreRecord(NLP, { github: { ok: true, evidence: before, requestId: 'r06' } });
  assert.ok(old.composite < buildScoreRecord(NLP).composite, 'the control must show the old defect');
});

// R-10 (D§4.1, B1): a parse without similarity is "not measured", never an available 0.
test('R-10: missing similarity -> parsing unavailable with a reason; weights redistribute', () => {
  for (const sa of [null, undefined, {}, { similarity_score: null }, { similarity_score: 'n/a' }, 'x']) {
    const sub = buildParsingSubScore(sa);
    assert.equal(sub.available, false, JSON.stringify(sa));
    assert.equal(sub.value, null);
    assert.equal(sub.weight, 0);
    assert.equal(sub.reason, PARSING_REASONS.no_similarity);
    assert.equal(sub.components.reason_code, 'no_similarity');
    assert.deepEqual(sub.evidence, []);
  }
  // A real 0 similarity is a measurement, and stays available.
  const zero = buildParsingSubScore({ similarity_score: 0 });
  assert.equal(zero.available, true);
  assert.equal(zero.value, 0);

  const record = buildScoreRecord({ semantic_analysis: null }, { github: GITHUB_OK });
  assert.equal(record.subscores[P].available, false);
  assert.equal(record.weights[P], 0);
  assert.equal(record.weights[G], 1);
  assert.equal(record.composite, record.subscores[G].value);
  assert.equal(record.explanation.factors.find((f) => f.key === P).direction, 'unavailable');
  assert.deepEqual(record.explanation.skill_evidence, []);

  // Nothing available at all: no composite and no band, never 0.
  const nothing = buildScoreRecord({ semantic_analysis: null }, { github: { ok: false, reasonCode: 'no_github_link' } });
  assert.equal(nothing.composite, null);
  assert.equal(nothing.band, null);
  assert.equal(nothing.explanation.band, null);
  for (const key of [P, G, A]) assert.equal(nothing.weights[key], 0);
});

// R-10 (D§7, F25): one band, thresholds 80 / 60, defined in explainability.js only.
test('R-10: the composite carries a band (80 / 60), stored in the explanation', () => {
  assert.deepEqual({ ...SCORE_BAND_THRESHOLDS }, { high: 80, medium: 60 });
  const cases = [[100, 'high'], [80, 'high'], [79.99, 'medium'], [60, 'medium'], [59.99, 'low'], [0, 'low'], ['84.84', 'high'],
    [null, null], [undefined, null], ['', null], [Number.NaN, null]];
  for (const [value, band] of cases) assert.equal(scoreBand(value), band, String(value));

  const record = buildScoreRecord(NLP, { github: GITHUB_OK });
  assert.equal(record.band, scoreBand(record.composite));
  assert.equal(record.explanation.band, record.band);
  assert.equal(record.explanation.band_thresholds.high, 80);
  assert.equal(record.explanation.band_thresholds.medium, 60);
  assert.match(record.explanation.band_thresholds.note, /not calibrated/);
  const withAssessment = buildScoreRecord(NLP, { github: GITHUB_OK, assessmentEvaluation: EVALUATION });
  assert.equal(withAssessment.band, scoreBand(withAssessment.composite));
});

// R-10 (D§5, D§7): the GitHub account comes from the résumé; ownership is not verified.
test('R-10: the explanation states the GitHub account came from the résumé and is not verified', () => {
  for (const github of [GITHUB_OK, { ok: false, reasonCode: 'no_github_link' }, undefined]) {
    const { explanation } = buildScoreRecord(NLP, { github });
    assert.deepEqual(explanation.github_account, { source: 'resume_link', ownership_verified: false, note: GITHUB_OWNERSHIP_NOTE });
  }
  assert.match(GITHUB_OWNERSHIP_NOTE, /résumé/);
  assert.match(GITHUB_OWNERSHIP_NOTE, /not verified/);
  const sub = buildGithubSubScore(GITHUB_OK);
  assert.equal(sub.components.account_source, 'resume_link');
  assert.equal(sub.components.ownership_verified, false);
  assert.ok(sub.evidence[0].note.startsWith(GITHUB_OWNERSHIP_NOTE), 'the first GitHub evidence item leads with the note');
});
