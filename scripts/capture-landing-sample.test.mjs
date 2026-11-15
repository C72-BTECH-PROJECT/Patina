// D-9: the capture script's pure sanitiser and leak scan.
//
//   node --test scripts/capture-landing-sample.test.mjs
//
// Every input here is SYNTHETIC, built in this file to exercise the code. None of it is a
// stored score, and none of it is rendered in the app.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildSample, identityTokens, scanSample } from './capture-landing-sample.lib.mjs';

const subscores = {
  parsing_semantic_alignment: { available: true, value: 70 },
  github_evidence: { available: false },
  assessment_results: { available: true, value: 40 },
};

// A synthetic stored row carrying every kind of field the sanitiser must drop.
const syntheticScore = () => ({
  id: '11111111-2222-3333-4444-555555555555',
  resume_id: '66666666-7777-8888-9999-000000000000',
  candidate_id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
  job_id: 'ffffffff-0000-1111-2222-333333333333',
  composite_score: 58.25,
  subscores,
  weights: { x: 1 },
  evidence_limited: true,
  created_at: '2026-03-04T10:00:00.000Z',
  explanation: {
    generated_at: '2026-03-04T09:59:00.000Z',
    weights_version: 'synthetic-v0',
    summary: 'Zed Example (zed@example.test) scored well. See https://github.com/zedexample',
    github_account: { note: 'from the link https://github.com/zedexample' },
    factors: [
      {
        key: 'parsing_semantic_alignment', label: 'Résumé match', available: true, direction: 'raises',
        weight: 0.4, weight_pct: 40, value: 70, contribution: 28, reason: 'r', evidence: [{ items: ['repo-name-1'] }],
      },
      { key: 'github_evidence', label: 'GitHub', available: false, direction: 'unavailable', weight: 0, weight_pct: 0, value: null, contribution: 0, reason: 'no link', evidence: [] },
    ],
    skill_evidence: [
      { name: 'Alpha', status: 'evidenced', marks: { resume: 'confirmed' }, github_claims: [{ skill: 'Alpha', repo: 'https://github.com/zedexample/r' }] },
      { name: 'Beta', status: 'claimed_only', marks: { resume: 'confirmed' } },
      { name: 'Gamma', status: 'matched', sources: { github: 'evidenced' } }, // pre-R-28 row
      { name: 'Delta', status: 'missing', sources: {} }, // pre-R-28 row
      { name: 'Eps', status: 'not_found', marks: {} },
      { name: 'Zeta', status: 'claimed_only', marks: {} },
      { name: 'Eta', status: 'evidenced', marks: {} },
    ],
  },
});

const build = (over = {}) => buildSample({
  score: syntheticScore(), jobTitle: 'Synthetic Job', fixture: null, capturedAt: '2026-03-05T00:00:00.000Z', ...over,
});

test('keeps only the card fields, the first 6 skills reduced to name + status, and the provenance', () => {
  const s = build({ fixture: 'synthetic.pdf' });
  assert.deepEqual(Object.keys(s).sort(), [
    'band', 'composite', 'factors', 'generated_at', 'job_title', 'provenance', 'skills', 'verification', 'weights_version',
  ]);
  assert.equal(s.composite, 58.25);
  assert.equal(s.band, 'low'); // core's scoreBand: below 60
  assert.equal(s.verification, 'partly_verified'); // core's scoreVerification: one independent source
  assert.equal(s.generated_at, '2026-03-04T09:59:00.000Z');
  assert.equal(s.job_title, 'Synthetic Job');
  assert.equal(s.weights_version, 'synthetic-v0');
  assert.equal(s.skills.length, 6);
  for (const row of s.skills) assert.deepEqual(Object.keys(row).sort(), ['skill', 'status']);
  assert.deepEqual(s.skills.map((r) => r.status), ['evidenced', 'claimed_only', 'evidenced', 'not_found', 'not_found', 'claimed_only']);
  assert.deepEqual(s.provenance, {
    captured_from: 'scores row via scripts/capture-landing-sample.mjs',
    captured_at: '2026-03-05T00:00:00.000Z',
    fixture: 'synthetic.pdf',
  });
  assert.equal(s.provenance.fixture === null, false);
  assert.equal(build().provenance.fixture, null);
});

test('factor rows carry label, sub-score, weight, points and direction only (no reason, no evidence)', () => {
  const s = build();
  assert.deepEqual(s.factors[0], {
    key: 'parsing_semantic_alignment', label: 'Résumé match', available: true, direction: 'raises',
    value: 70, weight: 0.4, weight_pct: 40, contribution: 28,
  });
  assert.deepEqual(s.factors[1], { key: 'github_evidence', label: 'GitHub', available: false, direction: 'unavailable' });
});

test('drops ids, summary, github_account and every evidence detail', () => {
  const text = JSON.stringify(build());
  assert.doesNotMatch(text, /zed|example|repo-name|summary|github_account/i);
  assert.equal(scanSample(build(), []).length, 0);
});

test('falls back to created_at when the explanation has no generated_at', () => {
  const score = syntheticScore();
  delete score.explanation.generated_at;
  assert.equal(build({ score }).generated_at, '2026-03-04T10:00:00.000Z');
});

test('throws, never defaults, when something the card needs is missing', () => {
  const cases = {
    'no composite': (s) => { s.composite_score = null; },
    'no explanation': (s) => { s.explanation = null; },
    'no factors': (s) => { s.explanation.factors = []; },
    'available factor without a value': (s) => { delete s.explanation.factors[0].value; },
    'no weights_version': (s) => { delete s.explanation.weights_version; },
    'unknown skill status': (s) => { s.explanation.skill_evidence[0].status = 'weird'; },
    'no verification (nothing available)': (s) => { s.subscores = {}; },
  };
  for (const [name, mutate] of Object.entries(cases)) {
    const score = syntheticScore();
    mutate(score);
    assert.throws(() => build({ score }), Error, name);
  }
  assert.throws(() => build({ jobTitle: '' }), /job has no title/);
});

test('scan refuses @, a UUID, http, github.com, the spec regex and the candidate identity tokens', () => {
  const base = build();
  const withSkill = (skill) => ({ ...base, skills: [{ skill, status: 'evidenced' }] });
  assert.ok(scanSample(withSkill('a@b'), []).some((p) => p.includes('"@"')));
  assert.ok(scanSample(withSkill('11111111-2222-3333-4444-555555555555'), []).some((p) => p.includes('UUID')));
  assert.ok(scanSample(withSkill('see http stuff'), []).some((p) => p.includes('"http"')));
  assert.ok(scanSample(withSkill('github.com'), []).some((p) => p.includes('github.com')));
  assert.ok(scanSample(withSkill('Email'), []).some((p) => p.includes('spec check')));
  const identity = [
    { kind: 'profile username', value: 'zedexample' },
    { kind: 'résumé contact candidate_name', value: 'Kim Qux' },
    { kind: 'résumé contact email', value: 'kim.qux@mail.test' },
  ];
  const hit = scanSample(withSkill('zedexample'), identity);
  assert.deepEqual(hit, ["contains a token of the candidate's profile username"]);
  assert.ok(scanSample(withSkill('Qux'), identity).some((p) => p.includes('candidate_name')));
  // The refusal message names the kind of field, never the value.
  assert.ok(!hit.join(' ').includes('zedexample'));
  assert.deepEqual(scanSample(base, identity), []);
});

test('identity tokens: email local part and URL last segment, never "com" or "https"', () => {
  const tokens = identityTokens([
    { kind: 'e', value: 'kim.qux@mail.test' },
    { kind: 'u', value: 'https://github.com/zedexample' },
    { kind: 'n', value: 'Kim Qux' },
  ]).map((t) => t.token);
  assert.ok(tokens.includes('kim.qux'));
  assert.ok(tokens.includes('zedexample'));
  assert.ok(tokens.includes('kim') && tokens.includes('qux'));
  for (const bad of ['com', 'https', 'github', 'test']) assert.ok(!tokens.includes(bad), bad);
});
