// R-30 follow-up: the upload result shows each education entry as a readable line, for
// both stored shapes (nlp-engine 2.1.0 objects and older strings), and every web link
// as plain text, never as JSON or a clickable link.
import React from 'react';
import '@testing-library/jest-dom';
import { render, screen, within } from '@testing-library/react';
import { ParsedSummary, isResumeFile } from './Upload';

// Jest 27 (react-scripts 5) cannot resolve react-router-dom 7's package exports (as in
// Login.test.jsx); ParsedSummary renders no router element, so a stand-in Link is enough.
jest.mock('react-router-dom', () => ({
  // eslint-disable-next-line jsx-a11y/anchor-has-content
  Link: ({ to, children, ...rest }) => <a href={to} {...rest}>{children}</a>,
}), { virtual: true });
jest.mock('../../lib/api', () => ({ api: { get: jest.fn(), post: jest.fn() } }));

const EDUCATION_OBJECT = {
  institution: 'Example Institute of Technology, Pune',
  degree: 'Bachelor of Technology in Computer Engineering',
  dates: '2021 – 2025',
  graduation_year: 2025,
  grade: 'CGPA: 8.72/10',
  honours: 'Honours in Artificial Intelligence',
  text: 'Example Institute of Technology, Pune · Bachelor of Technology in Computer Engineering · 2021 - 2025 | CGPA: 8.72/10 · Honours in Artificial Intelligence',
};
const OLD_STRING = 'B.Tech in Computer Science - Example Institute of Technology (2018 - 2022)';
const LINKS = [
  'https://github.com/example-plinkwell',
  'https://www.linkedin.com/in/example-priya-linkwell',
  'https://plinkwell.example.com/portfolio',
];

const renderSummary = (parsed) => render(<ParsedSummary fileName="cv.pdf" parsed={{ skills: [], experience: [], contact: {}, ...parsed }} />);

test('education objects and old string entries each read as one line, never JSON', () => {
  renderSummary({ education: [EDUCATION_OBJECT, OLD_STRING, { degree: null, institution: null, text: '' }], links: [] });
  const items = within(screen.getByTestId('parsed-education')).getAllByRole('listitem');
  expect(items.map((li) => li.textContent)).toEqual([
    'Bachelor of Technology in Computer Engineering · Example Institute of Technology, Pune · 2021 – 2025 · CGPA: 8.72/10 · Honours in Artificial Intelligence',
    OLD_STRING,
    'Entry without details',
  ]);
  expect(screen.getByTestId('parsed-education').textContent).not.toMatch(/[{}"]|graduation_year/);
});

test('every web link is listed as its address, with no anchor', () => {
  renderSummary({ education: [], links: LINKS });
  const section = screen.getByTestId('parsed-links');
  expect(within(section).getAllByRole('listitem').map((li) => li.textContent)).toEqual(LINKS);
  expect(section.querySelector('a')).toBeNull();
  expect(section).toHaveTextContent('Links (3)');
});

test('no links says so in words', () => {
  renderSummary({ education: [], links: [] });
  expect(screen.getByTestId('parsed-links')).toHaveTextContent('No web links were found.');
});

// R-38: LinkedIn and GitHub appear under Contact when the parser returned them.
test('Contact lists LinkedIn and GitHub when the parser returned them, as text', () => {
  renderSummary({
    education: [],
    links: LINKS,
    contact: { candidate_name: 'Priya Linkwell', email: null, phone: null, linkedin: LINKS[1], github: LINKS[0] },
  });
  const contact = screen.getByTestId('parsed-contact');
  const terms = [...contact.querySelectorAll('dt')].map((dt) => dt.textContent);
  const values = [...contact.querySelectorAll('dd')].map((dd) => dd.textContent);
  expect(terms).toEqual(['Name', 'LinkedIn', 'GitHub']);
  expect(values).toEqual(['Priya Linkwell', LINKS[1], LINKS[0]]);
  expect(contact.querySelector('a')).toBeNull();
});

test('Contact has no LinkedIn or GitHub line when the parser returned none', () => {
  renderSummary({ education: [], links: [], contact: { candidate_name: 'Sam Support', email: 'sam@example.com', github: null, linkedin: '' } });
  const contact = screen.getByTestId('parsed-contact');
  expect([...contact.querySelectorAll('dt')].map((dt) => dt.textContent)).toEqual(['Name', 'Email']);
});

// I-0006: the same check runs when a file is chosen (button or drop), not only at submit.
test('isResumeFile accepts PDF and DOCX by type or extension and rejects anything else', () => {
  expect(isResumeFile({ name: 'cv.pdf', type: '' })).toBe(true);
  expect(isResumeFile({ name: 'CV.DOCX', type: '' })).toBe(true);
  expect(isResumeFile({ name: 'resume', type: 'application/pdf' })).toBe(true);
  expect(isResumeFile({ name: 'photo.png', type: 'image/png' })).toBe(false);
  expect(isResumeFile({ name: 'old.doc', type: 'application/msword' })).toBe(false);
  expect(isResumeFile({ name: 'notes.txt', type: 'text/plain' })).toBe(false);
});
