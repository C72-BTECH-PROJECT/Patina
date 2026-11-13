import React from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, MinusCircle, XCircle } from 'lucide-react';
import { outcomeOf } from './assessmentLogic';

const fmt = (n) => (n === null || n === undefined ? '-' : String(Math.round(n * 100) / 100));

const OUTCOME_STYLE = {
  right: { cls: 'text-success', Icon: CheckCircle2, label: 'Right' },
  'partly right': { cls: 'text-warning-text', Icon: MinusCircle, label: 'Partly right' },
  wrong: { cls: 'text-destructive', Icon: XCircle, label: 'Wrong' },
};

/**
 * R-17: the graded attempt, exactly as evaluate returned it for the candidate
 * (candidateResultView): total, per-skill summary, right or wrong per question and
 * the candidate-safe feedback and each question's text (also after a reload: the
 * result carries it). `questions` (optional) is a fallback source of that text only.
 * No correct option or ideal answer is ever rendered.
 */
function ResultView({ view, questions }) {
  const textById = Object.fromEntries((questions || []).map((q) => [q.question_id, q.question]));
  return (
    <div data-testid="assessment-result">
      <div className="card p-8 text-center mb-6">
        <div className="text-caption text-muted-foreground mb-1">Assessment score</div>
        <div className="text-h1 text-foreground font-semibold">{view.score === null ? 'No score returned' : `${fmt(view.score)}%`}</div>
        <p className="text-body-sm text-muted-foreground mt-1">
          {fmt(view.points_earned)} of {fmt(view.points_possible)} points
        </p>
        {view.late_submission && (
          <p className="text-caption text-warning-text mt-2">Submitted after the time limit: the answers saved before the deadline were graded.</p>
        )}
        {view.answers_ignored && (
          <p className="text-caption text-muted-foreground mt-2">Your attempt had already been submitted, so the answers saved on the server were graded.</p>
        )}
        {view.scoring && (
          <p className="text-caption text-muted-foreground mt-2">
            {view.scoring.status === 'scored'
              ? 'Your credibility score for this job was updated with this result.'
              : `Your credibility score was not updated yet (reason: ${view.scoring.reason || 'not given'}).`}
          </p>
        )}
      </div>

      {view.skills.length > 0 && (
        <div className="card p-6 mb-6">
          <h2 className="text-h3 text-foreground mb-3">By skill</h2>
          <table className="w-full text-body-sm">
            <thead>
              <tr className="text-left text-caption text-muted-foreground">
                <th className="py-1 font-medium">Skill</th>
                <th className="py-1 font-medium">Right</th>
                <th className="py-1 font-medium">Points</th>
              </tr>
            </thead>
            <tbody>
              {view.skills.map((s) => (
                <tr key={s.skill} className="border-t border-border">
                  <td className="py-1.5 text-foreground">{s.skill}</td>
                  <td className="py-1.5 text-foreground">{fmt(s.correct)} of {fmt(s.questions)}</td>
                  <td className="py-1.5 text-foreground">{fmt(s.points_earned)} / {fmt(s.points_possible)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="space-y-3 mb-6">
        {view.results.map((r, i) => {
          const o = OUTCOME_STYLE[outcomeOf(r)];
          return (
            <div key={r.question_id || i} className="card p-4" data-question-id={r.question_id || ''} data-outcome={outcomeOf(r)}>
              <div className="flex items-start justify-between gap-3">
                <div className="text-caption text-muted-foreground mb-1">
                  Question {i + 1}{r.skill ? ` - ${r.skill}` : ''}
                </div>
                <span className={`inline-flex items-center gap-1 text-caption font-medium ${o.cls}`}>
                  <o.Icon className="w-3.5 h-3.5" aria-hidden="true" />
                  {o.label} ({fmt(r.points)}/{fmt(r.max_points)})
                </span>
              </div>
              {(r.question || textById[r.question_id]) && (
                <div className="text-body-sm text-foreground mb-2">{r.question || textById[r.question_id]}</div>
              )}
              {r.candidate_feedback && (
                <div className="text-caption text-muted-foreground rounded-md bg-muted p-2">{r.candidate_feedback}</div>
              )}
            </div>
          );
        })}
      </div>

      <Link to="/candidate/results" className="btn no-underline">See my results</Link>
    </div>
  );
}

export default ResultView;
