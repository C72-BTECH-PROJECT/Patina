// Skill search and skills-from-text for the job form (card R-32, MUST 6).
//
//   GET  /api/skills?q=react      search the parser's skill vocabulary
//   POST /api/skills/extract      { text } -> the skills the parser finds in it
//
// Both are recruiter-only (Routes/skills.routes.js) and read nlp-engine, the one skill
// vocabulary (nlp-engine/app/ner.py): GET /skills/vocabulary and POST /skills/extract
// (nlp-engine/app/main.py). Nothing here adds a skill to a job: the form shows these as
// suggestions and the recruiter picks them.
//
// When nlp-engine cannot answer, both answer 503 `suggestions_unavailable`; the form then
// still accepts typed skills and says suggestions are unavailable. Nothing is invented.
import { createTimeoutFetch, postJson } from '../Services/internalHttp.js';
import { logError, sendError } from '../Middlewares/errorHandler.js';

export const SEARCH_QUERY_LIMIT = 100;
export const SEARCH_RESULT_LIMIT = 20;
// Same limit as nlp-engine's SKILLS_TEXT_LIMIT, checked here so an over-long text never leaves core.
export const EXTRACT_TEXT_LIMIT = 50_000;
const VOCABULARY_TTL_MS_DEFAULT = 10 * 60 * 1000;
const NLP_SKILLS_TIMEOUT_MS_DEFAULT = 10_000;

const UNAVAILABLE = {
  status: 503,
  error: 'suggestions_unavailable',
  message: 'Skill suggestions are unavailable right now. You can still type a skill and add it.',
};

// The same nlp-engine address as the resume pipeline (Services/resumePipeline.js nlpParseUrl);
// the skill endpoints sit beside /parse.
const nlpUrl = (path) => new URL(path, process.env.NLP_PARSE_URL || 'http://127.0.0.1:8000/parse').toString();
const positiveEnv = (name, fallback) => {
  const n = Number(process.env[name]);
  return Number.isFinite(n) && n > 0 ? n : fallback;
};
const nlpTimeoutMs = () => positiveEnv('NLP_SKILLS_TIMEOUT_MS', NLP_SKILLS_TIMEOUT_MS_DEFAULT);

// ---- Normalisation: nlp-engine's normalize_skill (app/ner.py), with its alias table ----

const EDGE_CHARS = ' \t.,:;/|()[]-';
const stripEdges = (s) => {
  let start = 0;
  let end = s.length;
  while (start < end && EDGE_CHARS.includes(s[start])) start += 1;
  while (end > start && EDGE_CHARS.includes(s[end - 1])) end -= 1;
  return s.slice(start, end);
};

/** Lower case, inner whitespace collapsed, edge punctuation removed (normalize_skill without its aliases). */
export const basicSkillForm = (raw) => stripEdges(String(raw ?? '').split(/\s+/).filter(Boolean).join(' ').toLowerCase());

/** alias -> canonical name, from the vocabulary's own entries. */
export const aliasMap = (vocabulary) => {
  const map = new Map();
  for (const { name, aliases } of vocabulary) {
    map.set(name, name);
    for (const alias of aliases) if (!map.has(alias)) map.set(alias, name);
  }
  return map;
};

/**
 * Search the vocabulary. Ranked: the name a query resolves to (by name or alias), then names
 * starting with it, aliases starting with it, names containing it, aliases containing it; then
 * shorter names first. `exact` marks the entry the query resolves to.
 */
export const searchVocabulary = (vocabulary, query, limit = SEARCH_RESULT_LIMIT) => {
  const q = basicSkillForm(query);
  if (!q) return [];
  const resolved = aliasMap(vocabulary).get(q) || null;
  const ranked = [];
  for (const entry of vocabulary) {
    let rank = null;
    if (entry.name === resolved) rank = 0;
    else if (entry.name.startsWith(q)) rank = 1;
    else if (entry.aliases.some((a) => a.startsWith(q))) rank = 2;
    else if (entry.name.includes(q)) rank = 3;
    else if (entry.aliases.some((a) => a.includes(q))) rank = 4;
    if (rank !== null) ranked.push({ rank, entry });
  }
  ranked.sort((a, b) => a.rank - b.rank
    || a.entry.name.length - b.entry.name.length
    || a.entry.name.localeCompare(b.entry.name));
  return ranked.slice(0, limit).map(({ rank, entry }) => ({
    name: entry.name,
    aliases: entry.aliases,
    exact: rank === 0,
  }));
};

// ---- The vocabulary, read from nlp-engine and kept for a while once read ----

let cached = null;   // { at, parserVersion, skills }
let inFlight = null;

/** Tests only: forget the cached vocabulary. */
export const resetSkillVocabularyCache = () => {
  cached = null;
  inFlight = null;
};

const isVocabulary = (body) => Array.isArray(body?.skills) && body.skills.every((e) =>
  typeof e?.name === 'string' && e.name !== ''
  && Array.isArray(e.aliases) && e.aliases.every((a) => typeof a === 'string'));

class VocabularyUnavailable extends Error {
  constructor(detail) {
    super(`skill vocabulary unavailable: ${detail}`);
    this.name = 'VocabularyUnavailable';
  }
}

async function fetchVocabulary(requestId) {
  const timeoutMs = nlpTimeoutMs();
  const timedFetch = createTimeoutFetch({ timeoutMs, timeoutCode: 'NLP_TIMEOUT', label: 'NLP vocabulary' });
  const headers = { Accept: 'application/json' };
  if (requestId) headers['X-Request-ID'] = requestId;
  let response;
  try {
    response = await timedFetch(nlpUrl('skills/vocabulary'), { headers });
  } catch (err) {
    throw new VocabularyUnavailable(err?.code === 'NLP_TIMEOUT' ? `timeout after ${timeoutMs} ms` : 'unreachable');
  }
  if (!response.ok) throw new VocabularyUnavailable(`HTTP ${response.status}`);
  let body;
  try {
    body = await response.json();
  } catch {
    throw new VocabularyUnavailable('body is not JSON');
  }
  if (!isVocabulary(body)) throw new VocabularyUnavailable('body does not match the contract');
  return {
    parserVersion: typeof body.parser_version === 'string' ? body.parser_version : null,
    skills: body.skills.map((e) => ({ name: e.name, aliases: [...e.aliases] })),
  };
}

/** The vocabulary, from the cache while it is fresh. A failed read is never cached. */
export async function getSkillVocabulary(requestId) {
  const ttl = positiveEnv('SKILLS_VOCABULARY_TTL_MS', VOCABULARY_TTL_MS_DEFAULT);
  if (cached && Date.now() - cached.at < ttl) return cached;
  if (!inFlight) {
    inFlight = fetchVocabulary(requestId)
      .then((value) => { cached = { at: Date.now(), ...value }; return cached; })
      .finally(() => { inFlight = null; });
  }
  return inFlight;
}

// ---- Handlers ----

export const searchSkills = async (req, res) => {
  const raw = req.query?.q;
  if (raw !== undefined && typeof raw !== 'string') {
    return sendError(req, res, { status: 400, error: 'invalid_query', message: 'q must be one text value.' });
  }
  const query = raw ?? '';
  if (query.length > SEARCH_QUERY_LIMIT) {
    return sendError(req, res, { status: 400, error: 'invalid_query', message: `q must be at most ${SEARCH_QUERY_LIMIT} characters.` });
  }
  let vocabulary;
  try {
    vocabulary = await getSkillVocabulary(req.requestId);
  } catch (err) {
    // The message only (no stack): an unavailable parser is an expected state, not a bug.
    return sendError(req, res, { ...UNAVAILABLE, cause: String(err?.message || err), context: 'skill search' });
  }
  return res.json({
    query,
    parser_version: vocabulary.parserVersion,
    skills: searchVocabulary(vocabulary.skills, query),
  });
};

export const extractSkills = async (req, res) => {
  const text = req.body?.text;
  if (typeof text !== 'string') {
    return sendError(req, res, { status: 400, error: 'invalid_request', message: 'text must be a string.' });
  }
  if (text.length > EXTRACT_TEXT_LIMIT) {
    return sendError(req, res, { status: 400, error: 'text_too_long', message: `The text must be at most ${EXTRACT_TEXT_LIMIT} characters.` });
  }
  if (!text.trim()) return res.json({ parser_version: null, skills: [] });

  let body;
  try {
    body = await postJson(nlpUrl('skills/extract'), { text }, { timeoutMs: nlpTimeoutMs(), requestId: req.requestId });
  } catch (err) {
    return sendError(req, res, { ...UNAVAILABLE, cause: String(err?.message || err), context: 'skills from text' });
  }
  if (!Array.isArray(body?.skills) || !body.skills.every((s) => typeof s === 'string')) {
    logError(req, 'skills from text -> 503 suggestions_unavailable', 'nlp 200 body does not match the contract');
    return res.status(UNAVAILABLE.status).json({ error: UNAVAILABLE.error, message: UNAVAILABLE.message });
  }
  return res.json({
    parser_version: typeof body.parser_version === 'string' ? body.parser_version : null,
    skills: body.skills,
  });
};
