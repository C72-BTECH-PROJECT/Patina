import React, { useCallback, useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle, Calendar, Mail, ShieldAlert, X } from 'lucide-react';
import Badge from '../Badge';
import Button from '../Button';
import ScoreBadge, {
  AWAITING_ASSESSMENT, VerificationBadge, partialScoreLabel, showEvidenceLimited, weightsVersionLabel,
} from '../ScoreBadge';
import Spinner from '../Spinner';
import ScoreBreakdown, { EvidenceUnavailable, FlagsPanel } from './ScoreBreakdown';
import { api, isAborted, isStillWorking, pollServerState, stillWorkingSeconds } from '../../lib/api';
import {
  SUBSCORES, assessmentStateText, attemptStateText, describeVoid, formatWhen, resettableAttempt,
  scoringFailureText, statusText, subscoreLabel,
} from './applicationsLogic';

/**
 * The recruiter drill-down for ONE application (card R-18, DECISIONS.md §6.2, §7, §8.2):
 * composite -> weights (provisional) -> sub-scores -> evidence, the assessment attempts
 * with per-question outcomes and recruiter feedback, the GitHub-ownership and
 * unproctored notes, the honest flags panel, and the reset action.
 *
 * Data: GET /api/recruiter/applications/:id (backend/Controllers/analysis.controller.js
 * getRecruiterApplication). Every number shown is a value from that response.
 * Reset: POST /api/assessment/:assessmentId/reset { reason } (assessment.controller.js
 * resetAssessment); the reason is required. After a reset the detail is reloaded from
 * the server so the void record shown is the stored one.
 */

// The backend's unproctored note (explainability.js UNPROCTORED_NOTE) is the same words
// as the heading; it is shown only if it ever says something more.
const extraUnproctoredNote = (note) => {
  if (typeof note !== 'string') return '';
  const same = note.trim().replace(/\.$/, '').toLowerCase() === 'unproctored online assessment';
  return same || !note.trim() ? '' : `${note.trim()} `;
};

function Section({ title, children, testId, aside }) {
  return (
    <section className="space-y-3" data-testid={testId}>
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-body font-semibold text-foreground">{title}</h3>
        {aside}
      </div>
      {children}
    </section>
  );
}

function ResetRecord({ voided, currentUserId }) {
  const d = describeVoid(voided, currentUserId);
  if (!d) return null;
  return (
    <div className="p-3 rounded-lg border border-warning/30 bg-warning/10" data-testid="reset-record">
      <div className="text-body-sm font-medium text-foreground">This attempt was reset</div>
      <dl className="mt-1 grid grid-cols-[auto,1fr] gap-x-3 gap-y-0.5 text-caption">
        <dt className="text-muted-foreground">Who</dt>
        <dd className="text-foreground" data-testid="reset-record-who">{d.who}</dd>
        <dt className="text-muted-foreground">When</dt>
        <dd className="text-foreground" data-testid="reset-record-when">{formatWhen(d.at) || 'not recorded'}</dd>
        <dt className="text-muted-foreground">Why</dt>
        <dd className="text-foreground" data-testid="reset-record-reason">{d.reason}</dd>
        {d.prior && (
          <>
            <dt className="text-muted-foreground">State before</dt>
            <dd className="text-foreground">{d.prior}</dd>
          </>
        )}
      </dl>
      <p className="mt-1 text-caption text-muted-foreground">
        A reset attempt stays on record and no longer counts toward the attempt limit or the score.
      </p>
    </div>
  );
}

function QuestionResults({ results }) {
  if (!results.length) {
    return <p className="text-caption text-muted-foreground">No per-question results are stored for this attempt.</p>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left border-collapse" data-testid="question-results">
        <thead>
          <tr className="border-b border-border">
            <th className="py-1.5 pr-3 text-caption font-medium text-muted-foreground">#</th>
            <th className="py-1.5 pr-3 text-caption font-medium text-muted-foreground">Question</th>
            <th className="py-1.5 pr-3 text-caption font-medium text-muted-foreground">Outcome</th>
            <th className="py-1.5 text-caption font-medium text-muted-foreground">Recruiter feedback</th>
          </tr>
        </thead>
        <tbody>
          {results.map((r, i) => (
            <tr key={r.question_id || i} className="border-b border-border last:border-0 align-top">
              <td className="py-2 pr-3 text-caption text-muted-foreground tabular-nums">{i + 1}</td>
              <td className="py-2 pr-3 text-caption text-foreground min-w-[12rem]">
                {r.question || <span className="italic text-muted-foreground">Question text not stored</span>}
                <div className="text-muted-foreground">
                  {r.skill || 'Unnamed skill'} ·{' '}
                  {r.question_type === 'mcq' ? 'multiple choice' : r.question_type === 'short_answer' ? 'short answer' : 'type not recorded'}
                </div>
              </td>
              <td className={`py-2 pr-3 text-caption tabular-nums whitespace-nowrap ${r.correct ? 'text-success' : 'text-destructive'}`}>
                {r.correct ? 'Right' : 'Not right'} · {r.points} of {r.max_points}
              </td>
              <td className="py-2 text-caption text-foreground min-w-[12rem]">
                {r.recruiter_feedback || (
                  <span className="italic text-muted-foreground">No recruiter feedback stored for this question.</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AttemptCard({ item, index, currentUserId }) {
  const text = attemptStateText(item.state);
  const results = Array.isArray(item.results) ? item.results : [];
  return (
    <div className="rounded-lg border border-border p-4 space-y-3" data-testid="assessment-attempt" data-state={item.state}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-body-sm font-medium text-foreground">Attempt {index + 1}</span>
        <Badge variant={item.voided ? 'warning' : 'outline'}>{text.label}</Badge>
        {item.score_of_record && <Badge variant="success">Score of record</Badge>}
        {item.late_submission && <Badge variant="warning">Late submission</Badge>}
        {item.auto_submitted && <Badge variant="outline">Submitted automatically ({String(item.auto_submitted)})</Badge>}
      </div>
      <dl className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-caption">
        <div><dt className="text-muted-foreground">Started</dt><dd className="text-foreground">{formatWhen(item.started_at) || 'not started'}</dd></div>
        <div><dt className="text-muted-foreground">Submitted</dt><dd className="text-foreground">{formatWhen(item.submitted_at) || '—'}</dd></div>
        <div><dt className="text-muted-foreground">Completed</dt><dd className="text-foreground">{formatWhen(item.completed_at) || '—'}</dd></div>
        <div>
          <dt className="text-muted-foreground">Score</dt>
          <dd className="text-foreground tabular-nums" data-testid="attempt-score">{item.score === null || item.score === undefined ? '—' : String(item.score)}</dd>
        </div>
      </dl>
      {item.voided && <ResetRecord voided={item.voided} currentUserId={currentUserId} />}
      {results.length > 0 || item.state === 'completed' || item.voided ? <QuestionResults results={results} /> : null}
    </div>
  );
}

function ResetForm({ attempt, onDone, applicationId, scoreIdBefore }) {
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [still, setStill] = useState(false); // R-33
  const [note, setNote] = useState('');
  const trimmed = reason.trim();

  // R-33: the reset's answer was lost (504 or a dropped connection) but core may still be
  // voiding and re-scoring. Read this application back (bounded) until the attempt shows its
  // void record and a new score row exists, then report what the server holds.
  const readBack = async () => {
    setStill(true);
    const voidedIn = (d) => (Array.isArray(d?.assessment?.items) ? d.assessment.items : [])
      .some((it) => it.assessmentId === attempt.assessmentId && it.voided);
    const newScore = (d) => Boolean(d?.score?.id) && d.score.id !== scoreIdBefore;
    const out = await pollServerState(
      (signal) => api.get(`/api/recruiter/applications/${encodeURIComponent(applicationId)}`, { signal, cache: 'no-store' }),
      (d) => voidedIn(d) && newScore(d),
    ).catch(() => null);
    setStill(false);
    if (out?.hasValue && voidedIn(out.value)) {
      setReason('');
      onDone({ readBack: true, newScore: newScore(out.value) });
    } else if (out?.hasValue) {
      setNote(`The server did not answer in time and, after ${stillWorkingSeconds()} s of checking, does not show this attempt as reset. It may still be working: reload before trying again.`);
    } else {
      setNote(`The server did not answer in time and the current state could not be read: ${out?.error?.message || 'no answer'}`);
    }
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!trimmed || busy) return;
    setBusy(true);
    setError(null);
    setNote('');
    try {
      const data = await api.post(`/api/assessment/${attempt.assessmentId}/reset`, { reason: trimmed });
      setReason('');
      onDone(data);
    } catch (err) {
      if (isStillWorking(err) && applicationId) await readBack();
      else setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="rounded-lg border border-border p-4 space-y-2">
      <label htmlFor="reset-reason" className="block text-body-sm font-medium text-foreground">
        Reset assessment attempt
      </label>
      <p className="text-caption text-muted-foreground">
        For a genuine problem such as a lost connection. The attempt is kept on record with your
        reason, stops counting toward the score, and the candidate is notified and can take a new
        assessment. A reason is required.
      </p>
      <textarea
        id="reset-reason"
        data-testid="reset-reason-input"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        rows={2}
        required
        placeholder="Why is this attempt being reset?"
        className="w-full bg-background border border-input rounded-md px-3 py-2 text-body-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
      />
      {error && <p className="text-caption text-destructive" role="alert">Not reset: {error}</p>}
      {still && (
        <p className="text-caption text-muted-foreground" role="status" data-testid="still-working">
          Still working: the server has not answered yet but may still be resetting and re-scoring. Checking every few seconds.
        </p>
      )}
      {!still && note && <p className="text-caption text-muted-foreground" role="status" data-testid="still-working-note">{note}</p>}
      <Button
        type="submit"
        size="sm"
        variant="destructive"
        loading={busy}
        disabled={!trimmed}
        data-testid="reset-attempt-button"
      >
        Reset assessment attempt
      </Button>
    </form>
  );
}

function SummarySubscores({ score }) {
  // Used only when a score row has no stored explanation: the list summary's values.
  return (
    <div className="space-y-2">
      {SUBSCORES.map(({ key, testId }) => {
        const sub = score.subscores?.[key] || null;
        return (
          <div key={key} className="rounded-lg border border-border p-3" data-testid={testId} data-available={sub?.available ? 'true' : 'false'}>
            <div className="flex items-center justify-between gap-3">
              <span className="text-body-sm font-medium text-foreground">{subscoreLabel(key)}</span>
              <span className="text-body-sm text-foreground tabular-nums" data-testid="subscore-value">
                {sub?.available ? `${sub.value}/100 · weight ${sub.weight}` : '—'}
              </span>
            </div>
            {!sub?.available && (
              <p className="text-caption text-muted-foreground mt-1">
                {sub?.reason || 'Not available for this score; no reason was stored.'}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}

function Detail({ detail, currentUserId, onReset, resetResult }) {
  const { candidate, job, score, explanation, weights, assessment, notes } = detail;
  const status = statusText(detail.status);
  const stateText = assessmentStateText(assessment);
  const items = Array.isArray(assessment?.items) ? assessment.items : [];
  const target = resettableAttempt(items);
  const baseWeights = explanation?.weighting_scheme?.base_weights || null;
  const history = Array.isArray(detail.score_history) ? detail.score_history : [];
  // D§7.1 W4: until the assessment is completed (or the attempts are used) the state leads.
  const awaiting = detail.score_state === AWAITING_ASSESSMENT;
  const unearned = Number(explanation?.unearned_weight);

  return (
    <div className="space-y-8">
      {/* Who and what */}
      <div className="pr-10">
        <h2 className="text-h2 font-heading font-semibold text-foreground">
          {candidate?.name || <span className="italic text-muted-foreground">No name on the candidate's profile</span>}
        </h2>
        <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-body-sm text-muted-foreground">
          {candidate?.email ? (
            <a href={`mailto:${candidate.email}`} className="flex items-center gap-1.5 hover:text-foreground no-underline">
              <Mail className="w-4 h-4" aria-hidden="true" />
              {candidate.email}
            </a>
          ) : <span className="italic">No email on the account</span>}
          {job?.title && <span>Applied for {job.title}</span>}
          {detail.applied_at && (
            <span className="flex items-center gap-1.5">
              <Calendar className="w-4 h-4" aria-hidden="true" />
              {formatWhen(detail.applied_at)}
            </span>
          )}
          <Badge variant={status.variant} data-status={detail.status || ''}>{status.label}</Badge>
        </div>
      </div>

      {/* Composite */}
      <Section title="Credibility score" testId="drilldown-composite-section">
        {awaiting && (
          <div className="p-3 rounded-lg border border-border bg-muted" data-testid="drilldown-awaiting" data-score-state={AWAITING_ASSESSMENT}>
            <div className="text-h3 font-semibold text-foreground">Awaiting assessment</div>
            <p className="text-caption text-muted-foreground mt-0.5">
              Assessment: {stateText.label}. Until the candidate completes it, the score below is partial and is
              ranked only against other applicants who are also awaiting the assessment.
            </p>
          </div>
        )}
        {score && awaiting ? (
          // The composite stays the first <span> of drilldown-composite (tests/e2e reads it there).
          <div className="flex flex-wrap items-center gap-2" data-testid="drilldown-composite" data-state="scored" data-value={String(score.composite)}>
            <span className="text-body font-semibold text-muted-foreground tabular-nums">{String(score.composite)}</span>
            <span className="text-caption text-muted-foreground">/100</span>
            <Badge variant="outline" data-testid="partial-score-label">{partialScoreLabel(score.subscores)}</Badge>
            <VerificationBadge verification={score.verification} />
            {score.created_at && <span className="text-caption text-muted-foreground">Computed {formatWhen(score.created_at)}</span>}
          </div>
        ) : score ? (
          <div className="flex flex-wrap items-center gap-3" data-testid="drilldown-composite" data-state="scored" data-value={String(score.composite)}>
            <span className="text-h1 font-extrabold text-foreground tabular-nums">{String(score.composite)}</span>
            <span className="text-body-sm text-muted-foreground">/100</span>
            <ScoreBadge band={score.band} />
            <VerificationBadge verification={score.verification} />
            {showEvidenceLimited(score.evidence_limited, score.verification) && (
              <Badge variant="warning" data-testid="drilldown-evidence-limited">
                <ShieldAlert className="w-3 h-3 mr-1" aria-hidden="true" />
                Evidence-limited
              </Badge>
            )}
            {score.created_at && <span className="text-caption text-muted-foreground">Computed {formatWhen(score.created_at)}</span>}
          </div>
        ) : (
          <div data-testid="drilldown-composite" data-state="pending">
            <p className="text-body-sm font-medium text-foreground">Not scored yet</p>
            <p className="text-caption text-muted-foreground">
              This application has no score row. Use "Score again" in the applications table to retry.
            </p>
          </div>
        )}
        {explanation?.band_thresholds?.note && (
          <p className="text-caption text-muted-foreground">{explanation.band_thresholds.note}</p>
        )}
      </Section>

      {/* Weights */}
      {score && (
        <Section
          title="Weights used"
          testId="drilldown-weights"
          aside={<Badge variant="warning">Provisional</Badge>}
        >
          {weights ? (
            <>
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-border">
                    <th className="py-1.5 pr-3 text-caption font-medium text-muted-foreground">Evidence source</th>
                    <th className="py-1.5 pr-3 text-caption font-medium text-muted-foreground">Weight used</th>
                    {baseWeights && <th className="py-1.5 text-caption font-medium text-muted-foreground">Base weight</th>}
                  </tr>
                </thead>
                <tbody>
                  {SUBSCORES.map(({ key }) => (
                    <tr key={key} className="border-b border-border last:border-0" data-testid={`weight-${key}`}>
                      <td className="py-1.5 pr-3 text-body-sm text-foreground">{subscoreLabel(key)}</td>
                      <td className="py-1.5 pr-3 text-body-sm text-foreground tabular-nums">
                        {weights[key] === undefined || weights[key] === null ? '—' : String(weights[key])}
                      </td>
                      {baseWeights && (
                        <td className="py-1.5 text-body-sm text-muted-foreground tabular-nums">
                          {baseWeights[key] === undefined ? '—' : String(baseWeights[key])}
                        </td>
                      )}
                    </tr>
                  ))}
                  {Number.isFinite(unearned) && unearned > 0 && (
                    <tr className="border-b border-border last:border-0" data-testid="weight-unearned">
                      <td className="py-1.5 pr-3 text-body-sm text-foreground">Not earned by any source</td>
                      <td className="py-1.5 pr-3 text-body-sm text-foreground tabular-nums">{String(unearned)}</td>
                      {baseWeights && <td className="py-1.5 text-body-sm text-muted-foreground">—</td>}
                    </tr>
                  )}
                </tbody>
              </table>
              <p className="text-caption text-muted-foreground" data-testid="weights-version">
                Weights version: {weightsVersionLabel(explanation)}
              </p>
              <p className="text-caption text-muted-foreground">
                Provisional: these weights are a design choice with no calibration behind them.
                {explanation?.weighting_scheme?.redistribution ? ` ${explanation.weighting_scheme.redistribution}` : ''}
              </p>
            </>
          ) : (
            <p className="text-body-sm text-muted-foreground">No weights were stored with this score.</p>
          )}
        </Section>
      )}

      {/* Sub-scores and evidence */}
      {score && (
        <Section title="Sub-scores and evidence" testId="drilldown-subscores">
          {explanation?.factors?.length ? (
            <ScoreBreakdown explanation={explanation} evidenceLimited={score.evidence_limited} showFlags={false} />
          ) : (
            <>
              <EvidenceUnavailable
                title="No explanation stored with this score"
                reason="This score row has no stored factor breakdown, so only the sub-score values are shown."
              />
              <SummarySubscores score={score} />
            </>
          )}
        </Section>
      )}

      {/* Notes the recruiter must see */}
      <Section title="What these results do not prove" testId="drilldown-notes">
        <div className="p-3 rounded-lg bg-muted border border-border" data-testid="note-github-ownership">
          <div className="text-body-sm font-medium text-foreground">GitHub account taken from the resume; ownership not verified</div>
          {notes?.github_ownership && <p className="text-caption text-muted-foreground mt-0.5">{notes.github_ownership}</p>}
        </div>
        <div className="p-3 rounded-lg bg-muted border border-border" data-testid="note-unproctored">
          <div className="text-body-sm font-medium text-foreground">Unproctored online assessment</div>
          <p className="text-caption text-muted-foreground mt-0.5">
            {extraUnproctoredNote(notes?.unproctored_assessment)}
            Identity, a second device, AI-written answers and tab switching are not controlled.
          </p>
        </div>
      </Section>

      {/* Assessment */}
      <Section
        title="Assessment"
        testId="drilldown-assessment"
        aside={(
          <span className="text-caption text-muted-foreground tabular-nums">
            {assessment?.attempts ? `Attempts used ${assessment.attempts.used} of ${assessment.attempts.max}` : null}
          </span>
        )}
      >
        <div data-testid="drilldown-assessment-state" data-state={assessment?.state || ''}>
          <div className="text-body-sm font-medium text-foreground">{stateText.label}</div>
          {stateText.hint && <p className="text-caption text-muted-foreground">{stateText.hint}</p>}
        </div>
        {items.length ? (
          <div className="space-y-3">
            {items.map((item, i) => (
              <AttemptCard key={item.assessmentId || i} item={item} index={i} currentUserId={currentUserId} />
            ))}
          </div>
        ) : (
          <p className="text-caption text-muted-foreground">No assessment attempt exists for this application yet.</p>
        )}
        {resetResult?.readBack && (
          // R-33: read back after a lost answer; whether the candidate was notified is not known here.
          <div className="p-3 rounded-lg border text-caption border-warning/30 bg-warning/10 text-foreground" role="status" data-testid="reset-result">
            The attempt was reset (read back from the server after its answer did not arrive in time).{' '}
            {resetResult.newScore
              ? 'A new score without that attempt was saved.'
              : 'No new score had appeared yet; the server may still be scoring. Reload later, or use "Score again" in the table.'}
          </div>
        )}
        {resetResult && !resetResult.readBack && (
          <div
            className={`p-3 rounded-lg border text-caption ${resetResult.scoring?.status === 'scored' ? 'border-success/30 bg-success/10 text-foreground' : 'border-warning/30 bg-warning/10 text-foreground'}`}
            role="status"
            data-testid="reset-result"
          >
            The attempt was reset.{' '}
            {resetResult.notified ? 'The candidate was notified.' : 'The candidate notification could not be sent.'}{' '}
            {resetResult.scoring?.status === 'scored'
              ? 'A new score without that attempt was saved.'
              : `${scoringFailureText(resetResult.scoring?.reason)} Use "Score again" in the table.`}
          </div>
        )}
        {target ? (
          <ResetForm attempt={target} onDone={onReset} applicationId={detail.id} scoreIdBefore={score?.id ?? null} />
        ) : (
          <p className="text-caption text-muted-foreground">
            No attempt can be reset: the candidate has not started one, or every attempt is already reset.
          </p>
        )}
      </Section>

      {/* Flags */}
      <FlagsPanel
        storedReason={explanation?.flags_unavailable_reason ?? null}
        flags={explanation?.flags ?? []}
        checks={explanation?.flag_checks ?? null}
      />

      {/* History */}
      {history.length > 1 && (
        <Section title="Score history" testId="drilldown-history">
          <p className="text-caption text-muted-foreground">Every score row for this application, newest first. Rows are added, never changed.</p>
          <ul className="space-y-1">
            {history.map((h) => (
              <li key={h.id} className="flex flex-wrap items-center gap-2 text-body-sm">
                <span className="tabular-nums font-medium text-foreground">{String(h.composite)}</span>
                <ScoreBadge band={h.band} />
                <VerificationBadge verification={h.verification} />
                {showEvidenceLimited(h.evidence_limited, h.verification) && <Badge variant="warning">Evidence-limited</Badge>}
                <span className="text-caption text-muted-foreground">{formatWhen(h.created_at)}</span>
              </li>
            ))}
          </ul>
        </Section>
      )}
    </div>
  );
}

function CandidateModal({ applicationId, onClose, onChanged, currentUserId = null }) {
  const [state, setState] = useState({ status: 'loading', detail: null, error: null });
  const [resetResult, setResetResult] = useState(null);
  const controllerRef = useRef(null);

  const load = useCallback(async () => {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    setState((s) => ({ ...s, status: 'loading', error: null }));
    try {
      const detail = await api.get(`/api/recruiter/applications/${encodeURIComponent(applicationId)}`, {
        signal: controller.signal, cache: 'no-store',
      });
      if (!detail || typeof detail !== 'object' || !detail.id) {
        setState({ status: 'error', detail: null, error: { message: 'The server sent an application that could not be read.' } });
        return;
      }
      setState({ status: 'ready', detail, error: null });
    } catch (err) {
      if (isAborted(err)) return;
      setState({ status: 'error', detail: null, error: err });
    }
  }, [applicationId]);

  useEffect(() => {
    load();
    return () => controllerRef.current?.abort();
  }, [load]);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const onReset = (result) => {
    setResetResult(result);
    load();
    onChanged?.();
  };

  const name = state.detail?.candidate?.name;

  return (
    <motion.div
      className="fixed inset-0 bg-foreground/30 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={name ? `Application details for ${name}` : 'Application details'}
    >
      <motion.div
        className="bg-background rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden relative border border-border shadow-lg"
        initial={{ opacity: 0, scale: 0.96, y: 24 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 24 }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        onClick={(e) => e.stopPropagation()}
        data-testid="drilldown"
        data-state={state.status}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute top-5 right-5 w-9 h-9 rounded-lg bg-muted border border-border flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors z-10"
          aria-label="Close"
          data-testid="drilldown-close"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="overflow-y-auto max-h-[90vh] p-6">
          {state.status === 'error' && (
            <div className="py-10 text-center" role="alert" data-testid="drilldown-error">
              <AlertTriangle className="w-8 h-8 text-destructive mx-auto mb-3" aria-hidden="true" />
              <p className="text-body font-medium text-foreground">Could not load this application</p>
              <p className="text-body-sm text-muted-foreground mt-1">{state.error?.message || 'The request failed.'}</p>
              <Button variant="outline" className="mt-4" onClick={load}>Try again</Button>
            </div>
          )}
          {state.status === 'loading' && !state.detail && (
            <div className="py-16 flex flex-col items-center gap-3" data-testid="drilldown-loading">
              <Spinner />
              <p className="text-body-sm text-muted-foreground">Loading application...</p>
            </div>
          )}
          {state.detail && state.status !== 'error' && (
            <Detail
              detail={state.detail}
              currentUserId={currentUserId}
              onReset={onReset}
              resetResult={resetResult}
            />
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

export default CandidateModal;
