// Explainability layer for the unified credibility score.
//
// Spec: FR-13, GF-5, CHECKLIST 4.3 / 4.4 / 4.5 / 4.7 / 4.11 / 5.7 / 5.8 / 5.11.
//
// This module owns three things and nothing else:
//   1. Turning each evidence source into a normalised 0-100 **sub-score**.
//   2. Aggregating available sub-scores into the composite, redistributing the
//      weight of sources that produced no evidence (4.7 / GF-4) instead of
//      scoring them as zero.
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
// drop it into `buildScoreRecord`. Nothing else changes — `aggregate()` picks
// up the new `available: true` entry, redistributes weight away from whatever
// is still missing, and `buildExplanation()` renders it. The composite, the
// weights and the factor list all follow automatically.
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
//   * candidate `Assessment.jsx` (not routed yet) — once `/api/assessment/*`
//     exists it should post results that a `buildAssessmentSubScore()` turns
//     into the `assessment_results` entry above.

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
  github_rate_limited:
    "GitHub's request limit was reached, so repository activity was not checked for this score.",
  service_unavailable:
    'The GitHub evidence service was not reachable, so repository activity was not checked.',
  timeout: 'The GitHub evidence check took too long and was skipped for this score.',
  service_error: 'The GitHub evidence check failed, so repository activity was not checked.',
  service_disabled:
    'No GitHub evidence was collected for this candidate. The GitHub Aggregator service is not part of this deployment yet, so repository activity has not been checked.',
};

// Why a source has no evidence. Surfaced to the recruiter verbatim so an empty
// panel always says why it is empty (GF-4, CHECKLIST 5.10).
const UNAVAILABLE_REASONS = {
  [SUBSCORE_KEYS.GITHUB]: GITHUB_REASONS.service_disabled,
  [SUBSCORE_KEYS.ASSESSMENT]:
    'No assessment has been completed by this candidate. The generated technical assessment is not part of this deployment yet.',
};

// Intended weighting once all three evidence sources exist. Stated here rather
// than buried in a formula (CHECKLIST 4.3), and overridable per deployment via
// CREDIBILITY_WEIGHTS, e.g.
//   CREDIBILITY_WEIGHTS={"parsing_semantic_alignment":0.3,"github_evidence":0.4,"assessment_results":0.3}
// Only sources that actually produced evidence keep their weight; the rest is
// redistributed proportionally (4.7).
const DEFAULT_BASE_WEIGHTS = {
  [SUBSCORE_KEYS.PARSING]: 0.4,
  [SUBSCORE_KEYS.GITHUB]: 0.35,
  [SUBSCORE_KEYS.ASSESSMENT]: 0.25,
};

const readBaseWeights = () => {
  const raw = process.env.CREDIBILITY_WEIGHTS;
  if (!raw) return { ...DEFAULT_BASE_WEIGHTS };
  try {
    const parsed = JSON.parse(raw);
    const merged = { ...DEFAULT_BASE_WEIGHTS };
    for (const key of Object.values(SUBSCORE_KEYS)) {
      const value = Number(parsed[key]);
      if (Number.isFinite(value) && value >= 0) merged[key] = value;
    }
    const total = Object.values(merged).reduce((sum, n) => sum + n, 0);
    if (total <= 0) return { ...DEFAULT_BASE_WEIGHTS };
    return merged;
  } catch {
    console.warn('CREDIBILITY_WEIGHTS is not valid JSON; using default weights.');
    return { ...DEFAULT_BASE_WEIGHTS };
  }
};

export const BASE_WEIGHTS = readBaseWeights();

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
  const sa = semanticAnalysis || {};
  const similarity = clamp01(sa.similarity_score ?? 0);
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
    GITHUB_PRIVATE_WORK_NOTE +
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

// --- Aggregation ------------------------------------------------------------

/**
 * Normalise-then-weight (CHECKLIST 4.2 / 4.3). Sub-score values are already on
 * a common 0-100 scale; weight is taken only from the sources that produced
 * evidence and renormalised to sum to 1, so a missing source costs the
 * candidate nothing rather than scoring zero (4.7 / GF-4).
 *
 * Mutates each available sub-score's `weight` and returns the composite.
 */
export const aggregate = (subScores, baseWeights = BASE_WEIGHTS) => {
  const available = Object.values(subScores).filter((s) => s?.available);
  const totalBase = available.reduce((sum, s) => sum + (baseWeights[s.key] || 0), 0);

  for (const sub of Object.values(subScores)) {
    if (!sub) continue;
    // 4dp: enough to display, fine enough that the weights still sum to 1.
    sub.weight = sub.available && totalBase > 0
      ? Math.round(((baseWeights[sub.key] || 0) / totalBase) * 10000) / 10000
      : 0;
  }

  const composite = available.reduce((sum, s) => sum + s.value * s.weight, 0);
  return round2(composite);
};

// --- Per-skill evidence (CHECKLIST 5.11) ------------------------------------

/**
 * One row per skill that either the job asked for or the résumé claimed, with
 * how many of the *available* evidence sources confirm it. No invented
 * per-skill percentages: parsing says matched / missing / claimed only, and
 * GitHub (when available) says evidenced / not_found / not_checkable from the
 * service's claim cross-reference. Only `evidenced` confirms a skill.
 */
export const buildSkillEvidence = (subScores) => {
  const parsing = subScores[SUBSCORE_KEYS.PARSING];
  if (!parsing?.available) return [];

  const { jd_skills: jdSkills, matched_skills: matched, missing_skills: missing, resume_skills: resumeSkills } =
    parsing.components;

  const sourcesAvailable = Object.values(subScores).filter((s) => s?.available).length;
  const matchedSet = new Set(matched.map((s) => s.toLowerCase()));
  const jdSet = new Set(jdSkills.map((s) => s.toLowerCase()));

  const github = subScores[SUBSCORE_KEYS.GITHUB];
  const githubClaims = github?.available
    ? new Map(asArray(github.components?.claims).map((c) => [String(c?.skill).toLowerCase(), c?.status ?? null]))
    : null;

  const row = (name, status, parsingConfirms) => {
    // null = not checked: GitHub is unavailable, or this skill was not claimed.
    const githubStatus = githubClaims?.get(name.toLowerCase()) ?? null;
    return {
      name,
      status, // 'matched' | 'missing' | 'claimed_only'
      required_by_job: jdSet.has(name.toLowerCase()),
      claimed_on_resume: status !== 'missing',
      sources: {
        parsing: status,
        github: githubStatus, // 'evidenced' | 'not_found' | 'not_checkable' | null
        assessment: null,
      },
      evidence_sources_confirming: parsingConfirms + (githubStatus === 'evidenced' ? 1 : 0),
      evidence_sources_available: sourcesAvailable,
    };
  };

  const rows = [
    ...matched.map((name) => row(name, 'matched', 1)),
    ...missing.map((name) => row(name, 'missing', 0)),
    ...resumeSkills
      .filter((name) => !jdSet.has(name.toLowerCase()) && !matchedSet.has(name.toLowerCase()))
      .map((name) => row(name, 'claimed_only', 0)),
  ];

  return rows;
};

// --- Flags (CHECKLIST 4.6 / 5.9) --------------------------------------------

/**
 * Contradictions between claimed and evidenced skill. Every flag the spec names
 * ("claimed language absent from all repos", "claimed seniority contradicted by
 * assessment") needs an evidence source that does not exist yet, so this
 * returns an explicit unavailable state rather than a guess. A résumé skill the
 * job did not ask for is not an inconsistency, and must not be reported as one.
 */
export const buildFlags = (subScores) => {
  const corroborating = [SUBSCORE_KEYS.GITHUB, SUBSCORE_KEYS.ASSESSMENT]
    .filter((key) => subScores[key]?.available);

  if (!corroborating.length) {
    return {
      flags: [],
      flags_available: false,
      flags_unavailable_reason:
        'Inconsistency detection compares résumé claims against independent evidence. No corroborating source (GitHub activity or assessment results) is available for this candidate, so no claim can be contradicted.',
    };
  }

  // A corroborating source exists, but no comparison rule does yet (CHECKLIST
  // 4.6; GitHub rules come with ROADMAP P1-9). Saying "available" with an empty
  // list would read as an all-clear that nothing checked, so stay unavailable.
  return {
    flags: [],
    flags_available: false,
    flags_unavailable_reason:
      'Checks that compare résumé claims against GitHub or assessment evidence are not built yet, so no inconsistency flags are shown. This is not a finding that the claims are consistent.',
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

const buildSummary = (subScores, composite) => {
  const available = Object.values(subScores).filter((s) => s?.available);
  const unavailable = Object.values(subScores).filter((s) => s && !s.available);
  if (!available.length) {
    return 'No evidence was available for this candidate, so no credibility score could be derived.';
  }

  const parts = [`Credibility ${composite}/100.`];

  for (const sub of available) {
    const detail = sub.components?.match_reason;
    parts.push(
      `${sub.label} contributes ${Math.round(sub.weight * 100)}% of the score at ${sub.value}/100${detail ? ` — ${detail.replace(/\.$/, '')}` : ''}.`
    );
  }

  if (unavailable.length) {
    parts.push(
      `${unavailable.map((s) => s.label).join(' and ')} ${unavailable.length > 1 ? 'were' : 'was'} not available, so ${unavailable.length > 1 ? 'their' : 'its'} weight was redistributed across the remaining evidence rather than scored as zero.`
    );
  }

  return parts.join(' ');
};

export const buildExplanation = (subScores, composite) => {
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

  return {
    version: 1,
    generated_at: new Date().toISOString(),
    composite,
    summary: buildSummary(subScores, composite),
    factors,
    unavailable_evidence: factors
      .filter((f) => !f.available)
      .map((f) => ({ key: f.key, label: f.label, reason: f.reason })),
    evidence_limited: availableCount < Object.keys(SUBSCORE_KEYS).length,
    weighting_scheme: {
      base_weights: BASE_WEIGHTS,
      redistribution:
        'Base weights are renormalised across the evidence sources that produced data; unavailable sources are excluded, never scored as zero.',
    },
    skill_evidence: buildSkillEvidence(subScores),
    ...buildFlags(subScores),
  };
};

// --- Entry point ------------------------------------------------------------

/**
 * Build everything a `scores` row persists, from one NLP parse result and the
 * github-evidence result (`fetchGithubEvidence()`); without `github` the GitHub
 * sub-score is unavailable with `service_disabled`. Assessment enters here once
 * its builder exists.
 */
export const buildScoreRecord = (nlpJson, { github } = {}) => {
  const subscores = {
    [SUBSCORE_KEYS.PARSING]: buildParsingSubScore(nlpJson?.semantic_analysis),
    [SUBSCORE_KEYS.GITHUB]:
      github === undefined ? githubUnavailable('service_disabled') : buildGithubSubScore(github),
    [SUBSCORE_KEYS.ASSESSMENT]: unavailableSubScore(SUBSCORE_KEYS.ASSESSMENT),
  };

  const composite = aggregate(subscores);
  const explanation = buildExplanation(subscores, composite);

  const weights = Object.fromEntries(
    Object.values(SUBSCORE_KEYS).map((key) => [key, subscores[key].weight])
  );

  return {
    composite,
    subscores,
    weights,
    explanation,
    evidence_limited: explanation.evidence_limited,
  };
};
