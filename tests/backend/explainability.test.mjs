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
const { buildScoreRecord, buildGithubSubScore, rebuildScoreRecord, GITHUB_REASONS, SUBSCORE_KEYS } = X;

const NLP = JSON.parse(readFileSync(join(TESTS_DIR, 'nlp', 'snapshots', 'current', 'f1_dev_github.json'), 'utf8'));
const FIXTURE = JSON.parse(readFileSync(join(TESTS_DIR, 'backend', 'fixtures', 'github-evidence-example-mokafor.json'), 'utf8'));
const GITHUB_OK = { ok: true, evidence: FIXTURE, requestId: 't0014-unit' };

// ROADMAP §1.3, plus insufficient_evidence (owner decision D1, I-0047).
const REASON_CODES = [
  'no_github_link', 'invalid_github_link', 'github_user_not_found', 'no_public_repositories',
  'insufficient_evidence', 'github_rate_limited', 'service_unavailable', 'timeout', 'service_error',
  'service_disabled',
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

test('rebuildScoreRecord keeps the stored GitHub sub-score', () => {
  // As persisted: a JSON round trip of scores.subscores from an analyze with GitHub.
  const stored = JSON.parse(JSON.stringify(buildScoreRecord(NLP, { github: GITHUB_OK }).subscores));
  const rebuilt = rebuildScoreRecord(stored, EVALUATION);

  const { weight: _w, ...githubAfter } = rebuilt.subscores[G];
  const { weight: _s, ...githubBefore } = JSON.parse(JSON.stringify(stored[G]));
  assert.deepEqual(githubAfter, githubBefore, 'value, components and evidence unchanged');
  assert.equal(rebuilt.subscores[A].available, true);
  near(rebuilt.weights[G], 0.35, 1e-4, 'github weight');
  near(weightSum(rebuilt), 1, 1e-3, 'weights sum to 1');
  near(rebuilt.composite, weightedSum(rebuilt), 0.01, 'composite is the weighted sum');
});

test('rebuildScoreRecord on a score stored without a GitHub entry', () => {
  const stored = JSON.parse(JSON.stringify(buildScoreRecord(NLP).subscores));
  delete stored[G];
  const rebuilt = rebuildScoreRecord(stored, EVALUATION);
  const sub = rebuilt.subscores[G];
  assert.equal(sub.available, false);
  assert.equal(sub.weight, 0);
  assert.equal(sub.components.reason_code, 'not_collected_for_score');
  assert.equal(sub.reason, GITHUB_REASONS.not_collected_for_score);
  assert.match(sub.reason, /before GitHub evidence was collected/);
  assert.match(sub.reason, /Re-analysing the resume would include it/);
  assert.doesNotMatch(sub.reason, /not part of this deployment/);
  near(weightSum(rebuilt), 1, 1e-3, 'weights sum to 1');
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
