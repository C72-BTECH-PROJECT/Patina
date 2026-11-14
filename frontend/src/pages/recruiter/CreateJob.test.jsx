// R-32 (MUST 6): the job form's skills come from a search over the parser's vocabulary,
// from suggestions found in the description (added only on a click), or are typed as
// custom skills, saved normalised. With nlp-engine down the input still takes typed skills
// and says suggestions are unavailable. The API is mocked; core's answers are tested in
// tests/backend/skills-api.test.mjs and the parser's in tests/nlp/test_r32_skills_api.py.
import '@testing-library/jest-dom';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import CreateJob, { normaliseTypedSkill } from './CreateJob';
import { api, ApiError } from '../../lib/api';

const mockNavigate = jest.fn();
// Jest 27 (react-scripts 5) cannot resolve react-router-dom 7's package exports (as in Login.test.jsx).
jest.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
  // eslint-disable-next-line jsx-a11y/anchor-has-content
  Link: ({ to, children, ...rest }) => <a href={to} {...rest}>{children}</a>,
}), { virtual: true });
jest.mock('../../lib/api', () => {
  const actual = jest.requireActual('../../lib/api');
  return { ...actual, api: { get: jest.fn(), post: jest.fn() } };
});

const DESCRIPTION = 'Analyst role. Statistical modelling in R, reporting in SAS, applied statistics.';

// A stand-in for core's GET /api/skills: a small vocabulary with aliases.
const VOCABULARY = [
  { name: 'postgresql', aliases: ['postgres'] },
  { name: 'python', aliases: [] },
  { name: 'r', aliases: ['r language'] },
  { name: 'react', aliases: ['reactjs'] },
];
const searchAnswer = (path) => {
  const q = decodeURIComponent(path.split('?q=')[1] || '');
  const skills = VOCABULARY
    .filter((s) => s.name.startsWith(q) || s.aliases.some((a) => a.startsWith(q)))
    .map((s) => ({ ...s, exact: s.name === q || s.aliases.includes(q) }));
  return { query: q, skills };
};

const unavailable = () => new ApiError({ status: 503, error: 'suggestions_unavailable', message: 'Skill suggestions are unavailable right now.' });

const mockServer = ({ extracted = ['r'], down = false } = {}) => {
  api.get.mockImplementation(async (path) => {
    if (down) throw unavailable();
    return searchAnswer(path);
  });
  api.post.mockImplementation(async (path) => {
    if (path === '/api/skills/extract') {
      if (down) throw unavailable();
      return { skills: extracted };
    }
    if (path === '/api/jobs') return { id: 'job-1' };
    throw new Error(`unexpected POST ${path}`);
  });
};

const goToSkills = async () => {
  render(<CreateJob />);
  fireEvent.change(screen.getByLabelText('Job Title'), { target: { value: 'Data Analyst' } });
  fireEvent.change(screen.getByLabelText('Experience Level'), { target: { value: '2-5 years' } });
  fireEvent.click(screen.getByRole('button', { name: /next step/i }));
  fireEvent.change(await screen.findByLabelText('Job Description'), { target: { value: DESCRIPTION } });
  fireEvent.click(screen.getByRole('button', { name: /next step/i }));
  return screen.findByLabelText('Search skills');
};

const selected = () => screen.queryAllByTestId('selected-skill').map((li) => ({
  name: li.getAttribute('data-skill'),
  custom: li.getAttribute('data-custom') === 'true',
}));

const submittedSkills = async () => {
  fireEvent.click(screen.getByTestId('job-submit'));
  await waitFor(() => expect(api.post).toHaveBeenCalledWith('/api/jobs', expect.any(Object)));
  return api.post.mock.calls.find(([path]) => path === '/api/jobs')[1].skills;
};

beforeEach(() => {
  api.get.mockReset();
  api.post.mockReset();
  mockNavigate.mockReset();
});

test('normaliseTypedSkill: lower case, spaces collapsed, edge punctuation removed', () => {
  expect(normaliseTypedSkill('  Apache   Kafka Streams. ')).toBe('apache kafka streams');
  expect(normaliseTypedSkill('(Statistics)')).toBe('statistics');
  expect(normaliseTypedSkill('C++')).toBe('c++');
  expect(normaliseTypedSkill(' - ')).toBe('');
});

test('the fixed chip list is gone: the skills step is a search input', async () => {
  mockServer();
  await goToSkills();
  for (const old of ['Node.js', 'Docker', 'Kubernetes', 'Vue.js']) {
    expect(screen.queryByRole('button', { name: old })).toBeNull();
  }
  expect(screen.getByTestId('skill-search-input')).toBeInTheDocument();
});

test('a skill picked from the search is saved in the parser\'s spelling, an alias resolving to its name', async () => {
  mockServer();
  const input = await goToSkills();
  fireEvent.change(input, { target: { value: 'Postgres' } });
  const option = await screen.findByRole('button', { name: 'postgresql' });
  expect(option).toHaveAttribute('data-testid', 'skill-option');
  fireEvent.keyDown(input, { key: 'Enter' });
  await waitFor(() => expect(selected()).toEqual([{ name: 'postgresql', custom: false }]));
  expect(input).toHaveValue('');

  fireEvent.change(input, { target: { value: 'pyt' } });
  fireEvent.click(await screen.findByRole('button', { name: 'python' }));
  await waitFor(() => expect(selected().map((s) => s.name)).toEqual(['postgresql', 'python']));
  expect(screen.getByText('2 selected')).toBeInTheDocument();

  expect(await submittedSkills()).toEqual(['postgresql', 'python']);
  expect(mockNavigate).toHaveBeenCalledWith('/recruiter/jobs');
});

test('a custom skill is saved normalised and marked custom in the form', async () => {
  mockServer();
  const input = await goToSkills();
  fireEvent.change(input, { target: { value: '  Apache   Kafka Streams. ' } });
  fireEvent.click(await screen.findByTestId('skill-add-custom'));
  await waitFor(() => expect(selected()).toEqual([{ name: 'apache kafka streams', custom: true }]));
  expect(within(screen.getByTestId('selected-skills')).getByText('custom')).toBeInTheDocument();

  // Enter on a text with no exact match adds it as custom too.
  fireEvent.change(input, { target: { value: 'SAS' } });
  fireEvent.keyDown(input, { key: 'Enter' });
  await waitFor(() => expect(selected().map((s) => s.name)).toEqual(['apache kafka streams', 'sas']));

  expect(await submittedSkills()).toEqual(['apache kafka streams', 'sas']);
});

test('"Found in your description" lists the extracted skills and adds one only when clicked', async () => {
  mockServer({ extracted: ['r', 'python'] });
  await goToSkills();
  const box = screen.getByTestId('description-suggestions');
  expect(box).toHaveTextContent('Found in your description:');
  const r = await within(box).findByRole('button', { name: 'r' });
  expect(within(box).getByRole('button', { name: 'python' })).toBeInTheDocument();
  expect(api.post).toHaveBeenCalledWith('/api/skills/extract', { text: DESCRIPTION }, expect.any(Object));

  // Nothing was added by the suggestions arriving.
  expect(selected()).toEqual([]);
  expect(screen.getByText('0 selected')).toBeInTheDocument();
  expect(screen.getByTestId('job-submit')).toBeDisabled();

  fireEvent.click(r);
  await waitFor(() => expect(selected()).toEqual([{ name: 'r', custom: false }]));
  expect(r).toBeDisabled();
  expect(await submittedSkills()).toEqual(['r']);
});

test('with nlp-engine down the input still accepts typed skills and says suggestions are unavailable', async () => {
  mockServer({ down: true });
  const input = await goToSkills();
  expect(await within(screen.getByTestId('description-suggestions')).findByText(/Suggestions are unavailable right now/)).toBeInTheDocument();

  fireEvent.change(input, { target: { value: 'Statistics' } });
  expect(await within(screen.getByTestId('skill-search-results')).findByText(/Suggestions are unavailable right now/)).toBeInTheDocument();
  fireEvent.keyDown(input, { key: 'Enter' });
  await waitFor(() => expect(selected()).toEqual([{ name: 'statistics', custom: true }]));

  expect(await submittedSkills()).toEqual(['statistics']);
});
