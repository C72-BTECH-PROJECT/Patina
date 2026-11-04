// T-0031 (d) (offline): I-0025. The 10 MB cap at its exact boundary, on a small
// Express app using the real resumeUpload middleware. Nothing leaves loopback;
// the bucket half of the boundary is the constant-to-migration check here
// (owner, 2026-11-04: no 10 MB upload to the shared bucket).
//
//   node --test tests/backend/upload-limits.test.mjs
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { REPO_DIR } from './lib/env.mjs';

const backendUrl = (...parts) =>
  new URL(`file:///${join(REPO_DIR, 'backend', ...parts).replace(/\\/g, '/')}`);
const express = createRequire(join(REPO_DIR, 'backend', 'package.json'))('express');

const TEN_MB = 10485760;
let server;
let base;

before(async () => {
  const { resumeUpload } = await import(backendUrl('Middlewares', 'resumeUpload.js'));
  const app = express();
  app.post('/upload', resumeUpload, (req, res) => res.json({ size: req.file?.size ?? null }));
  await new Promise((resolve) => { server = app.listen(0, '127.0.0.1', resolve); });
  base = `http://127.0.0.1:${server.address().port}`;
});

after(() => new Promise((resolve) => { if (server) server.close(resolve); else resolve(); }));

const send = async (bytes, field = 'resume') => {
  const form = new FormData();
  form.append(field, new Blob([new Uint8Array(bytes)], { type: 'application/pdf' }), 'r.pdf');
  const r = await fetch(`${base}/upload`, { method: 'POST', body: form });
  const text = await r.text();
  return { status: r.status, type: r.headers.get('content-type') || '', text };
};

test('exactly 10485760 bytes is accepted, with every byte kept', async () => {
  const r = await send(TEN_MB);
  assert.equal(r.status, 200, r.text.slice(0, 200));
  assert.equal(JSON.parse(r.text).size, TEN_MB);
});

test('10485761 bytes gives 413 JSON naming the limit', async () => {
  const r = await send(TEN_MB + 1);
  assert.equal(r.status, 413, r.text.slice(0, 200));
  assert.match(r.type, /application\/json/);
  assert.deepEqual(JSON.parse(r.text), { message: 'Resume must be 10 MB or smaller.' });
});

test('a wrong field name gives 400 JSON, never an HTML page', async () => {
  const r = await send(16, 'not_resume');
  assert.equal(r.status, 400, r.text.slice(0, 200));
  assert.match(r.type, /application\/json/);
  assert.ok(JSON.parse(r.text).message, 'expected a message');
});

test('the one constant equals file_size_limit in the bucket migration', async () => {
  const { MAX_RESUME_BYTES } = await import(backendUrl('Config', 'uploadLimits.js'));
  const sql = readFileSync(
    join(REPO_DIR, 'supabase', 'migrations', '20261104120000_resumes_bucket_limits.sql'), 'utf8',
  );
  const m = sql.match(/set file_size_limit = (\d+)/);
  assert.ok(m, 'file_size_limit not found in the migration');
  assert.equal(MAX_RESUME_BYTES, Number(m[1]));
});
