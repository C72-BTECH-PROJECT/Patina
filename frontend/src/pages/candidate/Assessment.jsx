import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { AlertCircle, Clock, Send } from 'lucide-react';
import Button from '../../components/Button';
import AppliedJobPicker from '../../components/assessment/AppliedJobPicker';
import QuestionCard from '../../components/assessment/QuestionCard';
import ResultView from '../../components/assessment/ResultView';
import {
  answersFromSaved, answersPayload, candidateResultView, clockAnchor, formatClock, isKnownState,
  limitMinutes, pollDelayFor, questionView, remainingMs, saveErrorAction, saveRetryDelay, screenFor,
  shouldAutoSubmit, timeLimitOf,
} from '../../components/assessment/assessmentLogic';
import { api, isAborted } from '../../lib/api';

// R-17 (D§6.2, D§0 A1): the candidate's assessment for one job, at
// /candidate/assessment?jobId=<job id>. Without a jobId the applied jobs are listed.
//
// The page is driven by GET /api/assessment/status?jobId= and never waits on
// question generation:
//   not_applied      explain, link to the job
//   preparing        poll status every few seconds
//   unavailable      "not ready yet", Check again, and status is re-read after the server's retry gate
//   ready            the rules and the Start button (POST /api/assessment/start; 202 = still preparing)
//   in_progress      the questions (POST /api/assessment/start returns the same attempt, its clock and
//                    saved_answers on every call, so a reload restores both); every change is saved with
//                    PUT /api/assessment/:id/answers; the timer counts expires_at - server_time
//   grading_pending  submitted, grading pending; Retry calls POST /api/assessment/evaluate without answers
//   completed        the result: the evaluate answer, or on a later visit status's `result` (same shape)
//   attempts_used    no attempt left
// Logic lives in components/assessment/assessmentLogic.js (unit-tested).

const TEXT_SAVE_DEBOUNCE_MS = 700;
const TICK_MS = 250;
const mono = () => (typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now());

const clearTimers = (...refs) => {
  for (const r of refs) {
    clearTimeout(r.current);
    r.current = null;
  }
};

function Assessment() {
  const [searchParams] = useSearchParams();
  const jobId = searchParams.get('jobId');
  if (!jobId) return <AppliedJobPicker />;
  return <AssessmentForJob key={jobId} jobId={jobId} />;
}

function AssessmentForJob({ jobId }) {
  // Page-level: 'loading' (first status read), 'error' (it failed), 'state' (a status is shown).
  const [phase, setPhase] = useState('loading');
  const [pageError, setPageError] = useState('');
  const [status, setStatus] = useState(null);
  const [statusVersion, setStatusVersion] = useState(0);
  const [notice, setNotice] = useState('');
  const [checking, setChecking] = useState(false);
  const [starting, setStarting] = useState(false);
  const [jobTitle, setJobTitle] = useState(null);
  const [jobTitleError, setJobTitleError] = useState('');

  // The started attempt.
  const [attempt, setAttempt] = useState(null); // { assessmentId, startedAt, expiresAt, questions }
  const [questionsError, setQuestionsError] = useState('');
  const [loadingQuestions, setLoadingQuestions] = useState(false);
  const [answers, setAnswers] = useState({});
  const [anchor, setAnchor] = useState(null);
  const [now, setNow] = useState(mono());
  const [save, setSave] = useState({ state: 'idle', message: '' });
  const [submit, setSubmit] = useState({ running: false, startedAt: null, error: '' });
  const [retry, setRetry] = useState({ running: false, startedAt: null });
  const [result, setResult] = useState(null);

  const ctrlRef = useRef(null);
  const aliveRef = useRef(true);
  const seqRef = useRef(0);
  const attemptRef = useRef(null);
  const answersRef = useRef({});
  const anchorRef = useRef(null);
  const pendingRef = useRef(new Map());
  const inFlightRef = useRef(false);
  const flushTimerRef = useRef(null);
  const retryTimerRef = useRef(null);
  const failuresRef = useRef(0);
  const closedRef = useRef(false);
  const submitStartedRef = useRef(false);
  const autoSubmittedRef = useRef(false);
  const loadingQuestionsRef = useRef(false);

  const phaseRef = useRef('loading');
  useEffect(() => { phaseRef.current = phase; }, [phase]);

  useEffect(() => {
    aliveRef.current = true;
    ctrlRef.current = new AbortController();
    return () => {
      aliveRef.current = false;
      ctrlRef.current?.abort();
      clearTimers(flushTimerRef, retryTimerRef);
    };
  }, []);

  const reanchor = useCallback((body) => {
    const a = clockAnchor(body?.expires_at, body?.server_time, mono());
    if (!a) return;
    anchorRef.current = a;
    setAnchor(a);
    setNow(mono());
  }, []);

  /** Show a state the server reported (status body, or an error body that carries `state`). */
  const showState = useCallback((body) => {
    setStatus(body);
    setPhase('state');
    setStatusVersion((v) => v + 1);
  }, []);

  const readStatus = useCallback(async () => {
    const seq = ++seqRef.current;
    try {
      const body = await api.get(`/api/assessment/status?jobId=${encodeURIComponent(jobId)}`, { signal: ctrlRef.current?.signal, cache: 'no-store' });
      if (!aliveRef.current || seq !== seqRef.current) return;
      setNotice('');
      showState(body || {});
    } catch (err) {
      if (isAborted(err) || !aliveRef.current || seq !== seqRef.current) return;
      if (phaseRef.current === 'loading' || phaseRef.current === 'error') {
        setPageError(err.message);
        setPhase('error');
      } else {
        setNotice(`Could not check the assessment status: ${err.message}`);
      }
      setStatusVersion((v) => v + 1); // keeps any polling going
    }
  }, [jobId, showState]);

  // First read, and the job title for the header.
  useEffect(() => {
    readStatus();
    api.get(`/api/jobs/${encodeURIComponent(jobId)}`, { signal: ctrlRef.current?.signal })
      .then((job) => { if (aliveRef.current) setJobTitle(job?.title || null); })
      .catch((err) => { if (!isAborted(err) && aliveRef.current) setJobTitleError(err.message); });
  }, [jobId, readStatus]);

  const state = phase === 'state' ? status?.state : null;
  const screen = phase === 'state' ? screenFor(state) : null;

  // Polling: preparing, unavailable (after the server's retry gate) and grading_pending.
  useEffect(() => {
    if (phase !== 'state' || retry.running) return undefined;
    const delay = pollDelayFor(state, status);
    if (!delay) return undefined;
    const t = setTimeout(() => { readStatus(); }, delay);
    return () => clearTimeout(t);
  }, [phase, state, status, statusVersion, retry.running, readStatus]);

  // ---- the attempt -------------------------------------------------------

  const beginAttempt = useCallback((data) => {
    const questions = (Array.isArray(data.questions) ? data.questions : []).map(questionView);
    const a = {
      assessmentId: data.assessmentId,
      startedAt: data.started_at || null,
      expiresAt: data.expires_at || null,
      questions,
    };
    attemptRef.current = a;
    setAttempt(a);
    const restored = answersFromSaved(data.saved_answers);
    answersRef.current = restored;
    setAnswers(restored);
    pendingRef.current = new Map();
    closedRef.current = false;
    submitStartedRef.current = false;
    autoSubmittedRef.current = false;
    failuresRef.current = 0;
    reanchor(data);
    setSave(Object.keys(restored).length
      ? { state: 'saved', message: 'Your saved answers were restored.' }
      : { state: 'idle', message: '' });
    setQuestionsError('');
    showState({ ...data, state: 'in_progress' });
  }, [reanchor, showState]);

  /** An ApiError whose body names a candidate state moves the page there, with the server's message. */
  const followErrorState = useCallback((err, extra = {}) => {
    const s = err?.body?.state;
    if (isKnownState(s)) {
      showState({ ...err.body, ...extra, state: s });
      setNotice(err.message);
      return true;
    }
    return false;
  }, [showState]);

  /** POST /api/assessment/start: begins the attempt, or returns the one already running. */
  const callStart = useCallback(async ({ fromStatus }) => {
    const { status: http, data } = await api.request('POST', '/api/assessment/start', { jobId }, { signal: ctrlRef.current?.signal });
    if (!aliveRef.current) return;
    if (http === 202 || data?.state === 'preparing') {
      setNotice('');
      showState({ ...(data || {}), state: 'preparing' });
      return;
    }
    if (data?.state === 'in_progress' && data.assessmentId && Array.isArray(data.questions) && data.questions.length) {
      setNotice('');
      beginAttempt(data);
      return;
    }
    const msg = 'The server answered without any questions for this attempt.';
    if (fromStatus) setQuestionsError(msg); else setNotice(msg);
  }, [jobId, beginAttempt, showState]);

  const start = async () => {
    setStarting(true);
    setNotice('');
    try {
      await callStart({ fromStatus: false });
    } catch (err) {
      if (isAborted(err) || !aliveRef.current) return;
      if (!followErrorState(err)) setNotice(err.message);
    } finally {
      if (aliveRef.current) setStarting(false);
    }
  };

  // Status says in_progress but the page holds no questions (a reload, or another tab):
  // start returns the same attempt with its clock and saved answers.
  const loadQuestions = useCallback(async () => {
    if (loadingQuestionsRef.current) return;
    loadingQuestionsRef.current = true;
    setLoadingQuestions(true);
    setQuestionsError('');
    try {
      await callStart({ fromStatus: true });
    } catch (err) {
      if (isAborted(err) || !aliveRef.current) return;
      if (!followErrorState(err)) setQuestionsError(err.message);
    } finally {
      loadingQuestionsRef.current = false;
      if (aliveRef.current) setLoadingQuestions(false);
    }
  }, [callStart, followErrorState]);

  useEffect(() => {
    if (state === 'in_progress' && !attemptRef.current && !questionsError) loadQuestions();
  }, [state, questionsError, loadQuestions]);

  // ---- submit (and the automatic submit at zero) ---------------------------

  const doSubmit = useCallback(async ({ auto }) => {
    const a = attemptRef.current;
    if (!a || submitStartedRef.current) return;
    submitStartedRef.current = true;
    if (auto) autoSubmittedRef.current = true;
    closedRef.current = true;
    clearTimers(flushTimerRef, retryTimerRef);
    setSubmit({ running: true, startedAt: mono(), error: '' });
    setNotice(auto ? 'Time is up: your answers were submitted automatically.' : '');
    try {
      const data = await api.post('/api/assessment/evaluate', {
        assessmentId: a.assessmentId,
        answers: answersPayload(answersRef.current, a.questions),
      }, { signal: ctrlRef.current?.signal });
      if (!aliveRef.current) return;
      setResult(candidateResultView(data));
      showState({ ...(data || {}), state: 'completed' });
      setSubmit({ running: false, startedAt: null, error: '' });
    } catch (err) {
      if (isAborted(err) || !aliveRef.current) return;
      setSubmit({ running: false, startedAt: null, error: '' });
      if (followErrorState(err, { assessmentId: a.assessmentId })) return;
      if (err?.body?.state === 'voided') {
        setNotice(err.message);
        readStatus();
        return;
      }
      // Unknown outcome (network, gateway timeout, server error): the submission may or
      // may not be stored. Submitting again is safe (the server grades the stored
      // submission once); Check status re-reads.
      submitStartedRef.current = false;
      closedRef.current = false; // saving resumes; a closed attempt then reports itself
      setSubmit({ running: false, startedAt: null, error: err.message });
    }
  }, [followErrorState, readStatus, showState]);

  // Clock tick (also drives the elapsed-time text while grading); auto-submit at zero.
  const ticking = (screen === 'questions' && anchor) || submit.running || retry.running;
  useEffect(() => {
    if (!ticking) return undefined;
    const id = setInterval(() => {
      const t = mono();
      setNow(t);
      if (!autoSubmittedRef.current && shouldAutoSubmit({ anchor: anchorRef.current, monoNow: t, submitStarted: submitStartedRef.current })) {
        doSubmit({ auto: true });
      }
    }, TICK_MS);
    return () => clearInterval(id);
  }, [ticking, doSubmit]);

  // ---- saving --------------------------------------------------------------

  const flush = useCallback(async () => {
    const a = attemptRef.current;
    if (!a || closedRef.current || inFlightRef.current || pendingRef.current.size === 0) return;
    clearTimeout(retryTimerRef.current);
    retryTimerRef.current = null;
    const batch = [...pendingRef.current].map(([question_id, response]) => ({ question_id, response }));
    pendingRef.current.clear();
    inFlightRef.current = true;
    setSave({ state: 'saving', message: '' });
    let again = false;
    try {
      const data = await api.put(`/api/assessment/${encodeURIComponent(a.assessmentId)}/answers`, { answers: batch }, { signal: ctrlRef.current?.signal });
      if (!aliveRef.current) return;
      failuresRef.current = 0;
      reanchor(data);
      if (pendingRef.current.size) again = true;
      else setSave({ state: 'saved', message: '' });
    } catch (err) {
      if (isAborted(err) || !aliveRef.current || closedRef.current) return;
      const action = saveErrorAction(err);
      if (action === 'submit') {
        setSave({ state: 'failed', message: 'Time is up; the last change was not saved.' });
        doSubmit({ auto: true });
      } else if (action === 'closed') {
        closedRef.current = true;
        setSave({ state: 'failed', message: err.message });
        readStatus();
      } else if (action === 'retry') {
        for (const b of batch) if (!pendingRef.current.has(b.question_id)) pendingRef.current.set(b.question_id, b.response);
        failuresRef.current += 1;
        setSave({ state: 'retrying', message: err.message });
        retryTimerRef.current = setTimeout(() => { flushRef.current(); }, saveRetryDelay(failuresRef.current));
      } else {
        setSave({ state: 'failed', message: err.message });
      }
    } finally {
      inFlightRef.current = false;
    }
    if (again) flushRef.current();
  }, [doSubmit, readStatus, reanchor]);

  const flushRef = useRef(flush);
  useEffect(() => { flushRef.current = flush; }, [flush]);

  const setAnswer = (questionId, value, { debounce }) => {
    if (closedRef.current) return;
    answersRef.current = { ...answersRef.current, [questionId]: value };
    setAnswers(answersRef.current);
    pendingRef.current.set(questionId, value);
    clearTimeout(flushTimerRef.current);
    if (debounce) {
      if (!inFlightRef.current && !retryTimerRef.current) setSave({ state: 'pending', message: '' });
      flushTimerRef.current = setTimeout(() => { flushRef.current(); }, TEXT_SAVE_DEBOUNCE_MS);
    } else {
      flushTimerRef.current = null;
      flushRef.current();
    }
  };

  // ---- grading retry -------------------------------------------------------

  const retryGrading = async () => {
    const assessmentId = status?.assessmentId || attemptRef.current?.assessmentId;
    if (!assessmentId) {
      setNotice('The server did not say which attempt is pending, so grading cannot be retried from here. Check again.');
      return;
    }
    setRetry({ running: true, startedAt: mono() });
    setNotice('');
    try {
      const data = await api.post('/api/assessment/evaluate', { assessmentId }, { signal: ctrlRef.current?.signal });
      if (!aliveRef.current) return;
      setResult(candidateResultView(data));
      showState({ ...(data || {}), state: 'completed' });
    } catch (err) {
      if (isAborted(err) || !aliveRef.current) return;
      if (err?.body?.state === 'completed') {
        setNotice('');
        readStatus();
      } else if (!followErrorState(err, { assessmentId })) {
        setNotice(err.message);
      }
    } finally {
      if (aliveRef.current) setRetry({ running: false, startedAt: null });
    }
  };

  const checkAgain = async () => {
    setChecking(true);
    await readStatus();
    if (aliveRef.current) setChecking(false);
  };

  // ---- render --------------------------------------------------------------

  const header = (
    <div className="mb-6">
      <h1 className="text-h2 text-foreground">Skill assessment</h1>
      <p className="text-body-sm text-muted-foreground mt-1">
        {jobTitle ? `For: ${jobTitle}` : jobTitleError ? `The job title could not be loaded: ${jobTitleError}` : 'For the job you applied to'}
      </p>
    </div>
  );

  const noticeBox = notice && (
    <div role="alert" className="mb-4 p-3 rounded-md bg-destructive/10 border border-destructive/20 text-body-sm text-destructive">
      {notice}
    </div>
  );

  const frame = (stateName, body) => (
    <div className="max-w-3xl mx-auto" data-testid="assessment-state" data-state={stateName}>
      {header}
      {noticeBox}
      {body}
    </div>
  );

  const checkAgainButton = (
    <Button variant="outline" onClick={checkAgain} loading={checking} data-testid="assessment-check-again">
      {checking ? 'Checking...' : 'Check again'}
    </Button>
  );

  if (phase === 'loading') {
    return frame('loading', <p className="text-body-sm text-muted-foreground">Checking your assessment for this job...</p>);
  }

  if (phase === 'error') {
    return frame('error', (
      <div className="card p-6">
        <div className="flex items-start gap-2 mb-4">
          <AlertCircle className="w-5 h-5 text-destructive flex-shrink-0" aria-hidden="true" />
          <p className="text-body-sm text-foreground">Could not load the assessment status: {pageError}</p>
        </div>
        <Button variant="outline" onClick={() => { setPhase('loading'); readStatus(); }}>Try again</Button>
      </div>
    ));
  }

  const startLimit = timeLimitOf(status);
  const attempts = status?.attempts && Number.isFinite(Number(status.attempts.max))
    ? { used: Number(status.attempts.used) || 0, max: Number(status.attempts.max) }
    : null;

  switch (screen) {
    case 'not_applied':
      return frame(state, (
        <div className="card p-6">
          <p className="text-body-sm text-foreground mb-4">
            The assessment is offered only for jobs you have applied to, and you have not applied to this one.
          </p>
          <Link to={`/candidate/jobs/${encodeURIComponent(jobId)}`} className="btn btn-primary no-underline">View the job</Link>
        </div>
      ));

    case 'preparing':
      return frame(state, (
        <div className="card p-6">
          <p className="text-body font-medium text-foreground">Your assessment is being prepared.</p>
          <p className="text-body-sm text-muted-foreground mt-1">
            This page checks again every few seconds and shows the Start screen when it is ready. You can leave and come back.
          </p>
        </div>
      ));

    case 'unavailable':
      return frame(state, (
        <div className="card p-6">
          <p className="text-body font-medium text-foreground">Not ready yet, we will keep trying.</p>
          <p className="text-body-sm text-muted-foreground mt-1 mb-4">
            While this page is open it asks the server again
            {status?.retry_after_seconds ? ` in about ${Math.ceil(Number(status.retry_after_seconds))} seconds` : ' shortly'}.
          </p>
          {checkAgainButton}
        </div>
      ));

    case 'start':
      return frame(state, (
        <div className="card p-6">
          <h2 className="text-h3 text-foreground mb-3">Before you start</h2>
          <ul className="list-disc pl-5 space-y-2 text-body-sm text-foreground mb-6">
            <li>
              {attempts
                ? `You have ${Math.max(0, attempts.max - attempts.used)} of ${attempts.max} attempt${attempts.max === 1 ? '' : 's'} left for this job. `
                : 'The server did not report how many attempts you have. '}
              Your first completed attempt is the one that counts.
            </li>
            <li>
              {startLimit !== null
                ? `You have ${startLimit} minute${startLimit === 1 ? '' : 's'}. `
                : 'The server did not report the time limit. '}
              The clock starts when you press Start, not before, and keeps running if you leave or reload the page.
            </li>
            <li>Your answers are saved as you go. When the time runs out, what you have answered is submitted automatically.</li>
            <li>This is an unproctored online assessment.</li>
            <li>After you submit you see your score, a summary per skill and whether each answer was right; the correct answers are not shown.</li>
          </ul>
          <Button onClick={start} loading={starting} data-testid="assessment-start">
            {starting ? 'Starting...' : 'Start'}
          </Button>
        </div>
      ));

    case 'questions': {
      if (!attempt) {
        return frame(state, questionsError ? (
          <div className="card p-6">
            <p className="text-body-sm text-foreground mb-4">Your assessment is in progress, but its questions could not be loaded: {questionsError}</p>
            <Button variant="outline" onClick={() => { setQuestionsError(''); }} loading={loadingQuestions}>Try again</Button>
          </div>
        ) : (
          <p className="text-body-sm text-muted-foreground">Your assessment is in progress. Loading your questions and saved answers...</p>
        ));
      }
      const left = remainingMs(anchor, now);
      const limit = limitMinutes(attempt.startedAt, attempt.expiresAt);
      const answered = attempt.questions.filter((q) => (answers[q.question_id] || '').trim()).length;
      const SAVE_TEXT = {
        idle: 'No answers yet',
        pending: 'Not saved yet',
        saving: 'Saving...',
        saved: save.message || 'All answers saved',
        retrying: `Not saved, retrying: ${save.message}`,
        failed: `Not saved: ${save.message}`,
      };
      const saveCls = save.state === 'retrying' || save.state === 'failed' ? 'text-destructive' : 'text-muted-foreground';
      const elapsed = submit.running && submit.startedAt !== null ? Math.max(0, Math.floor((now - submit.startedAt) / 1000)) : 0;
      return frame(state, (
        <>
          <div className="sticky top-0 z-10 card p-3 mb-4 flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2" data-testid="assessment-timer" data-remaining-ms={left === null ? '' : String(Math.round(left))}>
              <Clock className="w-4 h-4 text-muted-foreground" aria-hidden="true" />
              <span className={`font-semibold tabular-nums ${left !== null && left < 60000 ? 'text-destructive' : 'text-foreground'}`}>
                {left === null ? 'Time remaining not known' : formatClock(left)}
              </span>
              {limit !== null && <span className="text-caption text-muted-foreground">of {limit} min</span>}
            </div>
            <span className="text-caption text-muted-foreground">{answered} of {attempt.questions.length} answered</span>
            <span className={`text-caption ${saveCls}`} data-testid="assessment-save-indicator" data-save-state={save.state} aria-live="polite">
              {SAVE_TEXT[save.state] || save.state}
            </span>
          </div>

          <div className="space-y-4 mb-6">
            {attempt.questions.map((q, i) => (
              <QuestionCard
                key={q.question_id || i}
                index={i}
                question={q}
                value={answers[q.question_id] || ''}
                disabled={submit.running || submitStartedRef.current}
                onChoose={(id, label) => setAnswer(id, label, { debounce: false })}
                onType={(id, text) => setAnswer(id, text, { debounce: true })}
              />
            ))}
          </div>

          {submit.error && (
            <div role="alert" className="mb-4 p-3 rounded-md bg-destructive/10 border border-destructive/20 text-body-sm text-destructive">
              Submitting failed: {submit.error} Your answers stay on this page. Submitting again is safe.
              <div className="mt-2">{checkAgainButton}</div>
            </div>
          )}

          <div className="flex items-center gap-3 flex-wrap">
            <Button onClick={() => doSubmit({ auto: false })} loading={submit.running} disabled={submit.running} data-testid="assessment-submit">
              {!submit.running && <Send className="w-4 h-4" aria-hidden="true" />}
              {submit.running ? 'Submitting...' : `Submit (${answered}/${attempt.questions.length})`}
            </Button>
            {submit.running && (
              <span className="text-body-sm text-muted-foreground">
                Submitted; grading your answers ({elapsed} s). Please keep this page open.
              </span>
            )}
          </div>
        </>
      ));
    }

    case 'grading_pending': {
      const elapsed = retry.running && retry.startedAt !== null ? Math.max(0, Math.floor((now - retry.startedAt) / 1000)) : 0;
      return frame(state, (
        <div className="card p-6">
          <p className="text-body font-medium text-foreground">Submitted, grading pending.</p>
          <p className="text-body-sm text-muted-foreground mt-1 mb-4">
            Your answers are saved and will be graded. This page checks again every few seconds; you can also retry now.
          </p>
          <div className="flex items-center gap-3 flex-wrap">
            <Button onClick={retryGrading} loading={retry.running} data-testid="assessment-retry-grading">
              {retry.running ? 'Grading...' : 'Retry grading'}
            </Button>
            {retry.running && <span className="text-body-sm text-muted-foreground">Grading your answers ({elapsed} s).</span>}
          </div>
        </div>
      ));
    }

    case 'result':
      // Right after submit: the evaluate answer. On a later visit: the same result as
      // status rebuilds it from the stored evaluation (R-17 backend addition).
      if (result) return frame(state, <ResultView view={result} questions={attempt?.questions} />);
      if (status?.result && typeof status.result === 'object') {
        return frame(state, <ResultView view={candidateResultView(status.result)} questions={attempt?.questions} />);
      }
      return frame(state, (
        <div className="card p-6" data-testid="assessment-result">
          <p className="text-body font-medium text-foreground mb-1">You have completed this assessment.</p>
          <p className="text-body-sm text-muted-foreground mb-4">The server returned no stored result for this attempt.</p>
          <Link to="/candidate/results" className="btn no-underline">See my results</Link>
        </div>
      ));

    case 'attempts_used':
      return frame(state, (
        <div className="card p-6">
          <p className="text-body font-medium text-foreground">You have no attempts left for this job.</p>
          {attempts && (
            <p className="text-body-sm text-muted-foreground mt-1">Attempts used: {attempts.used} of {attempts.max}.</p>
          )}
        </div>
      ));

    default:
      return frame('unknown', (
        <div className="card p-6">
          <p className="text-body-sm text-foreground mb-4">
            The server reported an assessment state this page does not recognise: {String(state ?? 'none')}.
          </p>
          {checkAgainButton}
        </div>
      ));
  }
}

export default Assessment;
