// T-0009: how the system behaves when the NLP service is down, hung or busy.
// Characterisation only: prints what happened, asserts nothing. Migration step M1
// (ARCHITECTURE.md §5) turns it into a red/green test.
//
//   node tests/arch/nlp-outage-probe.mjs              phases P-1, P-2, P-3
//   node tests/arch/nlp-outage-probe.mjs --phase 3    one phase (repeatable: --phase 1 --phase 2)
//
// P-1 NLP down : backend up, nothing on :8000. health, login, jobs, resume-status, upload, analyze.
// P-2 NLP hung : this script listens on :8000, accepts connections and never replies.
//                analyze with a 20 s client abort; /api/jobs and /api/health meanwhile.
// P-3 NLP busy : NLP up alone (no backend, no Supabase). GET / latency while a /parse
//                runs; one parse vs two concurrent parses.
//
// Live (P-1, P-2): logs in as t0001_cand and inserts one "[T-0001 TEST]" job owned by
// t0001_recr so analyze reaches the NLP call; P-1 also uploads f1 once (stored under
// candidates/<C>/). Sweeps before and after (lib/testdb.mjs guards apply).
// With NLP down or hung, analyze stops before any write: the NLP call
// (backend/Controllers/analysis.controller.js:262) precedes the storage/resumes/scores
// writes (:277, :303, :331). P-1/P-2 refuse to start if anything answers on :8000.
// Ports 5000 (backend) and 8000 (NLP) must be free: the current tree hardcodes both.
// Logs: tests/.out/t0009-probe-*.log; result table: tests/.out/t0009-probe.md.
import { spawn, execFileSync } from 'node:child_process';
import { mkdirSync, openSync, readFileSync, writeFileSync } from 'node:fs';
import net from 'node:net';
import { join } from 'node:path';
import { performance } from 'node:perf_hooks';
import { REPO_DIR, TESTS_DIR, backendBaseUrl } from '../backend/lib/env.mjs';
import { login } from '../backend/lib/session.mjs';
import { client, counts, insertTestJob, isZero, liveConfig, resolveAccounts, sweep } from '../backend/lib/testdb.mjs';

const BASE = backendBaseUrl();
const NLP = 'http://127.0.0.1:8000';
const OUT = join(TESTS_DIR, '.out');
const FIXTURE = join(TESTS_DIR, 'fixtures', 'f1_dev_github.pdf');
const HANG_LIMIT_MS = 20_000;
// Same job text and skills as insertTestJob (lib/testdb.mjs), for the direct /parse calls.
const JD = 'Synthetic job created by the T-0001 test harness and deleted in teardown. '
  + 'Backend engineer: Python, SQL, PostgreSQL, Docker, Git, REST API design.';
const REQUIRED = ['python', 'sql', 'postgresql', 'docker', 'git', 'rest api'];
const PREFERRED = ['react', 'redis', 'aws'];

const argPhases = process.argv.flatMap((a, i) => (a === '--phase' ? [Number(process.argv[i + 1])] : []));
const phases = argPhases.length ? argPhases : [1, 2, 3];
mkdirSync(OUT, { recursive: true });

const rows = [];
const record = (phase, step, result, ms, note = '') => {
  rows.push({ phase, step, result, ms: ms == null ? '' : Math.round(ms), note });
  console.log(`${phase} | ${step} | ${result} | ${ms == null ? '' : Math.round(ms)} | ${note}`);
};
const clip = (s, n = 140) => String(s ?? '').replace(/\s+/g, ' ').slice(0, n);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function timed(url, { method = 'GET', headers = {}, body, timeoutMs = 60_000 } = {}) {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), timeoutMs);
  const start = performance.now();
  try {
    const r = await fetch(url, { method, headers, body, signal: ac.signal });
    const text = await r.text();
    return { status: r.status, ms: performance.now() - start, text };
  } catch (e) {
    const aborted = e.name === 'AbortError';
    return { status: aborted ? 'no response (client aborted)' : `error: ${e.cause?.code || e.message}`, ms: performance.now() - start, text: '' };
  } finally {
    clearTimeout(t);
  }
}

function portOpen(port) {
  const tryHost = (host) => new Promise((res) => {
    const s = net.connect({ host, port });
    s.setTimeout(1000);
    s.once('connect', () => { s.destroy(); res(true); });
    s.once('timeout', () => { s.destroy(); res(false); });
    s.once('error', () => res(false));
  });
  return Promise.all([tryHost('127.0.0.1'), tryHost('::1')]).then((r) => r.some(Boolean));
}

async function waitHttp(url, timeoutSec) {
  const deadline = Date.now() + timeoutSec * 1000;
  while (Date.now() < deadline) {
    const r = await timed(url, { timeoutMs: 5000 });
    if (r.status === 200) return true;
    await sleep(1000);
  }
  return false;
}

function startProcess(name, file, args, cwd, env = {}) {
  const out = openSync(join(OUT, `t0009-probe-${name}.out.log`), 'w');
  const err = openSync(join(OUT, `t0009-probe-${name}.err.log`), 'w');
  return spawn(file, args, { cwd, env: { ...process.env, ...env }, stdio: ['ignore', out, err], windowsHide: true });
}

function stopProcess(child) {
  if (!child || child.exitCode !== null) return;
  if (process.platform === 'win32') {
    try { execFileSync('taskkill.exe', ['/PID', String(child.pid), '/T', '/F'], { stdio: 'ignore' }); } catch { /* already gone */ }
  } else {
    child.kill('SIGTERM');
  }
}

function parseForm(filename = 'f1_dev_github.pdf') {
  const form = new FormData();
  form.append('resume', new Blob([readFileSync(FIXTURE)], { type: 'application/pdf' }), filename);
  form.append('jd', JD);
  form.append('required_skills', JSON.stringify(REQUIRED));
  form.append('preferred_skills', JSON.stringify(PREFERRED));
  return form;
}

function analyzeForm(jobId) {
  const form = new FormData();
  form.append('jobId', jobId);
  form.append('resume', new Blob([readFileSync(FIXTURE)], { type: 'application/pdf' }), 'f1_dev_github.pdf');
  return form;
}

const backendLog = () => {
  try { return readFileSync(join(OUT, 't0009-probe-backend.out.log'), 'utf8') + readFileSync(join(OUT, 't0009-probe-backend.err.log'), 'utf8'); }
  catch { return ''; }
};

// ---------------------------------------------------------------- phases
async function phase1(cookie, jobId) {
  const P = 'P-1 NLP down';
  if (await portOpen(8000)) throw new Error('P-1: something answers on :8000; stop the NLP service first (analyze would write rows)');
  let r = await timed(`${BASE}/api/health`);
  record(P, 'GET /api/health', r.status, r.ms, clip(r.text, 80));
  r = await timed(`${BASE}/api/jobs`, { headers: { Cookie: cookie } });
  record(P, 'GET /api/jobs (candidate)', r.status, r.ms);
  r = await timed(`${BASE}/api/resume/status`, { headers: { Cookie: cookie } });
  record(P, 'GET /api/resume/status', r.status, r.ms);
  // Upload stores the file only (no NLP call); the object lands under candidates/<C>/, which the sweep removes.
  const up = new FormData();
  up.append('resume', new Blob([readFileSync(FIXTURE)], { type: 'application/pdf' }), 'f1_dev_github.pdf');
  r = await timed(`${BASE}/api/resume/upload`, { method: 'POST', headers: { Cookie: cookie }, body: up });
  record(P, 'POST /api/resume/upload (f1)', r.status, r.ms);
  r = await timed(`${BASE}/api/analyze`, { method: 'POST', headers: { Cookie: cookie }, body: analyzeForm(jobId) });
  record(P, 'POST /api/analyze (f1, test job)', r.status, r.ms, `body: ${clip(r.text)}`);
  r = await timed(`${BASE}/api/jobs`, { headers: { Cookie: cookie } });
  record(P, 'GET /api/jobs after analyze failed', r.status, r.ms);
}

async function phase2(cookie, jobId) {
  const P = 'P-2 NLP hung';
  if (await portOpen(8000)) throw new Error('P-2: something answers on :8000; stop the NLP service first');
  const sockets = new Set();
  let accepted = 0;
  let bytes = 0;
  const onConn = (s) => { accepted++; sockets.add(s); s.on('data', (d) => { bytes += d.length; }); s.on('error', () => {}); };
  // The backend resolves "localhost"; listen on both loopback families.
  const servers = [net.createServer(onConn), net.createServer(onConn)];
  await Promise.all([
    new Promise((res, rej) => servers[0].once('error', rej).listen(8000, '127.0.0.1', res)),
    new Promise((res) => servers[1].once('error', () => res()).listen({ port: 8000, host: '::1', ipv6Only: true }, res)),
  ]);
  try {
    const analyze = timed(`${BASE}/api/analyze`, { method: 'POST', headers: { Cookie: cookie }, body: analyzeForm(jobId), timeoutMs: HANG_LIMIT_MS });
    await sleep(2000);
    let r = await timed(`${BASE}/api/jobs`, { headers: { Cookie: cookie } });
    record(P, 'GET /api/jobs while analyze is pending', r.status, r.ms);
    r = await timed(`${BASE}/api/health`);
    record(P, 'GET /api/health while analyze is pending', r.status, r.ms, clip(r.text, 80));
    const a = await analyze;
    record(P, `POST /api/analyze (client limit ${HANG_LIMIT_MS / 1000} s)`, a.status, a.ms,
      `stub on :8000 accepted ${accepted} connection(s), received ${bytes} bytes, sent nothing`);
  } finally {
    for (const s of sockets) s.destroy();
    await Promise.all(servers.map((s) => new Promise((res) => (s.listening ? s.close(() => res()) : res()))));
  }
  await sleep(1000);
  const line = backendLog().split(/\r?\n/).find((l) => l.includes('[analyze] unhandled failure'));
  record(P, 'backend log after the stub closed the socket', line ? 'logged' : 'no log line', null, clip(line ?? ''));
}

async function phase3() {
  const P = 'P-3 NLP busy';
  if (await portOpen(8000)) throw new Error('P-3: :8000 is already in use');
  const python = join(REPO_DIR, 'nlp-engine', process.platform === 'win32' ? 'venv/Scripts/python.exe' : 'venv/bin/python');
  const nlp = startProcess('nlp', python, ['-m', 'uvicorn', 'app.main:app', '--host', '127.0.0.1', '--port', '8000'],
    join(REPO_DIR, 'nlp-engine'), { PYTHONHASHSEED: '0', HF_HUB_OFFLINE: '1', TRANSFORMERS_OFFLINE: '1' });
  try {
    const t0 = performance.now();
    if (!(await waitHttp(`${NLP}/`, 240))) throw new Error('P-3: NLP did not become healthy (see tests/.out/t0009-probe-nlp.err.log)');
    record(P, 'NLP start-up until GET / = 200', 200, performance.now() - t0, 'models load at import');
    let r = await timed(`${NLP}/parse`, { method: 'POST', body: parseForm() });
    record(P, 'POST /parse warm-up (first call)', r.status, r.ms);
    r = await timed(`${NLP}/`);
    record(P, 'GET / idle', r.status, r.ms);
    r = await timed(`${NLP}/parse`, { method: 'POST', body: parseForm() });
    record(P, 'POST /parse alone', r.status, r.ms);
    const single = r.ms;

    const parse = timed(`${NLP}/parse`, { method: 'POST', body: parseForm() });
    await sleep(150);
    const h = await timed(`${NLP}/`, { timeoutMs: 60_000 });
    const p = await parse;
    record(P, 'GET / sent 150 ms into a /parse', h.status, h.ms, `that /parse took ${Math.round(p.ms)} ms`);

    const start = performance.now();
    const [a, b] = await Promise.all([
      timed(`${NLP}/parse`, { method: 'POST', body: parseForm('f1_a.pdf') }),
      timed(`${NLP}/parse`, { method: 'POST', body: parseForm('f1_b.pdf') }),
    ]);
    const wall = performance.now() - start;
    record(P, 'two concurrent /parse', `${a.status}, ${b.status}`, wall,
      `finished at ${Math.round(a.ms)} and ${Math.round(b.ms)} ms; one alone took ${Math.round(single)} ms`);
  } finally {
    stopProcess(nlp);
  }
}

// ---------------------------------------------------------------- main
const live = phases.includes(1) || phases.includes(2);
let sb;
let ids;
let backend;
let failure;
try {
  if (live) {
    const cfg = liveConfig();
    if (cfg.missing.length) throw new Error(`tests/.env is missing ${cfg.missing.join(', ')}`);
    if (await portOpen(5000)) throw new Error(':5000 is already in use; stop the running backend first');
    if (await portOpen(8000)) throw new Error(':8000 is already in use; P-1/P-2 need the NLP service stopped');
    sb = client();
    ids = await resolveAccounts(sb, cfg);
    console.log('pre-run sweep removed:', JSON.stringify(await sweep(sb, ids)));
    const jobId = await insertTestJob(sb, ids.R);

    backend = startProcess('backend', process.execPath, ['index.js'], join(REPO_DIR, 'backend'));
    if (!(await waitHttp(`${BASE}/api/health`, 60))) throw new Error('backend did not become healthy (see tests/.out/t0009-probe-backend.*.log)');
    const t = performance.now();
    const cookie = await login(cfg.candidateUsername, cfg.candidatePassword);
    record('P-1 NLP down', 'POST /api/auth/login (t0001_cand)', 200, performance.now() - t);

    if (phases.includes(1)) await phase1(cookie, jobId);
    if (phases.includes(2)) await phase2(cookie, jobId);
  }
} catch (e) {
  failure = e;
} finally {
  stopProcess(backend);
  if (sb && ids) {
    console.log('teardown sweep removed:', JSON.stringify(await sweep(sb, ids)));
    const left = await counts(sb, ids);
    console.log('remaining after teardown:', JSON.stringify(left), isZero(left) ? '(clean)' : '(NOT CLEAN)');
  }
}
if (!failure && phases.includes(3)) {
  try { await phase3(); } catch (e) { failure = e; }
}

const md = ['| Phase | Step | Result | Time (ms) | Note |', '|---|---|---|---|---|',
  ...rows.map((r) => `| ${r.phase} | ${r.step} | ${r.result} | ${r.ms} | ${String(r.note).replace(/\|/g, '\\|')} |`)].join('\n');
writeFileSync(join(OUT, 't0009-probe.md'), `${md}\n`);
console.log(`\n${md}\n\n(table also written to tests/.out/t0009-probe.md)`);
if (failure) {
  console.error(`probe stopped: ${failure.message}`);
  process.exit(1);
}
