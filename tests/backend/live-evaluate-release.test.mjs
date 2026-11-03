// T-0029 criterion 7 (live, service down): I-0069. When grading fails, the
// claim is released: the attempt goes back to 'generated' and can be submitted
// again. Runs ONLY when assessment-service (:8002) is unreachable; stop it for
// one run. With :8002 up it skips.
//
// Note: on the pre-T-0029 code this test also passes (the old code never moved
// the status), so it is a regression guard for the release path; the fail-first
// test for release is tests/backend/grading-claim.test.mjs.
//
//   BACKEND_BASE_URL=http://localhost:5000 node --test tests/backend/live-evaluate-release.test.mjs
import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { api, login } from './lib/session.mjs';
import {
  client, counts, insertTestJob, isZero, liveConfig, resolveAccounts, snapshotProfiles, sweep,
} from './lib/testdb.mjs';
import { assessmentServiceUp, seedAssessment } from './lib/assessment.mjs';

const cfg = liveConfig();
let skip = cfg.missing.length ? `tests/.env missing ${cfg.missing.join(', ')}` : false;
if (!skip && (await assessmentServiceUp())) skip = 'assessment-service (:8002) is up; stop it to run the release case';

let sb;
let ids;

before(async () => {
  if (skip) return;
  sb = client();
  ids = await resolveAccounts(sb, cfg);
  await snapshotProfiles(sb, ids);
  console.log('pre-run sweep removed:', await sweep(sb, ids));
});

after(async () => {
  if (skip || !sb || !ids) return;
  console.log('teardown sweep removed:', await sweep(sb, ids));
  const remaining = await counts(sb, ids);
  assert.ok(isZero(remaining), `teardown left data behind: ${JSON.stringify(remaining)}`);
});

test('I-0069: grading fails -> 502, claim released, a retry claims it again', { skip }, async () => {
  const cookie = await login(cfg.candidateUsername, cfg.candidatePassword);
  const jobId = await insertTestJob(sb, ids.R);
  const a = await seedAssessment(sb, { candidateId: ids.C, jobId });
  const first = await api(cookie, 'POST', '/api/assessment/evaluate', { assessmentId: a.id, answers: a.responses });
  assert.equal(first.status, 502, first.text.slice(0, 200));
  const { data } = await sb.from('assessments').select('*').eq('id', a.id).single();
  assert.equal(data.status, 'generated');
  assert.equal(data.grading_started_at ?? null, null);
  const second = await api(cookie, 'POST', '/api/assessment/evaluate', { assessmentId: a.id, answers: a.responses });
  assert.equal(second.status, 502, 'a released attempt is claimable again (502, not 409)');
});
