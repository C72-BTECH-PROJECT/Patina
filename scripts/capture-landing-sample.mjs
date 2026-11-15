// Card D-9 (DESIGN_SPEC §8, O-10 replacement): capture the landing page's sample card from one
// real stored score.
//
//   node scripts/capture-landing-sample.mjs <applicationId> [--fixture <résumé file name>]
//
// Run it after staging the demo candidate (e.g. the support/maintenance fixture applied to a
// support job and scored). It READS the database (selects only; nothing is written to it),
// picks the score the result endpoint would show, and writes ONLY
//   frontend/src/data/landingSample.json
// A refusal (a leak scan hit, a missing application or score) exits non-zero and writes
// nothing. Credentials come from backend/.env and are never printed. Printed on success: the
// composite, band, job title and the output path.
//
// Which score: GET /api/applications/:id/result (analysis.controller.js getApplicationResult)
// shows the NEWEST `scores` row for the application's candidate and job. This does the same
// query. Band and verification come from core's own scoreBand / scoreVerification, so they are
// what the app shows; the composite is Number(composite_score), unrounded.
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readEnvFile } from '../tests/backend/lib/env.mjs';
import { buildSample, scanSample } from './capture-landing-sample.lib.mjs';

const REPO_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT_FILE = join(REPO_DIR, 'frontend', 'src', 'data', 'landingSample.json');
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// A refusal throws; main() prints it and sets the exit code. (process.exit() while the
// Supabase client still has sockets open trips a libuv assertion on Windows, exit 127.)
class Refusal extends Error {
  constructor(message, code = 1) {
    super(message);
    this.code = code;
  }
}
const fail = (message, code = 1) => {
  throw new Refusal(message, code);
};

function parseArgs(argv) {
  const args = { applicationId: null, fixture: null };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--fixture') {
      args.fixture = argv[i + 1] ?? null;
      i += 1;
      if (!args.fixture || args.fixture.startsWith('--')) fail('--fixture needs a résumé file name', 2);
    } else if (!args.applicationId && !argv[i].startsWith('--')) {
      args.applicationId = argv[i];
    } else {
      fail(`unexpected argument: ${argv[i]}`, 2);
    }
  }
  if (!args.applicationId) fail('usage: node scripts/capture-landing-sample.mjs <applicationId> [--fixture <résumé file name>]', 2);
  if (!UUID.test(args.applicationId)) fail('the application id must be a UUID', 2);
  return args;
}

// Same pattern as tests/backend/lib/testdb.mjs client(): the service-role client, from
// backend/.env, loaded from the backend's own node_modules. Nothing about it is logged.
function client() {
  const be = readEnvFile(join(REPO_DIR, 'backend', '.env'));
  if (!be.SUPABASE_URL || !be.SUPABASE_SERVICE_ROLE_KEY) fail('backend/.env is missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  const { createClient } = createRequire(join(REPO_DIR, 'backend', 'package.json'))('@supabase/supabase-js');
  return createClient(be.SUPABASE_URL, be.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

const dbFail = (what, error) => fail(`${what} failed: ${error?.message || 'database error'}`);

async function main() {
  const { applicationId, fixture } = parseArgs(process.argv.slice(2));
  const sb = client();

  const { data: app, error: appError } = await sb
    .from('applications')
    .select('id, candidate_id, job_id, job:jobs(id, title)')
    .eq('id', applicationId)
    .maybeSingle();
  if (appError) dbFail('application lookup', appError);
  if (!app) fail('no application has that id');

  const { data: score, error: scoreError } = await sb
    .from('scores')
    .select('id, resume_id, candidate_id, job_id, composite_score, subscores, weights, explanation, evidence_limited, created_at')
    .eq('candidate_id', app.candidate_id)
    .eq('job_id', app.job_id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (scoreError) dbFail('score lookup', scoreError);
  if (!score) fail('that application has no score yet');

  // The candidate's own identifying values, fetched ONLY to compare against the output.
  // They are never printed and never written.
  const identity = [];
  const { data: profile, error: profileError } = await sb.from('profiles').select('*').eq('id', app.candidate_id).maybeSingle();
  if (profileError) dbFail('profile lookup', profileError);
  const SKIP_KEY = /(^id$|_id$|role|status|created|updated|_at$)/i;
  for (const [key, value] of Object.entries(profile || {})) {
    if (typeof value === 'string' && !SKIP_KEY.test(key) && value.length <= 200) identity.push({ kind: `profile ${key}`, value });
  }
  if (score.resume_id) {
    const { data: resume, error: resumeError } = await sb.from('resumes').select('contact').eq('id', score.resume_id).maybeSingle();
    if (resumeError) dbFail('résumé lookup', resumeError);
    for (const [key, value] of Object.entries(resume?.contact || {})) {
      if (typeof value === 'string') identity.push({ kind: `résumé contact ${key}`, value });
    }
  }
  if (!identity.length) fail('could not read the candidate\'s identity fields to check the output against; refusing to write');

  let sample;
  try {
    sample = buildSample({
      score,
      jobTitle: app.job?.title,
      fixture,
      capturedAt: new Date().toISOString(),
    });
  } catch (err) {
    throw new Refusal(`cannot build the sample: ${err.message}`);
  }

  const problems = scanSample(sample, identity);
  if (problems.length) {
    fail(`refusing to write: the sample ${problems.join('; ')}. Nothing was written.`);
  }

  mkdirSync(dirname(OUT_FILE), { recursive: true });
  writeFileSync(OUT_FILE, `${JSON.stringify(sample, null, 2)}\n`, 'utf8');
  console.log(`composite: ${sample.composite}`);
  console.log(`band: ${sample.band}`);
  console.log(`job: ${sample.job_title}`);
  console.log(`written: ${OUT_FILE}`);
}

main().catch((err) => {
  if (err instanceof Refusal) {
    console.error(`capture-landing-sample: ${err.message}`);
    process.exitCode = err.code;
  } else {
    console.error(`capture-landing-sample: unexpected error: ${err?.message || 'unknown'}`);
    process.exitCode = 1;
  }
});
