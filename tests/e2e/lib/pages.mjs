// R-19: small page helpers shared by the specs. Everything goes through what a user can see and
// click; selectors are the data-testids in frontend/src (grep "data-testid"), then roles/labels.
import { expect } from '@playwright/test';

// The three sub-scores (frontend/src/components/recruiter/applicationsLogic.js SUBSCORES).
export const SUBSCORES = Object.freeze([
  { key: 'parsing_semantic_alignment', testId: 'subscore-parsing' },
  { key: 'github_evidence', testId: 'subscore-github' },
  { key: 'assessment_results', testId: 'subscore-assessment' },
]);

// ScoreBadge.jsx: the label shown for each band the backend sends.
export const BAND_LABELS = Object.freeze({ high: 'High', medium: 'Medium', low: 'Low' });

/** A score shown on a page is a number from 0 to 100. */
export function expectScore(value, what) {
  expect(Number.isFinite(value), `${what}: "${value}" is a number`).toBe(true);
  expect(value, `${what}: at least 0`).toBeGreaterThanOrEqual(0);
  expect(value, `${what}: at most 100`).toBeLessThanOrEqual(100);
}

/** The number in a text such as "72.5" or "72.5/100"; NaN when there is none. */
export const numberIn = (text) => {
  const m = String(text ?? '').trim().match(/^-?\d+(\.\d+)?/);
  return m ? Number(m[0]) : NaN;
};

/**
 * On /candidate/upload (Upload.jsx): open the picker ("Replace" when a resume is on file) and
 * choose `filePath` through the page's own "Browse files" button and the browser's file chooser.
 */
export async function chooseResumeFile(page, filePath) {
  const replace = page.getByRole('button', { name: 'Replace', exact: true });
  const browse = page.getByRole('button', { name: 'Browse files', exact: true });
  // While the resume status loads, neither button is shown.
  await expect(replace.or(browse)).toBeVisible();
  if (await replace.isVisible()) await replace.click();
  await expect(browse).toBeVisible();
  const [chooser] = await Promise.all([page.waitForEvent('filechooser'), browse.click()]);
  await chooser.setFiles(filePath);
  await expect(page.getByTestId('resume-upload-button')).toBeEnabled();
}

/**
 * Read the recruiter drill-down (CandidateModal.jsx, scoped to [data-testid=drilldown]) and check
 * its invariants against `detail`, the GET /api/recruiter/applications/:id body the page itself
 * received:
 *   - the composite is a number from 0 to 100 and equals the response's;
 *   - every weight shown equals the response's, and they sum to 1 within 0.001;
 *   - each sub-score's availability equals the response's; an available one shows a value from
 *     0 to 100 equal to the response's and has a weight above 0; an unavailable one shows no
 *     value and has weight 0.
 * Returns { composite, weights: {key: n}, available: {key: bool} }.
 */
export async function checkDrilldown(drill, detail, label) {
  expect(detail?.score, `${label}: the drill-down response carries a score`).toBeTruthy();
  const compositeEl = drill.getByTestId('drilldown-composite');
  await expect(compositeEl).toHaveAttribute('data-state', 'scored');
  const composite = Number(await compositeEl.getAttribute('data-value'));
  expectScore(composite, `${label}: drill-down composite`);
  expect(composite, `${label}: drill-down composite equals the response`).toBe(Number(detail.score.composite));
  const compositeText = numberIn(await compositeEl.locator('span').first().innerText());
  expect(compositeText, `${label}: the composite text equals its value`).toBe(composite);

  const factors = Array.isArray(detail.explanation?.factors) ? detail.explanation.factors : null;
  const weights = {};
  const available = {};
  for (const { key, testId } of SUBSCORES) {
    const weightText = (await drill.getByTestId(`weight-${key}`).locator('td').nth(1).innerText()).trim();
    const weight = Number(weightText);
    expect(Number.isFinite(weight), `${label}: weight of ${key} is a number (page shows "${weightText}")`).toBe(true);
    expect(weight, `${label}: weight of ${key} equals the response`).toBe(Number(detail.weights?.[key]));
    weights[key] = weight;

    const sub = drill.getByTestId(testId);
    await expect(sub, `${label}: one ${testId} in the drill-down`).toHaveCount(1);
    const shownAvailable = (await sub.getAttribute('data-available')) === 'true';
    const factor = factors ? factors.find((f) => f.key === key) : null;
    const responseSub = factor || detail.score.subscores?.[key] || null;
    expect(shownAvailable, `${label}: ${key} availability equals the response`).toBe(responseSub?.available === true);
    available[key] = shownAvailable;

    const valueText = (await sub.getByTestId('subscore-value').innerText()).trim();
    if (shownAvailable) {
      const value = numberIn(valueText);
      expectScore(value, `${label}: ${key} sub-score`);
      expect(value, `${label}: ${key} sub-score equals the response`).toBe(Number(responseSub.value));
      expect(weight, `${label}: available ${key} has a weight above 0`).toBeGreaterThan(0);
    } else {
      expect(valueText, `${label}: unavailable ${key} shows no value`).toBe('—');
      expect(weight, `${label}: unavailable ${key} has weight 0`).toBe(0);
    }
  }
  const sum = Object.values(weights).reduce((a, b) => a + b, 0);
  expect(Math.abs(sum - 1), `${label}: weights ${JSON.stringify(weights)} sum to 1 within 0.001`).toBeLessThanOrEqual(0.001);
  return { composite, weights, available };
}
