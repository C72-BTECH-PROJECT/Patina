// Pure parts of scripts/capture-landing-sample.mjs (card D-9): turn one stored `scores`
// row into the landing page's sample object, and scan that object for anything that could
// identify a person. No database, no file writes, no logging here, so it is unit-tested
// (scripts/capture-landing-sample.test.mjs).
//
// The band and verification come from core's own functions (backend/Services/explainability.js),
// the ones getApplicationResult -> serializeCandidate uses, so they are what the app shows.
// The composite is Number(score.composite_score), unrounded, as serializeCandidate sends it.
import { scoreBand, scoreVerification } from '../backend/Services/explainability.js';

export const SAMPLE_SKILL_ROWS = 6;
const SKILL_STATUSES = ['evidenced', 'claimed_only', 'not_found'];

const isText = (v) => typeof v === 'string' && v.trim() !== '';
const isNum = (v) => typeof v === 'number' && Number.isFinite(v);

// Same reading of a pre-R-28 row as the app's skillRowView (ScoreBreakdown.jsx): GitHub
// `evidenced` is the only confirmation it recorded, so a résumé match is "claimed only".
const skillStatusOf = (row) => {
  if (row?.marks && typeof row.marks === 'object') return row.status;
  const status = row?.status;
  if (!['matched', 'missing', 'claimed_only'].includes(status)) return status;
  if (row?.sources?.github === 'evidenced') return 'evidenced';
  return status === 'missing' ? 'not_found' : 'claimed_only';
};

/**
 * The sample object for one stored score, with only the fields the landing card shows.
 * Throws an Error (message safe to print: it names fields, never values) when the row
 * lacks something the card needs. Nothing is defaulted or recomputed.
 *
 * @param {{ score: object, jobTitle: string, fixture: string|null, capturedAt: string }} input
 */
export function buildSample({ score, jobTitle, fixture, capturedAt }) {
  if (!score || typeof score !== 'object') throw new Error('no score row');
  const explanation = score.explanation;
  if (!explanation || typeof explanation !== 'object') throw new Error('the score row has no stored explanation');

  const composite = Number(score.composite_score);
  if (score.composite_score === null || score.composite_score === undefined || !isNum(composite)) {
    throw new Error('the score row has no composite_score');
  }
  const band = scoreBand(score.composite_score);
  const verification = scoreVerification(score.subscores || {});
  if (!band) throw new Error('the score has no band');
  if (!verification) throw new Error('the score has no verification state');

  if (!Array.isArray(explanation.factors) || explanation.factors.length === 0) {
    throw new Error('the stored explanation has no factors');
  }
  const factors = explanation.factors.map((f, i) => {
    if (!f || !isText(f.key) || !isText(f.label) || !isText(f.direction) || typeof f.available !== 'boolean') {
      throw new Error(`factor ${i} is missing key, label, direction or available`);
    }
    const out = { key: f.key, label: f.label, available: f.available, direction: f.direction };
    if (f.available) {
      for (const field of ['value', 'weight', 'weight_pct', 'contribution']) {
        if (!isNum(f[field])) throw new Error(`factor ${i} is available but its ${field} is not a number`);
        out[field] = f[field];
      }
    }
    return out;
  });

  const rows = Array.isArray(explanation.skill_evidence) ? explanation.skill_evidence : [];
  const skills = rows.slice(0, SAMPLE_SKILL_ROWS).map((row, i) => {
    const status = skillStatusOf(row);
    if (!isText(row?.name) || !SKILL_STATUSES.includes(status)) {
      throw new Error(`skill row ${i} has no name or an unknown status`);
    }
    return { skill: row.name, status };
  });

  if (!isText(explanation.weights_version)) throw new Error('the stored explanation has no weights_version');
  const generatedAt = isText(explanation.generated_at) ? explanation.generated_at : score.created_at;
  if (!isText(generatedAt) || Number.isNaN(new Date(generatedAt).getTime())) {
    throw new Error('the score has no usable generated_at or created_at');
  }
  if (!isText(jobTitle)) throw new Error('the job has no title');

  return {
    composite,
    band,
    verification,
    factors,
    skills,
    weights_version: explanation.weights_version,
    generated_at: generatedAt,
    job_title: jobTitle,
    provenance: {
      captured_from: 'scores row via scripts/capture-landing-sample.mjs',
      captured_at: capturedAt,
      fixture: fixture || null,
    },
  };
}

// --- The leak scan -----------------------------------------------------------

const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
const SPEC_CHECK_RE = /@|email|name"/i; // DESIGN_SPEC D-9 check

/**
 * Lower-cased tokens (3+ characters) from the values that identify the candidate. An
 * email contributes its local part, a URL its last path segment (never "https" / "com");
 * any other text is split on non-alphanumerics and also kept whole.
 * `values` is an array of { kind, value }; returns [{ kind, token }].
 */
export function identityTokens(values) {
  const out = [];
  const add = (kind, token) => {
    const t = String(token).trim().toLowerCase();
    if (t.length >= 3) out.push({ kind, token: t });
  };
  for (const { kind, value } of values) {
    if (!isText(value)) continue;
    const v = value.trim();
    if (v.includes('@')) {
      add(kind, v);
      add(kind, v.split('@')[0]);
    } else if (/^https?:\/\//i.test(v) || /^(www\.)?[a-z0-9.-]+\.[a-z]{2,}\//i.test(v)) {
      const last = v.replace(/[?#].*$/, '').split('/').filter(Boolean).pop();
      add(kind, last);
    } else {
      add(kind, v);
      for (const part of v.split(/[^a-z0-9]+/i)) add(kind, part);
    }
  }
  return out;
}

/**
 * Scan the serialised sample. Returns a list of problems, each a short rule name and,
 * for an identity match, the KIND of field it matched (never the value). Empty list = clean.
 */
export function scanSample(sample, identityValues = []) {
  const text = JSON.stringify(sample);
  const problems = [];
  if (text.includes('@')) problems.push('contains "@"');
  if (UUID_RE.test(text)) problems.push('contains a UUID-shaped string');
  if (/http/i.test(text)) problems.push('contains "http"');
  if (/github\.com/i.test(text)) problems.push('contains "github.com"');
  if (SPEC_CHECK_RE.test(text)) problems.push('matches the spec check /@|email|name"/i');
  const lower = text.toLowerCase();
  const kinds = new Set();
  for (const { kind, token } of identityTokens(identityValues)) {
    if (lower.includes(token)) kinds.add(kind);
  }
  for (const kind of kinds) problems.push(`contains a token of the candidate's ${kind}`);
  return problems;
}
