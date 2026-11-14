// Explainability layer for the unified credibility score.
//
// Spec: FR-13, GF-5, CHECKLIST 4.3 / 4.4 / 4.5 / 4.7 / 4.11 / 5.7 / 5.8 / 5.11.
//
// This module owns three things and nothing else:
//   1. Turning each evidence source into a normalised 0-100 **sub-score**.
//   2. Aggregating available sub-scores into the composite by the weight rule of
//      REBUILD/DECISIONS.md §7.1 (weightPlan below): a source with no evidence is
//      never scored as zero (4.7 / GF-4), the résumé's share is fixed, and a share
//      no source earned stays unearned. Plus the verification state (W3).
//   3. Emitting an **explanation record** stating which factors contributed, in
//      which direction, with what weight, citing the evidence underneath.
//
// The explanation record is persisted verbatim into `scores.explanation`, so a
// stored score can be re-explained later without re-running the parser (4.11).
// Keys inside it stay snake_case on purpose: what the dashboard renders is
// byte-for-byte what was persisted, which is the point of an audit record.
//
// ---------------------------------------------------------------------------
// SUB-SCORE CONTRACT (read this before adding GitHub or assessment evidence)
// ---------------------------------------------------------------------------
// `scores.subscores` is an object keyed by the three SUBSCORE_KEYS. Every entry
// — including sources that produced nothing — has the same shape:
//
//   {
//     key:        'github_evidence',
//     label:      'GitHub Evidence',
//     available:  false,          // false => contributed nothing, weight 0
//     value:      null,           // 0-100 once available, null while not
//     weight:     0,              // share of the composite, 0..1
//     reason:     'The GitHub …', // why it is unavailable (null when available)
//     components: null,           // raw source metrics, kept for audit; an
//                                 // unavailable GitHub entry holds { reason_code }
//     evidence:   [],             // EvidenceItem[] — see below
//   }
//
// EvidenceItem is one of:
//   { type:'skill_set', key, label, direction:'positive'|'negative', items:[], count }
//   { type:'metric',    key, label, value, display, direction, weight_within_factor, note }
//
// To add a source later: write a `buildXSubScore()` that returns that shape and
// drop it into `buildScoreRecord`, and give it a place in `weightPlan()`'s rule
// (D§7.1 names each source's role, so a new one needs a decision first).
// `buildExplanation()` then renders it.
//
// Frontend consumers of this contract:
//   * recruiter `CandidateModal.jsx` — renders explanation.factors and each
//     factor's evidence array as the composite -> sub-score -> evidence
//     drill-down (5.8).
//   * candidate `Results.jsx` (not routed yet) — its three "Resume Match /
//     GitHub Verified / Assessment" tiles map 1:1 to
//     `subScores.<key>.value`, which is null until that engine exists. It must
//     render the unavailable state from `available`/`reason` rather than
//     aliasing the composite, which is what it does today.
//   * candidate `Assessment.jsx` — posts answers to `/api/assessment/evaluate`;
//     the stored evaluation is what `buildAssessmentSubScore()` turns into the
//     `assessment_results` entry above.

import { skillIndex, skillKey } from './skillNames.js';

export const SUBSCORE_KEYS = {
  PARSING: 'parsing_semantic_alignment',
  GITHUB: 'github_evidence',
  ASSESSMENT: 'assessment_results',
};

export const SUBSCORE_LABELS = {
  [SUBSCORE_KEYS.PARSING]: 'Résumé ↔ Job Semantic Alignment',
  [SUBSCORE_KEYS.GITHUB]: 'GitHub Evidence',
  [SUBSCORE_KEYS.ASSESSMENT]: 'Assessment Results',
};

// Why the GitHub sub-score is unavailable, by the reason code the client
// (Services/githubEvidence.js) returns. Texts are ROADMAP §1.3's drafts;
// `insufficient_evidence` is the I-0047 draft. Owner review of the wording is
// pending (T-0014 test plan).
export const GITHUB_REASONS = {
  no_github_link:
    'No GitHub profile link was found on the resume, so GitHub evidence was not used.',
  invalid_github_link: 'The GitHub link on the resume is not a valid profile address.',
  github_user_not_found: 'The GitHub account named on the resume does not exist.',
  no_public_repositories: 'The GitHub account has no public repositories of its own to check.',
  insufficient_evidence: "The GitHub account's repositories gave too little data to score.",
  // R-06/R-10 (D§5): repositories but no commits in the window. Weight 0, so an
  // inactive account counts exactly like no account.
  no_recent_public_activity:
    'The GitHub account has public repositories but no commits by the candidate in the last year, so GitHub evidence was not scored. An inactive account counts the same as no account, never as a zero.',
  github_rate_limited:
    "GitHub's request limit was reached, so repository activity was not checked for this score.",
  service_unavailable:
    'The GitHub evidence service was not reachable, so repository activity was not checked.',
  timeout: 'The GitHub evidence check took too long and was skipped for this score.',
  service_error: 'The GitHub evidence check failed, so repository activity was not checked.',
  service_disabled:
    'No GitHub evidence was collected for this candidate. The GitHub Aggregator service is not part of this deployment yet, so repository activity has not been checked.',
  // Historical: written by the removed rebuildScoreRecord() (T-0025 to R-10) into
  // rows updated in place. Kept so those stored rows still name a known code; no
  // code path writes it any more (R-11).
  not_collected_for_score:
    'This score was computed before GitHub evidence was collected, so repository activity was not checked. Re-analysing the resume would include it.',
};

// R-10 (D§4.1, B1): why the parsing sub-score is unavailable. A parse with no
// job-match similarity is "not measured", never an available 0.
export const PARSING_REASONS = {
  no_similarity:
    'The resume parser returned no résumé-to-job similarity for this application, so résumé-job alignment was not scored. It was not scored as zero.',
  // R-11 (lead's ruling 2026-11-14): after an assessment is graded the score is
  // recomputed; if the résumé cannot be parsed then, the row is anchored to the
  // newest stored parse and alignment is unavailable with the pipeline's code.
  no_resume:
    'No résumé file was found when this score was computed, so résumé-job alignment was not scored. It was not scored as zero.',
  storage_error:
    'The stored résumé could not be read when this score was computed, so résumé-job alignment was not scored. It was not scored as zero.',
  unreadable_document:
    'The résumé could not be read as text when this score was computed, so résumé-job alignment was not scored. It was not scored as zero.',
  unsupported_file_type:
    'The résumé file type is not supported, so résumé-job alignment was not scored. It was not scored as zero.',
  parser_unavailable:
    'The résumé parser was not available when this score was computed, so résumé-job alignment was not scored. It was not scored as zero. Scoring again once the parser is back would include it.',
  parser_failed:
    'The résumé parser failed when this score was computed, so résumé-job alignment was not scored. It was not scored as zero.',
  database_error:
    'The parsed résumé could not be saved when this score was computed, so résumé-job alignment was not scored. It was not scored as zero.',
};

/** Parsing with no measurement: weight 0, value null, the reason in words and as a code. */
export const parsingUnavailableSubScore = (reasonCode) => {
  const code = Object.hasOwn(PARSING_REASONS, reasonCode) ? reasonCode : 'parser_failed';
  return {
    ...unavailableSubScore(SUBSCORE_KEYS.PARSING, PARSING_REASONS[code]),
    components: { reason_code: code },
  };
};

// D§5, D§7: the GitHub login is read from the résumé link; nothing proves the
// candidate owns that account (verifying it is stretch S-3).
export const GITHUB_OWNERSHIP_NOTE =
  'The GitHub account was taken from the link on the résumé. Ownership of that account is not verified, so its evidence may not be the candidate\'s own work.';

// D§7 (F25): the one place the score bands are defined. Presentation labels
// with no calibration behind them; the frontend renders `band` and never
// re-derives it from the number.
export const SCORE_BAND_THRESHOLDS = Object.freeze({ high: 80, medium: 60 });
export const SCORE_BAND_NOTE =
  'Bands are presentation labels (high at 80 or more, medium at 60 or more, low below 60). They are not calibrated.';

/** 'high' | 'medium' | 'low' for a 0-100 composite, or null when there is no composite. */
export const scoreBand = (composite) => {
  if (composite === null || composite === undefined || composite === '') return null;
  const n = Number(composite);
  if (!Number.isFinite(n)) return null;
  if (n >= SCORE_BAND_THRESHOLDS.high) return 'high';
  if (n >= SCORE_BAND_THRESHOLDS.medium) return 'medium';
  return 'low';
};

// Why a source has no evidence. Surfaced to the recruiter verbatim so an empty
// panel always says why it is empty (GF-4, CHECKLIST 5.10).
const UNAVAILABLE_REASONS = {
  [SUBSCORE_KEYS.GITHUB]: GITHUB_REASONS.service_disabled,
  [SUBSCORE_KEYS.ASSESSMENT]:
    'No assessment has been completed by this candidate for this job yet. Candidates complete a generated technical assessment from their dashboard.',
};

// D§7.1 (W1, approved 2026-11-13): base weights résumé 0.20, GitHub 0.35,
// assessment 0.45. Stated here rather than buried in a formula (CHECKLIST 4.3),
// still provisional and uncalibrated, and overridable per deployment via
// CREDIBILITY_WEIGHTS, e.g.
//   CREDIBILITY_WEIGHTS={"parsing_semantic_alignment":0.2,"github_evidence":0.35,"assessment_results":0.45}
// An override is read as proportions (it is divided by its own total). How the
// weights are applied is aggregate()'s rule below (W2 and option (b)).
const DEFAULT_BASE_WEIGHTS = {
  [SUBSCORE_KEYS.PARSING]: 0.2,
  [SUBSCORE_KEYS.GITHUB]: 0.35,
  [SUBSCORE_KEYS.ASSESSMENT]: 0.45,
};

// D§7.1 W5: stored with every new score as `explanation.weights_version`. Change it
// whenever a default weight or a rule of D§7.1 changes. A stored row with no
// version was computed with the v1 rule (0.40 / 0.35 / 0.25, renormalised over
// whatever was available); the frontend labels it so.
export const WEIGHTS_VERSION = 'w2-2026-11-13';

const readBaseWeights = () => {
  const raw = process.env.CREDIBILITY_WEIGHTS;
  if (!raw) return { weights: { ...DEFAULT_BASE_WEIGHTS }, source: 'default' };
  try {
    const parsed = JSON.parse(raw);
    const merged = { ...DEFAULT_BASE_WEIGHTS };
    for (const key of Object.values(SUBSCORE_KEYS)) {
      const value = Number(parsed[key]);
      if (Number.isFinite(value) && value >= 0) merged[key] = value;
    }
    const total = Object.values(merged).reduce((sum, n) => sum + n, 0);
    if (total <= 0) return { weights: { ...DEFAULT_BASE_WEIGHTS }, source: 'default' };
    return { weights: merged, source: 'CREDIBILITY_WEIGHTS' };
  } catch {
    console.warn('CREDIBILITY_WEIGHTS is not valid JSON; using default weights.');
    return { weights: { ...DEFAULT_BASE_WEIGHTS }, source: 'default' };
  }
};

const BASE_WEIGHTS_READ = readBaseWeights();
export const BASE_WEIGHTS = BASE_WEIGHTS_READ.weights;
export const BASE_WEIGHTS_SOURCE = BASE_WEIGHTS_READ.source;

// D§7.1 W3: how far a score is verified, by how many INDEPENDENT sources (GitHub,
// the assessment) produced evidence. The résumé is self-reported and never counts.
export const VERIFICATION = Object.freeze({
  UNVERIFIED: 'unverified',
  PARTLY: 'partly_verified',
  VERIFIED: 'verified',
});

/** The verification state of a set of (stored or new) sub-scores; null when nothing is available. */
export const scoreVerification = (subScores) => {
  if (!subScores || typeof subScores !== 'object') return null;
  const avail = (key) => subScores[key]?.available === true;
  if (!Object.values(SUBSCORE_KEYS).some(avail)) return null;
  const independent = [SUBSCORE_KEYS.GITHUB, SUBSCORE_KEYS.ASSESSMENT].filter(avail).length;
  if (independent === 2) return VERIFICATION.VERIFIED;
  if (independent === 1) return VERIFICATION.PARTLY;
  return VERIFICATION.UNVERIFIED;
};

// D§7.1 W4: the assessment states in which a candidate is still awaiting the
// assessment (the state names of assessment.controller.js candidateView). A
// completed attempt or used-up attempts (which covers an expired-and-graded one)
// end it.
export const AWAITING_ASSESSMENT_STATES = Object.freeze([
  'not_prepared', 'preparing', 'unavailable', 'ready', 'in_progress', 'grading_pending',
]);
const FINAL_ASSESSMENT_STATES = new Set(['completed', 'attempts_used']);

/** 'awaiting_assessment' until the assessment state is `completed` or `attempts_used`, then 'final'. */
export const scoreState = (assessmentState) =>
  (FINAL_ASSESSMENT_STATES.has(assessmentState) ? 'final' : 'awaiting_assessment');

const clamp01 = (n) => Math.max(0, Math.min(1, Number(n) || 0));
const round2 = (n) => Math.round(n * 100) / 100;
const toPoints = (unitValue) => round2(clamp01(unitValue) * 100);
const asPercent = (unitValue) => `${Math.round(clamp01(unitValue) * 100)}%`;
const asArray = (value) => (Array.isArray(value) ? value : []);

// --- Sub-score builders -----------------------------------------------------

/** A source that produced no evidence. Weight 0, value null — never a zero score. */
export const unavailableSubScore = (key, reason = UNAVAILABLE_REASONS[key] || null) => ({
  key,
  label: SUBSCORE_LABELS[key],
  available: false,
  value: null,
  weight: 0,
  reason,
  components: null,
  evidence: [],
});

/**
 * Parsing Semantic Alignment (CHECKLIST 1.14).
 *
 * Every explainable field the NLP service computes is carried through here —
 * matched/missing skills, coverage, the two similarity components and the
 * weights the service used to combine them. Dropping any of them is what made
 * the composite a black box.
 */
export const buildParsingSubScore = (semanticAnalysis) => {
  // B1 (R-10): no similarity block, or one without a numeric similarity, means
  // the alignment was not measured. Unavailable with a reason, never a 0.
  const rawSimilarity = semanticAnalysis && typeof semanticAnalysis === 'object'
    ? semanticAnalysis.similarity_score
    : undefined;
  if (rawSimilarity === null || rawSimilarity === undefined || rawSimilarity === ''
    || !Number.isFinite(Number(rawSimilarity))) {
    return {
      ...unavailableSubScore(SUBSCORE_KEYS.PARSING, PARSING_REASONS.no_similarity),
      components: { reason_code: 'no_similarity' },
    };
  }
  const sa = semanticAnalysis;
  const similarity = clamp01(rawSimilarity);
  const semanticScore = sa.semantic_score == null ? null : clamp01(sa.semantic_score);
  const skillCoverage = sa.skill_coverage == null ? null : clamp01(sa.skill_coverage);

  const jdSkills = asArray(sa.jd_skills);
  const resumeSkills = asArray(sa.resume_skills);
  const matchedSkills = asArray(sa.matched_skills);
  const missingSkills = asArray(sa.missing_skills);

  // Which job-skill source the parser used (CHECKLIST 4.3). The stored job's
  // structured `required_skills`/`preferred_skills` are authoritative; the
  // markdown description is only scraped when no structured list exists.
  const jdSource = sa.jd_source || (jdSkills.length ? 'parsed_description' : null);
  const jdSourceNote =
    jdSource === 'structured_skills'
      ? " Job skills are taken from the role's listed required and preferred skills."
      : jdSource === 'parsed_description'
        ? ' Job skills were parsed from the job-description text because the role has no structured skill list.'
        : '';

  // Emitted by the NLP service (embedder.SKILL_COVERAGE_WEIGHT /
  // SEMANTIC_SCORE_WEIGHT). The fallback matches an older service build.
  const componentWeights = sa.component_weights || {
    skill_coverage: skillCoverage == null ? 0 : 0.6,
    semantic_score: skillCoverage == null ? 1 : 0.4,
  };

  const evidence = [];
  if (jdSkills.length) {
    evidence.push({
      type: 'skill_set',
      key: 'matched_skills',
      label: 'Job skills found in the résumé',
      direction: 'positive',
      items: matchedSkills,
      count: matchedSkills.length,
    });
    evidence.push({
      type: 'skill_set',
      key: 'missing_skills',
      label: 'Job skills not found in the résumé',
      direction: 'negative',
      items: missingSkills,
      count: missingSkills.length,
    });
  }
  if (skillCoverage != null) {
    evidence.push({
      type: 'metric',
      key: 'skill_coverage',
      label: 'Skill coverage',
      value: skillCoverage,
      display: `${matchedSkills.length} of ${jdSkills.length} job skills (${asPercent(skillCoverage)})`,
      direction: skillCoverage >= 0.5 ? 'positive' : 'negative',
      weight_within_factor: Number(componentWeights.skill_coverage) || 0,
      note:
        'Share of the technical skills the job asks for that also appear in the résumé.' +
        jdSourceNote,
    });
  }
  if (semanticScore != null) {
    evidence.push({
      type: 'metric',
      key: 'semantic_score',
      label: 'Semantic similarity',
      value: semanticScore,
      display: asPercent(semanticScore),
      direction: semanticScore >= 0.5 ? 'positive' : 'negative',
      weight_within_factor: Number(componentWeights.semantic_score) || 0,
      note: 'Sentence-embedding similarity between the résumé and the job description, so related wording counts even when the exact term differs.',
    });
  }
  if (sa.focused_score != null) {
    evidence.push({
      type: 'metric',
      key: 'focused_score',
      label: 'Similarity of skill-evidence lines',
      value: clamp01(sa.focused_score),
      display: asPercent(sa.focused_score),
      direction: 'neutral',
      weight_within_factor: null,
      note: 'Input to semantic similarity: only the résumé lines that substantiate a detected skill.',
    });
  }
  if (sa.full_text_score != null) {
    evidence.push({
      type: 'metric',
      key: 'full_text_score',
      label: 'Similarity of the full résumé text',
      value: clamp01(sa.full_text_score),
      display: asPercent(sa.full_text_score),
      direction: 'neutral',
      weight_within_factor: null,
      note: 'Input to semantic similarity: the whole résumé against the job description.',
    });
  }

  return {
    key: SUBSCORE_KEYS.PARSING,
    label: SUBSCORE_LABELS[SUBSCORE_KEYS.PARSING],
    available: true,
    value: toPoints(similarity),
    weight: 0, // set by aggregate()
    reason: null,
    components: {
      similarity_score: similarity,
      jd_source: jdSource,
      semantic_score: semanticScore,
      skill_coverage: skillCoverage,
      focused_score: sa.focused_score ?? null,
      full_text_score: sa.full_text_score ?? null,
      component_weights: componentWeights,
      matched_skills: matchedSkills,
      missing_skills: missingSkills,
      jd_skills: jdSkills,
      resume_skills: resumeSkills,
      match_level: sa.match_level ?? null,
      match_reason: sa.match_reason ?? null,
    },
    evidence,
  };
};

/** GitHub with no evidence: weight 0, value null, and the reason in words and as a code. */
const githubUnavailable = (reasonCode) => {
  const code = Object.hasOwn(GITHUB_REASONS, reasonCode) ? reasonCode : 'service_error';
  return {
    ...unavailableSubScore(SUBSCORE_KEYS.GITHUB, GITHUB_REASONS[code]),
    components: { reason_code: code },
  };
};

// Limitations every answer carries; anything else is worth naming to the recruiter.
const STANDARD_GITHUB_LIMITATIONS = new Set([
  'public_repositories_only',
  'default_branch_only',
  'author_matched_by_login_or_email',
]);

const GITHUB_PRIVATE_WORK_NOTE =
  'Public repositories only: private or employer work is not visible to this check and is not counted against the candidate.';

/** One metric per service component (github-evidence/README.md "Sub-score"). */
const githubComponentMetric = (component, ev, claimCounts) => {
  const value = clamp01(component.value);
  const activity = ev.commit_activity || {};
  const repos = ev.repositories || {};
  const describe = {
    activity: {
      label: 'Commit activity',
      display: `${activity.authored_commits ?? 0} authored commits in ${activity.window_days ?? 365} days`,
      note: "Commits the candidate authored in their own public repositories (default branch) over the window.",
    },
    consistency: {
      label: 'Consistency',
      display: `${activity.active_weeks ?? 0} of ${activity.weeks ?? 52} weeks active`,
      note: 'Weeks in the last year with at least one authored commit; steady work counts for more than one burst.',
    },
    ownership: {
      label: 'Own repositories with commits',
      display: `${repos.with_authored_commits ?? 0} of ${repos.considered ?? 0} own repositories`,
      note: 'Own (non-fork) public repositories with commits by the candidate in the window. Forks are not counted.',
    },
    corroboration: {
      label: 'Résumé languages found on GitHub',
      display: `${claimCounts.evidenced} of ${claimCounts.evidenced + claimCounts.notFound} checkable languages`,
      note:
        "Languages claimed on the résumé that appear in the candidate's own public repositories." +
        (claimCounts.notCheckable
          ? ` ${claimCounts.notCheckable} claimed framework${claimCounts.notCheckable === 1 ? '' : 's'} or tool${claimCounts.notCheckable === 1 ? '' : 's'} cannot be checked from language statistics and ${claimCounts.notCheckable === 1 ? 'is' : 'are'} not counted against the candidate.`
          : ''),
    },
  }[component.key] || { label: component.key, display: asPercent(value), note: '' };

  return {
    type: 'metric',
    key: `github_${component.key}`,
    label: describe.label,
    value,
    display: describe.display,
    direction: value >= 0.5 ? 'positive' : 'negative',
    weight_within_factor: Number(component.weight) || 0,
    note: describe.note,
  };
};

/**
 * GitHub Evidence (CHECKLIST 2.4 / 2.5 / 2.7 / 2.10 / 2.12), from the result of
 * fetchGithubEvidence(): `{ ok: true, evidence, requestId }` or
 * `{ ok: false, reasonCode }`.
 *
 * `components` is the evidence snapshot that is persisted with the score (DEC-6,
 * ROADMAP §1.4), so a later drill-down or re-explanation never calls GitHub again.
 */
export const buildGithubSubScore = (result) => {
  if (!result?.ok) return githubUnavailable(result?.reasonCode);

  const ev = result.evidence || {};
  const sub = ev.sub_score || {};
  const parts = asArray(sub.components);
  const claims = asArray(ev.claims);
  const limitations = asArray(ev.limitations);
  const repos = ev.repositories || {};
  const skillsWith = (status) => claims.filter((c) => c?.status === status).map((c) => c.skill);
  const evidenced = skillsWith('evidenced');
  const notFound = skillsWith('not_found');
  const claimCounts = {
    evidenced: evidenced.length,
    notFound: notFound.length,
    notCheckable: skillsWith('not_checkable').length,
  };

  const evidence = parts
    .filter((c) => c?.available && c.value != null)
    .map((c) => githubComponentMetric(c, ev, claimCounts));

  if (evidenced.length + notFound.length) {
    evidence.push({
      type: 'skill_set',
      key: 'github_claims_evidenced',
      label: "Résumé languages found in the candidate's own repositories",
      direction: 'positive',
      items: evidenced,
      count: evidenced.length,
    });
    evidence.push({
      type: 'skill_set',
      key: 'github_claims_not_found',
      label: "Résumé languages not found in the candidate's own repositories",
      direction: 'negative',
      items: notFound,
      count: notFound.length,
    });
  }

  // CHECKLIST 2.10: the limitation is always stated, on the first item shown.
  const partial = ev.status === 'partial' || sub.partial === true;
  const extra = limitations.filter((l) => !STANDARD_GITHUB_LIMITATIONS.has(l));
  const lead =
    `${GITHUB_OWNERSHIP_NOTE} ${GITHUB_PRIVATE_WORK_NOTE}` +
    (partial ? ' Partial result: some repository data could not be fetched.' : '') +
    (extra.length ? ` Limits of this check: ${extra.join(', ')}.` : '');
  if (evidence.length) {
    evidence[0] = { ...evidence[0], note: [lead, evidence[0].note].filter(Boolean).join(' ') };
  }

  return {
    key: SUBSCORE_KEYS.GITHUB,
    label: SUBSCORE_LABELS[SUBSCORE_KEYS.GITHUB],
    available: true,
    value: toPoints(sub.value),
    weight: 0, // set by aggregate()
    reason: null,
    components: {
      username: ev.username ?? null,
      account_source: 'resume_link',
      ownership_verified: false,
      request_id: result.requestId ?? ev.request_id ?? null,
      fetched_at: ev.fetched_at ?? null,
      contract_version: ev.contract_version ?? null,
      status: ev.status ?? null,
      partial,
      repositories: {
        listed: repos.listed ?? null,
        owned: repos.owned ?? null,
        forked: repos.forked ?? null,
        archived: repos.archived ?? null,
        considered: repos.considered ?? null,
        truncated: repos.truncated ?? null,
        detailed: repos.detailed ?? null,
        with_authored_commits: repos.with_authored_commits ?? null,
        items: asArray(repos.items).map((r) => ({
          name: r?.name ?? null,
          fork: r?.fork ?? null,
          archived: r?.archived ?? null,
          pushed_at: r?.pushed_at ?? null,
          primary_language: r?.primary_language ?? null,
          authored_commits_window: r?.authored_commits_window ?? null,
        })),
      },
      languages: asArray(ev.languages),
      commit_activity: ev.commit_activity ?? null,
      claims,
      limitations,
      sub_score_value: sub.value ?? null,
      weights_source: sub.weights_source ?? null,
      component_weights: Object.fromEntries(parts.map((c) => [c.key, c.weight])),
      sub_score_components: parts,
    },
    evidence,
  };
};

// D§6.2: identity, second devices, AI-written answers and tab switching are not
// controlled, and the recruiter view says so.
export const UNPROCTORED_NOTE = 'Unproctored online assessment.';

/**
 * One row per graded question with only candidate-safe fields (R-11). Anything
 * else in a result (feedback, the correct option, the ideal answer) is dropped.
 */
export const questionOutcomes = (results) => asArray(results)
  .filter((r) => r && typeof r === 'object')
  .map((r) => ({
    question_id: typeof r.question_id === 'string' ? r.question_id : null,
    question_type: r.question_type === 'mcq' || r.question_type === 'short_answer' ? r.question_type : null,
    skill: typeof r.skill === 'string' ? r.skill : null,
    correct: r.correct === true,
    points: Number.isFinite(Number(r.points)) ? Number(r.points) : 0,
    max_points: Number.isFinite(Number(r.max_points)) ? Number(r.max_points) : 1,
  }));

/**
 * Assessment Results (CHECKLIST 3.7 / 4.1, GF-5).
 *
 * Built from a completed assessment's evaluation: the server-side score
 * against the answer key, plus enough per-type detail for the recruiter to
 * see what the number is made of. MCQs are deterministic; short answers are
 * rubric-graded, so `short_answer_graded` records whether that path worked.
 */
export const buildAssessmentSubScore = (evaluation) => {
  const score = Number(evaluation?.score);
  if (!Number.isFinite(score)) {
    return unavailableSubScore(SUBSCORE_KEYS.ASSESSMENT);
  }

  const results = asArray(evaluation.results);
  const mcqResults = results.filter((r) => r?.question_type === 'mcq');
  const shortResults = results.filter((r) => r?.question_type === 'short_answer');
  const mcqCorrect = mcqResults.filter(
    (r) => Number(r.points) >= Number(r.max_points || 1) - 0.001
  ).length;
  const outcomes = questionOutcomes(results);
  const fullMarks = outcomes.filter((o) => o.correct).length;

  const gradedNote =
    evaluation.short_answer_graded === false
      ? ' Short-answer grading was unavailable, so the score reflects the multiple-choice questions and any short answers that could not be graded counted as unanswered.'
      : '';

  const evidence = [
    {
      type: 'metric',
      key: 'assessment_score',
      label: 'Assessment score',
      value: clamp01(score / 100),
      display: asPercent(score / 100),
      direction: score >= 50 ? 'positive' : 'negative',
      note: `${UNPROCTORED_NOTE} Scored server-side against the answer key generated with the questions: ${evaluation.points_earned} of ${evaluation.points_possible} points.${gradedNote}`,
    },
    {
      type: 'metric',
      key: 'assessment_mcq',
      label: 'Multiple-choice results',
      value: mcqResults.length ? mcqCorrect / mcqResults.length : 0,
      display: `${mcqCorrect} of ${mcqResults.length} correct`,
      direction: null,
      note: 'Deterministic match against the answer key.',
    },
  ];
  if (shortResults.length) {
    evidence.push({
      type: 'metric',
      key: 'assessment_short_answer',
      label: 'Short-answer questions',
      value: null,
      display: `${shortResults.length} question${shortResults.length === 1 ? '' : 's'}, rubric-graded`,
      direction: null,
      note:
        evaluation.short_answer_graded === false
          ? 'Rubric grading was unavailable for this attempt.'
          : 'Each answer was graded against its ideal answer and key points (0, 0.5 or 1).',
    });
  }
  if (outcomes.length) {
    // R-11: per-question outcomes for the recruiter drill-down. Only fields that
    // are also safe for the candidate (who can read their own score row): no
    // correct option, ideal answer, key points or grader feedback.
    evidence.push({
      type: 'question_outcomes',
      key: 'assessment_question_outcomes',
      label: 'Per-question outcomes',
      value: null,
      display: `${fullMarks} of ${outcomes.length} question${outcomes.length === 1 ? '' : 's'} with full marks`,
      direction: null,
      note: 'Right or wrong and points per question, in the order served. Short answers can earn 0, 0.5 or 1.',
      items: outcomes,
      count: outcomes.length,
    });
  }

  return {
    key: SUBSCORE_KEYS.ASSESSMENT,
    label: SUBSCORE_LABELS[SUBSCORE_KEYS.ASSESSMENT],
    available: true,
    value: toPoints(score / 100),
    weight: 0, // set by aggregate()
    reason: null,
    components: {
      score,
      points_earned: Number(evaluation.points_earned) || 0,
      points_possible: Number(evaluation.points_possible) || 0,
      questions_total: results.length,
      mcq_correct: mcqCorrect,
      mcq_total: mcqResults.length,
      short_answer_total: shortResults.length,
      short_answer_graded: evaluation.short_answer_graded ?? null,
      question_outcomes: outcomes,
      proctoring: 'unproctored_online',
      match_reason: `Scored ${Math.round(score)}% across ${results.length} generated question${results.length === 1 ? '' : 's'}.`,
    },
    evidence,
  };
};

// --- Aggregation ------------------------------------------------------------

const round4 = (n) => Math.round(n * 10000) / 10000;

/**
 * The weight each source gets, by the rule of D§7.1 (W2 with option (b)). Sub-score
 * values are already on a common 0-100 scale (CHECKLIST 4.2). With base shares
 * r (résumé), g (GitHub), a (assessment) summing to 1 (defaults 0.20 / 0.35 / 0.45):
 *   - the résumé gets r when it was measured, and never more;
 *   - assessment available: the rest (1 - the résumé's weight) is split between the
 *     independent sources that produced evidence, in proportion to g and a. So both
 *     -> 0.35 / 0.45; GitHub missing -> assessment 0.80 (GitHub is optional, GF-4);
 *     résumé also missing -> the independent sources share all of it;
 *   - assessment not available: GitHub (if available) keeps g and never absorbs the
 *     assessment's share (option (b), the account's ownership is unverified), so the
 *     ceiling is r + g = 55; with no independent source the composite is r x résumé,
 *     at most 20.
 * Whatever no source earned is `unearned`: 1 - the sum of the weights.
 *
 * Returns { weights: { key: 0..1 }, unearned }, rounded to 4 dp.
 */
export const weightPlan = (subScores, baseWeights = BASE_WEIGHTS) => {
  const keys = Object.values(SUBSCORE_KEYS);
  const total = keys.reduce((sum, k) => sum + (Number(baseWeights[k]) || 0), 0);
  const share = (k) => (total > 0 ? (Number(baseWeights[k]) || 0) / total : 0);
  const avail = (k) => subScores?.[k]?.available === true;
  const { PARSING: P, GITHUB: G, ASSESSMENT: A } = SUBSCORE_KEYS;

  const weights = { [P]: 0, [G]: 0, [A]: 0 };
  if (avail(P)) weights[P] = share(P);
  if (avail(A)) {
    const independent = [G, A].filter(avail);
    const independentBase = independent.reduce((sum, k) => sum + share(k), 0);
    for (const k of independent) {
      weights[k] = independentBase > 0 ? (1 - weights[P]) * (share(k) / independentBase) : 0;
    }
  } else if (avail(G)) {
    weights[G] = share(G);
  }

  for (const k of keys) weights[k] = round4(weights[k]);
  const anyAvailable = keys.some(avail);
  const sum = keys.reduce((s, k) => s + weights[k], 0);
  return { weights, unearned: anyAvailable ? round4(Math.max(0, 1 - sum)) : null };
};

/**
 * Applies weightPlan(): sets every sub-score's `weight` (0 for an unavailable one)
 * and returns the composite, the weighted sum of the available values.
 */
export const aggregate = (subScores, baseWeights = BASE_WEIGHTS) => {
  const { weights } = weightPlan(subScores, baseWeights);
  let composite = 0;
  for (const sub of Object.values(subScores)) {
    if (!sub) continue;
    sub.weight = sub.available ? (weights[sub.key] ?? 0) : 0;
    if (sub.available) composite += sub.value * sub.weight;
  }
  return round2(composite);
};

// --- Per-skill evidence (CHECKLIST 5.11, D§7.1 skill table, card R-28) ---------

// D§7.1: three statuses only. The résumé never counts as a confirming source.
export const SKILL_STATUS = Object.freeze({
  CLAIMED_ONLY: 'claimed_only', // the résumé lists it and no independent source confirms it
  EVIDENCED: 'evidenced', //       GitHub or the assessment confirms it
  NOT_FOUND: 'not_found', //       the job asks for it and no source has it
});

// One mark per source on every row.
export const SOURCE_MARK = Object.freeze({
  CONFIRMED: 'confirmed',
  ABSENT: 'absent', //           the source looked and does not have it
  UNAVAILABLE: 'unavailable', // the source produced nothing, or cannot check this skill
});

// R-28: the assessment confirms a skill when the answers on it earned at least
// this share of its points.
export const ASSESSMENT_CONFIRM_SHARE = 0.5;

/**
 * The GitHub mark for the claims that name one skill (several when a multi-word
 * skill matched its parts). Only `evidenced` confirms; `not_found` is a real
 * absence; `not_checkable` (frameworks and tools cannot be read from language
 * statistics) and a skill GitHub was not asked about are `unavailable`.
 */
const githubMark = (claims) => {
  const statuses = claims.map((c) => c?.status);
  if (statuses.length && statuses.every((s) => s === 'evidenced')) return SOURCE_MARK.CONFIRMED;
  if (statuses.includes('not_found')) return SOURCE_MARK.ABSENT;
  return SOURCE_MARK.UNAVAILABLE;
};

/**
 * One row per skill that the job asked for or the résumé claimed (D§7.1 skill
 * table), each with a status and one mark per source:
 *   - resume: `confirmed` when the résumé lists it, `absent` when not;
 *   - github: see githubMark(); `unavailable` for every row when GitHub produced nothing;
 *   - assessment: from the graded attempt's per-question results. `confirmed` when the
 *     candidate's answers on that skill earned at least half of its points, `absent`
 *     when they earned less or no question was asked on it (never guessed),
 *     `unavailable` when no assessment was completed.
 * Names are matched through skillNames.js, the same way for every source.
 */
export const buildSkillEvidence = (subScores) => {
  const parsing = subScores[SUBSCORE_KEYS.PARSING];
  if (!parsing?.available) return [];

  const c = parsing.components || {};
  const resumeIndex = skillIndex([...asArray(c.resume_skills), ...asArray(c.matched_skills)]);

  // Job skills: the parser's job list, plus matched/missing for rows stored without one.
  const jobSkills = [];
  const jobKeys = new Set();
  for (const name of [...asArray(c.jd_skills), ...asArray(c.matched_skills), ...asArray(c.missing_skills)]) {
    const key = skillKey(name);
    if (key && !jobKeys.has(key)) { jobKeys.add(key); jobSkills.push(name); }
  }
  const resumeOnly = [];
  for (const name of asArray(c.resume_skills)) {
    const key = skillKey(name);
    if (key && !jobKeys.has(key)) { jobKeys.add(key); resumeOnly.push(name); }
  }

  const github = subScores[SUBSCORE_KEYS.GITHUB];
  const githubIndex = github?.available
    ? skillIndex(asArray(github.components?.claims), (claim) => claim?.skill)
    : null;

  const assessment = subScores[SUBSCORE_KEYS.ASSESSMENT];
  const assessmentIndex = assessment?.available
    ? skillIndex(asArray(assessment.components?.question_outcomes), (o) => o?.skill)
    : null;

  const row = (name, requiredByJob) => {
    const onResume = resumeIndex.has(name);

    const claims = githubIndex ? githubIndex.lookup(name) : [];
    const github = githubIndex ? githubMark(claims) : SOURCE_MARK.UNAVAILABLE;

    let assessmentMark = SOURCE_MARK.UNAVAILABLE;
    let assessmentPoints = null;
    if (assessmentIndex) {
      const outcomes = assessmentIndex.lookup(name);
      const earned = round2(outcomes.reduce((sum, o) => sum + (Number(o.points) || 0), 0));
      const possible = round2(outcomes.reduce((sum, o) => sum + (Number(o.max_points) || 0), 0));
      assessmentPoints = { earned, possible, questions: outcomes.length };
      assessmentMark = possible > 0 && earned >= ASSESSMENT_CONFIRM_SHARE * possible - 1e-9
        ? SOURCE_MARK.CONFIRMED
        : SOURCE_MARK.ABSENT;
    }

    const marks = {
      resume: onResume ? SOURCE_MARK.CONFIRMED : SOURCE_MARK.ABSENT,
      github,
      assessment: assessmentMark,
    };
    const independent = marks.github === SOURCE_MARK.CONFIRMED || marks.assessment === SOURCE_MARK.CONFIRMED;
    const status = independent
      ? SKILL_STATUS.EVIDENCED
      : onResume ? SKILL_STATUS.CLAIMED_ONLY : SKILL_STATUS.NOT_FOUND;

    return {
      name,
      status,
      required_by_job: requiredByJob,
      claimed_on_resume: onResume,
      marks,
      // Audit detail behind the marks: GitHub's own claim statuses and the points.
      github_claims: claims.map((claim) => ({ skill: claim?.skill ?? null, status: claim?.status ?? null })),
      assessment_points: assessmentPoints,
    };
  };

  return [
    ...jobSkills.map((name) => row(name, true)),
    ...resumeOnly.map((name) => row(name, false)),
  ];
};

// --- Flags (CHECKLIST 4.6 / 5.9, D§7.1 W6 / W7) -----------------------------

// W7 (lead's proposal, a configurable default until Anthony confirms it).
const DEFAULT_FLAG_DISAGREE_MIN_POINTS = 2;
const DEFAULT_FLAG_DISAGREE_MAX_SHARE = 0.25;

/** The W7 thresholds, from FLAG_DISAGREE_MIN_POINTS / FLAG_DISAGREE_MAX_SHARE when they are valid numbers. */
export const readFlagSettings = (env = process.env) => {
  const num = (raw, fallback, ok) => {
    if (raw === undefined || raw === null || String(raw).trim() === '') return fallback;
    const n = Number(raw);
    return Number.isFinite(n) && ok(n) ? n : fallback;
  };
  return {
    minPoints: num(env.FLAG_DISAGREE_MIN_POINTS, DEFAULT_FLAG_DISAGREE_MIN_POINTS, (n) => n > 0),
    maxShare: num(env.FLAG_DISAGREE_MAX_SHARE, DEFAULT_FLAG_DISAGREE_MAX_SHARE, (n) => n >= 0 && n <= 1),
  };
};

const OTHER_FLAGS_NOT_BUILT =
  'Other checks that compare résumé claims against GitHub or assessment evidence are not built yet, so no other inconsistency flags are shown. This is not a finding that the claims are consistent.';

const listNames = (names) => (names.length <= 1
  ? names.join('')
  : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`);

/**
 * Inconsistency flags. One kind is built (W6, rule W7): "sources disagree", over the
 * skills GitHub confirms that the assessment asked about. When their questions carry
 * at least `minPoints` points and the candidate earned `maxShare` or less of them, one
 * flag names the skills and the points. It is not raised when GitHub or the assessment
 * is unavailable, and it never changes the score. Every other flag kind is not built,
 * so `flags_available` stays false and the reason says so: an empty list is never an
 * all-clear.
 */
export const buildFlags = (subScores, skillRows = buildSkillEvidence(subScores), settings = readFlagSettings()) => {
  const githubOk = subScores[SUBSCORE_KEYS.GITHUB]?.available === true;
  const assessmentOk = subScores[SUBSCORE_KEYS.ASSESSMENT]?.available === true;

  if (!githubOk && !assessmentOk) {
    return {
      flags: [],
      flags_available: false,
      flag_checks: { sources_disagree: 'not_run' },
      flags_unavailable_reason:
        'Inconsistency detection compares résumé claims against independent evidence. No corroborating source (GitHub activity or assessment results) is available for this candidate, so no claim can be contradicted.',
    };
  }
  if (!githubOk || !assessmentOk) {
    return {
      flags: [],
      flags_available: false,
      flag_checks: { sources_disagree: 'not_run' },
      flags_unavailable_reason:
        `The "sources disagree" check needs both GitHub evidence and a completed assessment; ${githubOk ? 'no assessment has been completed' : 'GitHub evidence is not available'}, so it was not run. ${OTHER_FLAGS_NOT_BUILT}`,
    };
  }

  // Skills GitHub confirms and the assessment asked about. A question counted under
  // two rows (a multi-word skill and one of its words) counts once.
  const skills = [];
  const seen = new Set();
  let earned = 0;
  let possible = 0;
  const outcomes = asArray(subScores[SUBSCORE_KEYS.ASSESSMENT].components?.question_outcomes);
  const outcomesIndex = skillIndex(outcomes, (o) => o?.skill);
  for (const r of asArray(skillRows)) {
    if (r?.marks?.github !== SOURCE_MARK.CONFIRMED || !(r.assessment_points?.questions > 0)) continue;
    skills.push(r.name);
    for (const o of outcomesIndex.lookup(r.name)) {
      if (seen.has(o)) continue;
      seen.add(o);
      earned += Number(o.points) || 0;
      possible += Number(o.max_points) || 0;
    }
  }
  earned = round2(earned);
  possible = round2(possible);

  const flags = [];
  if (skills.length && possible >= settings.minPoints && earned <= settings.maxShare * possible + 1e-9) {
    flags.push({
      kind: 'sources_disagree',
      skills,
      points_earned: earned,
      points_possible: possible,
      thresholds: { min_points: settings.minPoints, max_share: settings.maxShare },
      message: `Sources disagree: GitHub shows work in ${listNames(skills)}; the assessment on ${skills.length === 1 ? 'that skill' : 'those skills'} earned ${earned} of ${possible} points.`,
      affects_score: false,
    });
  }

  return {
    flags,
    flags_available: false,
    flag_checks: { sources_disagree: flags.length ? 'raised' : 'not_raised' },
    flags_unavailable_reason: OTHER_FLAGS_NOT_BUILT,
  };
};

// --- Explanation record -----------------------------------------------------

const factorDirection = (sub, composite, availableCount) => {
  if (!sub.available) return 'unavailable';
  if (availableCount === 1) return 'sole';
  if (sub.value > composite + 0.5) return 'raises';
  if (sub.value < composite - 0.5) return 'lowers';
  return 'neutral';
};

const pct = (w) => `${Math.round((Number(w) || 0) * 100)}%`;

/**
 * D§7.1 W3: which independent sources verified the score and what would verify it
 * further, in one or two sentences. Null when nothing is available.
 */
export const verificationNote = (subScores, unearned) => {
  const verification = scoreVerification(subScores);
  if (!verification) return null;
  const github = subScores[SUBSCORE_KEYS.GITHUB]?.available === true;
  const assessment = subScores[SUBSCORE_KEYS.ASSESSMENT]?.available === true;
  if (verification === VERIFICATION.VERIFIED) {
    return 'Verified by two independent sources: GitHub activity and the assessment.';
  }
  if (verification === VERIFICATION.UNVERIFIED) {
    return `Unverified: résumé claims only. Nothing has been verified yet. Completing the assessment would verify the score; ${pct(unearned)} of it is not earned until an independent source (the assessment, or GitHub activity) answers.`;
  }
  if (assessment && !github) {
    return 'Partly verified by the assessment. GitHub evidence would verify it further; GitHub is optional, so without it the assessment carries the independent share and nothing is lost.';
  }
  return `Partly verified by GitHub activity. Completing the assessment would verify it further; ${pct(unearned)} of the score is not earned until then, because GitHub never takes the assessment's share while account ownership is unverified.`;
};

const buildSummary = (subScores, composite, unearned) => {
  const available = Object.values(subScores).filter((s) => s?.available);
  const unavailable = Object.values(subScores).filter((s) => s && !s.available);
  if (!available.length) {
    return 'No evidence was available for this candidate, so no credibility score could be derived.';
  }

  const parts = [`Credibility ${composite}/100.`];

  for (const sub of available) {
    const detail = sub.components?.match_reason;
    parts.push(
      `${sub.label} contributes ${pct(sub.weight)} of the score at ${sub.value}/100${detail ? ` — ${detail.replace(/\.$/, '')}` : ''}.`
    );
  }

  if (unavailable.length) {
    parts.push(
      `${unavailable.map((s) => s.label).join(' and ')} ${unavailable.length > 1 ? 'were' : 'was'} not available and ${unavailable.length > 1 ? 'were' : 'was'} not scored as zero.`
    );
  }
  if (unearned > 0) {
    parts.push(`${pct(unearned)} of the score was not earned by any source.`);
  }
  const note = verificationNote(subScores, unearned);
  if (note) parts.push(note);

  return parts.join(' ');
};

export const buildExplanation = (subScores, composite, unearned = 0) => {
  const availableCount = Object.values(subScores).filter((s) => s?.available).length;

  const factors = Object.values(SUBSCORE_KEYS).map((key) => {
    const sub = subScores[key];
    return {
      key,
      label: sub.label,
      available: sub.available,
      direction: factorDirection(sub, composite, availableCount),
      weight: sub.weight,
      weight_pct: Math.round(sub.weight * 100),
      value: sub.value,
      // Points of the 0-100 composite this factor is responsible for.
      contribution: sub.available ? round2(sub.value * sub.weight) : 0,
      reason: sub.reason,
      evidence: sub.evidence,
    };
  });

  const verification = scoreVerification(subScores);
  const skillEvidence = buildSkillEvidence(subScores);
  return {
    version: 1,
    generated_at: new Date().toISOString(),
    composite,
    band: scoreBand(composite),
    band_thresholds: { ...SCORE_BAND_THRESHOLDS, note: SCORE_BAND_NOTE },
    // D§7.1 W3, W5. New keys inside the stored JSON; no schema change.
    weights_version: WEIGHTS_VERSION,
    verification,
    verification_note: verificationNote(subScores, unearned),
    unearned_weight: composite === null ? null : unearned,
    summary: buildSummary(subScores, composite, unearned),
    // D§5/D§7: always stated, whether or not GitHub evidence was used.
    github_account: {
      source: 'resume_link',
      ownership_verified: false,
      note: GITHUB_OWNERSHIP_NOTE,
    },
    factors,
    unavailable_evidence: factors
      .filter((f) => !f.available)
      .map((f) => ({ key: f.key, label: f.label, reason: f.reason })),
    evidence_limited: availableCount < Object.keys(SUBSCORE_KEYS).length,
    weighting_scheme: {
      version: WEIGHTS_VERSION,
      base_weights: BASE_WEIGHTS,
      base_weights_source: BASE_WEIGHTS_SOURCE,
      redistribution:
        "The résumé's weight is fixed and never grows. Once the assessment is completed, the rest is shared between the independent sources that produced evidence (GitHub and the assessment), so a missing GitHub account costs nothing. Before the assessment, GitHub keeps only its own share and the assessment's share is not earned. Unavailable sources are never scored as zero.",
    },
    skill_evidence: skillEvidence,
    ...buildFlags(subScores, skillEvidence),
  };
};

// --- Entry point ------------------------------------------------------------

/**
 * Build everything a `scores` row persists, from one NLP parse result, the
 * github-evidence result (`fetchGithubEvidence()`) and the latest completed
 * assessment's evaluation (CHECKLIST 3.7). Without `github` the GitHub
 * sub-score is unavailable with `service_disabled`; without
 * `assessmentEvaluation` the assessment sub-score is unavailable. With
 * `parsingUnavailable` (a resume-pipeline reason code, R-11) parsing is
 * unavailable with that reason whatever `nlpJson` holds.
 */
export const buildScoreRecord = (nlpJson, { github, assessmentEvaluation, parsingUnavailable = null } = {}) => {
  const subscores = {
    [SUBSCORE_KEYS.PARSING]: parsingUnavailable
      ? parsingUnavailableSubScore(parsingUnavailable)
      : buildParsingSubScore(nlpJson?.semantic_analysis),
    [SUBSCORE_KEYS.GITHUB]:
      github === undefined ? githubUnavailable('service_disabled') : buildGithubSubScore(github),
    [SUBSCORE_KEYS.ASSESSMENT]: buildAssessmentSubScore(assessmentEvaluation),
  };
  return finishRecord(subscores);
};

/**
 * Weights, composite, band and explanation for a set of sub-scores. With no
 * available source the composite and band are null (R-10): "nothing measured"
 * is never a 0, and callers must not store such a record as a score.
 */
const finishRecord = (subscores) => {
  const anyAvailable = Object.values(subscores).some((s) => s?.available);
  const weighted = aggregate(subscores); // also sets every sub-score's weight
  const composite = anyAvailable ? weighted : null;
  const { unearned } = weightPlan(subscores);
  const explanation = buildExplanation(subscores, composite, unearned ?? 0);

  const weights = Object.fromEntries(
    Object.values(SUBSCORE_KEYS).map((key) => [key, subscores[key].weight])
  );

  return {
    composite,
    band: scoreBand(composite),
    verification: explanation.verification,
    unearned_weight: explanation.unearned_weight,
    weights_version: WEIGHTS_VERSION,
    subscores,
    weights,
    explanation,
    evidence_limited: explanation.evidence_limited,
  };
};

// R-11: rebuildScoreRecord (which recomputed a stored row so the assessment
// controller could UPDATE it in place) is gone. A graded attempt now inserts a
// new row through the scoring pipeline (scoringPipeline.js); rows are never
// updated in place (D§3).
