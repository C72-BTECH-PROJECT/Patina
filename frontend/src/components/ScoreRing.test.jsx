import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import ScoreRing from './ScoreRing';
import { ScoreRing as FromResults } from '../pages/candidate/Results';

// Jest 27 cannot resolve react-router-dom 7's exports (see Login.test.jsx); Results.jsx imports it.
jest.mock('react-router-dom', () => ({
  Link: () => null,
  useParams: () => ({}),
}), { virtual: true });
jest.mock('../lib/api', () => ({ api: { get: jest.fn() } }));

// SYNTHETIC values, only to exercise the component.
describe('ScoreRing', () => {
  test('static: the final number and arc are there on the first render, with no stroke transition', () => {
    const { container } = render(<ScoreRing value={73} band="medium" static />);
    expect(screen.getByText('73', { selector: '[aria-hidden="true"]' })).toBeInTheDocument();
    expect(screen.getByTestId('landing-sample-score')).toHaveTextContent('73');
    const arc = container.querySelectorAll('circle')[1];
    const circumference = 2 * Math.PI * 52;
    expect(Number(arc.getAttribute('stroke-dashoffset'))).toBeCloseTo(circumference * 0.27, 3);
    expect(arc.getAttribute('style') || '').not.toMatch(/transition/);
  });

  test('default (Results page): keeps the application-score test span and starts the arc empty', () => {
    const { container } = render(<ScoreRing value={73} band="medium" />);
    expect(screen.getByTestId('application-score')).toHaveTextContent('73');
    const arc = container.querySelectorAll('circle')[1];
    expect(Number(arc.getAttribute('stroke-dashoffset'))).toBeCloseTo(2 * Math.PI * 52, 3);
    expect(arc.getAttribute('style')).toMatch(/transition/);
  });

  test('Results.jsx still exports ScoreRing', () => {
    expect(FromResults).toBe(ScoreRing);
  });
});
