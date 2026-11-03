// T-0029 helpers for the assessment live tests: seed attempts and score rows
// through the service role, and sign a test account in directly to GoTrue with
// the public anon key (what an attacker can do without the backend).
//
// Seeded attempts are MCQ-only, so evaluate grades them deterministically in
// assessment-service with no LLM call. Every row is owned by a t0001_ account
// and removed by testdb.sweep() (assessments, scores, resumes, applications).
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { REPO_DIR, TESTS_DIR, readEnvFile } from './env.mjs';

const requireFromBackend = createRequire(join(REPO_DIR, 'backend', 'package.json'));
const { createClient } = requireFromBackend('@supabase/supabase-js');

const backendEnv = () => readEnvFile(join(REPO_DIR, 'backend', '.env'));

export const ASSESSMENT_URL = (process.env.ASSESSMENT_SERVICE_URL || 'http://127.0.0.1:8002').replace(/\/+$/, '');

export async function assessmentServiceUp() {
  // Two tries with a generous timeout: a cold first request can be slow, and a
  // wrong "down" verdict would silently skip (or wrongly run) a whole file.
  for (let i = 0; i < 2; i += 1) {
    try {
      const r = await fetch(`${ASSESSMENT_URL}/`, { signal: AbortSignal.timeout(10000) });
      if (r.ok) return true;
    } catch { /* retry */ }
  }
  return false;
}

// A fresh anon client (no shared session state between calls).
export function anonClient() {
  const be = backendEnv();
  if (!be.SUPABASE_URL || !be.SUPABASE_ANON_KEY) {
    throw new Error('backend/.env is missing SUPABASE_URL or SUPABASE_ANON_KEY');
  }
  return createClient(be.SUPABASE_URL, be.SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export const supabaseUrl = () => backendEnv().SUPABASE_URL.replace(/\/+$/, '');
export const anonKey = () => backendEnv().SUPABASE_ANON_KEY;

// Sign a t0001_ account in to GoTrue directly and return its access token.
export async function directAccessToken(sb, userId, password) {
  if (!password) throw new Error('directAccessToken: no password');
  const { data: user, error: userError } = await sb.auth.admin.getUserById(userId);
  if (userError || !user?.user?.email) throw new Error(`email lookup failed for ${userId}: ${userError?.message}`);
  const anon = anonClient();
  const { data, error } = await anon.auth.signInWithPassword({ email: user.user.email, password });
  if (error || !data?.session) throw new Error(`direct GoTrue sign-in failed: ${error?.message}`);
  return data.session.access_token;
}

// Raw PostgREST GET with a user's token: { status, body }.
export async function restGet(token, pathAndQuery) {
  const r = await fetch(`${supabaseUrl()}/rest/v1/${pathAndQuery}`, {
    headers: { apikey: anonKey(), Authorization: `Bearer ${token}` },
  });
  const text = await r.text();
  let body = null;
  try { body = JSON.parse(text); } catch { body = text; }
  return { status: r.status, body };
}

// Does the T-0029 key table exist yet (M2 applied)?
export async function keyTableExists(sb) {
  // Not a HEAD request: on a missing table supabase-js reports a HEAD 404 with no error object.
  const { error, status } = await sb.from('assessment_keys').select('assessment_id').limit(1);
  return !error && status >= 200 && status < 300;
}

const options = (i) => ['A', 'B', 'C', 'D'].map((label) => ({ label, text: `Option ${label} for question ${i}` }));

// questions bundle and answer-key bundle in the shapes the backend stores.
export function mcqBundles(assessmentId, count = 4) {
  const questions = Array.from({ length: count }, (_, i) => ({
    question_id: `q${i + 1}`,
    question_type: 'mcq',
    question: `T-0029 seeded question ${i + 1}?`,
    options: options(i + 1),
    skill: 'python',
    source: 'jd',
  }));
  const answers = questions.map((q) => ({
    question_id: q.question_id,
    correct_option: 'B',
    explanation: `T-0029 SECRET-KEY-MARKER explanation for ${q.question_id}`,
  }));
  return {
    questions: { assessment_id: assessmentId, model_used: 't0029-seed', prompt_version: 't0029', questions },
    answerKey: { assessment_id: assessmentId, answers },
    // Half right, half wrong: score 50.
    responses: questions.map((q, i) => ({ question_id: q.question_id, response: i % 2 === 0 ? 'B' : 'A' })),
  };
}

// Seed one attempt for candidate C on jobId. Works on every schema step:
// before M2 the key goes into assessments.answer_key; from M2 on it goes into
// assessment_keys (and assessments.answer_key is left out).
export async function seedAssessment(sb, { candidateId, jobId, status = 'generated', gradingStartedAt = null }) {
  const id = crypto.randomUUID();
  const b = mcqBundles(id);
  const split = await keyTableExists(sb);
  const row = {
    id,
    candidate_id: candidateId,
    job_id: jobId,
    questions: b.questions,
    status,
    model_used: 't0029-seed',
    prompt_version: 't0029',
    ...(gradingStartedAt ? { grading_started_at: gradingStartedAt } : {}),
    ...(split ? {} : { answer_key: b.answerKey }),
  };
  const { error } = await sb.from('assessments').insert(row);
  if (error) throw new Error(`seed assessment failed: ${error.message}`);
  if (split) {
    const { error: keyError } = await sb.from('assessment_keys').insert({ assessment_id: id, answer_key: b.answerKey });
    if (keyError) throw new Error(`seed assessment key failed: ${keyError.message}`);
  }
  return { id, ...b };
}

// A resumes row plus a parsing-only scores row for C/job, built by the real
// explainability layer from the f1 NLP snapshot, so evaluate has a score to fold into.
export async function seedScore(sb, { candidateId, jobId }) {
  const X = await import(
    new URL(`file:///${join(REPO_DIR, 'backend', 'Services', 'explainability.js').replace(/\\/g, '/')}`)
  );
  const nlp = JSON.parse(readFileSync(join(TESTS_DIR, 'nlp', 'snapshots', 'current', 'f1_dev_github.json'), 'utf8'));
  const { data: resume, error: resumeError } = await sb
    .from('resumes')
    .insert({ candidate_id: candidateId, job_id: jobId, file_name: 't0029-seed.pdf', parser_version: 't0029-seed' })
    .select('id')
    .single();
  if (resumeError) throw new Error(`seed resume failed: ${resumeError.message}`);
  const score = X.buildScoreRecord(nlp);
  const { data, error } = await sb
    .from('scores')
    .insert({
      resume_id: resume.id,
      candidate_id: candidateId,
      job_id: jobId,
      composite_score: score.composite,
      subscores: score.subscores,
      weights: score.weights,
      explanation: score.explanation,
      evidence_limited: score.evidence_limited,
    })
    .select('id')
    .single();
  if (error) throw new Error(`seed score failed: ${error.message}`);
  return data.id;
}

// Recursively collect every object key in a JSON value.
export function allKeys(value, out = new Set()) {
  if (Array.isArray(value)) value.forEach((v) => allKeys(v, out));
  else if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) { out.add(k); allKeys(v, out); }
  }
  return out;
}
