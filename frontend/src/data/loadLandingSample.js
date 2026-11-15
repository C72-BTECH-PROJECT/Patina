// D-9 (DESIGN_SPEC §8, with Anthony's 2026-11-15 override of "static import; the build
// fails if the file is missing"): the landing page's real-score sample card reads
// `frontend/src/data/landingSample.json`, which `scripts/capture-landing-sample.mjs`
// writes from a real stored `scores` row. If that file does not exist, or is not the
// shape the card needs, `loadLandingSample()` returns null and the page renders no
// sample card at all: no placeholder, no default number, nothing typed by hand.
//
// How the file is optional: `require.context` with a pattern that matches only that
// file. Webpack (react-scripts 5) accepts a context that matches nothing (it is an
// empty context), whereas a plain `import` or `require('./landingSample.json')` of a
// missing file is a "Module not found" build error. Under jest `require.context` does
// not exist, so the loader returns null there; tests mock this module instead.

const REQUIRED_STATUSES = ['evidenced', 'claimed_only', 'not_found'];

const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const isText = (v) => typeof v === 'string' && v.trim() !== '';
const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const isDate = (v) => isText(v) && !Number.isNaN(new Date(v).getTime());

const validFactor = (f) => {
  if (!isObject(f) || !isText(f.key) || !isText(f.label) || !isText(f.direction)) return false;
  if (typeof f.available !== 'boolean') return false;
  // An unavailable factor carries no figures (the app shows a dash for it).
  if (!f.available) return true;
  return isNum(f.value) && isNum(f.weight) && isNum(f.weight_pct) && isNum(f.contribution);
};

const validSkill = (s) =>
  isObject(s) && isText(s.skill) && REQUIRED_STATUSES.includes(s.status);

/**
 * The sample object when `raw` has every field the card shows, with the right types;
 * otherwise null. Nothing is defaulted, coerced or repaired: a missing or mistyped
 * field makes the whole sample invalid.
 */
export function validateLandingSample(raw) {
  if (!isObject(raw)) return null;
  if (!isNum(raw.composite) || raw.composite < 0 || raw.composite > 100) return null;
  if (!isText(raw.band) || !isText(raw.verification)) return null;
  if (!Array.isArray(raw.factors) || raw.factors.length === 0 || !raw.factors.every(validFactor)) return null;
  if (!Array.isArray(raw.skills) || !raw.skills.every(validSkill)) return null;
  if (!isText(raw.weights_version) || !isDate(raw.generated_at) || !isText(raw.job_title)) return null;
  const p = raw.provenance;
  if (!isObject(p) || !isText(p.captured_from) || !isDate(p.captured_at)) return null;
  if (p.fixture !== null && !isText(p.fixture)) return null;
  return raw;
}

// Loads and validates the optional file. Returns null when absent or invalid.
export function loadLandingSample() {
  try {
    // Under jest `require.context` is undefined, so this throws and the loader returns null.
    const ctx = require.context('./', false, /^\.\/landingSample\.json$/);
    if (!ctx.keys().includes('./landingSample.json')) return null;
    return validateLandingSample(ctx('./landingSample.json'));
  } catch (err) {
    return null;
  }
}

// The date in the caption: the stored score's `generated_at`, as a UTC calendar date so
// it reads the same on every machine ("15 November 2026").
export const sampleDate = (iso) =>
  new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });

// Spec §8: "Captured from a real scoring run on <date> (<fixture résumé>, <job>). Nothing
// on this card was typed by hand." With no fixture the parenthesis holds the job only.
export const sampleCaption = (sample) => {
  const where = sample.provenance.fixture
    ? `${sample.provenance.fixture}, ${sample.job_title}`
    : sample.job_title;
  return `Captured from a real scoring run on ${sampleDate(sample.generated_at)} (${where}). Nothing on this card was typed by hand.`;
};

export default loadLandingSample;
