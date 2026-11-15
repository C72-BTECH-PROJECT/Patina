import '@testing-library/jest-dom';
import { render, screen, within } from '@testing-library/react';
import Landing from './Landing';
import { loadLandingSample, validateLandingSample } from '../../data/loadLandingSample';

// Jest 27 (react-scripts 5) cannot resolve react-router-dom 7's package exports, so Link is a
// stand-in (same approach as Login.test.jsx).
jest.mock('react-router-dom', () => ({
  // eslint-disable-next-line jsx-a11y/anchor-has-content
  Link: ({ to, children, ...rest }) => <a href={to} {...rest}>{children}</a>,
}), { virtual: true });

// The optional-file loader is replaced; its helpers stay real. The sample objects below are
// SYNTHETIC test inputs (made up here to exercise rendering). They are never shipped or shown
// in the app; the real card only ever renders data/landingSample.json captured from a scores row.
jest.mock('../../data/loadLandingSample', () => ({
  ...jest.requireActual('../../data/loadLandingSample'),
  loadLandingSample: jest.fn(),
}));

const SYNTHETIC = {
  composite: 61.5,
  band: 'medium',
  verification: 'partly_verified',
  factors: [
    { key: 'f_a', label: 'Factor A', available: true, direction: 'raises', value: 71, weight: 0.4, weight_pct: 40, contribution: 28.4 },
    { key: 'f_b', label: 'Factor B', available: true, direction: 'lowers', value: 33, weight: 0.35, weight_pct: 35, contribution: 11.55 },
    { key: 'f_c', label: 'Factor C', available: false, direction: 'unavailable', value: null, weight: 0, weight_pct: 0, contribution: 0 },
  ],
  skills: [
    { skill: 'Skill 1', status: 'evidenced' },
    { skill: 'Skill 2', status: 'claimed_only' },
    { skill: 'Skill 3', status: 'not_found' },
    { skill: 'Skill 4', status: 'evidenced' },
    { skill: 'Skill 5', status: 'claimed_only' },
    { skill: 'Skill 6', status: 'evidenced' },
  ],
  weights_version: 'test-v0',
  generated_at: '2026-03-04T10:00:00.000Z',
  job_title: 'Synthetic Job',
  provenance: { captured_from: 'test', captured_at: '2026-03-05T10:00:00.000Z', fixture: 'synthetic.pdf' },
};

const renderLanding = (sample) => {
  loadLandingSample.mockReturnValue(sample);
  return render(<Landing />);
};

describe('Landing without a sample file', () => {
  test('renders ScoreInputsPanel and no sample card, ring or score figure', () => {
    renderLanding(null);
    expect(screen.getByTestId('score-inputs-panel')).toBeInTheDocument();
    expect(screen.queryByTestId('landing-sample')).not.toBeInTheDocument();
    expect(screen.queryByTestId('landing-sample-score')).not.toBeInTheDocument();
    expect(screen.queryByText('A real stored score')).not.toBeInTheDocument();
    expect(screen.queryByText(/Captured from a real scoring run/)).not.toBeInTheDocument();
    // No number-with-/100 anywhere on the page.
    expect(document.body.textContent).not.toMatch(/\d\s*\/\s*100/);
  });

  test('the rest of the page is intact: nav, how it works, mid-page CTA, footer', () => {
    renderLanding(null);
    expect(screen.getAllByText('Get Started').length).toBeGreaterThanOrEqual(3);
    expect(screen.getByText('Three Steps to a Score')).toBeInTheDocument();
    expect(screen.getByTestId('landing-mid-cta')).toHaveAttribute('href', '/select-role');
    expect(screen.getByText(/© 2026 PATINA/)).toBeInTheDocument();
  });
});

describe('Landing with a (mocked, synthetic) sample', () => {
  test('shows exactly the sample composite, band, verification, factor rows, skill rows and caption', () => {
    renderLanding(SYNTHETIC);
    const card = screen.getByTestId('landing-sample');
    expect(screen.queryByTestId('score-inputs-panel')).not.toBeInTheDocument();
    expect(within(card).getByText('A real stored score')).toBeInTheDocument();
    expect(screen.getByTestId('landing-sample-score')).toHaveTextContent('61.5');
    expect(within(card).getByText('Medium')).toBeInTheDocument();
    expect(within(card).getByTestId('verification-badge')).toHaveAttribute('data-verification', 'partly_verified');

    const factors = within(card).getAllByTestId('landing-sample-factor');
    expect(factors).toHaveLength(3);
    expect(factors[0]).toHaveTextContent('Factor A');
    expect(factors[0]).toHaveTextContent('71/100');
    expect(factors[0]).toHaveTextContent('0.4 (40%)');
    expect(factors[0]).toHaveTextContent('28.4');
    expect(factors[1]).toHaveAttribute('data-direction', 'lowers');
    // An unavailable factor shows dashes, never a zero.
    expect(factors[2]).toHaveTextContent('—');
    expect(factors[2]).not.toHaveTextContent('0/100');

    const skills = within(card).getAllByTestId('landing-sample-skill');
    expect(skills).toHaveLength(6);
    expect(skills[0]).toHaveTextContent('Skill 1');
    expect(skills[0]).toHaveTextContent('Evidenced');
    expect(skills[1]).toHaveTextContent('Claimed only');
    expect(skills[2]).toHaveTextContent('Not found');

    expect(screen.getByTestId('landing-sample-caption').textContent).toBe(
      'Captured from a real scoring run on 4 March 2026 (synthetic.pdf, Synthetic Job). Nothing on this card was typed by hand.',
    );
  });

  test('shows at most 6 skill rows', () => {
    renderLanding({
      ...SYNTHETIC,
      skills: [...SYNTHETIC.skills, { skill: 'Skill 7', status: 'evidenced' }, { skill: 'Skill 8', status: 'not_found' }],
    });
    expect(screen.getAllByTestId('landing-sample-skill')).toHaveLength(6);
    expect(screen.queryByText('Skill 7')).not.toBeInTheDocument();
  });

  test('with no fixture the caption holds the job only', () => {
    renderLanding({ ...SYNTHETIC, provenance: { ...SYNTHETIC.provenance, fixture: null } });
    expect(screen.getByTestId('landing-sample-caption').textContent).toBe(
      'Captured from a real scoring run on 4 March 2026 (Synthetic Job). Nothing on this card was typed by hand.',
    );
  });
});

describe('Landing with a malformed sample file', () => {
  // The page is given what the real loader gives for a malformed file: the real validator's result.
  test.each([
    ['composite typed as a string', { ...SYNTHETIC, composite: '61.5' }],
    ['a factor missing its sub-score', { ...SYNTHETIC, factors: [{ ...SYNTHETIC.factors[0], value: undefined }] }],
    ['an unknown skill status', { ...SYNTHETIC, skills: [{ skill: 'S', status: 'matched' }] }],
    ['no provenance', { ...SYNTHETIC, provenance: undefined }],
  ])('renders no sample card and no figures: %s', (_name, malformed) => {
    renderLanding(validateLandingSample(malformed));
    expect(screen.queryByTestId('landing-sample')).not.toBeInTheDocument();
    expect(screen.queryByTestId('landing-sample-score')).not.toBeInTheDocument();
    expect(screen.getByTestId('score-inputs-panel')).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/\d\s*\/\s*100/);
  });
});

describe('Landing page, framer-motion-free hero and how-it-works', () => {
  test('the connecting line is an aria-hidden svg hidden below md, and sets data-inview', () => {
    renderLanding(null);
    const line = screen.getByTestId('how-it-works-line');
    expect(line).toHaveAttribute('aria-hidden', 'true');
    expect(line.getAttribute('class')).toMatch(/\bhidden\b/);
    expect(line.getAttribute('class')).toMatch(/md:block/);
    // jest has no IntersectionObserver: the section is treated as already in view.
    expect(line.closest('section')).toHaveAttribute('data-inview', 'true');
  });
});
