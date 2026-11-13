// R-19: record every Supabase row an e2e run creates (job ids, application ids, ...) so the run
// can end by printing what it left behind (TASKS.md: "The run ends by printing the rows it left
// in Supabase"). Nothing here deletes anything; Anthony runs the sweep.
//
// Specs run in a worker process and the final print happens in the runner (global-teardown.mjs),
// so the record is a JSON-lines file under output/, reset by global-setup.mjs at the start of
// each run.
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { OUTPUT_DIR } from './env.mjs';

export const LEFTOVER_FILE = join(OUTPUT_DIR, 'leftover-rows.jsonl');

export function resetLeftovers() {
  mkdirSync(OUTPUT_DIR, { recursive: true });
  writeFileSync(LEFTOVER_FILE, '');
}

// kind: the table, e.g. 'jobs', 'applications', 'resumes', 'assessments'.
// id: the row id. note: free text, e.g. the job title or which step created it.
export function recordLeftover(kind, id, note = '') {
  if (!kind || id === undefined || id === null || id === '') {
    throw new Error(`recordLeftover: kind and id are required (got kind=${kind}, id=${id})`);
  }
  mkdirSync(OUTPUT_DIR, { recursive: true });
  appendFileSync(LEFTOVER_FILE, `${JSON.stringify({ kind, id: String(id), note, at: new Date().toISOString() })}\n`);
}

export function readLeftovers() {
  if (!existsSync(LEFTOVER_FILE)) return [];
  return readFileSync(LEFTOVER_FILE, 'utf8')
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

export function formatLeftovers(rows = readLeftovers()) {
  if (!rows.length) return 'e2e leftover rows: none recorded by this run.';
  const byKind = new Map();
  for (const r of rows) {
    if (!byKind.has(r.kind)) byKind.set(r.kind, []);
    byKind.get(r.kind).push(r);
  }
  const lines = [`e2e leftover rows (${rows.length}) in Supabase, created by this run:`];
  for (const [kind, list] of byKind) {
    lines.push(`  ${kind} (${list.length}):`);
    for (const r of list) lines.push(`    ${r.id}${r.note ? `  ${r.note}` : ''}`);
  }
  return lines.join('\n');
}

// Record the id from every matching API response a page receives, e.g.
//   recordFromResponses(page, { method: 'POST', url: /\/api\/jobs$/, kind: 'jobs', pick: (b) => b.job?.id })
// `pick` gets the parsed JSON body and returns the id (or undefined to skip). Returns a stop
// function. A response that should have matched but has no id is recorded as a note, not dropped.
export function recordFromResponses(page, { method = 'POST', url, kind, pick, note = '' }) {
  const handler = async (res) => {
    const req = res.request();
    if (req.method() !== method) return;
    if (url instanceof RegExp ? !url.test(res.url()) : !res.url().includes(url)) return;
    if (!res.ok()) return;
    let body;
    try { body = await res.json(); } catch { return; }
    const id = pick(body);
    if (id === undefined || id === null || id === '') {
      recordLeftover(kind, 'unknown', `${method} ${res.url()} answered ${res.status()} but pick() found no id ${note}`.trim());
    } else {
      recordLeftover(kind, id, note);
    }
  };
  page.on('response', handler);
  return () => page.off('response', handler);
}
