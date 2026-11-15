import {
  loadLandingSample, sampleCaption, sampleDate, validateLandingSample,
} from './loadLandingSample';

// SYNTHETIC input built here to exercise the validator. It is not a stored score and is never
// rendered in the app.
const valid = () => ({
  composite: 50,
  band: 'low',
  verification: 'unverified',
  factors: [
    { key: 'k1', label: 'L1', available: true, direction: 'neutral', value: 10, weight: 0.5, weight_pct: 50, contribution: 5 },
    { key: 'k2', label: 'L2', available: false, direction: 'unavailable', value: null, weight: 0, weight_pct: 0, contribution: 0 },
  ],
  skills: [{ skill: 'S1', status: 'evidenced' }],
  weights_version: 'v-test',
  generated_at: '2026-03-04T10:00:00.000Z',
  job_title: 'J',
  provenance: { captured_from: 'test', captured_at: '2026-03-05T10:00:00.000Z', fixture: null },
});

describe('loadLandingSample', () => {
  test('with no landingSample.json (and under jest, where require.context does not exist) it returns null', () => {
    expect(loadLandingSample()).toBeNull();
  });
});

describe('validateLandingSample', () => {
  test('accepts a complete sample and returns it unchanged', () => {
    const s = valid();
    expect(validateLandingSample(s)).toBe(s);
  });

  test('rejects non-objects', () => {
    for (const v of [null, undefined, 5, 'x', [], true]) expect(validateLandingSample(v)).toBeNull();
  });

  test.each([
    ['missing composite', (s) => { delete s.composite; }],
    ['composite as a string', (s) => { s.composite = '50'; }],
    ['composite NaN', (s) => { s.composite = NaN; }],
    ['composite above 100', (s) => { s.composite = 101; }],
    ['missing band', (s) => { delete s.band; }],
    ['empty band', (s) => { s.band = ' '; }],
    ['missing verification', (s) => { delete s.verification; }],
    ['no factors', (s) => { s.factors = []; }],
    ['factors not an array', (s) => { s.factors = {}; }],
    ['available factor without a value', (s) => { delete s.factors[0].value; }],
    ['available factor with a string weight', (s) => { s.factors[0].weight = '0.5'; }],
    ['factor without a label', (s) => { delete s.factors[0].label; }],
    ['factor with a non-boolean available', (s) => { s.factors[0].available = 'yes'; }],
    ['skills missing', (s) => { delete s.skills; }],
    ['skill with an unknown status', (s) => { s.skills[0].status = 'matched'; }],
    ['skill without a name', (s) => { s.skills[0].skill = ''; }],
    ['missing weights_version', (s) => { delete s.weights_version; }],
    ['unparseable generated_at', (s) => { s.generated_at = 'not a date'; }],
    ['missing job_title', (s) => { delete s.job_title; }],
    ['missing provenance', (s) => { delete s.provenance; }],
    ['provenance fixture undefined', (s) => { delete s.provenance.fixture; }],
    ['provenance fixture a number', (s) => { s.provenance.fixture = 4; }],
    ['provenance captured_at invalid', (s) => { s.provenance.captured_at = 'nope'; }],
  ])('rejects: %s (returns null, nothing defaulted)', (_name, mutate) => {
    const s = valid();
    mutate(s);
    expect(validateLandingSample(s)).toBeNull();
  });

  test('an unavailable factor may carry null figures', () => {
    const s = valid();
    s.factors[1] = { key: 'k2', label: 'L2', available: false, direction: 'unavailable' };
    expect(validateLandingSample(s)).toBe(s);
  });
});

describe('caption', () => {
  test('date is the UTC calendar date of generated_at', () => {
    expect(sampleDate('2026-03-04T23:59:00.000Z')).toBe('4 March 2026');
  });

  test('uses the fixture and job, or the job alone when there is no fixture', () => {
    const s = valid();
    expect(sampleCaption(s)).toBe('Captured from a real scoring run on 4 March 2026 (J). Nothing on this card was typed by hand.');
    s.provenance.fixture = 'r.pdf';
    expect(sampleCaption(s)).toBe('Captured from a real scoring run on 4 March 2026 (r.pdf, J). Nothing on this card was typed by hand.');
  });
});
