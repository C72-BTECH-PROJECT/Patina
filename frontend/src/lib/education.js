// R-30 follow-up: one readable line for an education entry of a parsed résumé.
//
// nlp-engine >= 2.1.0 gives an object per qualification:
//   { institution, degree, dates, graduation_year, grade, honours, text }
// Résumés parsed before 2.1.0 are stored with plain strings, shown as they are.
// Nothing is ever shown as raw JSON; an entry with nothing readable gives null and
// the page says so in words.

const part = (v) => {
  if (typeof v === 'number' && Number.isFinite(v)) return String(v);
  return typeof v === 'string' && v.trim() ? v.trim() : null;
};

/**
 * "Degree · Institution · dates (or graduation year) · grade · honours", each part
 * only when present. An object with neither a degree nor an institution falls back
 * to the parser's own `text` of the entry, which reads better than a lone date.
 */
export function educationLine(entry) {
  if (typeof entry === 'string') return entry.trim() || null;
  if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return null;

  const degree = part(entry.degree);
  const institution = part(entry.institution);
  const text = part(entry.text);
  const parts = [
    degree,
    institution,
    part(entry.dates) || part(entry.graduation_year),
    part(entry.grade),
    part(entry.honours),
  ].filter(Boolean);

  if (!degree && !institution && text) return text;
  return parts.length ? parts.join(' · ') : null;
}

export const EDUCATION_EMPTY_ENTRY = 'Entry without details';
