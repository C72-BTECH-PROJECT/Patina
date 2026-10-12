// T-0005 / I-0020 (live): no logged-in user can create notifications for
// another user. POST /api/notifications/send must not exist; reading and
// marking one's own notifications must keep working.
//
// Accounts (tests/.env): attacker candidate t0001_cand (C), victim recruiter
// t0001_recr (R). Notifications are swept by user_id (lib/testdb.mjs).
//
//   BACKEND_BASE_URL=http://localhost:5000 node --test tests/backend/live-notifications-authz.test.mjs
import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { api, login } from './lib/session.mjs';
import { client, counts, isZero, liveConfig, resolveAccounts, snapshotProfiles, sweep } from './lib/testdb.mjs';

const cfg = liveConfig();
const missing = [...cfg.missing, ...(cfg.recruiterPassword ? [] : ['TEST_RECRUITER_PASSWORD'])];
const skip = missing.length ? `tests/.env missing ${missing.join(', ')}` : false;

let sb;
let ids;
let cookieC;
let cookieR;

before(async () => {
  if (skip) return;
  sb = client();
  ids = await resolveAccounts(sb, cfg);
  await snapshotProfiles(sb, ids);
  console.log('pre-run sweep removed:', await sweep(sb, ids));
  cookieC = await login(cfg.candidateUsername, cfg.candidatePassword);
  cookieR = await login(cfg.recruiterUsername, cfg.recruiterPassword);
});

after(async () => {
  if (skip || !sb || !ids) return;
  console.log('teardown sweep removed:', await sweep(sb, ids));
  const remaining = await counts(sb, ids);
  console.log('remaining after teardown:', remaining);
  assert.ok(isZero(remaining), `teardown left data behind: ${JSON.stringify(remaining)}`);
});

const hasMarker = (list, marker) => (list ?? []).some((n) => n.message === marker);

test('I-0020: candidate cannot send a notification to a recruiter (404, nothing delivered)', { skip }, async () => {
  const marker = `t0005 spoof ${randomUUID()}`;
  const r = await api(cookieC, 'POST', '/api/notifications/send', { userId: ids.R, type: 'phish', message: marker });
  const inbox = await api(cookieR, 'GET', '/api/notifications');
  assert.equal(inbox.status, 200);
  const { data } = await sb.from('notifications').select('message').eq('user_id', ids.R);
  const state = { http: r.status, inInbox: hasMarker(inbox.body?.notifications, marker), inDb: hasMarker(data, marker) };
  assert.deepEqual(state, { http: 404, inInbox: false, inDb: false }, `got ${JSON.stringify(state)}`);
});

test('I-0020: unauthenticated POST /send is not accepted', { skip }, async () => {
  const marker = `t0005 anon ${randomUUID()}`;
  const r = await api(null, 'POST', '/api/notifications/send', { userId: ids.R, type: 'phish', message: marker });
  const { data } = await sb.from('notifications').select('message').eq('user_id', ids.R);
  assert.ok(r.status >= 400, `HTTP ${r.status}`);
  assert.equal(hasMarker(data, marker), false);
});

test('control: own notifications are listed and can be marked read', { skip }, async () => {
  const marker = `t0005 own ${randomUUID()}`;
  const { data: row, error } = await sb
    .from('notifications')
    .insert({ user_id: ids.C, type: 'shortlisted', message: marker, data: {} })
    .select('id')
    .single();
  assert.ifError(error);

  const list = await api(cookieC, 'GET', '/api/notifications');
  assert.equal(list.status, 200);
  assert.ok(Array.isArray(list.body.notifications) && typeof list.body.unreadCount === 'number');
  assert.ok(hasMarker(list.body.notifications, marker), 'seeded notification not listed');

  const read = await api(cookieC, 'POST', `/api/notifications/${row.id}/read`);
  assert.equal(read.status, 200, read.text);
  const { data: after } = await sb.from('notifications').select('read').eq('id', row.id).single();
  assert.equal(after.read, true);
});

test('control: another user cannot mark C\'s notification read (404)', { skip }, async () => {
  const { data: row, error } = await sb
    .from('notifications')
    .insert({ user_id: ids.C, type: 'shortlisted', message: `t0005 other ${randomUUID()}`, data: {} })
    .select('id')
    .single();
  assert.ifError(error);
  const r = await api(cookieR, 'POST', `/api/notifications/${row.id}/read`);
  assert.equal(r.status, 404);
  const { data: after } = await sb.from('notifications').select('read').eq('id', row.id).single();
  assert.equal(after.read, false);
});
