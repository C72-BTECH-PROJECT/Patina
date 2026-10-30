import React, { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronLeft, ChevronRight, AlertCircle,
  Sparkles, FileText, ListChecks, Send,
  CheckCircle2, XCircle,
} from 'lucide-react';
import Button from '../../components/Button';
import Spinner from '../../components/Spinner';
import EmptyState from '../../components/EmptyState';
import { useAuth } from '../../context/AuthContext';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000';

// T-0017: candidates answer a generated assessment and submit it for
// server-side scoring. MCQs are graded against the answer key, short
// answers by rubric; the result folds into their credibility score.
function Assessment() {
  const { authFetch } = useAuth();
  const [searchParams] = useSearchParams();
  const [jobs, setJobs] = useState([]);
  const [jobId, setJobId] = useState(searchParams.get('jobId') || '');
  const [meta, setMeta] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [picked, setPicked] = useState({});
  const [drafts, setDrafts] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);
  const [phase, setPhase] = useState('pick-job'); // pick-job | loading | error | ready
  const [error, setError] = useState('');

  useEffect(() => {
    const loadJobs = async () => {
      try {
        const resp = await authFetch(`${API_BASE_URL}/api/jobs`);
        if (resp.ok) setJobs(await resp.json());
      } catch {
        // job picker stays empty; user can still generate via ?jobId=
      }
    };
    loadJobs();
  }, [authFetch]);

  const generate = async (id) => {
    const target = id || jobId;
    if (!target) return;
    setPhase('loading');
    setError('');
    setCurrentIndex(0);
    setPicked({});
    setDrafts({});
    setSubmitted(false);
    setResult(null);
    try {
      const resp = await authFetch(`${API_BASE_URL}/api/assessment/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId: target }),
      });
      const data = await resp.json().catch(() => ({}));
      if (resp.status === 409 && typeof data.score === 'number') {
        const max = data.max_attempts || 5;
        setError(`You have used all ${max} attempts for this assessment. Your latest score: ${data.score}%.`);
        setPhase('error');
        return;
      }
      if (!resp.ok) {
        setError(data.message || `Generation failed (HTTP ${resp.status}).`);
        setPhase('error');
        return;
      }
      const bundle = data?.questions ?? data;
      const list = Array.isArray(bundle?.questions)
        ? bundle.questions
        : Array.isArray(bundle)
          ? bundle
          : [];
      if (list.length === 0) {
        setError('The service returned no questions. Try again.');
        setPhase('error');
        return;
      }
      setMeta({
        assessmentId: data.assessmentId || bundle?.assessment_id || null,
        model: bundle?.model_used || data.model_used || null,
        count: list.length,
      });
      setQuestions(list);
      setPhase('ready');
    } catch {
      setError('Could not reach the server. Check your connection and try again.');
      setPhase('error');
    }
  };

  useEffect(() => {
    const preset = searchParams.get('jobId');
    if (preset) generate(preset);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const current = questions[currentIndex];
  const isLast = currentIndex === questions.length - 1;
  const isAnswered = (q) =>
    Boolean(picked[q.question_id] || (drafts[q.question_id] || '').trim());
  const answeredCount = questions.filter(isAnswered).length;

  const submit = async () => {
    if (!meta?.assessmentId || submitting) return;
    const answers = questions
      .filter(isAnswered)
      .map((q) => ({
        question_id: q.question_id,
        response: q.question_type === 'mcq'
          ? picked[q.question_id]
          : (drafts[q.question_id] || '').trim(),
      }));
    if (answers.length === 0) return;

    setSubmitting(true);
    setError('');
    try {
      const resp = await authFetch(`${API_BASE_URL}/api/assessment/evaluate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assessmentId: meta.assessmentId, answers }),
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        setError(data.message || `Submission failed (HTTP ${resp.status}). Your answers are still on this page — try again.`);
        return;
      }
      setResult(data);
      setSubmitted(true);
    } catch {
      setError('Could not reach the server. Your answers are still on this page — try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (phase === 'loading') {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <Spinner />
        <p className="text-body-sm text-muted-foreground">
          Generating your assessment — this can take up to a minute...
        </p>
      </div>
    );
  }

  if (phase === 'error') {
    return (
      <div className="max-w-lg mx-auto">
        <EmptyState
          icon={AlertCircle}
          title="Could not generate the assessment"
          description={error}
          action={
            <Button onClick={() => setPhase('pick-job')}>
              Try again
            </Button>
          }
        />
      </div>
    );
  }

  if (phase === 'pick-job') {
    return (
      <div className="max-w-3xl mx-auto">
        <h1 className="text-h2 text-foreground">Skill Assessment</h1>
        <p className="text-body-sm text-muted-foreground mt-1 mb-6">
          Pick a job — questions are generated live from its requirements and your resume.
        </p>
        {jobs.length === 0 ? (
          <EmptyState
            icon={ListChecks}
            title="No jobs available"
            description="There are no jobs to assess against yet."
            action={
              <Link to="/candidate/jobs" className="btn btn-primary no-underline">
                Browse jobs
              </Link>
            }
          />
        ) : (
          <div className="space-y-3">
            {jobs.map((job) => (
              <button
                key={job.id}
                type="button"
                onClick={() => { setJobId(job.id); generate(job.id); }}
                className="card p-4 w-full text-left hover:border-primary transition-colors"
              >
                <div className="font-medium text-foreground">{job.title}</div>
                <div className="text-caption text-muted-foreground truncate">
                  {(job.requiredSkills || job.required_skills || []).join(' • ')}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  if (submitted) {
    const resultById = Object.fromEntries(
      (result?.results || []).map((r) => [r.question_id, r])
    );
    const score = result?.score;
    return (
      <div className="max-w-3xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="card p-8 text-center mb-6"
        >
          <div className="text-h1 text-foreground font-semibold">{score}%</div>
          <p className="text-body-sm text-muted-foreground mt-1">
            {result?.points_earned} of {result?.points_possible} points across {questions.length} questions.
          </p>
          {result?.short_answer_graded === false && (
            <p className="text-caption text-warning mt-2">
              Short-answer grading was unavailable for this attempt, so the score
              reflects the questions that could be graded.
            </p>
          )}
          <p className="text-caption text-muted-foreground mt-2">
            Your latest attempt counts toward your credibility score for this job.
          </p>
          <div className="mt-4 flex justify-center">
            <Button onClick={() => generate()}>
              <Sparkles className="w-4 h-4" />
              Retake assessment
            </Button>
          </div>
        </motion.div>

        <div className="space-y-3 mb-6">
          {questions.map((q, i) => {
            const r = resultById[q.question_id];
            const mine = q.question_type === 'mcq'
              ? picked[q.question_id]
              : (drafts[q.question_id] || '').trim();
            return (
              <div key={q.question_id || i} className="card p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="text-caption text-muted-foreground mb-1">
                    Q{i + 1} • {q.skill}
                  </div>
                  {r && (
                    <span className={`inline-flex items-center gap-1 text-caption font-medium ${
                      r.points >= (r.max_points || 1) - 0.001 ? 'text-success' : 'text-destructive'
                    }`}>
                      {r.points >= (r.max_points || 1) - 0.001
                        ? <CheckCircle2 className="w-3.5 h-3.5" />
                        : <XCircle className="w-3.5 h-3.5" />}
                      {r.points}/{r.max_points}
                    </span>
                  )}
                </div>
                <div className="text-body-sm text-foreground mb-2">{q.question}</div>
                <div className="text-body-sm mb-2">
                  <span className="text-muted-foreground">Your answer: </span>
                  {mine ? <span className="text-foreground">{mine}</span> : <span className="text-muted-foreground">Not answered</span>}
                </div>
                {r?.feedback && (
                  <div className="text-caption text-muted-foreground rounded-md bg-muted p-2">
                    {r.feedback}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="flex gap-3">
          <Button variant="outline" onClick={() => { setPhase('pick-job'); setQuestions([]); setSubmitted(false); setResult(null); }}>
            Pick another job
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-6"
      >
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-h2 text-foreground">Skill Assessment</h1>
            <p className="text-body-sm text-muted-foreground mt-1">
              AI-generated questions based on your resume and the job
              {meta?.model ? ` • ${meta.model}` : ''}
            </p>
          </div>
          <button
            type="button"
            onClick={() => { setPhase('pick-job'); setQuestions([]); }}
            className="text-caption text-muted-foreground hover:text-foreground transition-colors"
          >
            Pick another job
          </button>
        </div>
      </motion.div>

      {error && (
        <div className="mb-4 p-3 rounded-md bg-destructive/10 border border-destructive/20 text-body-sm text-destructive">
          {error}
        </div>
      )}

      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-caption text-muted-foreground">
            Question {currentIndex + 1} of {questions.length}
          </span>
          <span className="text-caption text-muted-foreground">
            {answeredCount} answered
          </span>
        </div>
        <div className="w-full h-1.5 bg-border rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-primary rounded-full"
            animate={{ width: `${((currentIndex + 1) / questions.length) * 100}%` }}
            transition={{ duration: 0.3 }}
          />
        </div>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={current.question_id || currentIndex}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.25 }}
          className="card p-6 mb-6"
        >
          <div className="flex items-center gap-2 mb-4 flex-wrap">
            <span className="badge badge-primary text-[10px]">
              <Sparkles className="w-3 h-3 mr-1" />
              {current.skill}
            </span>
            <span className="badge text-[10px]">{current.question_type === 'mcq' ? 'Multiple choice' : 'Short answer'}</span>
            {current.source && (
              <span className="badge text-[10px]">from {current.source === 'jd' ? 'job description' : current.source}</span>
            )}
          </div>

          <h2 className="text-body font-medium text-foreground leading-relaxed mb-4">
            {current.question}
          </h2>

          {current.question_type === 'mcq' && Array.isArray(current.options) && (
            <div className="space-y-2">
              {current.options.map((opt) => {
                const selected = picked[current.question_id] === opt.label;
                return (
                  <button
                    key={opt.label}
                    type="button"
                    onClick={() => setPicked((prev) => ({ ...prev, [current.question_id]: opt.label }))}
                    className={`flex items-start gap-3 p-3 rounded-md border w-full text-left transition-colors ${
                      selected
                        ? 'bg-primary/10 border-primary'
                        : 'bg-muted border-border hover:border-primary/50'
                    }`}
                  >
                    <span className={`w-6 h-6 rounded-md border flex items-center justify-center text-caption font-semibold flex-shrink-0 ${
                      selected
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-background border-border'
                    }`}>
                      {opt.label}
                    </span>
                    <span className="text-body-sm text-foreground">{opt.text}</span>
                  </button>
                );
              })}
            </div>
          )}

          {current.question_type === 'short_answer' && (
            <div>
              <textarea
                value={drafts[current.question_id] || ''}
                onChange={(e) => setDrafts((prev) => ({ ...prev, [current.question_id]: e.target.value }))}
                placeholder="Type your answer here..."
                rows={5}
                className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-body-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 resize-none"
              />
              <div className="flex items-center justify-between mt-2">
                <span className="text-caption text-muted-foreground">
                  {(drafts[current.question_id] || '').split(/\s+/).filter(Boolean).length} words
                </span>
                {drafts[current.question_id] && (
                  <button
                    onClick={() => setDrafts((prev) => ({ ...prev, [current.question_id]: '' }))}
                    className="text-caption text-muted-foreground hover:text-destructive transition-colors"
                  >
                    Clear answer
                  </button>
                )}
              </div>
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          onClick={() => setCurrentIndex((i) => Math.max(0, i - 1))}
          disabled={currentIndex === 0}
        >
          <ChevronLeft className="w-4 h-4" />
          Previous
        </Button>

        <div className="flex items-center gap-1.5 flex-wrap justify-center">
          {questions.map((q, i) => {
            const answered = picked[q.question_id] || (drafts[q.question_id] || '').trim();
            return (
              <button
                key={q.question_id || i}
                onClick={() => setCurrentIndex(i)}
                className={`w-8 h-8 rounded-md text-caption font-medium transition-colors ${
                  i === currentIndex
                    ? 'bg-primary text-primary-foreground'
                    : answered
                    ? 'bg-success/10 text-success'
                    : 'bg-secondary text-muted-foreground hover:text-foreground'
                }`}
              >
                {i + 1}
              </button>
            );
          })}
        </div>

        {isLast ? (
          <Button
            onClick={submit}
            disabled={answeredCount === 0 || submitting || !meta?.assessmentId}
          >
            {submitting ? (
              <>
                <Spinner />
                Grading...
              </>
            ) : (
              <>
                <Send className="w-4 h-4" />
                Submit ({answeredCount}/{questions.length})
              </>
            )}
          </Button>
        ) : (
          <Button
            onClick={() => setCurrentIndex((i) => Math.min(questions.length - 1, i + 1))}
          >
            Next
            <ChevronRight className="w-4 h-4" />
          </Button>
        )}
      </div>

      <div className="mt-6 p-3 rounded-md bg-primary/5 border border-primary/10">
        <div className="flex items-start gap-2">
          <FileText className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-body-sm text-foreground font-medium">Up to 5 attempts per job</p>
            <p className="text-caption text-muted-foreground mt-0.5">
              Your answers are graded against the answer key when you submit, and your
              latest attempt counts toward your credibility score. You can leave and come
              back before submitting — the same attempt is resumed.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Assessment;
