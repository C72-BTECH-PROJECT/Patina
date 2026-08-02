import crypto from "crypto";
import { candidates } from "../Config/Candidate.js";
import { recruiters } from "../Config/Recruiter.js";

const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID || "your_github_client_id";
const GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET || "your_github_client_secret";
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || "your_google_client_id";
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || "your_google_client_secret";
const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:5001";
const GITHUB_CALLBACK_URL = `${BACKEND_URL}/api/auth/github/callback`;
const GOOGLE_CALLBACK_URL = `${BACKEND_URL}/api/auth/google/callback`;
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:3000";

const SESSION_COOKIE_NAME = "patina_session";
const sessions = new Map();

const roleStores = {
  candidate: {
    list: candidates,
    nextId: () => `cand${candidates.length + 1}`,
    defaults: () => ({
      location: "",
    }),
  },
  recruiter: {
    list: recruiters,
    nextId: () => `rec${recruiters.length + 1}`,
    defaults: () => ({
      companyName: "",
      verificationInfo: "",
      isVerified: false,
    }),
  },
};

const isValidRole = (role) => role === "candidate" || role === "recruiter";
const isOAuthConfigured = (clientId, clientSecret) =>
  !String(clientId).startsWith("your_") && !String(clientSecret).startsWith("your_");

const parseCookieHeader = (cookieHeader = "") =>
  cookieHeader
    .split(";")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .reduce((acc, entry) => {
      const separatorIndex = entry.indexOf("=");
      if (separatorIndex === -1) {
        return acc;
      }

      const key = entry.slice(0, separatorIndex).trim();
      const value = decodeURIComponent(entry.slice(separatorIndex + 1));
      if (key) {
        acc[key] = value;
      }
      return acc;
    }, {});

const getStoreByRole = (role) => roleStores[role]?.list || null;

const sanitizeUser = (user, role) => {
  const { password, ...safeUser } = user;
  return { ...safeUser, role };
};

const setSessionCookie = (res, sessionId) => {
  const secureSuffix = process.env.NODE_ENV === "production" ? "; Secure" : "";
  const maxAge = 7 * 24 * 60 * 60;
  res.setHeader(
    "Set-Cookie",
    `${SESSION_COOKIE_NAME}=${encodeURIComponent(
      sessionId
    )}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secureSuffix}`
  );
};

const clearSessionCookie = (res) => {
  const secureSuffix = process.env.NODE_ENV === "production" ? "; Secure" : "";
  res.setHeader(
    "Set-Cookie",
    `${SESSION_COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secureSuffix}`
  );
};

const createSession = (res, userId, role) => {
  const sessionId = crypto.randomUUID();
  sessions.set(sessionId, { userId, role });
  setSessionCookie(res, sessionId);
};

const getSessionUser = (req) => {
  const cookies = parseCookieHeader(req.headers.cookie || "");
  const sessionId = cookies[SESSION_COOKIE_NAME];
  if (!sessionId) {
    return null;
  }

  const session = sessions.get(sessionId);
  if (!session) {
    return null;
  }

  const store = getStoreByRole(session.role);
  if (!store) {
    sessions.delete(sessionId);
    return null;
  }

  const user = store.find((entry) => entry._id === session.userId);
  if (!user) {
    sessions.delete(sessionId);
    return null;
  }

  return { user, role: session.role, sessionId };
};

const createUser = (role, data) => {
  const roleStore = roleStores[role];
  const user = {
    _id: roleStore.nextId(),
    name: data.name || "",
    email: data.email,
    password: data.password || "",
    googleId: data.googleId || null,
    githubId: data.githubId || null,
    ...roleStore.defaults(),
  };

  if (role === "candidate" && data.location) {
    user.location = data.location;
  }

  if (role === "recruiter") {
    user.companyName = data.companyName || "";
    user.verificationInfo = data.verificationInfo || "";
    user.isVerified = Boolean(data.isVerified);
  }

  roleStore.list.push(user);
  return user;
};

export const me = (req, res) => {
  const activeSession = getSessionUser(req);
  if (!activeSession) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  return res.json({ user: sanitizeUser(activeSession.user, activeSession.role) });
};

export const logout = (req, res) => {
  const cookies = parseCookieHeader(req.headers.cookie || "");
  const sessionId = cookies[SESSION_COOKIE_NAME];
  if (sessionId) {
    sessions.delete(sessionId);
  }
  clearSessionCookie(res);
  return res.json({ message: "Logged out successfully" });
};

export const login = (req, res) => {
  const { role, email, password } = req.body;

  if (!isValidRole(role)) {
    return res.status(400).json({ message: "Role must be candidate or recruiter" });
  }

  if (!email || !password) {
    return res.status(400).json({ message: "Email and password are required" });
  }

  const store = getStoreByRole(role);
  const user = store.find((entry) => entry.email === email && entry.password === password);
  if (!user) {
    return res.status(401).json({ message: "Invalid credentials for selected role" });
  }

  createSession(res, user._id, role);
  return res.json({
    message: "Login successful",
    user: sanitizeUser(user, role),
  });
};

export const signup = (req, res) => {
  const { role, email, password, name, companyName, verificationInfo, location } =
    req.body;

  if (!isValidRole(role)) {
    return res.status(400).json({ message: "Role must be candidate or recruiter" });
  }

  if (!email || !password || !name) {
    return res.status(400).json({ message: "Name, email and password are required" });
  }

  const store = getStoreByRole(role);
  const existingUser = store.find((entry) => entry.email === email);
  if (existingUser) {
    return res.status(409).json({ message: `${role} account already exists with this email` });
  }

  const user = createUser(role, {
    name,
    email,
    password,
    companyName,
    verificationInfo,
    location,
  });

  createSession(res, user._id, role);
  return res.status(201).json({
    message: "Signup successful",
    user: sanitizeUser(user, role),
  });
};

export const githubAuth = (req, res) => {
  const role = req.query.role;
  if (!isValidRole(role)) {
    return res.status(400).json({ message: "Role must be candidate or recruiter" });
  }
  if (!isOAuthConfigured(GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET)) {
    return res.status(500).json({ message: "GitHub OAuth is not configured" });
  }

  const scope = "read:user user:email";
  const githubAuthUrl = `https://github.com/login/oauth/authorize?client_id=${GITHUB_CLIENT_ID}&redirect_uri=${encodeURIComponent(
    GITHUB_CALLBACK_URL
  )}&scope=${scope}&state=${role}`;

  return res.redirect(githubAuthUrl);
};

export const githubCallback = async (req, res) => {
  const { code, state } = req.query;
  const role = state;

  if (!isValidRole(role)) {
    return res.redirect(`${FRONTEND_URL}/login/candidate?error=invalid_role`);
  }

  if (!code) {
    return res.redirect(`${FRONTEND_URL}/login/${role}?error=no_code`);
  }

  try {
    const tokenResponse = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        client_id: GITHUB_CLIENT_ID,
        client_secret: GITHUB_CLIENT_SECRET,
        code,
        redirect_uri: GITHUB_CALLBACK_URL,
      }),
    });
    const tokenData = await tokenResponse.json();
    if (tokenData.error || !tokenData.access_token) {
      return res.redirect(`${FRONTEND_URL}/login/${role}?error=token_exchange_failed`);
    }

    const accessToken = tokenData.access_token;
    const authHeaders = {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
    };

    const userResponse = await fetch("https://api.github.com/user", {
      headers: authHeaders,
    });
    const githubUser = await userResponse.json();

    const emailsResponse = await fetch("https://api.github.com/user/emails", {
      headers: authHeaders,
    });
    const emails = await emailsResponse.json();

    const primaryEmail = Array.isArray(emails)
      ? emails.find((entry) => entry.primary)?.email || emails[0]?.email
      : null;

    const store = getStoreByRole(role);
    let user = store.find(
      (entry) =>
        entry.githubId === String(githubUser.id) ||
        (primaryEmail && entry.email === primaryEmail)
    );

    if (!user) {
      user = createUser(role, {
        name: githubUser.name || githubUser.login || "GitHub User",
        email: primaryEmail || `${githubUser.login}@github.nomail`,
        password: "",
        githubId: String(githubUser.id),
      });
    } else {
      user.githubId = String(githubUser.id);
    }

    createSession(res, user._id, role);
    return res.redirect(`${FRONTEND_URL}/login/${role}?github_success=true&user_id=${user._id}`);
  } catch (error) {
    console.error("GitHub OAuth error:", error);
    return res.redirect(`${FRONTEND_URL}/login/${role}?error=oauth_failed`);
  }
};

export const googleAuth = (req, res) => {
  const role = req.query.role;
  if (!isValidRole(role)) {
    return res.status(400).json({ message: "Role must be candidate or recruiter" });
  }
  if (!isOAuthConfigured(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET)) {
    return res.status(500).json({ message: "Google OAuth is not configured" });
  }

  const scope = "openid email profile";
  const googleAuthUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${encodeURIComponent(
    GOOGLE_CLIENT_ID
  )}&redirect_uri=${encodeURIComponent(
    GOOGLE_CALLBACK_URL
  )}&response_type=code&scope=${encodeURIComponent(scope)}&state=${encodeURIComponent(role)}&access_type=offline&prompt=consent`;

  return res.redirect(googleAuthUrl);
};

export const googleCallback = async (req, res) => {
  const { code, state } = req.query;
  const role = state;

  if (!isValidRole(role)) {
    return res.redirect(`${FRONTEND_URL}/login/candidate?error=invalid_role`);
  }

  if (!code) {
    return res.redirect(`${FRONTEND_URL}/login/${role}?error=no_code`);
  }

  try {
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        code: String(code),
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        redirect_uri: GOOGLE_CALLBACK_URL,
        grant_type: "authorization_code",
      }),
    });
    const tokenData = await tokenResponse.json();
    if (tokenData.error || !tokenData.access_token) {
      return res.redirect(`${FRONTEND_URL}/login/${role}?error=token_exchange_failed`);
    }

    const profileResponse = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
        Accept: "application/json",
      },
    });
    const googleUser = await profileResponse.json();

    const email = googleUser.email || null;
    const store = getStoreByRole(role);
    let user = store.find(
      (entry) =>
        entry.googleId === String(googleUser.sub) || (email && entry.email === email)
    );

    if (!user) {
      user = createUser(role, {
        name: googleUser.name || email || "Google User",
        email: email || `${googleUser.sub}@google.nomail`,
        password: "",
        googleId: String(googleUser.sub),
      });
    } else {
      user.googleId = String(googleUser.sub);
    }

    createSession(res, user._id, role);
    return res.redirect(`${FRONTEND_URL}/login/${role}?google_success=true&user_id=${user._id}`);
  } catch (error) {
    console.error("Google OAuth error:", error);
    return res.redirect(`${FRONTEND_URL}/login/${role}?error=oauth_failed`);
  }
};
