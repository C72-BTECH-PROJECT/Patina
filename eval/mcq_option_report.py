"""R-29 report: do the multiple-choice options give the answer away?

Generates N pools with the real assessment-service code and the configured
Gemini key (LIVE: it calls the LLM; tests run it only against a fake LLM), then
reports:
- per pool: model, outcome, rounds, seconds, and the MCQs the option rule
  rejected in every round (not only the accepted one); a pool that fails is
  recorded with its error code and the run goes on to the next pool;
- for the kept pool MCQs (after the R-29 option rule): the share whose correct
  option is the strictly longest, and the mean correct/distractor length ratio;
- for the served MCQs (after the draw and the option shuffle): the same share,
  and the share of correct answers at each position A-D.

Run from the repo root in assessment-service's venv:

    assessment-service\\.venv\\Scripts\\python eval\\mcq_option_report.py --pools 3
    ... --save-json eval\\mcq_pools.json    (keep the generated questions for audit)
    ... --write                             (append the section to eval/RESULTS.md)

The input is one invented job and one invented candidate (below); no real
person's data. The key is read by assessment-service's config and never printed.
The saved JSON holds only generated content (questions, options, answer keys,
rejected MCQs with their reasons) and per-round outcomes; no ids or input text.
"""
import argparse
import json
import random
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
RESULTS = REPO / "eval" / "RESULTS.md"
LABELS = ["A", "B", "C", "D"]
_MAX_ERROR_CHARS = 300

SYNTHETIC_INPUT = {
    "candidate_id": "eval-r29-candidate",
    "job_id": "eval-r29-job",
    "job_title": "Backend Engineer",
    "job_description": (
        "Build and maintain REST APIs in Python (FastAPI) and Node.js backed by "
        "PostgreSQL. Write SQL, design schemas, add tests, deploy with Docker."
    ),
    "required_skills": ["python", "fastapi", "sql", "postgresql", "docker", "rest api"],
    "preferred_skills": ["node.js", "redis"],
    "experience_level": "mid",
    "resume_text": (
        "Invented Candidate. Backend developer, 3 years. Built a FastAPI order "
        "service with PostgreSQL and Redis caching; wrote SQL migrations; "
        "containerised services with Docker; Node.js scripts for data imports."
    ),
    "resume_skills": ["python", "fastapi", "postgresql", "redis", "docker", "node.js", "sql"],
    # Same shape as core sends (the parser's {title, description} objects).
    "resume_projects": [
        {
            "title": "Order service",
            "description": "FastAPI order service with PostgreSQL and Redis caching",
        }
    ],
    "include_github": False,
    "github_data": None,
}


# ── metrics (pure; tested in tests/assessment/test_option_rule.py) ──────────

def _length(text: str) -> int:
    return len(" ".join(str(text).split()))


def longest_option_stats(mcqs: list[tuple[list[dict], str]]) -> dict:
    """mcqs: [(options, correct_label)]. Strictly longest, tied-longest, mean ratio."""
    strictly = tied = 0
    ratios = []
    for options, correct_label in mcqs:
        correct = next(_length(o["text"]) for o in options if o["label"] == correct_label)
        others = [_length(o["text"]) for o in options if o["label"] != correct_label]
        if correct > max(others):
            strictly += 1
        elif correct == max(others):
            tied += 1
        mean = sum(others) / len(others)
        if mean:
            ratios.append(correct / mean)
    n = len(mcqs)
    return {
        "n": n,
        "correct_strictly_longest": strictly,
        "correct_tied_longest": tied,
        "share_strictly_longest": strictly / n if n else None,
        "mean_length_ratio": sum(ratios) / len(ratios) if ratios else None,
    }


def position_spread(correct_labels: list[str]) -> dict:
    """Share of correct answers at each label A-D."""
    n = len(correct_labels)
    return {
        label: (correct_labels.count(label) / n if n else None) for label in LABELS
    }


def pool_mcqs(questions_json: dict, answers_json: dict) -> list[tuple[list[dict], str]]:
    correct = {a["question_id"]: a.get("correct_option") for a in answers_json["answers"]}
    return [
        (q["options"], correct[q["question_id"]])
        for q in questions_json["questions"]
        if q["question_type"] == "mcq"
    ]


def rejected_all_rounds(round_log: list[dict]) -> int:
    """MCQs rejected by the option rule, summed over every round of one pool."""
    return sum(len(entry.get("rejected") or []) for entry in round_log)


# ── live run ────────────────────────────────────────────────────────────────

def run_live(pools: int, rng: random.Random | None = None) -> tuple[list[dict], list[dict]]:
    service_dir = str(REPO / "assessment-service")
    if service_dir not in sys.path:
        sys.path.insert(0, service_dir)
    from app import config  # noqa: E402  (reads assessment-service/.env)
    from app.generator import _shuffle_mcq_options, draw_served_questions, generate_pool
    from app.llm_client import AssessmentLLMError

    if not config.llm_configured():
        raise SystemExit("No Gemini key/models configured in assessment-service/.env.")

    rng = rng or random.SystemRandom()
    runs, saved = [], []
    for index in range(1, pools + 1):
        round_log: list[dict] = []
        started = time.monotonic()
        try:
            pool = generate_pool(
                dict(SYNTHETIC_INPUT, candidate_id=f"eval-r29-{index}"),
                round_log=round_log,
            )
            served_q, served_a = draw_served_questions(
                pool.questions_json, pool.answers_json, rng
            )
            _shuffle_mcq_options(served_q, served_a, rng)
        except Exception as exc:  # one failed pool must not lose the others
            code = exc.code if isinstance(exc, AssessmentLLMError) else type(exc).__name__
            seconds = round(time.monotonic() - started, 1)
            runs.append({
                "pool": index, "model": None, "failed": code,
                "rounds": len(round_log), "seconds": seconds,
                "rejected_all_rounds": rejected_all_rounds(round_log),
                "kept_mcqs": [], "served_mcqs": [],
            })
            saved.append({
                "pool": index, "outcome": "failed", "error": code,
                "error_detail": str(exc)[:_MAX_ERROR_CHARS], "round_log": round_log,
            })
            print(f"pool {index}: FAILED {code} after {seconds}s, rounds={len(round_log)}, "
                  f"rejected={rejected_all_rounds(round_log)}", file=sys.stderr)
            continue

        runs.append({
            "pool": index,
            "model": pool.model_used,
            "failed": None,
            "rounds": pool.rounds,
            "seconds": round(pool.seconds, 1),
            "rejected_all_rounds": rejected_all_rounds(round_log),
            "kept_mcqs": pool_mcqs(pool.questions_json, pool.answers_json),
            "served_mcqs": pool_mcqs(served_q, served_a),
        })
        saved.append({
            "pool": index,
            "outcome": "ok",
            "prompt_version": pool.questions_json.get("prompt_version"),
            "length_ratio_limit": config.MCQ_MAX_LENGTH_RATIO,
            "min_length_gap": config.MCQ_MIN_LENGTH_GAP,
            "round_log": round_log,
            "pool_questions": pool.questions_json["questions"],
            "pool_answers": pool.answers_json["answers"],
            "served_questions": served_q["questions"],
            "served_answers": served_a["answers"],
        })
        print(f"pool {index}: {pool.seconds:.1f}s, rounds={pool.rounds}, "
              f"rejected={rejected_all_rounds(round_log)}", file=sys.stderr)
    return runs, saved


def render(runs: list[dict], *, ratio_limit: float, gap_limit: float) -> str:
    kept = [m for r in runs for m in r["kept_mcqs"]]
    served = [m for r in runs for m in r["served_mcqs"]]
    kept_stats = longest_option_stats(kept)
    served_stats = longest_option_stats(served)
    spread = position_spread([label for _, label in served])
    stamp = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
    failed = sum(1 for r in runs if r["failed"])

    def pct(x):
        return "n/a" if x is None else f"{x * 100:.1f} %"

    ratio = kept_stats["mean_length_ratio"]
    lines = [
        f"## {stamp} - R-29 multiple-choice option report (LIVE, {len(runs)} pools, "
        f"{failed} failed)",
        "",
        f"Option rule: an MCQ is rejected when its correct option is more than "
        f"{ratio_limit:g}x the distractors' mean length AND at least {gap_limit:g} "
        "characters longer. Input: one invented job and candidate "
        "(`eval/mcq_option_report.py`).",
        "",
        "| Pool | Model | Outcome | Rounds | Seconds | MCQs rejected by the option rule (all rounds) |",
        "|---|---|---|---|---|---|",
    ]
    for r in runs:
        outcome = f"failed ({r['failed']})" if r["failed"] else "ok"
        lines.append(
            f"| {r['pool']} | {r['model'] or '-'} | {outcome} | {r['rounds']} | "
            f"{r['seconds']} | {r['rejected_all_rounds']} |"
        )
    lines += [
        "",
        f"- Kept pool MCQs: {kept_stats['n']}; correct option strictly longest: "
        f"{kept_stats['correct_strictly_longest']} ({pct(kept_stats['share_strictly_longest'])}); "
        f"tied longest: {kept_stats['correct_tied_longest']}; mean correct/distractor "
        f"length ratio: {'n/a' if ratio is None else f'{ratio:.2f}'}",
        f"- Served MCQs: {served_stats['n']}; correct option strictly longest: "
        f"{served_stats['correct_strictly_longest']} ({pct(served_stats['share_strictly_longest'])})",
        "- Served correct-answer position: "
        + ", ".join(f"{label} {pct(share)}" for label, share in spread.items()),
        "",
    ]
    return "\n".join(lines)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--pools", type=int, default=3)
    parser.add_argument("--save-json", type=Path, default=None)
    parser.add_argument("--write", action="store_true", help="append to eval/RESULTS.md")
    args = parser.parse_args()

    runs, saved = run_live(args.pools)
    from app import config  # imported by run_live

    section = render(
        runs, ratio_limit=config.MCQ_MAX_LENGTH_RATIO, gap_limit=config.MCQ_MIN_LENGTH_GAP
    )
    print(section)
    if args.save_json:
        args.save_json.write_text(json.dumps(saved, indent=2, ensure_ascii=False), encoding="utf-8")
    if args.write:
        with RESULTS.open("a", encoding="utf-8") as handle:
            handle.write("\n" + section)


if __name__ == "__main__":
    main()
