import React from 'react';
import { motion } from 'framer-motion';
import {
  ArrowDownRight, ArrowUpRight, CheckCircle2, Circle, Info, Minus, ShieldAlert, XCircle,
} from 'lucide-react';
import Badge from '../Badge';
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

const SKILL_STATUS = {
  matched: {
    variant: 'success',
    label: 'Evidenced',
    hint: 'Required by the job and found in the résumé.',
  },
  missing: {
    variant: 'destructive',
    label: 'Not found',
    hint: 'Required by the job but absent from the résumé.',
  },
  claimed_only: {
    variant: 'warning',
    label: 'Claimed only',
    hint: 'On the résumé but not asked for by this job, so nothing corroborates it.',
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
 * The honest flags panel (DECISIONS.md §7: inconsistency flags are not built, stretch
 * S-2). It never lists flags and never reads as an all-clear. `storedReason` is the
 * explanation's own `flags_unavailable_reason`, shown when present.
 */
function FlagsPanel({ storedReason }) {
  return (
    <section data-testid="flags-panel">
      <h3 className="text-body font-medium text-foreground mb-3">Inconsistency flags</h3>
      <EvidenceUnavailable
        title="Not built yet: no flags are shown"
        reason={storedReason
          || 'Checks that compare résumé claims against GitHub or assessment evidence are not built, so no inconsistency flags are shown. This is not a finding that the claims are consistent.'}
      />
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

  return (
    <div className="overflow-x-auto -mx-1 px-1">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="border-b border-border">
            <th className="py-2 pr-3 text-caption font-medium text-muted-foreground">Skill</th>
            <th className="py-2 pr-3 text-caption font-medium text-muted-foreground">Status</th>
            <th className="py-2 text-caption font-medium text-muted-foreground whitespace-nowrap">
              Confirmed by
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const status = skillStatusView(row.status);
            return (
              <tr key={`${row.name}-${row.status}`} className="border-b border-border last:border-0">
                <td className="py-2 pr-3 text-body-sm text-foreground">{row.name}</td>
                <td className="py-2 pr-3">
                  <Badge variant={status.variant} title={status.hint}>
                    {status.label}
                  </Badge>
                </td>
                <td className="py-2 text-caption text-muted-foreground whitespace-nowrap tabular-nums">
                  {row.evidence_sources_confirming} of {row.evidence_sources_available}{' '}
                  {row.evidence_sources_available === 1 ? 'source' : 'sources'}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
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

  return (
    <div className="space-y-6">
      {/* Plain-language summary of the composite, as stored */}
      <div className="p-4 rounded-lg bg-muted border border-border">
        <p className="text-body-sm text-foreground leading-relaxed">{explanation.summary}</p>
        {evidenceLimited && (
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
            Every skill this job asked for, plus the ones the résumé claims, and how many of the
            available evidence sources confirm each.
          </p>
          <SkillEvidenceTable rows={skillRows} />
        </section>
      )}

      {showFlags && <FlagsPanel storedReason={explanation.flags_unavailable_reason ?? analysis?.flagsUnavailableReason ?? null} />}

      <p className="text-caption text-muted-foreground">
        {explanation.generated_at
          ? `Stored with the score on ${new Date(explanation.generated_at).toLocaleString()}`
          : 'Stored with the score'}{' '}
        · explanation format v{explanation.version ?? 1}
      </p>
    </div>
  );
}

export { EvidenceUnavailable, FlagsPanel };
export default ScoreBreakdown;
