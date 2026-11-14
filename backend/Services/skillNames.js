// Skill-name matching across evidence sources (card R-28, D§7.1 skill table).
//
// The résumé and job lists come from nlp-engine already in its canonical spelling
// (nlp-engine/app/ner.py normalize_skill, the one skill vocabulary). GitHub claims
// echo those names, but the assessment's per-question `skill` is written by the
// LLM ("Node.js", "REST APIs"), and older stored rows predate some canonical forms.
// This module only decides whether two spellings name the same skill. It holds no
// alias table of its own, so there is still one vocabulary: a variant that only an
// alias resolves (js -> javascript, postgres -> postgresql) does not match here and
// reads as "absent", never as a guessed match. nlp-engine does not serve its alias
// table yet (R-32 adds a vocabulary read); that is the place to feed it in.
//
// Rules, in order, the same for every source:
//   1. lower case; every character other than a-z, 0-9, '#' and '+' separates words
//      ("Node.js" -> node js, "CI/CD" -> ci cd, "C#" and "C++" kept);
//   2. the words are joined, and a trailing "js" is dropped when something is left
//      ("node.js" = "nodejs" = "node js" = "node", "vue.js" = "vue");
//   3. otherwise a plural ending loses its 's' (longer than 3 letters, not "ss"),
//      so "REST APIs" = "rest api";
//   4. a multi-word skill ("rest api") also matches when the other source lists each
//      of its words as a skill of its own ("rest" and "api").

const words = (name) => String(name ?? '')
  .toLowerCase()
  .replace(/[^a-z0-9#+]+/g, ' ')
  .trim()
  .split(/\s+/)
  .filter(Boolean);

const depluralise = (word) =>
  (word.length > 3 && word.endsWith('s') && !word.endsWith('ss') ? word.slice(0, -1) : word);

/** The comparison key of a skill name ('' for an empty one). Two names match when their keys are equal. */
export const skillKey = (name) => {
  const joined = words(name).join('');
  if (joined.length > 3 && joined.endsWith('js')) return joined.slice(0, -2);
  return depluralise(joined);
};

/** True when the two names are the same skill by rules 1 to 3. */
export const sameSkill = (a, b) => {
  const ka = skillKey(a);
  return ka !== '' && ka === skillKey(b);
};

/**
 * An index over one source's entries. `lookup(name)` returns the entries that
 * name the skill: those whose key equals the name's key, or, when there are none
 * and the name has several words, the entries for each word provided that every
 * word is listed (rule 4). An empty array means the source does not have it.
 */
export const skillIndex = (entries, nameOf = (e) => e) => {
  const byKey = new Map();
  for (const entry of Array.isArray(entries) ? entries : []) {
    const key = skillKey(nameOf(entry));
    if (!key) continue;
    if (!byKey.has(key)) byKey.set(key, []);
    byKey.get(key).push(entry);
  }
  const lookup = (name) => {
    const exact = byKey.get(skillKey(name));
    if (exact) return exact;
    const parts = words(name);
    if (parts.length < 2) return [];
    const found = parts.map((p) => byKey.get(skillKey(p)));
    return found.every(Boolean) ? found.flat() : [];
  };
  return { lookup, has: (name) => lookup(name).length > 0 };
};
