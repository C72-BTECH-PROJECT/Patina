import React from 'react';
import { motion } from 'framer-motion';
import {
  ArrowDownRight, ArrowUpRight, CheckCircle2, Circle, Info, Minus, ShieldAlert, XCircle,
} from 'lucide-react';
import Badge from '../Badge';

/**
 * ScoreBreakdown — the composite -> sub-score -> evidence drill-down
 * (FR-13, GF-5, CHECKLIST 4.5 / 5.7 / 5.8 / 5.9 / 5.10 / 5.11).
 *
 * Everything here is read straight from the `explanation` record the backend
 * persisted with the score, so what a recruiter reads is what was stored at
 * scoring time. Nothing is re-derived in the browser, and a source with no
 * evidence renders its stored reason instead of a zero.
 *
 * Expects the `analysis` shape from `analysis.controller.serializeCandidate`.
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

/** Explicit "we have no evidence here" panel — never a zero, never a blank. */
function EvidenceUnavailable({ title, reason }) {
  return (
    <div className="p-4 rounded-lg border border-dashed border-border bg-muted/40">
      <div className="flex items-center gap-2 mb-1">
        <Info className="w-4 h-4 text-muted-foreground" aria-hidden="true" />
        <span className="text-body-sm font-medium text-muted-foreground">{title}</span>
      </div>
      <p className="text-caption text-muted-foreground leading-relaxed">{reason}</p>
    </div>
  );
}

function MetricEvidence({ item }) {
  const pct = Math.round((Number(item.value) || 0) * 100);
  return (
    <div className="py-2">
      <div className="flex items-baseline justify-between gap-3 mb-1.5">
        <span className="text-body-sm text-foreground">{item.label}</span>
        <span className="text-body-sm font-semibold text-foreground tabular-nums">
          {item.display}
        </span>
      </div>
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
      <p className="text-caption text-muted-foreground mt-1.5 leading-relaxed">
        {item.note}
        {item.weight_within_factor != null && item.weight_within_factor > 0 && (
          <span className="text-foreground">
            {' '}Weighted {Math.round(item.weight_within_factor * 100)}% of this factor.
          </span>
        )}
      </p>
    </div>
  );
}

function SkillSetEvidence({ item }) {
  const positive = item.direction === 'positive';
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
      {item.items.length ? (
        <div className="flex flex-wrap gap-1.5">
          {item.items.map((skill) => (
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

function Factor({ factor }) {
  const direction = DIRECTION_STYLES[factor.direction] || DIRECTION_STYLES.neutral;
  const DirectionIcon = direction.icon;

  return (
    <div className="rounded-lg border border-border bg-background p-4">
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
            <div className="text-body font-semibold text-foreground tabular-nums">
              {factor.available ? `${factor.value}/100` : '—'}
            </div>
            <div className="text-caption text-muted-foreground">Sub-score</div>
          </div>
          <div>
            <div className="text-body font-semibold text-foreground tabular-nums">
              {factor.weight_pct}%
            </div>
            <div className="text-caption text-muted-foreground">Weight</div>
          </div>
          <div>
            <div className="text-body font-semibold text-foreground tabular-nums">
              {factor.available ? `${factor.contribution}` : '0'}
            </div>
            <div className="text-caption text-muted-foreground">Points</div>
          </div>
        </div>
      </div>

      {factor.available ? (
        <div className="divide-y divide-border border-t border-border">
          {factor.evidence.map((item) =>
            item.type === 'skill_set' ? (
              <SkillSetEvidence key={item.key} item={item} />
            ) : (
              <MetricEvidence key={item.key} item={item} />
            )
          )}
        </div>
      ) : (
        <EvidenceUnavailable title="Evidence not available" reason={factor.reason} />
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
            const status = SKILL_STATUS[row.status] || SKILL_STATUS.claimed_only;
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

function ScoreBreakdown({ analysis }) {
  const explanation = analysis?.explanation;

  if (!explanation?.factors?.length) {
    return (
      <EvidenceUnavailable
        title="No score explanation stored"
        reason="This score predates the explainability layer, or was written by an older version of the pipeline. Re-run the analysis to produce an auditable breakdown."
      />
    );
  }

  const skillRows = analysis.skillEvidence || [];

  return (
    <div className="space-y-6">
      {/* Plain-language summary of the composite */}
      <div className="p-4 rounded-lg bg-muted border border-border">
        <p className="text-body-sm text-foreground leading-relaxed">{explanation.summary}</p>
        {analysis.evidenceLimited && (
          <div className="flex items-center gap-2 mt-3">
            <ShieldAlert className="w-4 h-4 text-warning" aria-hidden="true" />
            <span className="text-caption text-warning">
              Evidence-limited: scored on {explanation.factors.filter((f) => f.available).length} of{' '}
              {explanation.factors.length} evidence sources. Missing sources had their weight
              redistributed, not counted as zero.
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

      {/* Flagged inconsistencies */}
      <section>
        <h3 className="text-body font-medium text-foreground mb-3">Flagged inconsistencies</h3>
        {analysis.flagsAvailable && analysis.flags.length > 0 ? (
          <div className="space-y-2">
            {analysis.flags.map((flag, i) => (
              <div key={i} className="p-3 rounded-lg bg-warning/10 border border-warning/20">
                <p className="text-body-sm text-foreground">{flag.description}</p>
                {flag.severity && (
                  <Badge variant="warning" className="mt-2">
                    {flag.severity} severity
                  </Badge>
                )}
              </div>
            ))}
          </div>
        ) : analysis.flagsAvailable ? (
          <p className="text-body-sm text-muted-foreground">
            No contradictions were found between this candidate's claims and the available evidence.
          </p>
        ) : (
          <EvidenceUnavailable
            title="Inconsistency detection not available"
            reason={analysis.flagsUnavailableReason}
          />
        )}
      </section>

      <p className="text-caption text-muted-foreground">
        {explanation.generated_at
          ? `Stored with the score on ${new Date(explanation.generated_at).toLocaleString()}`
          : 'Stored with the score'}{' '}
        · explanation format v{explanation.version ?? 1}
      </p>
    </div>
  );
}

export { EvidenceUnavailable };
export default ScoreBreakdown;
