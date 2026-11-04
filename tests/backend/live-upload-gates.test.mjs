// T-0031 (d, k) (live): I-0025, I-0072. Every core upload route refuses an
// over-limit file and a `.txt`.
//
// Bucket safety (owner, 2026-11-04: no 10 MB upload to the shared bucket). Each
// over-limit case stops before storage even if the cap regresses: the
// /api/resume/upload case is named .txt, so the extension gate refuses it, and
// the /api/analyze case has no jobId, so it never reaches the NLP or storage steps.
//
// Accounts: t0001_cand (C), t0001_recr (R). Job tagged "[T-0001 TEST]"; the sweep
// removes everything. See lib/testdb.mjs.
//
//   BACKEND_BASE_URL=http://localhost:5000 node --test tests/backend/live-upload-gates.test.mjs
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { backendBaseUrl } from './lib/env.mjs';
import { api, login } from './lib/session.mjs';
import {
  client, counts, insertTestJob, isZero, liveConfig, resolveAccounts, snapshotProfiles, sweep,
} from './lib/testdb.mjs';

const cfg = liveConfig();
const skip = cfg.missing.length ? `tests/.env missing ${cfg.missing.join(', ')}` : false;
const BASE = backendBaseUrl();
const OVER_LIMIT = 10485761;
const TXT_RESUME = 'Jane Doe\njane@example.com\nSkills: Python, SQL, Docker\nExperience: backend engineer\n';

let sb;
let ids;
let cookieC;
let jobId;

before(async () => {
  if (skip) return;
  sb = client();
  ids = await resolveAccounts(sb, cfg);
  await snapshotProfiles(sb, ids);
  console.log('pre-run sweep removed:', await sweep(sb, ids));
  cookieC = await login(cfg.candidateUsername, cfg.candidatePassword);
  jobId = await insertTestJob(sb, ids.R);
});

after(async () => {
  if (skip || !sb || !ids) return;
  console.log('teardown sweep removed:', await sweep(sb, ids));
  const remaining = await counts(sb, ids);
  assert.ok(isZero(remaining), `teardown left data behind: ${JSON.stringify(remaining)}`);
});

const post = async (path, { content, name, type, job }) => {
  const form = new FormData();
  if (job) form.append('jobId', job);
  form.append('resume', new Blob([content], { type }), name);
  const r = await fetch(`${BASE}${path}`, { method: 'POST', headers: { Cookie: cookieC }, body: form });
  const text = await r.text();
  return { status: r.status, type: r.headers.get('content-type') || '', text };
};

const resumeRows = async () => {
  const { count, error } = await sb.from('resumes').select('id', { count: 'exact', head: true }).eq('candidate_id', ids.C);
  assert.ifError(error);
  return count;
};

const assert413 = (r) => {
  assert.equal(r.status, 413, `HTTP ${r.status}: ${r.text.slice(0, 200)}`);
  assert.match(r.type, /application\/json/);
  assert.equal(JSON.parse(r.text).message, 'Resume must be 10 MB or smaller.');
};

test('I-0025: 10 MB + 1 byte to /api/resume/upload -> 413 JSON', { skip }, async () => {
  assert413(await post('/api/resume/upload', {
    content: new Uint8Array(OVER_LIMIT), name: 'over-limit.txt', type: 'application/pdf',
  }));
});

test('I-0025: 10 MB + 1 byte to /api/analyze -> 413 JSON', { skip }, async () => {
  assert413(await post('/api/analyze', {
    content: new Uint8Array(OVER_LIMIT), name: 'over-limit.pdf', type: 'application/pdf',
  }));
});

test('I-0025: /api/resume/status returns maxResumeBytes', { skip }, async () => {
  const r = await api(cookieC, 'GET', '/api/resume/status');
  assert.equal(r.status, 200, r.text.slice(0, 200));
  assert.equal(r.body.maxResumeBytes, 10485760);
});

for (const [label, type] of [['plain', 'text/plain'], ['declared as application/pdf', 'application/pdf']]) {
  test(`I-0072: .txt (${label}) to /api/analyze -> 400, no new resumes row`, { skip }, async () => {
    const rowsBefore = await resumeRows();
    const r = await post('/api/analyze', { content: TXT_RESUME, name: 'resume.txt', type, job: jobId });
    const state = { http: r.status, newRows: (await resumeRows()) - rowsBefore };
    assert.deepEqual(state, { http: 400, newRows: 0 }, `got ${JSON.stringify(state)}: ${r.text.slice(0, 200)}`);
    assert.equal(JSON.parse(r.text).message, 'Only PDF or DOCX resumes are supported.');
  });
}

test('control: .txt to /api/resume/upload -> 400', { skip }, async () => {
  const r = await post('/api/resume/upload', { content: TXT_RESUME, name: 'resume.txt', type: 'text/plain' });
  assert.equal(r.status, 400, r.text.slice(0, 200));
});
