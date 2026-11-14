import React from 'react';
import { motion } from 'framer-motion';
import {
  ArrowDownRight, ArrowUpRight, CheckCircle2, Circle, Info, Minus, ShieldAlert, XCircle,
} from 'lucide-react';
import Badge from '../Badge';
import { VerificationBadge, weightsVersionLabel } from '../ScoreBadge';
import { subscoreTestId } from './applicationsLogic';

/**
 * ScoreBreakdown — the composite -> sub-score -> evidence drill-down
 * (FR-13, GF-5, CHECKLIST 4.5 / 5.7 / 5.8 / 5.9 / 5.10 / 5.11).
 *
 * Everything here is read straight from the `explanation` record the backend
 * persisted with the score (backend/Services/explainability.js buildExplanation),
 * so what a reader sees is what was stored at scoring time. Nothing is
 * re-derived in the browser, and a source with no evidence renders its stored
 * reason instead of a zero.
 *
 * Two callers:
 *   recruiter drill-down  <ScoreBreakdown explanation={detail.explanation}
 *                                         evidenceLimited={detail.score.evidence_limited} showFlags={false} />
 *   candidate Results     <ScoreBreakdown analysis={score} />  (the serializeCandidate shape)
 */

const DIRECTION_STYLES = {
  raises: { icon: ArrowUpRight, className: 'text-success', label: 'Raises the score' },
  lowers: { icon: ArrowDownRight, className: 'text-destructive', label: 'Lowers the score' },
  neutral: { icon: Minus, className: 'text-muted-foreground', label: 'In line with the score' },
  sole: { icon: Circle, className: 'text-primary', label: 'Sole contributor' },
  unavailable: { icon: Minus, className: 'text-muted-foreground', label: 'No evidence' },
};

// R-28 (REBUILD/DECISIONS.md §7.1 skill table): three statuses only. The résumé never
// counts as a confirming source.
const SKILL_STATUS = {
  evidenced: {
    variant: 'success',
    label: 'Evidenced',
    hint: 'GitHub or the assessment confirms it.',
  },
  claimed_only: {
    variant: 'warning',
    label: 'Claimed only',
    hint: 'The résumé lists it and no independent source (GitHub or the assessment) confirms it.',
  },
  not_found: {
    variant: 'destructive',
    label: 'Not found',
    hint: 'The job asks for it and no source has it.',
  },
};

/** A known status's badge; an unknown or missing one is shown as unknown with its raw value, never as a real category. */
export const skillStatusView = (status) => {
  if (Object.prototype.hasOwnProperty.call(SKILL_STATUS, status)) return SKILL_STATUS[status];
  const raw = typeof status === 'string' && status.trim() ? status.trim().replace(/_/g, ' ') : '';
  return {
    variant: 'outline',
    label: raw ? `Unknown status: ${raw}` : 'Unknown status',
    hint: 'The server sent a skill status this page does not know.',
  };
};

const LEGACY_GITHUB_MARK = { evidenced: 'confirmed', not_found: 'absent' };

/**
 * A skill row in the R-28 shape (`status` + one mark per source). A row stored
 * before R-28 (`status` matched / missing / claimed_only, `sources`) is read in the
 * same terms: GitHub `evidenced` is the only confirmation it recorded, so a résumé
 * match is "Claimed only", never "Evidenced". Its assessment mark was not recorded.
 */
export const skillRowView = (row) => {
  if (row && row.marks && typeof row.marks === 'object') return { ...row, legacy: false };
  const status = row?.status;
  const github = row?.sources?.github;
  const legacyKnown = ['matched', 'missing', 'claimed_only'].includes(status);
  let viewStatus = status;
  if (legacyKnown) {
    if (github === 'evidenced') viewStatus = 'evidenced';
    else viewStatus = status === 'missing' ? 'not_found' : 'claimed_only';
  }
  let resume = null;
  if (legacyKnown) resume = status === 'missing' ? 'absent' : 'confirmed';
  return {
    ...row,
    legacy: true,
    status: viewStatus,
    marks: { resume, github: LEGACY_GITHUB_MARK[github] || 'unavailable', assessment: null },
  };
};

const MARKS = {
  confirmed: { icon: CheckCircle2, className: 'text-success', label: 'Confirmed' },
  absent: { icon: XCircle, className: 'text-destructive', label: 'Absent' },
  unavailable: { icon: Minus, className: 'text-muted-foreground', label: 'Unavailable' },
};

/** One source's mark on one skill row; a missing one is "Not recorded", an unknown one is shown as sent. */
export const markView = (mark) => {
  if (mark === null || mark === undefined) {
    return { icon: Minus, className: 'text-muted-foreground', label: 'Not recorded' };
  }
  if (Object.prototype.hasOwnProperty.call(MARKS, mark)) return MARKS[mark];
  return { icon: Info, className: 'text-muted-foreground', label: `Unknown: ${String(mark)}` };
};

const markTitle = (source, row) => {
  if (source === 'github' && Array.isArray(row.github_claims) && row.github_claims.length) {
    return `GitHub: ${row.github_claims.map((c) => `${c.skill} ${String(c.status || 'unknown').replace(/_/g, ' ')}`).join(', ')}`;
  }
  if (source === 'github' && row.marks?.github === 'unavailable') {
    return 'GitHub evidence was not available, cannot check this kind of skill, or was not asked about it.';
  }
  if (source === 'assessment' && row.assessment_points) {
    const p = row.assessment_points;
    return p.questions
      ? `${p.earned} of ${p.possible} points on ${p.questions} question${p.questions === 1 ? '' : 's'}; confirmed at half the points or more.`
      : 'The assessment asked no question on this skill.';
  }
  if (row.legacy && source === 'assessment') return 'This score was stored before the assessment was recorded per skill.';
  return undefined;
};

function SkillMark({ source, row }) {
  const view = markView(row.marks?.[source]);
  const Icon = view.icon;
  const points = source === 'assessment' && row.assessment_points?.questions
    ? ` · ${row.assessment_points.earned} of ${row.assessment_points.possible} pts`
    : '';
  return (
    <td
      className="py-2 pr-3 text-caption whitespace-nowrap"
      data-testid={`skill-mark-${source}`}
      data-mark={row.marks?.[source] ?? ''}
      title={markTitle(source, row)}
    >
      <span className={`inline-flex items-center gap-1 ${view.className}`}>
        <Icon className="w-3.5 h-3.5" aria-hidden="true" />
        {view.label}{points}
      </span>
    </td>
  );
}

/** Explicit "we have no evidence here" panel — never a zero, never a blank. */
function EvidenceUnavailable({ title, reason }) {
  return (
    <div className="p-4 rounded-lg border border-dashed border-border bg-muted/40">
      <div className="flex items-center gap-2 mb-1">
        <Info className="w-4 h-4 text-muted-foreground" aria-hidden="true" />
        <span className="text-body-sm font-medium text-muted-foreground">{title}</span>
      </div>
      {reason && <p className="text-caption text-muted-foreground leading-relaxed">{reason}</p>}
    </div>
  );
}

/**
 * The honest flags panel. One flag kind is built (R-28, D§7.1 W6/W7: "sources
 * disagree"); every other kind is not (stretch S-2), so the panel never reads as an
 * all-clear. `flags` and `checks` are the explanation's stored `flags` and
 * `flag_checks`; `storedReason` is its `flags_unavailable_reason`.
 */
// R-38: the stored reason ends with this sentence when the sources-disagree check ran or
// was skipped (explainability.js OTHER_FLAGS_NOT_BUILT); the panel states it on its own
// line, so it is not repeated under the check.
const OTHER_KINDS_SENTENCE_RE = /\s*Other checks that compare résumé claims[\s\S]*$/;
const OTHER_KINDS_TEXT = 'Other flag kinds (claims contradicted by GitHub or by the assessment in other ways) are not built yet, so none is shown. This is not a finding that the claims are consistent.';

/**
 * R-38: the one built check's state, as stored in `flag_checks.sources_disagree`.
 * 'raised' | 'not_raised' | 'not_run' | 'not_recorded' (a score stored before the
 * check existed) | 'unknown' (a value this page does not know, shown as sent).
 */
export const sourcesDisagreeView = (checks, raisedCount, storedReason) => {
  const state = checks?.sources_disagree;
  const why = typeof storedReason === 'string' ? storedReason.replace(OTHER_KINDS_SENTENCE_RE, '').trim() : '';
  if (state === 'raised' || (state === undefined && raisedCount > 0)) {
    return { state: 'raised', label: 'Raised', text: 'GitHub and the assessment disagree; the flag below names the skills and the points. A flag does not change the score.' };
  }
  if (state === 'not_raised') {
    return { state: 'not_raised', label: 'Not raised', text: 'It ran: GitHub and the assessment do not disagree on the skills both cover.' };
  }
  if (state === 'not_run') {
    return { state: 'not_run', label: 'Not run', text: why || 'It needs both GitHub evidence and a completed assessment.' };
  }
  if (state === undefined || state === null) {
    return { state: 'not_recorded', label: 'Not recorded', text: 'This score was stored before the check existed.' };
  }
  return { state: 'unknown', label: `Unknown: ${String(state)}`, text: 'The server sent a check state this page does not know.' };
};

function FlagsPanel({ storedReason, flags, checks }) {
  const raised = Array.isArray(flags) ? flags.filter((f) => f && typeof f.message === 'string') : [];
  const check = sourcesDisagreeView(checks, raised.length, storedReason);
  return (
    <section data-testid="flags-panel">
      <h3 className="text-body font-medium text-foreground mb-3">Inconsistency flags</h3>
      <div
        className="mb-3 p-3 rounded-lg border border-border bg-background"
        data-testid="flag-check-sources-disagree"
        data-state={check.state}
      >
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-body-sm font-medium text-foreground">Sources-disagree check</span>
          <Badge variant={check.state === 'raised' ? 'warning' : 'outline'}>{check.label}</Badge>
        </div>
        <p className="text-caption text-muted-foreground mt-1 leading-relaxed">{check.text}</p>
      </div>
      {raised.length > 0 && (
        <ul className="space-y-2 mb-3">
          {raised.map((flag, i) => (
            <li
              key={`${flag.kind}-${i}`}
              className="flex items-start gap-2 p-3 rounded-lg border border-warning/30 bg-warning/10"
              data-testid={`flag-${String(flag.kind || 'unknown').replace(/_/g, '-')}`}
            >
              <ShieldAlert className="w-4 h-4 text-warning mt-0.5 shrink-0" aria-hidden="true" />
              <span className="text-body-sm text-foreground">
                {flag.message}
                {flag.affects_score === false && (
                  <span className="text-caption text-muted-foreground"> This flag does not change the score.</span>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
      <div data-testid="flag-kinds-not-built">
        <EvidenceUnavailable title="Other flag kinds: not built yet" reason={OTHER_KINDS_TEXT} />
      </div>
    </section>
  );
}

function MetricEvidence({ item }) {
  const hasValue = item.value !== null && item.value !== undefined && Number.isFinite(Number(item.value));
  const pct = hasValue ? Math.max(0, Math.min(100, Number(item.value) * 100)) : 0;
  return (
    <div className="py-2">
      <div className="flex items-baseline justify-between gap-3 mb-1.5">
        <span className="text-body-sm text-foreground">{item.label}</span>
        <span className="text-body-sm font-semibold text-foreground tabular-nums">
          {item.display}
        </span>
      </div>
      {hasValue && (
        <div className="h-1.5 rounded-full bg-border overflow-hidden">
          <motion.div
            className={`h-full rounded-full ${
              item.direction === 'negative' ? 'bg-destructive' : 'bg-primary'
            }`}
            initial={{ width: 0 }}
            animate={{ width: `${pct}%` }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
          />
        </div>
      )}
      <p className="text-caption text-muted-foreground mt-1.5 leading-relaxed">
        {item.note}
        {item.weight_within_factor != null && item.weight_within_factor > 0 && (
          <span className="text-foreground">
            {' '}Weight within this factor: {item.weight_within_factor}.
          </span>
        )}
      </p>
    </div>
  );
}

function SkillSetEvidence({ item }) {
  const positive = item.direction === 'positive';
  const list = Array.isArray(item.items) ? item.items : [];
  return (
    <div className="py-2">
      <div className="flex items-center gap-2 mb-2">
        {positive ? (
          <CheckCircle2 className="w-4 h-4 text-success" aria-hidden="true" />
        ) : (
          <XCircle className="w-4 h-4 text-destructive" aria-hidden="true" />
        )}
        <span className="text-body-sm text-foreground">{item.label}</span>
        <span className="text-caption text-muted-foreground">({item.count})</span>
      </div>
      {list.length ? (
        <div className="flex flex-wrap gap-1.5">
          {list.map((skill) => (
            <Badge key={skill} variant={positive ? 'success' : 'destructive'}>
              {skill}
            </Badge>
          ))}
        </div>
      ) : (
        <p className="text-caption text-muted-foreground">None.</p>
      )}
    </div>
  );
}

/** Per-question outcomes stored with the score (candidate-safe fields only). */
function QuestionOutcomes({ item }) {
  const list = Array.isArray(item.items) ? item.items : [];
  return (
    <div className="py-2">
      <div className="flex items-baseline justify-between gap-3 mb-1.5">
        <span className="text-body-sm text-foreground">{item.label}</span>
        <span className="text-body-sm font-semibold text-foreground tabular-nums">{item.display}</span>
      </div>
      {item.note && <p className="text-caption text-muted-foreground mb-2">{item.note}</p>}
      <ol className="space-y-1">
        {list.map((q, i) => (
          <li key={q.question_id || i} className="flex items-center justify-between gap-3 text-caption">
            <span className="text-foreground">
              {i + 1}. {q.skill || 'Unnamed skill'}
              <span className="text-muted-foreground"> ({q.question_type === 'mcq' ? 'multiple choice' : q.question_type === 'short_answer' ? 'short answer' : 'type not recorded'})</span>
            </span>
            <span className={`tabular-nums ${q.correct ? 'text-success' : 'text-destructive'}`}>
              {q.correct ? 'Right' : 'Not right'} · {q.points} of {q.max_points}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}

function EvidenceItem({ item }) {
  if (item.type === 'skill_set') return <SkillSetEvidence item={item} />;
  if (item.type === 'question_outcomes') return <QuestionOutcomes item={item} />;
  return <MetricEvidence item={item} />;
}

function Factor({ factor }) {
  const direction = DIRECTION_STYLES[factor.direction] || DIRECTION_STYLES.neutral;
  const DirectionIcon = direction.icon;
  const evidence = Array.isArray(factor.evidence) ? factor.evidence : [];

  return (
    <div
      className="rounded-lg border border-border bg-background p-4"
      data-testid={subscoreTestId(factor.key) || undefined}
      data-available={factor.available ? 'true' : 'false'}
    >
      <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <DirectionIcon className={`w-4 h-4 ${direction.className}`} aria-hidden="true" />
            <h4 className="text-body font-medium text-foreground">{factor.label}</h4>
          </div>
          <p className={`text-caption mt-0.5 ${direction.className}`}>{direction.label}</p>
        </div>

        <div className="flex items-center gap-4 text-right">
          <div>
            <div className="text-body font-semibold text-foreground tabular-nums" data-testid="subscore-value">
              {factor.available ? `${factor.value}/100` : '—'}
            </div>
            <div className="text-caption text-muted-foreground">Sub-score</div>
          </div>
          <div>
            <div className="text-body font-semibold text-foreground tabular-nums">
              {factor.available ? `${factor.weight} (${factor.weight_pct}%)` : '—'}
            </div>
            <div className="text-caption text-muted-foreground">Weight used</div>
          </div>
          <div>
            <div className="text-body font-semibold text-foreground tabular-nums">
              {factor.available ? `${factor.contribution}` : '—'}
            </div>
            <div className="text-caption text-muted-foreground">Points</div>
          </div>
        </div>
      </div>

      {factor.available ? (
        evidence.length ? (
          <div className="divide-y divide-border border-t border-border">
            {evidence.map((item, i) => <EvidenceItem key={item.key || i} item={item} />)}
          </div>
        ) : (
          <p className="text-caption text-muted-foreground">No evidence items were stored for this factor.</p>
        )
      ) : (
        <EvidenceUnavailable title="Not available for this score" reason={factor.reason} />
      )}
    </div>
  );
}

function SkillEvidenceTable({ rows }) {
  if (!rows.length) return null;
  const views = rows.map(skillRowView);
  const anyLegacy = views.some((r) => r.legacy);

  return (
    <div className="overflow-x-auto -mx-1 px-1">
      <table className="w-full text-left border-collapse" data-testid="skill-evidence-table">
        <thead>
          <tr className="border-b border-border">
            <th className="py-2 pr-3 text-caption font-medium text-muted-foreground">Skill</th>
            <th className="py-2 pr-3 text-caption font-medium text-muted-foreground">Status</th>
            <th className="py-2 pr-3 text-caption font-medium text-muted-foreground">Résumé</th>
            <th className="py-2 pr-3 text-caption font-medium text-muted-foreground">GitHub</th>
            <th className="py-2 text-caption font-medium text-muted-foreground">Assessment</th>
          </tr>
        </thead>
        <tbody>
          {views.map((row, i) => {
            const status = skillStatusView(row.status);
            return (
              <tr key={`${row.name}-${i}`} className="border-b border-border last:border-0" data-testid="skill-row">
                <td className="py-2 pr-3 text-body-sm text-foreground">
                  {row.name}
                  {row.required_by_job === false && (
                    <span className="text-caption text-muted-foreground"> (not asked for by this job)</span>
                  )}
                </td>
                <td className="py-2 pr-3">
                  <Badge variant={status.variant} title={status.hint}>
                    {status.label}
                  </Badge>
                </td>
                <SkillMark source="resume" row={row} />
                <SkillMark source="github" row={row} />
                <SkillMark source="assessment" row={row} />
              </tr>
            );
          })}
        </tbody>
      </table>
      {anyLegacy && (
        <p className="text-caption text-muted-foreground mt-2" data-testid="skill-evidence-legacy">
          Stored before per-source marks: a résumé match is shown as claimed only, and the assessment was not recorded per skill.
        </p>
      )}
    </div>
  );
}

function ScoreBreakdown({
  analysis,
  explanation: explanationProp,
  evidenceLimited: evidenceLimitedProp,
  showFlags = true,
}) {
  const explanation = explanationProp ?? analysis?.explanation ?? null;
  const evidenceLimited = evidenceLimitedProp ?? analysis?.evidenceLimited ?? explanation?.evidence_limited ?? false;

  if (!explanation?.factors?.length) {
    return (
      <EvidenceUnavailable
        title="No explanation stored with this score"
        reason="This score row has no stored factor breakdown, so the evidence behind it cannot be shown."
      />
    );
  }

  const skillRows = Array.isArray(explanation.skill_evidence)
    ? explanation.skill_evidence
    : (analysis?.skillEvidence || []);
  const availableCount = explanation.factors.filter((f) => f.available).length;
  // R-27 (D§7.1): a score stored with a weights version carries its verification state
  // and note; a row written before (v1) keeps its own redistribution wording.
  const versioned = typeof explanation.weights_version === 'string' && explanation.weights_version.trim() !== '';
  const verification = explanation.verification ?? analysis?.verification ?? null;

  return (
    <div className="space-y-6">
      {/* Plain-language summary of the composite, as stored */}
      <div className="p-4 rounded-lg bg-muted border border-border">
        <p className="text-body-sm text-foreground leading-relaxed">{explanation.summary}</p>
        {/* The stored summary already ends with the verification sentence; the badge names the state. */}
        {versioned && verification && (
          <div className="flex flex-wrap items-center gap-2 mt-3" data-testid="verification-state">
            <VerificationBadge verification={verification} />
            {Number(explanation.unearned_weight) > 0 && (
              <span className="text-caption text-muted-foreground">
                {Math.round(Number(explanation.unearned_weight) * 100)}% of the score is not earned by any source yet.
              </span>
            )}
          </div>
        )}
        {!versioned && evidenceLimited && (
          <div className="flex items-center gap-2 mt-3" data-testid="evidence-limited">
            <ShieldAlert className="w-4 h-4 text-warning" aria-hidden="true" />
            <span className="text-caption text-warning-text">
              Evidence-limited: scored on {availableCount} of {explanation.factors.length} evidence
              sources. Missing sources had their weight redistributed, not counted as zero.
            </span>
          </div>
        )}
      </div>

      {/* Factor-by-factor contribution */}
      <section>
        <h3 className="text-body font-medium text-foreground mb-3">
          What produced this score
        </h3>
        <div className="space-y-3">
          {explanation.factors.map((factor) => (
            <Factor key={factor.key} factor={factor} />
          ))}
        </div>
      </section>

      {/* Per-skill confidence */}
      {skillRows.length > 0 && (
        <section>
          <h3 className="text-body font-medium text-foreground mb-1">Skill-level evidence</h3>
          <p className="text-caption text-muted-foreground mb-3">
            Every skill this job asked for, plus the ones the résumé claims, with one mark per
            source. Only GitHub or the assessment can make a skill evidenced; the résumé is a claim.
          </p>
          <SkillEvidenceTable rows={skillRows} />
        </section>
      )}

      {showFlags && (
        <FlagsPanel
          storedReason={explanation.flags_unavailable_reason ?? analysis?.flagsUnavailableReason ?? null}
          flags={explanation.flags ?? analysis?.flags ?? []}
          checks={explanation.flag_checks ?? null}
        />
      )}

      <p className="text-caption text-muted-foreground">
        {explanation.generated_at
          ? `Stored with the score on ${new Date(explanation.generated_at).toLocaleString()}`
          : 'Stored with the score'}{' '}
        · explanation format v{explanation.version ?? 1}
        <span data-testid="breakdown-weights-version"> · weights {weightsVersionLabel(explanation)}</span>
      </p>
    </div>
  );
}

export { EvidenceUnavailable, FlagsPanel };
export default ScoreBreakdown;
