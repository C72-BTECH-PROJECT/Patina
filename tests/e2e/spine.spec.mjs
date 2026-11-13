// R-19: the demo spine, through the browser only, for the recruiter and the candidate side by
// side (two browser contexts). One serial flow with named steps. Every write is done by clicking
// the page; responses are only observed (never intercepted) so the numbers a page shows can be
// compared with what that page received. Assertions are on states and invariants, never on LLM
// text or on specific score values.
//
// Bounded waits (env, seconds): E2E_POOL_WAIT_S (default 240) for the assessment pool to go from
// preparing to ready; E2E_GRADING_WAIT_S (default 240) for grading after Submit. Running out of
// either is a PROVIDER failure (lib/provider.mjs), reported apart from a product failure.
// E2E_RESUME: the resume to upload (default fixture f1).
//
// The candidate account is not assumed clean: the spec finds its own job by its unique title and
// its own application by the id the apply response carried. Rows it creates are printed at the
// end of the run (lib/leftovers.mjs).
import { test, expect } from '@playwright/test';
import { newRoleContext } from './lib/auth.mjs';
import { recordLeftover } from './lib/leftovers.mjs';
import { ANSWER_KEY_FIELDS, actAndWait, findFieldNames, recordApiResponses } from './lib/network.mjs';
import { providerFailure } from './lib/provider.mjs';
import { BAND_LABELS, checkDrilldown, chooseResumeFile, expectScore, numberIn } from './lib/pages.mjs';
import { demoResumePath } from './fixtures/index.mjs';

const secondsFromEnv = (name, fallback) => {
  const v = Number(process.env[name]);
  return (Number.isFinite(v) && v > 0 ? v : fallback) * 1000;
};
const POOL_WAIT_MS = secondsFromEnv('E2E_POOL_WAIT_S', 240);
const GRADING_WAIT_MS = secondsFromEnv('E2E_GRADING_WAIT_S', 240);
const APPLY_WAIT_MS = 120_000; // apply scores in the same request (NLP + GitHub)
const UPLOAD_WAIT_MS = 120_000; // upload parses in the same request

// Skills from CreateJob.jsx's list that fixture f1 (a Python/SQL developer) also claims.
const JOB_SKILLS = ['Python', 'SQL', 'PostgreSQL', 'Docker'];
const JOB_DESCRIPTION = [
  '# About the role',
  'Scripted end-to-end check (R-19). Build and run Python services backed by PostgreSQL, packaged with Docker.',
  '',
  '# Requirements',
  'Python, SQL, PostgreSQL and Docker in production work.',
].join('\n');
const TEXT_ANSWER = 'I would read the documentation, try it on a small example, measure the result and then apply it.';

const ASSESSMENT_PATH = /^\/api\/assessment\//;
const isApplicationResult = (path) => /^\/api\/applications\/[^/]+\/result$/.test(path);
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Wait until [data-testid=assessment-state] leaves the states in `whileIn`. Returns
 * { state, timedOut }: the first state outside `whileIn`, or the current one at the bound.
 */
async function waitAssessmentState(page, whileIn, timeout) {
  try {
    const handle = await page.waitForFunction((waiting) => {
      const el = document.querySelector('[data-testid="assessment-state"]');
      const s = el ? el.getAttribute('data-state') : null;
      return s !== null && !waiting.includes(s) ? s : false;
    }, whileIn, { timeout: Math.max(1, timeout), polling: 250 });
    return { state: await handle.jsonValue(), timedOut: false };
  } catch (err) {
    if (err?.name !== 'TimeoutError') throw err;
    const state = await page.getByTestId('assessment-state').getAttribute('data-state').catch(() => null);
    return { state, timedOut: true };
  }
}

const remainingMs = async (timer) => Number(await timer.getAttribute('data-remaining-ms'));

/** Answer one question as the script's rule says; returns { qid, type, value } once the page saved it. */
async function answerQuestion(page, question) {
  const qid = await question.getAttribute('data-question-id');
  const type = await question.getAttribute('data-type');
  const saved = (action) => actAndWait(page, 'PUT', /^\/api\/assessment\/[^/]+\/answers$/, action);
  if (type === 'mcq') {
    const option = question.getByTestId('assessment-option').first();
    const label = await option.getAttribute('data-label');
    const { status } = await saved(() => option.click());
    expect(status, `saving the answer to ${qid}`).toBe(200);
    await expect(option).toHaveAttribute('data-selected', 'true');
    return { qid, type, value: label };
  }
  if (type === 'short_answer') {
    const box = question.getByTestId('assessment-short-answer');
    const { status } = await saved(() => box.fill(TEXT_ANSWER));
    expect(status, `saving the answer to ${qid}`).toBe(200);
    return { qid, type, value: TEXT_ANSWER };
  }
  throw new Error(`question ${qid} has type "${type}", which the page cannot answer`);
}

test('demo spine: recruiter and candidate, through the browser', async ({ browser }, testInfo) => {
  test.setTimeout(10 * 60_000 + POOL_WAIT_MS + GRADING_WAIT_MS);

  const title = `[E2E ${new Date().toISOString().replace(/\.\d{3}Z$/, 'Z')}]`;
  const resumePath = demoResumePath();
  const timings = [];
  const step = (name, fn) => test.step(name, async () => {
    const t0 = Date.now();
    try {
      return await fn();
    } finally {
      const line = `${name}: ${((Date.now() - t0) / 1000).toFixed(1)} s`;
      timings.push(line);
      console.log(`e2e step ${line}`);
    }
  });
  // Debug only: E2E_SPINE_UNTIL=<n> stops after step n by FAILING the test (never a pass), so the
  // early steps can be developed without spending the LLM generation that apply triggers.
  const until = Number(process.env.E2E_SPINE_UNTIL) || 0;
  const stopAfter = (n) => {
    if (until && n >= until) throw new Error(`E2E_SPINE_UNTIL=${until}: stopped after step ${n} on purpose (debug run, not a pass)`);
  };
  const note = (line) => {
    timings.push(line);
    console.log(`e2e ${line}`);
  };

  const rec = await newRoleContext(browser, 'recruiter');
  const cand = await newRoleContext(browser, 'candidate');
  // Every API response the candidate's browser receives, for step 6's answer-key scan.
  const candResponses = recordApiResponses(cand.context);
  const ids = {};
  let assessmentResultHtml = '';

  try {
    await step('1 recruiter creates the job through CreateJob', async () => {
      const p = rec.page;
      await p.goto('/recruiter/jobs');
      await p.locator('a[href="/recruiter/create-job"]').first().click();
      await expect(p).toHaveURL(/\/recruiter\/create-job$/);

      await p.getByTestId('job-title-input').fill(title);
      await p.getByLabel('Location', { exact: true }).fill('Remote');
      await p.getByLabel('Experience Level', { exact: true }).selectOption('2-5 years');
      await p.getByRole('button', { name: 'Next Step' }).click();

      for (const skill of JOB_SKILLS) await p.getByRole('button', { name: skill, exact: true }).click();
      await expect(p.getByText(`${JOB_SKILLS.length} selected`, { exact: true })).toBeVisible();
      await p.getByRole('button', { name: 'Next Step' }).click();

      await p.getByLabel('Job Description', { exact: true }).fill(JOB_DESCRIPTION);
      const { status, body } = await actAndWait(p, 'POST', /^\/api\/jobs$/, () => p.getByTestId('job-submit').click());
      expect(status, `POST /api/jobs answered ${status}: ${body?.message || ''}`).toBe(201);
      expect(body?.id, 'the created job has an id').toBeTruthy();
      ids.jobId = body.id;
      recordLeftover('jobs', ids.jobId, title);
      expect(body.title).toBe(title);

      await expect(p).toHaveURL(/\/recruiter\/jobs$/);
      await expect(p.getByText(title, { exact: true })).toBeVisible();
    });

    stopAfter(1);
    await step('2 candidate uploads the demo resume and sees parsed skills', async () => {
      const p = cand.page;
      await p.goto('/candidate/upload');
      await chooseResumeFile(p, resumePath);
      const { status, body } = await actAndWait(
        p, 'POST', /^\/api\/resume\/upload$/,
        () => p.getByTestId('resume-upload-button').click(),
        { timeout: UPLOAD_WAIT_MS },
      );
      expect(status, `resume upload answered ${status} ${body?.error || ''}: ${body?.message || ''}`).toBe(201);
      if (body?.parsed?.resumeId) {
        recordLeftover('resumes', body.parsed.resumeId, 'the candidate resume row this upload saved (the stored file replaced the account resume)');
      }
      const skills = Array.isArray(body?.parsed?.skills) ? body.parsed.skills : [];
      expect(skills.length, 'the parser found at least one skill').toBeGreaterThan(0);

      await expect(p.getByTestId('resume-parsed')).toBeVisible();
      const shown = await p.getByTestId('parsed-skills').locator('div.flex-wrap > span').allInnerTexts();
      expect(shown.map((s) => s.trim()).sort(), 'the page shows exactly the skills the upload response carried')
        .toEqual([...skills].map(String).sort());
    });

    stopAfter(2);
    await step('3 candidate applies and sees the score, the row in My applications and its Result', async () => {
      const p = cand.page;
      await p.goto('/candidate/jobs');
      const card = p.locator('div.card').filter({ has: p.getByRole('heading', { name: title, exact: true }) });
      await expect(card, 'the new job is listed once').toHaveCount(1);
      await card.getByRole('link', { name: 'View job' }).click();
      await expect(p.getByRole('heading', { level: 1, name: title, exact: true })).toBeVisible();

      const apply = p.getByTestId('apply-button');
      await expect(apply).toBeEnabled();
      const mark = candResponses.entries.length;
      const { status, body } = await actAndWait(p, 'POST', new RegExp(`^/api/jobs/${ids.jobId}/apply$`), () => apply.click(), { timeout: APPLY_WAIT_MS });
      expect(status, `apply answered ${status}: ${body?.message || ''}`).toBe(201);
      expect(body?.id, 'the application has an id').toBeTruthy();
      ids.applicationId = body.id;
      recordLeftover('applications', ids.applicationId, `candidate application to ${title}`);
      expect(body.scoring?.status, `apply scored the application (reason: ${body.scoring?.reason ?? 'none given'})`).toBe('scored');

      // The page reads the application back after a scored apply; compare with that response.
      const scoredBox = p.getByTestId('application-score');
      await expect(scoredBox).toHaveAttribute('data-state', 'scored');
      const composite = p.getByTestId('application-composite');
      await expect(composite).toBeVisible();
      await candResponses.settle();
      const readBack = candResponses.entries.slice(mark)
        .filter((e) => e.method === 'GET' && e.path === '/api/jobs/my-applications' && Array.isArray(e.body))
        .map((e) => e.body.find((r) => r.id === ids.applicationId))
        .filter(Boolean)
        .pop();
      expect(readBack?.score, 'the page read the scored application back').toBeTruthy();
      const shownAfterApply = numberIn(await composite.innerText());
      expectScore(shownAfterApply, 'composite after apply');
      expect(shownAfterApply, 'composite after apply equals the response').toBe(readBack.score.composite);

      // My applications
      const { body: apps } = await actAndWait(p, 'GET', /^\/api\/jobs\/my-applications$/,
        () => p.getByRole('link', { name: 'My applications', exact: true }).first().click());
      const appRow = apps.find((r) => r.id === ids.applicationId);
      expect(appRow, 'My applications lists the new application').toBeTruthy();
      const row = p.getByTestId(`application-row-${ids.applicationId}`);
      await expect(row).toBeVisible();
      await expect(row.getByTestId('status-badge')).toHaveAttribute('data-status', 'submitted');
      await expect(row.getByTestId('application-score')).toHaveAttribute('data-state', 'scored');
      const rowComposite = numberIn(await row.getByTestId('application-composite').innerText());
      expectScore(rowComposite, 'My applications composite');
      expect(rowComposite, 'My applications composite equals the response').toBe(appRow.score.composite);

      // Its Result page: composite and band.
      const { status: rs, body: result } = await actAndWait(p, 'GET', new RegExp(`^/api/applications/${ids.applicationId}/result$`),
        () => row.getByTestId('application-result-link').click());
      expect(rs, 'the result loads').toBe(200);
      expect(result?.score, 'the result carries a score').toBeTruthy();
      const ring = p.locator('[data-testid="application-score"][data-state="scored"]');
      await expect(ring).toBeVisible();
      const ringValue = numberIn(await ring.innerText());
      expectScore(ringValue, 'Result composite');
      expect(ringValue, 'Result composite equals the response').toBe(Number(result.score.credibilityScore));
      expect(Object.keys(BAND_LABELS), 'the response band is a known band').toContain(result.score.band);
      const band = p.locator('[title^="Score band"]').first();
      await expect(band).toHaveText(BAND_LABELS[result.score.band]);
      ids.step3Composite = ringValue;
    });

    stopAfter(3);
    await step('4 recruiter sees the scored application, opens the drill-down and shortlists; the candidate is notified', async () => {
      const p = rec.page;
      const { status, body: list } = await actAndWait(p, 'GET', /^\/api\/recruiter\/applications$/, () => p.goto('/recruiter/applications'));
      expect(status, 'the applications list loads').toBe(200);
      const item = list.find((i) => i.id === ids.applicationId);
      expect(item?.score, 'the list carries the application with a score').toBeTruthy();

      const row = p.getByTestId(`application-row-${ids.applicationId}`);
      await expect(row).toBeVisible();
      await expect(row).toHaveAttribute('data-scoring', 'scored');
      await expect(row).toHaveAttribute('data-status', 'submitted');
      const rowScore = row.getByTestId('application-score');
      await expect(rowScore).toHaveAttribute('data-state', 'scored');
      const rowComposite = numberIn(await rowScore.locator('span').first().innerText());
      expectScore(rowComposite, 'recruiter row composite');
      expect(rowComposite, 'recruiter row composite equals the response').toBe(item.score.composite);
      expect(rowComposite, 'the recruiter sees the composite the candidate saw').toBe(ids.step3Composite);

      const { status: ds, body: detail } = await actAndWait(p, 'GET', new RegExp(`^/api/recruiter/applications/${ids.applicationId}$`),
        () => row.getByTestId('open-drilldown').click());
      expect(ds, 'the drill-down loads').toBe(200);
      const drill = p.getByTestId('drilldown');
      await expect(drill).toHaveAttribute('data-state', 'ready');
      const view = await checkDrilldown(drill, detail, 'step 4');
      expect(view.composite).toBe(rowComposite);
      expect(view.available.assessment_results, 'no assessment sub-score before the assessment').toBe(false);
      ids.firstScoreId = detail.score.id;
      note(`step 4 sub-scores available: ${JSON.stringify(view.available)}`);

      await drill.getByTestId('drilldown-close').click();
      await expect(drill).toHaveCount(0);
      const { status: ss, body: sl } = await actAndWait(p, 'POST', /^\/api\/jobs\/applications\/shortlist$/,
        () => row.getByTestId('shortlist-button').click());
      expect(ss, `shortlist answered ${ss}: ${sl?.message || ''}`).toBe(200);
      expect(sl.status).toBe('shortlisted');
      expect(sl.notified, 'the server saved the candidate notification').toBe(true);
      await expect(row).toHaveAttribute('data-status', 'shortlisted');
      await expect(row.getByTestId('status-badge')).toHaveAttribute('data-status', 'shortlisted');
      await expect(row.getByTestId('shortlist-button')).toBeDisabled();

      const c = cand.page;
      const { body: inbox } = await actAndWait(c, 'GET', /^\/api\/notifications$/, () => c.goto('/candidate/notifications'));
      const notifications = Array.isArray(inbox?.notifications) ? inbox.notifications : [];
      const mine = notifications.find((n) => n.type === 'shortlisted' && String(n.message || '').includes(title));
      expect(mine, 'the candidate has a shortlist notification for this job').toBeTruthy();
      recordLeftover('notifications', mine.id, `shortlist notification for ${title}`);
      await expect(c.getByText(mine.message, { exact: true })).toBeVisible();
    });

    stopAfter(4);
    await step('5 candidate takes the assessment (preparing -> ready, start, reload mid-way, submit)', async () => {
      const p = cand.page;
      const { body: apps } = await actAndWait(p, 'GET', /^\/api\/jobs\/my-applications$/, () => p.goto('/candidate/dashboard'));
      expect(apps.find((r) => r.id === ids.applicationId)?.status).toBe('shortlisted');
      const row = p.getByTestId(`application-row-${ids.applicationId}`);
      await expect(row.getByTestId('status-badge')).toHaveAttribute('data-status', 'shortlisted');

      const mark = candResponses.entries.length;
      await row.getByTestId('assessment-link').click();
      await expect(p).toHaveURL(new RegExp(`/candidate/assessment\\?jobId=${escapeRe(ids.jobId)}$`));
      // The dashboard rows carry assessment-state too; wait until the assessment page replaced them.
      await expect(p.getByRole('heading', { name: 'Skill assessment', exact: true })).toBeVisible();
      await expect(p.getByTestId('assessment-state')).toHaveCount(1);

      // preparing -> ready, bounded.
      const t0 = Date.now();
      const first = await waitAssessmentState(p, ['loading'], 30_000);
      expect(first.timedOut, 'the assessment page left its loading state').toBe(false);
      expect(['preparing', 'unavailable', 'ready'], `first assessment state "${first.state}"`).toContain(first.state);
      let ready = first;
      if (first.state !== 'ready') ready = await waitAssessmentState(p, ['preparing', 'unavailable'], POOL_WAIT_MS - (Date.now() - t0));
      await candResponses.settle();
      const statusBodies = candResponses.entries.slice(mark)
        .filter((e) => e.method === 'GET' && e.path === '/api/assessment/status' && e.body && typeof e.body === 'object')
        .map((e) => e.body);
      const seen = statusBodies.map((b) => b.state).filter((s, i, a) => i === 0 || s !== a[i - 1]);
      const lastBody = statusBodies[statusBodies.length - 1] || {};
      if (ready.timedOut) {
        providerFailure(testInfo,
          `the assessment pool was not ready within ${POOL_WAIT_MS / 1000} s; the page still read "${ready.state}".`,
          `States seen: ${seen.join(' -> ') || 'none'}.${lastBody.reason ? ` Last reason from the server: ${lastBody.reason}.` : ''}`);
      }
      expect(ready.state, `the assessment went from ${seen.join(' -> ')} to a state other than ready`).toBe('ready');
      note(`preparing -> ready: ${((Date.now() - t0) / 1000).toFixed(1)} s after opening the page (states seen: ${seen.join(' -> ')})`);

      // Start.
      const { status: st, body: started } = await actAndWait(p, 'POST', /^\/api\/assessment\/start$/,
        () => p.getByTestId('assessment-start').click(), { timeout: 60_000 });
      expect(st, `start answered ${st} (state ${started?.state}): ${started?.message || ''}`).toBe(200);
      expect(started?.assessmentId, 'the attempt has an id').toBeTruthy();
      ids.assessmentId = started.assessmentId;
      recordLeftover('assessments', ids.assessmentId, `attempt for ${title}; its assessment_keys row has the same assessment_id`);
      const n = Array.isArray(started.questions) ? started.questions.length : 0;
      expect(n, 'the attempt has questions').toBeGreaterThan(0);
      const typeCounts = started.questions.reduce((m, q) => ({ ...m, [q.question_type]: (m[q.question_type] || 0) + 1 }), {});
      note(`attempt has ${n} questions ${JSON.stringify(typeCounts)}`);

      await expect(p.getByTestId('assessment-state')).toHaveAttribute('data-state', 'in_progress');
      const questions = p.getByTestId('assessment-question');
      await expect(questions).toHaveCount(n);
      const timer = p.getByTestId('assessment-timer');
      const save = p.getByTestId('assessment-save-indicator');
      await expect.poll(() => remainingMs(timer), { message: 'the clock shows time remaining' }).toBeGreaterThan(0);

      // First half, then a reload.
      const half = Math.ceil(n / 2);
      const answered = new Map();
      for (let i = 0; i < half; i += 1) {
        const a = await answerQuestion(p, questions.nth(i));
        answered.set(a.qid, a);
      }
      await expect(save).toHaveAttribute('data-save-state', 'saved');
      const beforeReload = await remainingMs(timer);
      expect(beforeReload).toBeGreaterThan(0);

      await p.reload();
      await expect(p.getByTestId('assessment-state')).toHaveAttribute('data-state', 'in_progress');
      await expect(questions).toHaveCount(n);
      await expect(save).toHaveAttribute('data-save-state', 'saved');
      await expect(save).toHaveText('Your saved answers were restored.');
      for (let i = 0; i < n; i += 1) {
        const q = questions.nth(i);
        const qid = await q.getAttribute('data-question-id');
        const type = await q.getAttribute('data-type');
        const a = answered.get(qid);
        if (type === 'mcq') {
          const selected = q.locator('[data-testid="assessment-option"][data-selected="true"]');
          if (a) {
            await expect(selected, `restored choice for ${qid}`).toHaveCount(1);
            await expect(selected).toHaveAttribute('data-label', a.value);
          } else {
            await expect(selected, `no choice yet for ${qid}`).toHaveCount(0);
          }
        } else {
          await expect(q.getByTestId('assessment-short-answer'), `restored text for ${qid}`).toHaveValue(a ? a.value : '');
        }
      }
      const afterReload = await remainingMs(timer);
      expect(afterReload, 'the clock still has time left after the reload').toBeGreaterThan(0);
      expect(afterReload, 'the reload did not reset the clock').toBeLessThanOrEqual(beforeReload + 2000);
      await expect.poll(() => remainingMs(timer), { message: 'the clock is still running after the reload' }).toBeLessThan(afterReload);

      // The rest, then submit.
      for (let i = half; i < n; i += 1) {
        const a = await answerQuestion(p, questions.nth(i));
        answered.set(a.qid, a);
      }
      await expect(save).toHaveAttribute('data-save-state', 'saved');
      const submit = p.getByTestId('assessment-submit');
      await expect(submit).toHaveText(new RegExp(`Submit \\(${n}/${n}\\)`));

      const tg = Date.now();
      let evaluate;
      try {
        evaluate = await actAndWait(p, 'POST', /^\/api\/assessment\/evaluate$/, () => submit.click(), { timeout: GRADING_WAIT_MS });
      } catch (err) {
        if (err?.name !== 'TimeoutError') throw err;
        providerFailure(testInfo, `grading did not answer within ${GRADING_WAIT_MS / 1000} s of Submit; the evaluate request was still running.`);
      }
      const { status: es, body: graded } = evaluate;
      let resultBody = null;
      if (es === 200) {
        resultBody = graded;
        await expect(p.getByTestId('assessment-state')).toHaveAttribute('data-state', 'completed');
      } else if (graded?.state === 'grading_pending') {
        note(`evaluate answered ${es} ${graded.error || ''}${graded.reason ? ` (${graded.reason})` : ''}; waiting for grading`);
        const done = await waitAssessmentState(p, ['grading_pending', 'in_progress'], GRADING_WAIT_MS - (Date.now() - tg));
        if (done.timedOut && done.state === 'grading_pending') {
          providerFailure(testInfo,
            `grading was still pending ${GRADING_WAIT_MS / 1000} s after Submit.`,
            `Evaluate answered ${es} ${graded.error || ''}${graded.reason ? ` (reason: ${graded.reason})` : ''}.`);
        }
        expect(done.state, 'grading ended in completed').toBe('completed');
        await candResponses.settle();
        resultBody = candResponses.entries.filter((e) => e.path === '/api/assessment/status' && e.body?.state === 'completed')
          .map((e) => e.body.result).filter(Boolean).pop() || null;
      } else {
        expect(es, `evaluate answered ${es} ${graded?.error || ''}: ${graded?.message || ''}`).toBe(200);
      }
      note(`grading: ${((Date.now() - tg) / 1000).toFixed(1)} s from Submit to the result`);

      const resultView = p.getByTestId('assessment-result');
      await expect(resultView).toBeVisible();
      expect(resultBody, 'the page received the graded result').toBeTruthy();
      const score = Number(resultBody.score);
      expectScore(score, 'assessment score');
      await expect(resultView).toContainText(`${Math.round(score * 100) / 100}%`);
      await expect(resultView.locator('[data-outcome]')).toHaveCount(n);
      if (resultBody.scoring) note(`re-scoring after grading: ${resultBody.scoring.status}${resultBody.scoring.reason ? ` (${resultBody.scoring.reason})` : ''}`);
      assessmentResultHtml = await p.content();
    });

    stopAfter(5);
    await step('6 no answer-key material reaches the candidate', async () => {
      const p = cand.page;
      await actAndWait(p, 'GET', /^\/api\/jobs\/my-applications$/, () => p.goto('/candidate/dashboard'));
      const row = p.getByTestId(`application-row-${ids.applicationId}`);
      await expect(row.getByTestId('assessment-state')).toHaveAttribute('data-state', 'completed');
      const { status, body: result } = await actAndWait(p, 'GET', new RegExp(`^/api/applications/${ids.applicationId}/result$`),
        () => row.getByTestId('application-result-link').click());
      expect(status).toBe(200);
      const ring = p.locator('[data-testid="application-score"][data-state="scored"]');
      await expect(ring).toBeVisible();
      const ringValue = numberIn(await ring.innerText());
      expectScore(ringValue, 'Result composite after the assessment');
      expect(ringValue, 'Result composite equals the response').toBe(Number(result.score.credibilityScore));
      const resultPageHtml = await p.content();

      await candResponses.settle();
      const assessmentEntries = candResponses.entries.filter((e) => ASSESSMENT_PATH.test(e.path));
      expect(assessmentEntries.length, 'the candidate page received assessment responses').toBeGreaterThan(0);
      const unread = candResponses.entries
        .filter((e) => (ASSESSMENT_PATH.test(e.path) || isApplicationResult(e.path)) && e.bodyError)
        .map((e) => `${e.method} ${e.path} (${e.status}): ${e.bodyError}`);
      expect(unread, 'every assessment and result response body could be read (an unread body cannot be called clean)').toEqual([]);
      const hits = candResponses.entries.flatMap((e) => findFieldNames(e.body).map((where) => `${e.method} ${e.path} ${where}`));
      expect(hits, `no candidate response carries ${ANSWER_KEY_FIELDS.join(', ')}`).toEqual([]);
      for (const field of ANSWER_KEY_FIELDS) {
        expect(assessmentResultHtml, `the assessment result page does not contain "${field}"`).not.toContain(field);
        expect(resultPageHtml, `the Result page does not contain "${field}"`).not.toContain(field);
      }
      note(`answer-key scan: ${candResponses.entries.length} candidate responses (${assessmentEntries.length} assessment) checked`);
    });

    stopAfter(6);
    await step('7 recruiter reloads the drill-down: a new composite with the assessment sub-score', async () => {
      const p = rec.page;
      const { body: list } = await actAndWait(p, 'GET', /^\/api\/recruiter\/applications$/, () => p.reload());
      const item = list.find((i) => i.id === ids.applicationId);
      expect(item?.score, 'the list carries the application with a score').toBeTruthy();
      const row = p.getByTestId(`application-row-${ids.applicationId}`);
      await expect(row).toHaveAttribute('data-status', 'shortlisted');
      await expect(row.getByTestId('assessment-state')).toHaveAttribute('data-state', 'completed');
      const rowComposite = numberIn(await row.getByTestId('application-score').locator('span').first().innerText());
      expectScore(rowComposite, 'recruiter row composite after the assessment');
      expect(rowComposite).toBe(item.score.composite);

      const { status, body: detail } = await actAndWait(p, 'GET', new RegExp(`^/api/recruiter/applications/${ids.applicationId}$`),
        () => row.getByTestId('open-drilldown').click());
      expect(status).toBe(200);
      const drill = p.getByTestId('drilldown');
      await expect(drill).toHaveAttribute('data-state', 'ready');
      for (const h of Array.isArray(detail.score_history) ? detail.score_history : []) {
        recordLeftover('scores', h.id, `score row for ${title} (composite ${h.composite})`);
      }
      const view = await checkDrilldown(drill, detail, 'step 7');
      expect(view.composite).toBe(rowComposite);
      expect(detail.score.id, 'a new score row after the assessment').not.toBe(ids.firstScoreId);
      expect(view.available.assessment_results, 'the assessment sub-score is available').toBe(true);
      if (view.available.github_evidence) {
        expect(Object.values(view.available).every(Boolean), 'GitHub answered, so all three sub-scores are available').toBe(true);
      }
      await expect(drill.getByTestId('drilldown-assessment-state')).toHaveAttribute('data-state', 'completed');
      note(`step 7 sub-scores available: ${JSON.stringify(view.available)}; weights ${JSON.stringify(view.weights)}`);
    });
  } finally {
    testInfo.annotations.push({ type: 'step-timings', description: timings.join(' | ') });
  }

  // On success only: on a failure the contexts stay open so the failure screenshot and trace
  // capture their pages.
  candResponses.stop();
  await rec.context.close();
  await cand.context.close();
});
