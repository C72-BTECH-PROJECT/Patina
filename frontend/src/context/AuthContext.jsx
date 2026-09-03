import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

const AuthContext = createContext(null);
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";

const withCredentialsFetch = async (input, init = {}) => {
  const mergedInit = { ...init };
  if (!mergedInit.credentials) {
    mergedInit.credentials = "include";
  }
  return fetch(input, mergedInit);
};

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (typeof window === "undefined" || window.__patinaFetchWrapped) {
      return;
    }

    const originalFetch = window.fetch.bind(window);
    window.fetch = (input, init = {}) => {
      const url = typeof input === "string" ? input : input?.url || "";
      // Only force credentials on requests to our own API. Patching every
      // fetch call app-wide would also attach credentials to third-party
      // requests, which breaks outright for any API using
      // Access-Control-Allow-Origin: "*" (incompatible with credentialed
      // requests per the CORS spec — the browser rejects the response).
      if (url.startsWith(API_BASE_URL)) {
        return originalFetch(input, { credentials: "include", ...init });
      }
      return originalFetch(input, init);
    };
    window.__patinaFetchWrapped = true;
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      const response = await withCredentialsFetch(`${API_BASE_URL}/api/auth/me`);
      if (!response.ok) {
        setUser(null);
        return null;
      }

      const data = await response.json();
      setUser(data.user || null);
      return data.user || null;
    } catch (error) {
      setUser(null);
      return null;
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    const initialize = async () => {
      await refreshUser();
      if (mounted) {
        setLoading(false);
      }
    };

    initialize();
    return () => {
      mounted = false;
    };
  }, [refreshUser]);

  const login = useCallback(async (payload) => {
    const response = await withCredentialsFetch(`${API_BASE_URL}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = await response.json();
    if (!response.ok) {
      const error = new Error(data.message || "Login failed");
      error.code = data.code;
      throw error;
    }

    setUser(data.user || null);
    return data;
  }, []);

  const logout = useCallback(async () => {
    const response = await withCredentialsFetch(`${API_BASE_URL}/api/auth/logout`, {
      method: "POST",
    });

    if (!response.ok) {
      let message = "Logout failed";
      try {
        const data = await response.json();
        message = data.message || message;
      } catch {
        // Response had no JSON body — keep the default message.
      }
      throw new Error(message);
    }

    setUser(null);
  }, []);

  const authFetch = useCallback(withCredentialsFetch, []);

  const contextValue = useMemo(
    () => ({
      user,
      loading,
      login,
      logout,
      refreshUser,
      authFetch,
    }),
    [user, loading, login, logout, refreshUser, authFetch]
  );

  return <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
