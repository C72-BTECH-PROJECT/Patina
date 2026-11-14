// R-31: recruiter sign-up has one "Create Account" button and no verification section; the
// sign-up body is the same five fields for every role; the post-sign-up page says
// "Account created" once.
import '@testing-library/jest-dom';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import Login, { buildSignupPayload, signupFollowUp } from './Login';
import { api } from '../../lib/api';

// Jest 27 (react-scripts 5) cannot resolve react-router-dom 7's package exports, so the three
// router hooks and Link the page uses are replaced with minimal stand-ins on the /signup route.
jest.mock('react-router-dom', () => ({
  useNavigate: () => jest.fn(),
  useLocation: () => ({ pathname: '/signup', state: null }),
  // eslint-disable-next-line jsx-a11y/anchor-has-content
  Link: ({ to, children, ...rest }) => <a href={to} {...rest}>{children}</a>,
}), { virtual: true });
jest.mock('../../context/AuthContext', () => ({
  useAuth: () => ({ login: jest.fn(), refreshUser: jest.fn(), user: null, loading: false }),
}));
jest.mock('../../lib/api', () => ({ api: { post: jest.fn() } }));

const SERVER_MESSAGE = 'Account created. Check your email to confirm the account before signing in.';

const renderSignup = () => render(<Login />);

const fillRecruiter = () => {
  fireEvent.change(screen.getByLabelText('Account type'), { target: { value: 'recruiter' } });
  fireEvent.change(screen.getByLabelText('Username'), { target: { value: 'rec_one' } });
  fireEvent.change(screen.getByLabelText('Full Name'), { target: { value: 'Rec One' } });
  fireEvent.change(screen.getByLabelText('Email Address'), { target: { value: 'rec.one@example.com' } });
  fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'a-long-password-1' } });
};

beforeEach(() => api.post.mockReset());

describe('buildSignupPayload', () => {
  test('sends the same five fields for a recruiter and a candidate, never companyName or verificationInfo', () => {
    for (const role of ['recruiter', 'candidate']) {
      const body = buildSignupPayload({ email: 'a@example.com', password: 'p', username: 'u', role, name: 'N', companyName: 'Acme', verificationInfo: 'https://x' });
      expect(Object.keys(body).sort()).toEqual(['email', 'name', 'password', 'role', 'username']);
      expect(body.role).toBe(role);
    }
  });
});

describe('signupFollowUp', () => {
  test('drops the opening "Account created" sentence and keeps the rest', () => {
    expect(signupFollowUp(SERVER_MESSAGE)).toBe('Check your email to confirm the account before signing in.');
    expect(signupFollowUp('Account created successfully.')).toBe('');
    expect(signupFollowUp(undefined)).toBe('');
    expect(signupFollowUp('Something else.')).toBe('Something else.');
  });
});

describe('recruiter sign-up form', () => {
  test('one Create Account button, no verification section or fields', () => {
    renderSignup();
    fireEvent.change(screen.getByLabelText('Account type'), { target: { value: 'recruiter' } });
    expect(screen.getByText('Sign up as a recruiter to get started')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /create account/i })).toHaveLength(1);
    expect(document.querySelectorAll('button[type="submit"]')).toHaveLength(1);
    expect(screen.queryByText(/verification details/i)).toBeNull();
    expect(screen.queryByText(/skip verification/i)).toBeNull();
    expect(screen.queryByLabelText(/company name/i)).toBeNull();
    expect(screen.queryByLabelText(/linkedin/i)).toBeNull();
  });

  test('submitting posts the five fields, and the post-sign-up page says "Account created" once', async () => {
    api.post.mockResolvedValue({ message: SERVER_MESSAGE });
    renderSignup();
    fillRecruiter();
    fireEvent.click(screen.getByRole('button', { name: /create account/i }));

    const done = await screen.findByTestId('signup-confirm-email');
    expect(api.post).toHaveBeenCalledTimes(1);
    expect(api.post).toHaveBeenCalledWith('/api/auth/signup', {
      email: 'rec.one@example.com', password: 'a-long-password-1', username: 'rec_one', role: 'recruiter', name: 'Rec One',
    });
    expect(done.textContent.match(/account created/gi)).toHaveLength(1);
    expect(done).toHaveTextContent('Check your email to confirm the account before signing in.');
    expect(done).toHaveTextContent('rec.one@example.com');
  });

  test('a failed sign-up shows the server message and stays on the form', async () => {
    api.post.mockRejectedValue(Object.assign(new Error('Username is already taken.'), { status: 409 }));
    renderSignup();
    fillRecruiter();
    fireEvent.click(screen.getByRole('button', { name: /create account/i }));
    await waitFor(() => expect(screen.getByTestId('login-error')).toHaveTextContent('Username is already taken.'));
    expect(screen.queryByTestId('signup-confirm-email')).toBeNull();
  });
});
