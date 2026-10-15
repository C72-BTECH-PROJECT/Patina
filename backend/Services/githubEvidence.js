// Core's client for the github-evidence service (T-0014, ROADMAP P1-4).
//
// Contract: github-evidence/README.md ("Contract v1"). Core-side settings and
// the reason codes: ROADMAP §1.2 and §1.3.
//
//   GITHUB_EVIDENCE_URL         default http://localhost:8001; empty = disabled
//   GITHUB_EVIDENCE_TIMEOUT_MS  default 8000 (longer than the service's 6 s deadline)
//
// Both are read on every call, not at import.
//
// fetchGithubEvidence() never throws. Every failure becomes a reason code, and
// explainability.js turns it into an "unavailable" sub-score with a stated
// reason, never a zero (GF-4).
import { postJson } from './internalHttp.js';

const DEFAULT_URL = 'http://localhost:8001';
const DEFAULT_TIMEOUT_MS = 8000;
const WINDOW_DAYS = 365;
const MAX_CLAIMED_SKILLS = 200; // the service rejects more

export const REASON_CODES = [
  'no_github_link',
  'invalid_github_link',
  'github_user_not_found',
  'no_public_repositories',
  'insufficient_evidence',
  'github_rate_limited',
  'service_unavailable',
  'timeout',
  'service_error',
  'service_disabled',
];

// A login: 1-39 ASCII letters, digits and single hyphens, no hyphen at either end
// (the service applies the same rule, github-evidence/README.md).
const LOGIN_RE = /^[A-Za-z0-9](?:[A-Za-z0-9]|-(?=[A-Za-z0-9])){0,38}$/;

// First path segments that are GitHub pages, not accounts.
const RESERVED = new Set([
  'about', 'account', 'apps', 'codespaces', 'collections', 'contact', 'customer-stories', 'dashboard',
  'enterprise', 'events', 'explore', 'features', 'issues', 'join', 'login', 'logout', 'marketplace',
  'new', 'notifications', 'organizations', 'orgs', 'pricing', 'pulls', 'readme', 'search', 'security',
  'settings', 'site', 'sponsors', 'team', 'topics', 'trending', 'users',
]);

/**
 * The GitHub login named by a resume link, or null.
 * `github.com/<login>`, with or without scheme, `www.`, a trailing slash or a repo path.
 */
export const normaliseGithubLogin = (link) => {
  if (typeof link !== 'string') return null;
  const m = link.trim().match(/^(?:https?:\/\/)?(?:www\.)?github\.com\/([^/?#\s]+)/i);
  if (!m) return null;
  const login = m[1];
  if (!LOGIN_RE.test(login) || RESERVED.has(login.toLowerCase())) return null;
  return login;
};

const readConfig = () => {
  const url = process.env.GITHUB_EVIDENCE_URL ?? DEFAULT_URL;
  const timeout = Number(process.env.GITHUB_EVIDENCE_TIMEOUT_MS);
  return {
    url: url.trim().replace(/\/+$/, ''),
    timeoutMs: Number.isFinite(timeout) && timeout > 0 ? timeout : DEFAULT_TIMEOUT_MS,
  };
};

const fail = (reasonCode) => ({ ok: false, reasonCode });

// HTTP outcome -> reason code (ROADMAP §1.3; a 404 counts as "user not found"
// only when the service says so, any other 404 is a misconfiguration).
const reasonForError = (err) => {
  if (err?.kind === 'timeout') return 'timeout';
  if (err?.kind === 'unreachable') return 'service_unavailable';
  if (err?.kind === 'bad_status') {
    if (err.status === 404 && err.errorCode === 'github_user_not_found') return 'github_user_not_found';
    if (err.status === 503 && err.errorCode === 'github_rate_limited') return 'github_rate_limited';
    if (err.status === 502 || err.status === 503) return 'service_unavailable';
  }
  return 'service_error';
};

// A 200 is only usable if it carries a sub-score in the contract's shape.
const reasonForBody = (body) => {
  const sub = body?.sub_score;
  if (!body || typeof body !== 'object' || !sub || typeof sub !== 'object') return 'service_error';
  if (sub.available === true) {
    return Number.isFinite(sub.value) && sub.value >= 0 && sub.value <= 1 ? null : 'service_error';
  }
  if (sub.reason_code === 'no_public_repositories' || sub.reason_code === 'insufficient_evidence') {
    return sub.reason_code;
  }
  return 'service_error';
};

/**
 * Ask github-evidence about the resume's GitHub link.
 * Returns { ok: true, evidence, requestId } or { ok: false, reasonCode }.
 */
export async function fetchGithubEvidence({ githubLink, claimedSkills, requestId } = {}) {
  try {
    const { url, timeoutMs } = readConfig();
    if (!url) return fail('service_disabled');
    if (typeof githubLink !== 'string' || !githubLink.trim()) return fail('no_github_link');
    const username = normaliseGithubLogin(githubLink);
    if (!username) return fail('invalid_github_link');

    const claimed = (Array.isArray(claimedSkills) ? claimedSkills : [])
      .filter((s) => typeof s === 'string' && s.length > 0)
      .slice(0, MAX_CLAIMED_SKILLS);

    let evidence;
    try {
      evidence = await postJson(
        `${url}/v1/evidence`,
        { username, claimed_skills: claimed, window_days: WINDOW_DAYS },
        { timeoutMs, requestId }
      );
    } catch (err) {
      return fail(reasonForError(err));
    }

    const reason = reasonForBody(evidence);
    if (reason) return fail(reason);
    return { ok: true, evidence, requestId: requestId ?? evidence.request_id ?? null };
  } catch {
    return fail('service_error');
  }
}
