"""Parsing evaluation harness (card R-20, DECISIONS 4.3).

Reads a gold label CSV in the format of eval/LABELLING_GUIDE.md section 4,
sends each resume to the running nlp-engine `POST /parse`, compares the
output with the labels using the rules in section 6 of the guide, prints the
numbers and appends a dated section to eval/RESULTS.md.

Standard library only. Metric code lives in eval/parsing_metrics.py.

Usage (from the repo root, NLP service already running):
    python eval/run_parsing_eval.py                      # eval/labels/gold.csv + eval/resumes/
    python eval/run_parsing_eval.py --smoke --nlp-url http://127.0.0.1:18010
    python eval/run_parsing_eval.py --labeller-a eval/labels/aaron.csv --labeller-b eval/labels/anurag.csv

Exit codes: 0 ok; 2 bad input (labels, files, alias table) or service unreachable.
"""

from __future__ import annotations

import argparse
import csv
import datetime as dt
import hashlib
import json
import mimetypes
import sys
import time
import urllib.error
import urllib.request
import uuid
from pathlib import Path

HERE = Path(__file__).resolve().parent
REPO = HERE.parent
sys.path.insert(0, str(HERE))

import parsing_metrics as pm  # noqa: E402

GUIDE_COLUMNS = [
    "resume_file", "source", "role_type", "skills",
    "email", "github_url", "linkedin_url", "notes",
]
REAL_SOURCES = {"kaggle", "consented"}
SMOKE_SOURCE = "smoke"
ROLE_TYPES = {"development", "support_operations", "other"}
NEUTRAL_JD = "Parsing evaluation run. No job description is attached."
HTTP_TIMEOUT_S = 120


class InputError(Exception):
    """Bad labels, missing files or a bad alias table. Exit code 2."""


# ---------------------------------------------------------------------------
# Inputs
# ---------------------------------------------------------------------------


def rel(path: Path) -> str:
    try:
        return path.resolve().relative_to(REPO).as_posix()
    except ValueError:
        return path.name  # outside the repo: never write a full local path


def read_labels(path: Path, allow_smoke: bool = True) -> list[dict]:
    if not path.is_file():
        raise InputError(f"label file not found: {path}")
    with path.open(newline="", encoding="utf-8-sig") as fh:
        reader = csv.DictReader(fh)
        header = [h.strip() for h in (reader.fieldnames or [])]
        missing = [c for c in GUIDE_COLUMNS if c not in header]
        if missing:
            raise InputError(f"{path.name}: missing column(s) {missing}; expected {GUIDE_COLUMNS}")
        rows, seen = [], set()
        for lineno, raw in enumerate(reader, start=2):
            row = {k.strip(): (v or "").strip() for k, v in raw.items() if k is not None}
            if not any(row.values()):
                continue
            name = row["resume_file"]
            if not name:
                raise InputError(f"{path.name}:{lineno}: empty resume_file")
            if name in seen:
                raise InputError(f"{path.name}:{lineno}: duplicate resume_file {name}")
            seen.add(name)
            src = row["source"].lower()
            allowed = REAL_SOURCES | ({SMOKE_SOURCE} if allow_smoke else set())
            if src not in allowed:
                raise InputError(
                    f"{path.name}:{lineno}: source '{row['source']}' not allowed; "
                    f"guide section 1 permits only {sorted(REAL_SOURCES)} (smoke sets use '{SMOKE_SOURCE}')")
            row["source"] = src
            role = row["role_type"].lower()
            if role not in ROLE_TYPES:
                raise InputError(f"{path.name}:{lineno}: role_type '{row['role_type']}' not in {sorted(ROLE_TYPES)}")
            row["role_type"] = role
            rows.append(row)
    if not rows:
        raise InputError(f"{path.name}: no rows")
    sources = {r["source"] for r in rows}
    if SMOKE_SOURCE in sources and sources & REAL_SOURCES:
        raise InputError(f"{path.name}: mixes smoke rows with real rows; keep them in separate files")
    return rows


def load_aliases(path: Path) -> dict[str, str]:
    data = json.loads(path.read_text(encoding="utf-8"))
    raw = data.get("aliases")
    if not isinstance(raw, dict):
        raise InputError(f"{path.name}: needs an 'aliases' object")
    aliases = {}
    for k, v in raw.items():
        nk, nv = pm.normalise_skill(k), pm.normalise_skill(v)
        if not nk or not nv:
            raise InputError(f"{path.name}: empty alias or canonical in {k!r}: {v!r}")
        aliases[nk] = nv
    chained = sorted(v for v in aliases.values() if v in aliases)
    if chained:
        raise InputError(f"{path.name}: canonical names that are also aliases (one hop only): {chained}")
    return aliases


def load_out_of_scope(path: Path) -> list[str]:
    data = json.loads(path.read_text(encoding="utf-8"))
    terms = []
    for key, value in data.items():
        if key.startswith("_"):
            continue
        if not isinstance(value, list):
            raise InputError(f"{path.name}: '{key}' must be a list")
        terms.extend(value)
    return terms


def sha12(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()[:12]


def vocabulary_names(body: object) -> dict[str, list[str]]:
    """{name: aliases} from a GET /skills/vocabulary body (R-32)."""
    if not isinstance(body, dict) or not isinstance(body.get("skills"), list):
        raise InputError("vocabulary: expected a GET /skills/vocabulary body with a 'skills' list")
    return {str(e["name"]): [str(a) for a in e.get("aliases") or []] for e in body["skills"]}


def vocabulary_set(vocab: dict[str, list[str]], aliases) -> set[str]:
    """Every spelling the parser knows, canonicalised with the eval alias table, so
    a gold skill can be tested for membership in the same form the metrics use."""
    spellings = [s for name, al in vocab.items() for s in [name, *al]]
    kept, _ = pm.skill_set(spellings, aliases)
    return kept


# ---------------------------------------------------------------------------
# NLP service client
# ---------------------------------------------------------------------------


def _multipart(fields: dict[str, str], file_field: str, file_path: Path) -> tuple[bytes, str]:
    boundary = f"----patina-eval-{uuid.uuid4().hex}"
    out = bytearray()
    for name, value in fields.items():
        out += f"--{boundary}\r\nContent-Disposition: form-data; name=\"{name}\"\r\n\r\n".encode()
        out += value.encode("utf-8") + b"\r\n"
    ctype = mimetypes.guess_type(file_path.name)[0] or "application/octet-stream"
    out += (f"--{boundary}\r\nContent-Disposition: form-data; name=\"{file_field}\"; "
            f"filename=\"{file_path.name}\"\r\nContent-Type: {ctype}\r\n\r\n").encode()
    out += file_path.read_bytes() + b"\r\n"
    out += f"--{boundary}--\r\n".encode()
    return bytes(out), f"multipart/form-data; boundary={boundary}"


def _post(url: str, body: bytes, ctype: str) -> tuple[int, object]:
    req = urllib.request.Request(url, data=body, method="POST", headers={"Content-Type": ctype})
    try:
        with urllib.request.urlopen(req, timeout=HTTP_TIMEOUT_S) as resp:
            status, raw = resp.status, resp.read()
    except urllib.error.HTTPError as err:
        status, raw = err.code, err.read()
    try:
        payload = json.loads(raw.decode("utf-8", errors="replace"))
    except ValueError:
        payload = None
    return status, payload


def _jd_required(payload: object) -> bool:
    """A 422 saying the form field `jd` is missing: either FastAPI's default
    body (`detail[].loc[-1] == "jd"`, `type == "missing"`) or the service's
    own validation body (`error == "invalid_request"`, `"jd" in fields`)."""
    if not isinstance(payload, dict):
        return False
    if payload.get("error") == "invalid_request" and "jd" in (payload.get("fields") or []):
        return True
    if not isinstance(payload.get("detail"), list):
        return False
    for item in payload["detail"]:
        loc = item.get("loc") if isinstance(item, dict) else None
        if isinstance(loc, list) and loc and loc[-1] == "jd" and item.get("type") == "missing":
            return True
    return False


def _unreadable_reason(payload: object) -> str | None:
    """The 422 `unreadable_document` body, top level or inside `detail`."""
    for body in (payload, payload.get("detail") if isinstance(payload, dict) else None):
        if isinstance(body, dict) and body.get("error") == "unreadable_document":
            return str(body.get("reason") or "unspecified")
    return None


class NlpClient:
    def __init__(self, base_url: str):
        self.base = base_url.rstrip("/")
        self.send_jd: bool | None = None  # learnt from the first request

    def health(self) -> dict:
        with urllib.request.urlopen(self.base + "/", timeout=15) as resp:
            return json.loads(resp.read().decode("utf-8"))

    def vocabulary(self) -> dict:
        with urllib.request.urlopen(self.base + "/skills/vocabulary", timeout=15) as resp:
            return json.loads(resp.read().decode("utf-8"))

    def parse(self, file_path: Path) -> dict:
        """Returns {status: parsed|unreadable|failed, ...}. Raises URLError if
        the service is unreachable (the run aborts rather than miscounting)."""
        attempts = [self.send_jd] if self.send_jd is not None else [False, True]
        for send_jd in attempts:
            fields = {"jd": NEUTRAL_JD} if send_jd else {}
            body, ctype = _multipart(fields, "resume", file_path)
            t0 = time.perf_counter()
            status, payload = _post(self.base + "/parse", body, ctype)
            elapsed = time.perf_counter() - t0
            if status == 422 and not send_jd and _jd_required(payload):
                continue  # service predates optional jd (R-05); retry with a neutral jd
            self.send_jd = send_jd
            if status == 200 and isinstance(payload, dict):
                return {"status": "parsed", "seconds": elapsed, "payload": payload}
            reason = _unreadable_reason(payload) if status == 422 else None
            if reason is not None:
                return {"status": "unreadable", "seconds": elapsed, "reason": reason}
            return {"status": "failed", "seconds": elapsed, "reason": f"HTTP {status}"}
        raise AssertionError("unreachable")


# ---------------------------------------------------------------------------
# Evaluation
# ---------------------------------------------------------------------------


def _fmt(x) -> str:
    return "n/a" if x is None else f"{float(x):.3f}"


def in_vocabulary_recall(per_resume, vocab_set: set[str]):
    """(found, gold) over gold skills whose canonical form is in the frozen vocabulary."""
    gold_in = found_in = 0
    for p in per_resume:
        c = p["counts"]
        gold = (c.true_found | c.missed) & vocab_set
        gold_in += len(gold)
        found_in += len(c.true_found & vocab_set)
    return found_in, gold_in


def spelling_mismatches(per_resume, vocab: dict[str, list[str]], aliases) -> list[tuple[str, str, str]]:
    """(resume, false find, missed gold skill) where the parser's own vocabulary lists
    the missed gold skill as a spelling of the false find: the same skill under a
    name the frozen alias table does not join. Reported, never corrected."""
    spellings = {}
    for name, al in vocab.items():
        canon = pm.canonical_skill(name, aliases)
        spellings.setdefault(canon, set()).update(
            s for s in (pm.canonical_skill(a, aliases) for a in [name, *al]) if s)
    out = []
    for p in per_resume:
        c = p["counts"]
        for f in sorted(c.false_found):
            for m in sorted(c.missed & spellings.get(f, set())):
                out.append((p["row"]["resume_file"], f, m))
    return out


def summarise(per_resume) -> dict:
    counts = [p["counts"] for p in per_resume]
    return {
        "micro": pm.micro_prf(counts),
        "macro": pm.macro_prf(counts),
        "totals": (sum(c.tp for c in counts), sum(c.fp for c in counts), sum(c.fn for c in counts)),
        "n": len(counts),
    }


def evaluate(rows, resumes_dir: Path, client: NlpClient, aliases, oos_terms) -> dict:
    missing = [r["resume_file"] for r in rows if not (resumes_dir / r["resume_file"]).is_file()]
    if missing:
        raise InputError(f"resume file(s) listed in the labels but not found in {resumes_dir}: {missing}")

    per_resume, warnings = [], []
    oos_norm = {pm.normalise_skill(t) for t in oos_terms}
    for row in rows:
        gold, _ = pm.skill_set(pm.split_gold_skills(row["skills"]), aliases)
        flagged = sorted(g for g in gold if g in oos_norm)
        if flagged:
            warnings.append(f"{row['resume_file']}: gold contains out-of-scope term(s) {flagged} (kept)")

        result = client.parse(resumes_dir / row["resume_file"])
        payload = result.get("payload") or {}
        ents = payload.get("entities") or {}
        predicted, removed = pm.skill_set(ents.get("skills") or [], aliases, oos_terms)
        no_text = result["status"] == "parsed" and (
            payload.get("raw_text") == ""
            or (payload.get("preprocessing") or {}).get("token_count") == 0)
        per_resume.append({
            "row": row,
            "status": result["status"],
            "reason": result.get("reason"),
            "seconds": result["seconds"],
            "no_text": no_text,
            "parser_version": payload.get("parser_version"),
            "counts": pm.compare_skills(gold, predicted),
            "oos_removed": removed,
            "pred_email": pm.normalise_email(ents.get("email")),
            "pred_github": pm.normalise_url(ents.get("github")),
            "pred_linkedin": pm.normalise_url(ents.get("linkedin")),
        })
        c = per_resume[-1]["counts"]
        print(f"  {row['resume_file']}: {result['status']}"
              f"{' (' + result['reason'] + ')' if result.get('reason') else ''}"
              f" tp={c.tp} fp={c.fp} fn={c.fn} {result['seconds']:.3f}s")

    counts = [p["counts"] for p in per_resume]
    by_role = {}
    for role in sorted(ROLE_TYPES):
        sub = [p["counts"] for p in per_resume if p["row"]["role_type"] == role]
        if sub:
            by_role[role] = (len(sub), pm.micro_prf(sub))
    contact = {
        "email": pm.contact_accuracy((pm.normalise_email(p["row"]["email"]), p["pred_email"]) for p in per_resume),
        "github_url": pm.contact_accuracy((pm.normalise_url(p["row"]["github_url"]), p["pred_github"]) for p in per_resume),
        "linkedin_url": pm.contact_accuracy((pm.normalise_url(p["row"]["linkedin_url"]), p["pred_linkedin"]) for p in per_resume),
    }
    parsed_times = [p["seconds"] for p in per_resume if p["status"] == "parsed"]
    return {
        "per_resume": per_resume,
        "micro": pm.micro_prf(counts),
        "macro": pm.macro_prf(counts),
        "totals": (sum(c.tp for c in counts), sum(c.fp for c in counts), sum(c.fn for c in counts)),
        "by_role": by_role,
        "contact": contact,
        "timing": pm.timing_summary(parsed_times),
        "n_timed": len(parsed_times),
        "warnings": warnings,
    }


def labeller_agreement(path_a: Path, path_b: Path, aliases):
    rows_a, rows_b = read_labels(path_a, allow_smoke=False), read_labels(path_b, allow_smoke=False)
    a = {r["resume_file"]: pm.split_gold_skills(r["skills"]) for r in rows_a}
    b = {r["resume_file"]: pm.split_gold_skills(r["skills"]) for r in rows_b}
    micro, macro, only_a, only_b = pm.agreement(a, b, aliases)
    role_a = {r["resume_file"]: r["role_type"] for r in rows_a}
    role_b = {r["resume_file"]: r["role_type"] for r in rows_b}
    shared = sorted(set(role_a) & set(role_b))
    role_same = sum(role_a[k] == role_b[k] for k in shared)
    return {"micro": micro, "macro": macro, "only_a": only_a, "only_b": only_b,
            "n_shared": len(shared), "role_same": role_same}


# ---------------------------------------------------------------------------
# Report
# ---------------------------------------------------------------------------


def display_name(row: dict, index: dict) -> str:
    """Consented resumes are never named in RESULTS.md (a file name can carry a
    person's name); they appear as consented-<n> in label-file order."""
    if row["source"] == "consented":
        return f"consented-{index[row['resume_file']]}"
    return row["resume_file"]


def render_section(args, rows, res, health, agree) -> str:
    now = dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
    smoke = rows[0]["source"] == SMOKE_SOURCE
    consented_idx = {r["resume_file"]: i for i, r in
                     enumerate((r for r in rows if r["source"] == "consented"), start=1)}
    n = len(rows)
    src = {s: sum(r["source"] == s for r in rows) for s in ("kaggle", "consented", SMOKE_SOURCE)}
    roles = {k: sum(r["role_type"] == k for r in rows) for k in sorted(ROLE_TYPES)}
    versions = sorted({str(p["parser_version"]) for p in res["per_resume"] if p["parser_version"] is not None})
    tp, fp, fn = res["totals"]
    micro, macro = res["micro"], res["macro"]
    removed_total = sum(len(p["oos_removed"]) for p in res["per_resume"])

    L = []
    if smoke:
        L.append(f"## {now} - SMOKE SET on synthetic fixtures (NOT the evaluation result)")
        L.append("")
        L.append("> **This is not the evaluation result.** It is a harness check on the six synthetic fixtures in "
                 "`tests/fixtures/`, hand-labelled by the R-20 implementer. The fixtures were written for the test "
                 "harness, not sampled from real resumes, so these numbers say nothing about Patina's parsing "
                 "accuracy and must not be quoted as such. The evaluation result needs the 30-resume TM-1 set.")
    else:
        L.append(f"## {now} - Evaluation run on `{rel(args.labels)}`")
    L.append("")
    if args.limit:
        L.append("**Stated limits (read before quoting any number below):**")
        L.append("")
        for text in args.limit:
            L.append(f"- {text}")
        L.append("")
    L.append(f"- Label set: `{rel(args.labels)}`, {n} resumes")
    L.append(f"- Sources: kaggle {src['kaggle']}, consented {src['consented']}, smoke {src[SMOKE_SOURCE]}")
    L.append("- Role types: " + ", ".join(f"{k} {v}" for k, v in roles.items()))
    if versions:
        L.append(f"- Parser version (`parser_version` in /parse responses): {', '.join(versions)}")
    elif health.get("parser_version"):
        L.append(f"- Parser version: not in /parse responses; `GET /` reports {health['parser_version']}")
    else:
        L.append("- Parser version: not reported")
    L.append(f"- Service version (`GET /` `version` field): {health.get('version', 'not reported')}")
    L.append(f"- Alias table: `eval/aliases.json`, {len(args._aliases)} aliases, sha256 {sha12(args.aliases)}")
    L.append(f"- Out-of-scope list: `eval/out_of_scope_terms.json`, {len(args._oos)} terms, sha256 {sha12(args.out_of_scope)}")
    jd_note = {True: "yes, a fixed neutral string (the service requires `jd`)", False: "no",
               None: "not determined"}[args._client.send_jd]
    L.append(f"- `jd` sent: {jd_note}")
    L.append("")
    L.append("### Skills")
    L.append("")
    L.append("| | Precision | Recall | F1 | Resumes averaged (P / R / F1) |")
    L.append("|---|---|---|---|---|")
    L.append(f"| Micro (TP {tp}, FP {fp}, FN {fn}) | {_fmt(micro.precision)} | {_fmt(micro.recall)} | {_fmt(micro.f1)} | {n} / {n} / {n} |")
    L.append(f"| Macro (per-resume mean) | {_fmt(macro.precision)} | {_fmt(macro.recall)} | {_fmt(macro.f1)} | "
             f"{macro.n_precision} / {macro.n_recall} / {macro.n_f1} |")
    L.append("")
    L.append("Macro rules: precision averages resumes where the parser kept at least one skill; recall averages "
             "resumes with at least one gold skill; F1 = 2TP/(2TP+FP+FN) per resume, averaged over resumes where "
             "either side is non-empty (an unreadable resume with gold skills scores F1 0).")
    L.append(f"Out-of-scope terms removed from the parser's output: {removed_total} in total.")
    L.append("")
    if args._vocab is not None:
        found_in, gold_in = in_vocabulary_recall(res["per_resume"], args._vocab_set)
        all_gold = tp + fn
        L.append("#### Recall on gold skills the parser can name")
        L.append("")
        L.append(f"Frozen vocabulary: `{rel(args.vocabulary)}`, {len(args._vocab)} skills, sha256 "
                 f"{sha12(args.vocabulary)}; checked identical to the live `GET /skills/vocabulary` before the run. "
                 "A gold skill is in the vocabulary when its canonical form (eval alias table applied) equals the "
                 "canonical form of a vocabulary name or one of its spellings. Always read the two recall figures together: "
                 "the first is what a recruiter gets; the second is how well the parser finds what it is built to find.")
        L.append("")
        L.append("| Recall over | Gold skills | Found | Recall |")
        L.append("|---|---|---|---|")
        L.append(f"| All gold skills | {all_gold} | {tp} | {_fmt(micro.recall)} |")
        L.append(f"| Gold skills in the frozen vocabulary | {gold_in} | {found_in} | "
                 f"{_fmt(pm._ratio(found_in, gold_in))} |")
        L.append("")
        L.append(f"{all_gold - gold_in} of {all_gold} gold skills ({_fmt(pm._ratio(all_gold - gold_in, all_gold))}) "
                 "are not in the vocabulary, so the parser cannot find them whatever the résumé says.")
        L.append("")
        mism = spelling_mismatches(res["per_resume"], args._vocab, args._aliases)
        L.append("#### Same skill, different name (alias-table gaps; reported, not corrected)")
        L.append("")
        if not mism:
            L.append("None: no false find is the parser's name for a missed gold skill.")
        else:
            pairs = {}
            for resume, f, m in mism:
                pairs.setdefault((f, m), []).append(resume)
            L.append(f"{len(mism)} false finds are the parser's canonical name for a gold skill it then counts as "
                     f"missed, because the frozen alias table does not join the two names. Each is counted once as a "
                     f"false find and once as a miss above: "
                     + "; ".join(f"parser `{f}` vs gold `{m}` ({len(r)} résumé{'s' if len(r) > 1 else ''})"
                                 for (f, m), r in sorted(pairs.items())) + ".")
        L.append("")
    for name in args.sensitivity or []:
        focus = [p for p in res["per_resume"] if p["row"]["resume_file"] == name]
        rest = [p for p in res["per_resume"] if p["row"]["resume_file"] != name]
        if not focus:
            L.append(f"Sensitivity: `{name}` is not in the label set; nothing excluded.")
            L.append("")
            continue
        fc = focus[0]["counts"]
        s = summarise(rest)
        r_tp, r_fp, r_fn = s["totals"]
        L.append(f"#### Sensitivity: the result with `{name}` excluded")
        L.append("")
        L.append(f"`{name}` holds {fc.tp + fc.fn} of {tp + fn} gold skills "
                 f"({_fmt(pm._ratio(fc.tp + fc.fn, tp + fn))}), {fc.tp} of {tp} correct finds, {fc.fp} of {fp} false finds "
                 f"and {fc.fn} of {fn} misses.")
        L.append("")
        L.append("| Set | Resumes | Micro P | Micro R | Micro F1 | Macro P | Macro R | Macro F1 |")
        L.append("|---|---|---|---|---|---|---|---|")
        L.append(f"| All | {n} | {_fmt(micro.precision)} | {_fmt(micro.recall)} | {_fmt(micro.f1)} | "
                 f"{_fmt(macro.precision)} | {_fmt(macro.recall)} | {_fmt(macro.f1)} |")
        L.append(f"| Without `{name}` (TP {r_tp}, FP {r_fp}, FN {r_fn}) | {s['n']} | {_fmt(s['micro'].precision)} | "
                 f"{_fmt(s['micro'].recall)} | {_fmt(s['micro'].f1)} | {_fmt(s['macro'].precision)} | "
                 f"{_fmt(s['macro'].recall)} | {_fmt(s['macro'].f1)} |")
        if args._vocab is not None:
            f_in, g_in = in_vocabulary_recall(rest, args._vocab_set)
            L.append("")
            L.append(f"Without `{name}`: recall on all gold skills {_fmt(s['micro'].recall)}; recall on gold skills "
                     f"in the frozen vocabulary {_fmt(pm._ratio(f_in, g_in))} ({f_in} of {g_in}).")
        L.append("")
    L.append("| Role type | Resumes | Micro P | Micro R | Micro F1 |")
    L.append("|---|---|---|---|---|")
    for role, (cnt, prf) in res["by_role"].items():
        L.append(f"| {role} | {cnt} | {_fmt(prf.precision)} | {_fmt(prf.recall)} | {_fmt(prf.f1)} |")
    L.append("")
    L.append("### Contact fields (exact match after normalisation)")
    L.append("")
    L.append("Normalisation: email trimmed and lower-cased; GitHub and LinkedIn URLs trimmed, lower-cased, with a "
             "leading `http://`/`https://`, a leading `www.` and trailing `/` removed. Nothing else.")
    L.append("")
    L.append("| Field | Resumes with the field in gold | Correct of those | Accuracy over all resumes (empty = empty counts as correct) | Parser value where gold is empty |")
    L.append("|---|---|---|---|---|")
    for name, c in res["contact"].items():
        L.append(f"| {name} | {c.n_with_field} | {c.correct_with_field} ({_fmt(c.accuracy_with_field)}) | "
                 f"{c.correct_all}/{c.n_resumes} ({_fmt(c.accuracy_all)}) | {c.false_present} |")
    L.append("")
    med, mx = res["timing"]
    L.append("### Parse time")
    L.append("")
    L.append(f"Client-side wall clock per `POST /parse` on loopback, over the {res['n_timed']} resumes that returned "
             f"HTTP 200: median {('%.3f s' % med) if med is not None else 'n/a'}, maximum "
             f"{('%.3f s' % mx) if mx is not None else 'n/a'}.")
    L.append("")
    L.append("### Resumes not parsed")
    L.append("")
    not_parsed = [p for p in res["per_resume"] if p["status"] != "parsed" or p["no_text"]]
    if not not_parsed:
        L.append("None. Every resume returned HTTP 200 with text.")
    for p in not_parsed:
        name = display_name(p["row"], consented_idx)
        if p["status"] == "unreadable":
            L.append(f"- `{name}`: rejected as unreadable (HTTP 422, reason `{p['reason']}`); counted as zero found skills.")
        elif p["status"] == "failed":
            L.append(f"- `{name}`: parse failed ({p['reason']}); counted as zero found skills.")
        else:
            L.append(f"- `{name}`: HTTP 200 but no text was extracted; the service did not flag it as unreadable. "
                     f"Counted as returned (zero skills).")
    L.append("")
    L.append("<details><summary>Per-resume detail</summary>")
    L.append("")
    L.append("| Resume | Role | Status | TP | FP | FN | Missed | False finds |")
    L.append("|---|---|---|---|---|---|---|---|")
    for p in res["per_resume"]:
        c = p["counts"]
        L.append(f"| `{display_name(p['row'], consented_idx)}` | {p['row']['role_type']} | {p['status']} | "
                 f"{c.tp} | {c.fp} | {c.fn} | {', '.join(sorted(c.missed)) or '-'} | "
                 f"{', '.join(sorted(c.false_found)) or '-'} |")
    L.append("")
    L.append("</details>")
    if res["warnings"]:
        L.append("")
        L.append("Label warnings: " + "; ".join(res["warnings"]))
    if agree:
        L.append("")
        L.append("### Labeller agreement (skill-level, aliases applied, no out-of-scope filtering)")
        L.append("")
        L.append(f"- Resumes labelled by both: {agree['n_shared']}; only in A: {len(agree['only_a'])}; only in B: {len(agree['only_b'])}")
        L.append(f"- Micro F1 {_fmt(agree['micro'].f1)} (P {_fmt(agree['micro'].precision)}, R {_fmt(agree['micro'].recall)}, A as reference)")
        L.append(f"- Macro F1 {_fmt(agree['macro'].f1)} over {agree['macro'].n_f1} resumes")
        L.append(f"- Same role_type: {agree['role_same']}/{agree['n_shared']}")
    L.append("")
    return "\n".join(L)


RESULTS_HEADER = """# Parsing evaluation results

Written by `eval/run_parsing_eval.py` (card R-20, DECISIONS 4.3). Each run appends one dated section below. Sections are
never edited by hand. Only counts and skill names appear here: no resume text, no contact values, and consented
resumes are not named.

"""


def append_results(path: Path, section: str) -> None:
    existing = path.read_text(encoding="utf-8") if path.exists() else RESULTS_HEADER
    if not existing.endswith("\n"):
        existing += "\n"
    path.write_text(existing + "\n" + section, encoding="utf-8")


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--labels", type=Path, default=HERE / "labels" / "gold.csv")
    ap.add_argument("--resumes", type=Path, default=HERE / "resumes")
    ap.add_argument("--smoke", action="store_true",
                    help="use eval/smoke/gold.csv against tests/fixtures/ (overrides --labels/--resumes)")
    ap.add_argument("--nlp-url", default="http://127.0.0.1:8000")
    ap.add_argument("--aliases", type=Path, default=HERE / "aliases.json")
    ap.add_argument("--out-of-scope", type=Path, default=HERE / "out_of_scope_terms.json")
    ap.add_argument("--results", type=Path, default=HERE / "RESULTS.md")
    ap.add_argument("--no-write", action="store_true", help="print only; do not append to RESULTS.md")
    ap.add_argument("--labeller-a", type=Path)
    ap.add_argument("--labeller-b", type=Path)
    ap.add_argument("--vocabulary", type=Path,
                    help="frozen GET /skills/vocabulary body; adds recall on in-vocabulary gold skills")
    ap.add_argument("--freeze-vocabulary", action="store_true",
                    help="write the live vocabulary to --vocabulary and exit")
    ap.add_argument("--sensitivity", action="append", metavar="RESUME_FILE",
                    help="also report the scores with this resume excluded (repeatable)")
    ap.add_argument("--limit", action="append", metavar="TEXT",
                    help="a stated limit printed at the top of the section (repeatable)")
    args = ap.parse_args(argv)
    if args.smoke:
        args.labels = HERE / "smoke" / "gold.csv"
        args.resumes = REPO / "tests" / "fixtures"
    args._vocab = None

    if args.freeze_vocabulary:
        if not args.vocabulary:
            print("error: --freeze-vocabulary needs --vocabulary PATH", file=sys.stderr)
            return 2
        body = NlpClient(args.nlp_url).vocabulary()
        args.vocabulary.write_text(json.dumps(body, indent=2, sort_keys=True) + "\n", encoding="utf-8")
        print(f"Froze {len(vocabulary_names(body))} skills ({body.get('parser_version')}) to "
              f"{rel(args.vocabulary)}, sha256 {sha12(args.vocabulary)}")
        return 0

    try:
        rows = read_labels(args.labels)
        args._aliases = load_aliases(args.aliases)
        args._oos = load_out_of_scope(args.out_of_scope)
        if args.vocabulary:
            if not args.vocabulary.is_file():
                raise InputError(f"vocabulary file not found: {args.vocabulary}")
            args._vocab = vocabulary_names(json.loads(args.vocabulary.read_text(encoding="utf-8")))
            args._vocab_set = vocabulary_set(args._vocab, args._aliases)
        if bool(args.labeller_a) != bool(args.labeller_b):
            raise InputError("--labeller-a and --labeller-b must be given together")
        agree = labeller_agreement(args.labeller_a, args.labeller_b, args._aliases) if args.labeller_a else None
    except (InputError, ValueError) as err:
        print(f"error: {err}", file=sys.stderr)
        return 2

    client = NlpClient(args.nlp_url)
    args._client = client
    try:
        health = client.health()
    except (urllib.error.URLError, OSError, ValueError) as err:
        print(f"error: NLP service not reachable at {args.nlp_url}: {err}", file=sys.stderr)
        return 2
    if args._vocab is not None:
        live = vocabulary_names(client.vocabulary())
        if live != args._vocab:
            print(f"error: the live vocabulary differs from the frozen {rel(args.vocabulary)} "
                  f"(only live: {sorted(set(live) - set(args._vocab))[:10]}; "
                  f"only frozen: {sorted(set(args._vocab) - set(live))[:10]}); nothing written", file=sys.stderr)
            return 2

    print(f"Evaluating {len(rows)} resumes from {rel(args.labels)} against {args.nlp_url}")
    try:
        res = evaluate(rows, args.resumes, client, args._aliases, args._oos)
    except InputError as err:
        print(f"error: {err}", file=sys.stderr)
        return 2
    except (urllib.error.URLError, OSError) as err:
        print(f"error: NLP service failed mid-run ({err}); nothing written", file=sys.stderr)
        return 2

    section = render_section(args, rows, res, health, agree)
    print()
    print(section)
    if not args.no_write:
        append_results(args.results, section)
        print(f"Appended to {rel(args.results)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
