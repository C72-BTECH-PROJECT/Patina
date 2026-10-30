// T-0009: how the system behaves when the NLP service is down, hung or busy.
// Characterisation only: prints what happened, asserts nothing. Migration step M1
// (ARCHITECTURE.md §5) turns it into a red/green test.
//
//   node tests/arch/nlp-outage-probe.mjs              phases P-1 .. P-6
//   node tests/arch/nlp-outage-probe.mjs --phase 3    one phase (repeatable: --phase 1 --phase 2)
//
// P-1 NLP down : backend up, nothing on :8000. health, login, jobs, resume-status, upload, analyze.
// P-2 NLP hung : this script listens on :8000, accepts connections and never replies.
//                analyze with a 20 s client abort; /api/jobs and /api/health meanwhile.
// P-3 NLP busy : NLP up alone (no backend, no Supabase). GET / latency while a /parse
//                runs; one parse vs two concurrent parses.
//
// T-0015 adds P-4..P-6, which ASSERT: each row prints expected, observed and PASS/FAIL,
// and the probe exits 1 if any fails. P-1..P-3 stay descriptive until ROADMAP P2-1.
// They run a real analyze (NLP up, so the score is written) with github-evidence broken:
// P-4 down  : nothing on :8001.
// P-5 hung  : this script listens on :8001, accepts and never replies.
// P-6 rate-limited : the real github-evidence service on :8001 with a dummy GITHUB_TOKEN
//                and GITHUB_API_URL on a local stub that answers every request 403 with
//                x-ratelimit-remaining: 0 (no request leaves the machine).
// P-4..P-6 start the NLP service themselves (:8000) and need :8001 free. Run with
// GITHUB_EVIDENCE_TIMEOUT_MS=60000 to see P-5 fail (T-0015 red run).
// Result table: tests/.out/t0015-probe.md when any of P-4..P-6 runs.
//
// Live (P-1, P-2): logs in as t0001_cand and inserts one "[T-0001 TEST]" job owned by
// t0001_recr so analyze reaches the NLP call; P-1 also uploads f1 once (stored under
// candidates/<C>/). Sweeps before and after (lib/testdb.mjs guards apply).
// With NLP down or hung, analyze stops before any write: the NLP call
// (backend/Controllers/analysis.controller.js:262) precedes the storage/resumes/scores
// writes (:277, :303, :331). P-1/P-2 refuse to start if anything answers on :8000.
// Ports 5000 (backend) and 8000 (NLP) must be free: the current tree hardcodes both.
// Logs: tests/.out/t0009-probe-*.log; result table: tests/.out/t0009-probe.md
// (t0015-probe.md when P-4..P-6 run).
import { spawn, execFileSync } from 'node:child_process';
import { mkdirSync, openSync, readFileSync, writeFileSync } from 'node:fs';
import net from 'node:net';
import { join } from 'node:path';
import { performance } from 'node:perf_hooks';
import { REPO_DIR, TESTS_DIR, backendBaseUrl } from '../backend/lib/env.mjs';
import { login } from '../backend/lib/session.mjs';
import { client, counts, insertTestJob, isZero, liveConfig, resolveAccounts, sweep } from '../backend/lib/testdb.mjs';
import { startStub } from '../backend/lib/stub-server.mjs';

const BASE = backendBaseUrl();
const NLP = 'http://127.0.0.1:8000';
const OUT = join(TESTS_DIR, '.out');
const FIXTURE = join(TESTS_DIR, 'fixtures', 'f1_dev_github.pdf');
const HANG_LIMIT_MS = 20_000;
const GITHUB_EVIDENCE_PORT = 8001;
// Core's documented default (backend/Services/githubEvidence.js:19, ROADMAP §1.2). P-5's bound
// uses this, not the env, so a run with a longer GITHUB_EVIDENCE_TIMEOUT_MS fails.
const GITHUB_EVIDENCE_TIMEOUT_MS = 8000;
const SLACK_MS = 2000;
// Same job text and skills as insertTestJob (lib/testdb.mjs), for the direct /parse calls.
const JD = 'Synthetic job created by the T-0001 test harness and deleted in teardown. '
  + 'Backend engineer: Python, SQL, PostgreSQL, Docker, Git, REST API design.';
const REQUIRED = ['python', 'sql', 'postgresql', 'docker', 'git', 'rest api'];
const PREFERRED = ['react', 'redis', 'aws'];

const argPhases = process.argv.flatMap((a, i) => (a === '--phase' ? [Number(process.argv[i + 1])] : []));
const phases = argPhases.length ? argPhases : [1, 2, 3, 4, 5, 6];
const githubPhases = phases.filter((p) => p >= 4 && p <= 6);
mkdirSync(OUT, { recursive: true });

const rows = [];
const record = (phase, step, result, ms, note = '') => {
  rows.push({ phase, step, result, ms: ms == null ? '' : Math.round(ms), note });
  console.log(`${phase} | ${step} | ${result} | ${ms == null ? '' : Math.round(ms)} | ${note}`);
};
let failedChecks = 0;
// An asserting row (T-0015): Result is PASS or FAIL; the note carries expected and observed.
const check = (phase, step, expected, observed, ok, ms = null, extra = '') => {
  if (!ok) failedChecks += 1;
  record(phase, step, ok ? 'PASS' : 'FAIL', ms, `expected: ${expected}; observed: ${observed}${extra ? `; ${extra}` : ''}`);
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

// A TCP listener on 127.0.0.1 and ::1 (the backend resolves "localhost") that accepts
// connections and never replies. stats.accepted counts connections, stats.bytes what arrived.
async function hangStub(port) {
  const stats = { accepted: 0, bytes: 0 };
  const sockets = new Set();
  const onConn = (s) => { stats.accepted++; sockets.add(s); s.on('data', (d) => { stats.bytes += d.length; }); s.on('error', () => {}); };
  const servers = [net.createServer(onConn), net.createServer(onConn)];
  await Promise.all([
    new Promise((res, rej) => servers[0].once('error', rej).listen(port, '127.0.0.1', res)),
    new Promise((res) => servers[1].once('error', () => res()).listen({ port, host: '::1', ipv6Only: true }, res)),
  ]);
  return {
    stats,
    async close() {
      for (const s of sockets) s.destroy();
      await Promise.all(servers.map((s) => new Promise((res) => (s.listening ? s.close(() => res()) : res()))));
    },
  };
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
  const stub = await hangStub(8000);
  try {
    const analyze = timed(`${BASE}/api/analyze`, { method: 'POST', headers: { Cookie: cookie }, body: analyzeForm(jobId), timeoutMs: HANG_LIMIT_MS });
    await sleep(2000);
    let r = await timed(`${BASE}/api/jobs`, { headers: { Cookie: cookie } });
    record(P, 'GET /api/jobs while analyze is pending', r.status, r.ms);
    r = await timed(`${BASE}/api/health`);
    record(P, 'GET /api/health while analyze is pending', r.status, r.ms, clip(r.text, 80));
    const a = await analyze;
    record(P, `POST /api/analyze (client limit ${HANG_LIMIT_MS / 1000} s)`, a.status, a.ms,
      `stub on :8000 accepted ${stub.stats.accepted} connection(s), received ${stub.stats.bytes} bytes, sent nothing`);
  } finally {
    await stub.close();
  }
  await sleep(1000);
  const line = backendLog().split(/\r?\n/).find((l) => l.includes('[analyze] unhandled failure'));
  record(P, 'backend log after the stub closed the socket', line ? 'logged' : 'no log line', null, clip(line ?? ''));
}

// ---------------------------------------------------------------- T-0015 phases (asserting)
async function analyzeJson(cookie, jobId) {
  const r = await timed(`${BASE}/api/analyze`, { method: 'POST', headers: { Cookie: cookie }, body: analyzeForm(jobId), timeoutMs: HANG_LIMIT_MS });
  let body = null;
  try { body = JSON.parse(r.text); } catch { /* not JSON */ }
  return { ...r, body, gh: body?.subScores?.github_evidence, weights: body?.weights };
}

const describe = (a) => `${a.status} in ${Math.round(a.ms)} ms, available:${a.gh?.available}, reason_code:${a.gh?.components?.reason_code}, `
  + `parsing weight ${a.weights?.parsing_semantic_alignment}`;

async function jobsStillServed(P, cookie, step) {
  const r = await timed(`${BASE}/api/jobs`, { headers: { Cookie: cookie } });
  check(P, step, '200', String(r.status), r.status === 200, r.ms);
}

async function phase4(cookie, jobId, nlpMs) {
  const P = 'P-4 github-evidence down';
  if (await portOpen(GITHUB_EVIDENCE_PORT)) throw new Error('P-4: something answers on :8001; stop the github-evidence service first');
  const bound = nlpMs + SLACK_MS;
  const a = await analyzeJson(cookie, jobId);
  check(P, 'POST /api/analyze (f1)',
    `200 within ${Math.round(bound)} ms (NLP ${Math.round(nlpMs)} + ${SLACK_MS}); available:false, reason_code:service_unavailable, parsing weight 1`,
    describe(a),
    a.status === 200 && a.ms <= bound && a.gh?.available === false && a.gh?.components?.reason_code === 'service_unavailable'
      && a.weights?.parsing_semantic_alignment === 1, a.ms);
  await jobsStillServed(P, cookie, 'GET /api/jobs afterwards');
}

async function phase5(cookie, jobId, nlpMs) {
  const P = 'P-5 github-evidence hung';
  if (await portOpen(GITHUB_EVIDENCE_PORT)) throw new Error('P-5: something answers on :8001; stop the github-evidence service first');
  const bound = GITHUB_EVIDENCE_TIMEOUT_MS + nlpMs + SLACK_MS;
  const stub = await hangStub(GITHUB_EVIDENCE_PORT);
  try {
    let done = false;
    const analyze = analyzeJson(cookie, jobId).then((a) => { done = true; return a; });
    await sleep(1000);
    const r = await timed(`${BASE}/api/jobs`, { headers: { Cookie: cookie } });
    check(P, 'GET /api/jobs 1 s into analyze', '200 while analyze is still pending',
      `${r.status}, analyze ${done ? 'already returned' : 'still pending'}`, r.status === 200 && !done, r.ms);
    const a = await analyze;
    check(P, 'POST /api/analyze (f1)',
      `200 within ${Math.round(bound)} ms (${GITHUB_EVIDENCE_TIMEOUT_MS} + NLP ${Math.round(nlpMs)} + ${SLACK_MS}); available:false, reason_code:timeout`,
      describe(a), a.status === 200 && a.ms <= bound && a.gh?.available === false && a.gh?.components?.reason_code === 'timeout', a.ms);
    check(P, 'connections the stub saw', '1 (a timeout is not retried)', String(stub.stats.accepted), stub.stats.accepted === 1, null,
      `received ${stub.stats.bytes} bytes, sent nothing`);
  } finally {
    await stub.close();
  }
  await jobsStillServed(P, cookie, 'GET /api/jobs afterwards');
}

async function phase6(cookie, jobId, nlpMs) {
  const P = 'P-6 GitHub rate-limited';
  if (await portOpen(GITHUB_EVIDENCE_PORT)) throw new Error('P-6: something answers on :8001; stop the github-evidence service first');
  const bound = nlpMs + 2 * SLACK_MS; // service answers at once; the extra 2 s is for the service round trip
  const gh = await startStub({
    port: 0,
    handler: (req, res) => {
      res.writeHead(403, {
        'content-type': 'application/json',
        'x-ratelimit-limit': '5000',
        'x-ratelimit-remaining': '0',
        'x-ratelimit-reset': String(Math.floor(Date.now() / 1000) + 600),
      });
      res.end(JSON.stringify({ message: 'API rate limit exceeded' }));
    },
  });
  const python = join(REPO_DIR, 'github-evidence', 'venv', process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python');
  const svc = startProcess('github-evidence', python,
    ['-m', 'uvicorn', 'app.main:app', '--host', '127.0.0.1', '--port', String(GITHUB_EVIDENCE_PORT)],
    join(REPO_DIR, 'github-evidence'), { GITHUB_TOKEN: 'dummy-token-t0015', GITHUB_API_URL: `http://127.0.0.1:${gh.port}` });
  try {
    if (!(await waitHttp(`http://127.0.0.1:${GITHUB_EVIDENCE_PORT}/health`, 60))) {
      throw new Error('P-6: github-evidence did not become healthy (see tests/.out/t0009-probe-github-evidence.err.log)');
    }
    const first = await analyzeJson(cookie, jobId);
    const afterFirst = gh.requests.length;
    check(P, 'POST /api/analyze (f1), first',
      `200 within ${Math.round(bound)} ms; available:false, reason_code:github_rate_limited; GitHub stub got 1 request`,
      `${describe(first)}; stub requests ${afterFirst}`,
      first.status === 200 && first.ms <= bound && first.gh?.available === false
        && first.gh?.components?.reason_code === 'github_rate_limited' && afterFirst === 1, first.ms);
    const second = await analyzeJson(cookie, jobId);
    const extra = gh.requests.length - afterFirst;
    check(P, 'POST /api/analyze (f1), second',
      '200; reason_code:github_rate_limited; 0 more GitHub requests (low-water mark)',
      `${describe(second)}; ${extra} more`,
      second.status === 200 && second.gh?.components?.reason_code === 'github_rate_limited' && extra === 0, second.ms);
    check(P, 'GitHub traffic', 'only the local stub saw requests (GITHUB_API_URL is the stub)',
      `stub log: ${gh.requests.map((q) => `${q.method} ${q.path}`).join(', ') || 'none'}`, gh.requests.length === 1);
  } finally {
    stopProcess(svc);
    await gh.close();
  }
}

// P-4..P-6 need a score to be produced, so NLP must be up: start it, time one warm parse, run the phases.
async function runGithubPhases(cookie, jobId) {
  if (await portOpen(8000)) throw new Error('P-4..P-6: :8000 is already in use (they start the NLP service themselves)');
  const python = join(REPO_DIR, 'nlp-engine', process.platform === 'win32' ? 'venv/Scripts/python.exe' : 'venv/bin/python');
  const nlp = startProcess('nlp-github', python, ['-m', 'uvicorn', 'app.main:app', '--host', '127.0.0.1', '--port', '8000'],
    join(REPO_DIR, 'nlp-engine'), { PYTHONHASHSEED: '0', HF_HUB_OFFLINE: '1', TRANSFORMERS_OFFLINE: '1' });
  try {
    if (!(await waitHttp(`${NLP}/`, 240))) throw new Error('NLP did not become healthy (see tests/.out/t0009-probe-nlp-github.err.log)');
    await timed(`${NLP}/parse`, { method: 'POST', body: parseForm() }); // warm-up
    const nlpMs = (await timed(`${NLP}/parse`, { method: 'POST', body: parseForm() })).ms;
    record('P-4..P-6 setup', 'POST /parse alone (the NLP time the bounds use)', 200, nlpMs);
    if (phases.includes(4)) await phase4(cookie, jobId, nlpMs);
    if (phases.includes(5)) await phase5(cookie, jobId, nlpMs);
    if (phases.includes(6)) await phase6(cookie, jobId, nlpMs);
  } finally {
    stopProcess(nlp);
  }
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
const live = phases.includes(1) || phases.includes(2) || githubPhases.length > 0;
let sb;
let ids;
let backend;
let failure;
try {
  if (live) {
    const cfg = liveConfig();
    if (cfg.missing.length) throw new Error(`tests/.env is missing ${cfg.missing.join(', ')}`);
    if (await portOpen(5000)) throw new Error(':5000 is already in use; stop the running backend first');
    if (await portOpen(8000)) throw new Error(':8000 is already in use; P-1/P-2 need the NLP service stopped (P-4..P-6 start their own)');
    if (githubPhases.length && await portOpen(GITHUB_EVIDENCE_PORT)) throw new Error(':8001 is already in use; P-4..P-6 need the github-evidence service stopped');
    sb = client();
    ids = await resolveAccounts(sb, cfg);
    console.log('pre-run sweep removed:', JSON.stringify(await sweep(sb, ids)));
    const jobId = await insertTestJob(sb, ids.R);

    backend = startProcess('backend', process.execPath, ['index.js'], join(REPO_DIR, 'backend'),
      githubPhases.length ? { GITHUB_EVIDENCE_URL: `http://localhost:${GITHUB_EVIDENCE_PORT}` } : {});
    if (!(await waitHttp(`${BASE}/api/health`, 60))) throw new Error('backend did not become healthy (see tests/.out/t0009-probe-backend.*.log)');
    const t = performance.now();
    const cookie = await login(cfg.candidateUsername, cfg.candidatePassword);
    record('P-1 NLP down', 'POST /api/auth/login (t0001_cand)', 200, performance.now() - t);

    if (phases.includes(1)) await phase1(cookie, jobId);
    if (phases.includes(2)) await phase2(cookie, jobId);
    if (githubPhases.length) await runGithubPhases(cookie, jobId);
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
const outName = githubPhases.length ? 't0015-probe.md' : 't0009-probe.md';
writeFileSync(join(OUT, outName), `${md}\n`);
console.log(`\n${md}\n\n(table also written to tests/.out/${outName})`);
if (failure) {
  console.error(`probe stopped: ${failure.message}`);
  process.exit(1);
}
if (failedChecks) {
  console.error(`${failedChecks} expected row(s) FAILED`);
  process.exit(1);
}
