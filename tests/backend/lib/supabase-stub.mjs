// R-11: an in-memory Supabase (PostgREST + Storage) for offline core tests.
//
// Enough of PostgREST for core's assessment, apply and scoring paths:
//   GET / POST / PATCH / DELETE on /rest/v1/<table> with eq., neq., in.(), is.null and
//   not.is.null filters, order=<col>.<asc|desc>, limit, single-object answers
//   (Accept: application/vnd.pgrst.object+json), one embed (applications -> job:jobs);
//   POST /rest/v1/rpc/claim_assessment_for_grading as the migration defines it;
//   the unique indexes core relies on: one application per candidate and job, and one
//   assessments row per candidate and job with status in ('generated', 'grading').
// Storage: list and download in the `resumes` bucket.
//
//   const db = createSupabaseStub();
//   const supa = await startStub({ handler: db.handler });
//   db.tables.<name>    rows, mutable by tests
//   db.store            Map(object path -> { bytes, contentType, updated_at })
//   db.fail             Set of 'table:METHOD' (e.g. 'scores:POST') that answer a database error
//   db.emails           Map(user id -> email) for POST /rest/v1/rpc/applicant_emails (R-13;
//                       fail key 'applicant_emails:POST')
// profiles: the auth middleware's `is_suspended` read always answers one active profile;
// any other profiles read is answered from db.tables.profiles (R-13).
import { randomUUID } from 'node:crypto';
import { json } from './stub-server.mjs';

export const LEAK = 'LEAKY-STUB database failure';

export function createSupabaseStub() {
  const tables = {
    jobs: [], applications: [], resumes: [], scores: [], assessments: [], assessment_keys: [], profiles: [],
    notifications: [],
  };
  const store = new Map();
  const fail = new Set();
  const emails = new Map();
  let clock = Date.parse('2026-11-14T10:00:00Z');
  const stamp = () => new Date(clock += 1000).toISOString();

  // R-12: JSON path columns (`answers->>started_at`, `evaluation->voided`), as PostgREST
  // reads them: a missing key or a null parent is SQL null.
  const cellOf = (row, k) => {
    if (!k.includes('->')) return row[k] === undefined ? null : row[k];
    const [col, ...path] = k.split(/->>?/);
    let v = row[col];
    for (const p of path) {
      if (v === null || v === undefined || typeof v !== 'object') return null;
      v = v[p];
    }
    return v === undefined ? null : v;
  };

  const match = (row, k, v) => {
    const cell = cellOf(row, k);
    if (v === 'is.null') return cell === null;
    if (v === 'not.is.null') return cell !== null;
    if (v.startsWith('eq.')) return cell !== null && String(cell) === v.slice(3);
    if (v.startsWith('neq.')) return cell === null || String(cell) !== v.slice(4);
    if (v.startsWith('in.(')) {
      const set = new Set(v.slice(4, -1).split(',').map((s) => s.replace(/^"|"$/g, '')));
      return cell !== null && set.has(String(cell));
    }
    throw new Error(`supabase stub: unsupported filter ${k}=${v}`);
  };

  const filterRows = (rows, params) => {
    let out = rows;
    for (const [k, v] of params) {
      if (['select', 'order', 'limit', 'offset', 'columns', 'on_conflict'].includes(k) || k.includes('.')) continue;
      out = out.filter((r) => match(r, k, v));
    }
    return out;
  };

  const sortAndLimit = (rows, params) => {
    let out = rows;
    const order = params.get('order');
    if (order) {
      const [col, dir] = order.split('.');
      out = [...out].sort((a, b) => (String(a[col]) < String(b[col]) ? -1 : String(a[col]) > String(b[col]) ? 1 : 0) * (dir === 'desc' ? -1 : 1));
    }
    const limit = Number(params.get('limit'));
    if (limit) out = out.slice(0, limit);
    return out;
  };

  const answer = (req, res, rows, status = 200) => {
    if (/vnd\.pgrst\.object/.test(req.headers.accept || '')) {
      if (rows.length !== 1) return json(res, 406, { code: 'PGRST116', message: 'stub: not exactly one row' });
      return json(res, status, rows[0]);
    }
    return json(res, status, rows);
  };

  const dbError = (res) => json(res, 400, { code: '42P01', message: LEAK });
  const conflict = (res) => json(res, 409, { code: '23505', message: 'LEAKY-STUB duplicate key' });
  const OPEN = new Set(['generated', 'grading']);
  const clone = (v) => (v === undefined ? v : JSON.parse(JSON.stringify(v)));

  const claim = (body) => {
    const row = tables.assessments.find((a) => a.id === body.p_assessment_id && a.candidate_id === body.p_candidate_id);
    const staleMs = 10 * 60 * 1000;
    if (!row) return [];
    const stale = row.status === 'grading' && Date.parse(row.grading_started_at) < Date.now() - staleMs;
    if (!(row.status === 'generated' || stale)) return [];
    row.status = 'grading';
    row.grading_started_at = new Date(Date.now()).toISOString();
    return [{ id: row.id, job_id: row.job_id, questions: clone(row.questions), grading_started_at: row.grading_started_at }];
  };

  const handler = (req, res, rec) => {
    const url = new URL(req.url, 'http://stub');
    const p = decodeURIComponent(url.pathname);
    const params = url.searchParams;

    // Storage
    if (req.method === 'POST' && p === '/storage/v1/object/list/resumes') {
      if (fail.has('storage:list')) return json(res, 500, { statusCode: '500', error: 'stub_error', message: 'LEAKY-STUB storage failure' });
      const prefix = `${rec.body?.prefix || ''}/`;
      const items = [...store.entries()]
        .filter(([k]) => k.startsWith(prefix) && !k.slice(prefix.length).includes('/'))
        .map(([k, v]) => ({ name: k.slice(prefix.length), id: k, updated_at: v.updated_at, created_at: v.updated_at, metadata: {} }));
      return json(res, 200, items);
    }
    if (req.method === 'GET' && p.startsWith('/storage/v1/object/resumes/')) {
      const obj = store.get(p.slice('/storage/v1/object/resumes/'.length));
      if (!obj) return json(res, 400, { statusCode: '404', error: 'not_found', message: 'Object not found' });
      res.writeHead(200, { 'content-type': obj.contentType || 'application/octet-stream' });
      return res.end(obj.bytes);
    }

    if (req.method === 'POST' && p === '/rest/v1/rpc/claim_assessment_for_grading') {
      if (fail.has('rpc:POST')) return dbError(res);
      return json(res, 200, claim(rec.body || {}));
    }

    if (req.method === 'POST' && p === '/rest/v1/rpc/applicant_emails') {
      if (fail.has('applicant_emails:POST')) return dbError(res);
      const ids = Array.isArray(rec.body?.p_candidate_ids) ? rec.body.p_candidate_ids : [];
      return json(res, 200, ids.filter((id) => emails.has(id)).map((id) => ({ id, email: emails.get(id) })));
    }

    const m = p.match(/^\/rest\/v1\/(\w+)$/);
    if (!m || !tables[m[1]]) return json(res, 404, { message: `stub: no route ${req.method} ${p}` });
    const table = m[1];
    if (fail.has(`${table}:${req.method}`)) return dbError(res);

    if (table === 'profiles' && req.method === 'GET' && /is_suspended/.test(params.get('select') || '')) {
      return answer(req, res, [{ is_suspended: false }]);
    }

    if (req.method === 'GET') {
      let rows = sortAndLimit(filterRows(tables[table], params), params);
      if (table === 'applications' && /job:jobs/.test(params.get('select') || '')) {
        rows = rows.map((a) => ({ ...a, job: tables.jobs.find((j) => j.id === a.job_id) || null }));
      }
      return answer(req, res, clone(rows));
    }

    if (req.method === 'POST') {
      const inserted = [];
      for (const body of Array.isArray(rec.body) ? rec.body : [rec.body]) {
        const row = { id: randomUUID(), created_at: stamp(), ...body };
        if (table === 'applications') {
          if (tables.applications.some((a) => a.candidate_id === row.candidate_id && a.job_id === row.job_id)) return conflict(res);
          row.submitted_at = row.created_at;
        }
        if (table === 'assessments') {
          row.status = row.status || 'generated';
          if (!('answers' in row)) row.answers = null;
          if (OPEN.has(row.status) && tables.assessments.some((a) => a.candidate_id === row.candidate_id
            && a.job_id === row.job_id && OPEN.has(a.status))) return conflict(res);
          if (tables.assessments.some((a) => a.id === row.id)) return conflict(res);
        }
        tables[table].push(row);
        inserted.push(row);
      }
      return answer(req, res, clone(inserted), 201);
    }

    if (req.method === 'PATCH') {
      const rows = filterRows(tables[table], params);
      for (const row of rows) Object.assign(row, clone(rec.body));
      return answer(req, res, clone(rows));
    }

    if (req.method === 'DELETE') {
      const rows = filterRows(tables[table], params);
      tables[table] = tables[table].filter((r) => !rows.includes(r));
      return answer(req, res, clone(rows));
    }
    return json(res, 405, { message: `stub: ${req.method} ${p} is not expected` });
  };

  return { tables, store, fail, emails, handler, stamp };
}

/** A JWT-shaped service key the Supabase client accepts (never a real key). */
export const fakeServiceKey = () => {
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  return `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ role: 'service_role' })}.sig`;
};
