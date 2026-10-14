// T-0008: tracker drift check. Read-only, no services needed.
//   node tests/docs/check-trackers.mjs            -> verify, exit 0/1
//   node tests/docs/check-trackers.mjs --changes  -> also print "id: old -> new" vs AUDIT@32905c1
//
// Rules (CLAUDE.md "Source of truth"):
//  - every CHECKLIST.md item id has exactly one AUDIT.md row, and vice versa
//  - every row has a valid status, a spec id and a "delivered by"
//  - every file:line cite in an AUDIT row exists (file present, line <= length)
//  - DONE_CORRECTLY rows need a valid file:line cite AND a tests/ reference, and
//    must not lean on the archived self-reported trackers
//  - CODE_REVIEWED_UNTESTED rows (code read at HEAD, no test yet) need a valid
//    file:line cite and a "Promote with: `tests/<file>` ... asserts ..." line in Notes
//  - CLAIMED_UNVERIFIED is for claims nobody has checked: no code-read implied
//  - AUDIT.md says which commit it was verified at; GF-1..GF-5 and the required
//    new items are present; CLAUDE.md only names files that exist
//  - ARCHITECTURE.md (T-0009): every file:line cite resolves; every row of a table
//    with an "Evidence" column cites a file:line or a probe id (P-n); "Verdict"
//    cells are PASS/PARTIAL/FAIL; its "Verified at commit" is a real commit.
//    This proves the cites exist, not that they still say what the doc claims.
//  - ROADMAP.md (T-0010), hard failures: every item table has the columns Id, Item,
//    Depends on, Size, Files, Moves, Issues, Task; ids are unique; Size is S/M/L;
//    every Pn-m in "Depends on" is an item defined in an earlier row (dependency
//    order); every CHECKLIST id in Moves, every I-NNNN anywhere in the file and every
//    T-NNNN in Task exists; every file:line cite resolves.
//    Warnings only (exit 0): an OPEN issue or a CODE_REVIEWED_UNTESTED row that no
//    item maps, because issues are logged mid-session before ROADMAP catches up.
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (p) => readFileSync(resolve(root, p), 'utf8');
const STATUSES = new Set([
  'DONE_CORRECTLY', 'DONE_BUT_BROKEN_OR_HACKY', 'STUBBED_OR_PARTIAL', 'MISSING',
  'CODE_REVIEWED_UNTESTED', 'CLAIMED_UNVERIFIED',
]);
const ID = /^(\d+\.\d+[a-z]?|GR-\d+|X-\d+)$/;
const REQUIRED_IDS = ['GR-1', 'GR-2', 'X-1', 'X-2'];
const REQUIRED_GF = ['GF-1', 'GF-2', 'GF-3', 'GF-4', 'GF-5'];
const problems = [];
const fail = (m) => problems.push(m);
const warnings = [];
const warn = (m) => warnings.push(m);

const cells = (line) =>
  line.trim().replace(/^\|/, '').replace(/\|$/, '').split(/(?<!\\)\|/).map((c) => c.trim());

// Tables: returns [{header:[...], rows:[[...]]}]
function tables(md) {
  const out = [];
  let cur = null;
  for (const line of md.split(/\r?\n/)) {
    if (!line.trim().startsWith('|')) { cur = null; continue; }
    const c = cells(line);
    if (c.every((x) => /^:?-{2,}:?$/.test(x))) continue;
    if (!cur) { cur = { header: c.map((h) => h.toLowerCase()), rows: [] }; out.push(cur); }
    else cur.rows.push(c);
  }
  return out;
}

// ---- CHECKLIST ids
const checklist = read('CHECKLIST.md');
const checkIds = [];
for (const t of tables(checklist)) for (const r of t.rows) if (ID.test(r[0])) checkIds.push(r[0]);
const dupCheck = checkIds.filter((x, i) => checkIds.indexOf(x) !== i);
if (dupCheck.length) fail(`CHECKLIST duplicate ids: ${[...new Set(dupCheck)].join(', ')}`);

// ---- AUDIT rows
const audit = read('AUDIT.md');
const col = (t, name) => t.header.findIndex((h) => h.startsWith(name));
const rows = [];
const gfSeen = new Set();
for (const t of tables(audit)) {
  const iItem = col(t, 'item'), iSpec = col(t, 'spec'), iStat = col(t, 'status');
  const iEv = col(t, 'evidence'), iDel = col(t, 'delivered'), iNote = col(t, 'notes');
  if (iItem === 0 && iStat > 0) {
    for (const r of t.rows) {
      const id = (r[0].match(/^(\d+\.\d+[a-z]?|GR-\d+|X-\d+)\b/) || [])[1];
      if (!id) continue;
      rows.push({
        id, spec: iSpec >= 0 ? r[iSpec] : undefined, status: r[iStat]?.replace(/[*`]/g, '').trim(),
        evidence: iEv >= 0 ? r[iEv] ?? '' : '', delivered: iDel >= 0 ? r[iDel] : undefined, notes: iNote >= 0 ? r[iNote] ?? '' : '',
      });
    }
  }
  for (const r of t.rows) { const g = r[0].replace(/\*/g, '').match(/^(GF-\d)\b/); if (g) gfSeen.add(g[1]); }
}
const auditIds = rows.map((r) => r.id);
const dupAudit = auditIds.filter((x, i) => auditIds.indexOf(x) !== i);
if (dupAudit.length) fail(`AUDIT duplicate rows: ${[...new Set(dupAudit)].join(', ')}`);
for (const id of checkIds) if (!auditIds.includes(id)) fail(`AUDIT has no row for CHECKLIST id ${id}`);
for (const id of new Set(auditIds)) if (!checkIds.includes(id)) fail(`AUDIT row ${id} has no CHECKLIST id`);
for (const id of REQUIRED_IDS) if (!checkIds.includes(id)) fail(`CHECKLIST is missing required item ${id}`);
for (const g of REQUIRED_GF) if (!gfSeen.has(g)) fail(`AUDIT has no ${g} row`);

// ---- per-row rules
const citeRe = /([A-Za-z0-9_./\\-]+\.(?:js|jsx|mjs|py|sql|md|json|ps1|txt|css)):(\d+)(?:[-–](\d+))?/g;
const lineCount = new Map();
const lines = (p) => {
  if (!lineCount.has(p)) lineCount.set(p, existsSync(resolve(root, p)) ? read(p).split(/\r?\n/).length : -1);
  return lineCount.get(p);
};
for (const r of rows) {
  if (!STATUSES.has(r.status)) fail(`${r.id}: invalid status "${r.status}"`);
  if (!r.spec || /^[—–-]?$/.test(r.spec)) fail(`${r.id}: no spec id`);
  if (!r.delivered || /^[—–-]?$/.test(r.delivered)) fail(`${r.id}: no "delivered by"`);
  let validCites = 0;
  for (const m of r.evidence.matchAll(citeRe)) {
    const p = m[1].replace(/\\/g, '/');
    const n = lines(p);
    const last = Number(m[3] ?? m[2]);
    if (n < 0) fail(`${r.id}: cited file does not exist: ${p}`);
    else if (last > n || Number(m[2]) < 1) fail(`${r.id}: cite ${p}:${m[2]}${m[3] ? '-' + m[3] : ''} is past end of file (${n} lines)`);
    else validCites++;
  }
  if (r.status === 'CODE_REVIEWED_UNTESTED') {
    if (!validCites) fail(`${r.id}: CODE_REVIEWED_UNTESTED without a valid file:line cite`);
    if (!/Promote with:\s*`tests\/[A-Za-z0-9_./-]+`[^|]*\basserts\b/.test(r.notes)) {
      fail(`${r.id}: CODE_REVIEWED_UNTESTED needs "Promote with: \`tests/<file>\` ... asserts ..." in Notes`);
    }
  }
  if (r.status === 'DONE_CORRECTLY') {
    if (!validCites) fail(`${r.id}: DONE_CORRECTLY without a valid file:line cite`);
    const t = [...r.evidence.matchAll(/(tests\/[A-Za-z0-9_./-]+)/g)].map((m) => m[1].replace(/[./-]+$/, ''));
    if (!t.some((p) => existsSync(resolve(root, p)))) fail(`${r.id}: DONE_CORRECTLY without an existing tests/ reference`);
    if (/Docs\/archive|project_checklist|IMPLEMENTATION-TRACKER/.test(r.evidence)) fail(`${r.id}: DONE_CORRECTLY cites an archived self-reported tracker`);
  }
}

// ---- verified-at commit
const v = audit.match(/Verified at commit:\s*`?([0-9a-f]{7,40})`?/i);
if (!v) fail('AUDIT.md has no "Verified at commit: <hash>" line');
else {
  try { execFileSync('git', ['cat-file', '-e', `${v[1]}^{commit}`], { cwd: root, stdio: 'ignore' }); }
  catch { fail(`AUDIT.md "Verified at commit" ${v[1]} is not a commit in this repo`); }
}

// ---- CLAUDE.md names only files that exist
for (const m of read('CLAUDE.md').matchAll(/`([^`\s]+\.md)`/g)) {
  const p = m[1];
  if (/[<>*]/.test(p) || /NNNN/.test(p)) continue;
  if (!existsSync(resolve(root, p))) fail(`CLAUDE.md names a file that does not exist: ${p}`);
}

// ---- ARCHITECTURE.md (T-0009)
const isCommit = (sha) => {
  try { execFileSync('git', ['cat-file', '-e', `${sha}^{commit}`], { cwd: root, stdio: 'ignore' }); return true; }
  catch { return false; }
};
let archCites = 0;
if (!existsSync(resolve(root, 'ARCHITECTURE.md'))) fail('ARCHITECTURE.md is missing');
else {
  const arch = read('ARCHITECTURE.md');
  for (const m of arch.matchAll(citeRe)) {
    const p = m[1].replace(/\\/g, '/');
    const n = lines(p);
    const last = Number(m[3] ?? m[2]);
    if (n < 0) fail(`ARCHITECTURE.md: cited file does not exist: ${p}`);
    else if (last > n || Number(m[2]) < 1) fail(`ARCHITECTURE.md: cite ${p}:${m[2]}${m[3] ? '-' + m[3] : ''} is past end of file (${n} lines)`);
    else archCites++;
  }
  for (const t of tables(arch)) {
    const iEv = col(t, 'evidence'), iVer = col(t, 'verdict');
    for (const r of t.rows) {
      if (iEv >= 0) {
        const ev = r[iEv] ?? '';
        if (![...ev.matchAll(citeRe)].length && !/\bP-\d+[a-z]?\b/.test(ev)) fail(`ARCHITECTURE.md: row "${r[0]}" has no file:line or P-n in its Evidence cell`);
      }
      if (iVer >= 0) {
        const verdict = (r[iVer] ?? '').replace(/[*`]/g, '').trim();
        if (!/^(PASS|PARTIAL|FAIL)$/.test(verdict)) fail(`ARCHITECTURE.md: row "${r[0]}" has verdict "${verdict}" (want PASS, PARTIAL or FAIL)`);
      }
    }
  }
  const av = arch.match(/Verified at commit:\s*`?([0-9a-f]{7,40})`?/i);
  if (!av) fail('ARCHITECTURE.md has no "Verified at commit: <hash>" line');
  else if (!isCommit(av[1])) fail(`ARCHITECTURE.md "Verified at commit" ${av[1]} is not a commit in this repo`);
}

// ---- ROADMAP.md (T-0010)
const ROADMAP_COLS = ['id', 'item', 'depends on', 'size', 'files', 'moves', 'issues', 'task'];
let roadmapItems = 0;
if (!existsSync(resolve(root, 'ROADMAP.md'))) fail('ROADMAP.md is missing');
else {
  const roadmap = read('ROADMAP.md');
  const plain = (s) => (s ?? '').replace(/[*`]/g, '').trim();
  const issueIds = new Set([...read('ISSUES.md').matchAll(/^###\s+(I-\d{4})\b/gm)].map((m) => m[1]));
  const taskIds = new Set(readdirSync(resolve(root, 'tasks')).map((f) => (f.match(/^(T-\d{4})-/) || [])[1]).filter(Boolean));
  const defined = new Set();
  const mapped = { issues: new Set(), moves: new Set() };
  for (const t of tables(roadmap)) {
    if (t.header[0] !== 'id' || col(t, 'size') < 0) continue;
    const idx = Object.fromEntries(ROADMAP_COLS.map((c) => [c, t.header.indexOf(c)]));
    const missingCols = ROADMAP_COLS.filter((c) => idx[c] < 0);
    if (missingCols.length) { fail(`ROADMAP.md: item table "${t.header.join(' | ')}" lacks column(s): ${missingCols.join(', ')}`); continue; }
    for (const r of t.rows) {
      const id = plain(r[idx.id]);
      if (!/^P[1-9]-\d+$/.test(id)) { fail(`ROADMAP.md: item id "${id}" is not of the form Pn-m`); continue; }
      if (defined.has(id)) fail(`ROADMAP.md: duplicate item id ${id}`);
      const size = plain(r[idx.size]);
      if (!/^(S|M|L)$/.test(size)) fail(`ROADMAP.md: ${id} has size "${size}" (want S, M or L)`);
      for (const [dep] of plain(r[idx['depends on']]).matchAll(/\bP[1-9]-\d+\b/g)) {
        if (!defined.has(dep)) fail(`ROADMAP.md: ${id} depends on ${dep}, which is not defined in an earlier row`);
      }
      for (const c of ROADMAP_COLS) if (!plain(r[idx[c]])) fail(`ROADMAP.md: ${id} has an empty "${c}" cell`);
      for (const [mv] of plain(r[idx.moves]).matchAll(/(?<![\w.])(\d+\.\d+[a-z]?|GR-\d+|X-\d+)(?![\w.])/g)) {
        if (!checkIds.includes(mv)) fail(`ROADMAP.md: ${id} moves ${mv}, which is not a CHECKLIST id`);
        mapped.moves.add(mv);
      }
      for (const [tk] of plain(r[idx.task]).matchAll(/\bT-\d{4}\b/g)) {
        if (!taskIds.has(tk)) fail(`ROADMAP.md: ${id} names task ${tk}, which has no tasks/${tk}-*.md`);
      }
      for (const cell of r) for (const [is] of cell.matchAll(/\bI-\d{4}\b/g)) mapped.issues.add(is);
      defined.add(id);
      roadmapItems++;
    }
  }
  if (!roadmapItems) fail('ROADMAP.md has no item tables (header starting "Id" with a "Size" column)');
  for (const [is] of roadmap.matchAll(/\bI-\d{4}\b/g)) if (!issueIds.has(is)) fail(`ROADMAP.md names ${is}, which is not in ISSUES.md`);
  for (const m of roadmap.matchAll(citeRe)) {
    const p = m[1].replace(/\\/g, '/');
    const n = lines(p);
    const last = Number(m[3] ?? m[2]);
    if (n < 0) fail(`ROADMAP.md: cited file does not exist: ${p}`);
    else if (last > n || Number(m[2]) < 1) fail(`ROADMAP.md: cite ${p}:${m[2]}${m[3] ? '-' + m[3] : ''} is past end of file (${n} lines)`);
  }
  // coverage: warnings only
  for (const t of tables(read('ISSUES.md'))) {
    const iStat = col(t, 'status');
    if (t.header[0] !== 'id' || iStat < 0) continue;
    for (const r of t.rows) {
      const is = plain(r[0]);
      if (/^(OPEN|IN-PROGRESS)/.test(plain(r[iStat])) && !mapped.issues.has(is)) warn(`open issue ${is} is not in any ROADMAP.md item row`);
    }
  }
  for (const r of rows) {
    if (r.status === 'CODE_REVIEWED_UNTESTED' && !mapped.moves.has(r.id)) warn(`CODE_REVIEWED_UNTESTED row ${r.id} is not in any ROADMAP.md item's Moves`);
  }
}

// ---- status changes vs AUDIT@32905c1
if (process.argv.includes('--changes')) {
  let old = '';
  try { old = execFileSync('git', ['show', '32905c1:AUDIT.md'], { cwd: root, encoding: 'utf8', maxBuffer: 1 << 26 }); }
  catch { fail('cannot read AUDIT.md at 32905c1 for --changes'); }
  const oldStatus = new Map();
  for (const t of tables(old)) {
    const iStat = col(t, 'classification');
    if (iStat < 0) continue;
    for (const r of t.rows) { const id = (r[0].match(/^(\d+\.\d+)\b/) || [])[1]; if (id) oldStatus.set(id, r[iStat].replace(/[*`]/g, '').trim()); }
  }
  for (const r of rows) {
    const o = oldStatus.get(r.id) ?? '(new item)';
    if (o !== r.status) console.log(`${r.id}: ${o} -> ${r.status}`);
  }
}

// ---- --summary: markdown count table for the AUDIT.md Summary section
if (process.argv.includes('--summary')) {
  const order = ['DONE_CORRECTLY', 'DONE_BUT_BROKEN_OR_HACKY', 'STUBBED_OR_PARTIAL', 'MISSING', 'CODE_REVIEWED_UNTESTED', 'CLAIMED_UNVERIFIED'];
  const group = (id) => (/^GR-/.test(id) ? 'GR' : /^X-/.test(id) ? 'Appendix A' : `Module ${id.split('.')[0]}`);
  const groups = [...new Set(rows.map((r) => group(r.id)))];
  const short = ['DONE_CORRECTLY', 'BROKEN_OR_HACKY', 'PARTIAL', 'MISSING', 'CODE_REVIEWED_UNTESTED', 'CLAIMED_UNVERIFIED'];
  console.log(`| Group | ${short.join(' | ')} | Total |`);
  console.log(`|${'---|'.repeat(short.length + 2)}`);
  const tot = order.map(() => 0);
  for (const g of groups) {
    const rs = rows.filter((r) => group(r.id) === g);
    const c = order.map((st) => rs.filter((r) => r.status === st).length);
    c.forEach((n, i) => { tot[i] += n; });
    console.log(`| ${g} | ${c.join(' | ')} | ${rs.length} |`);
  }
  console.log(`| **All** | ${tot.map((n) => `**${n}**`).join(' | ')} | **${rows.length}** |`);
}

for (const w of warnings) console.error(`warning: ${w}`);
if (problems.length) {
  console.error(`check-trackers: ${problems.length} problem(s)`);
  for (const p of problems) console.error(`  - ${p}`);
  process.exit(1);
}
console.log(`check-trackers: ids ${checkIds.length}/${auditIds.length} matched, ${rows.length} rows OK, verified at ${v[1]}; ARCHITECTURE.md ${archCites} cites OK; ROADMAP.md ${roadmapItems} items OK, ${warnings.length} warning(s)`);
