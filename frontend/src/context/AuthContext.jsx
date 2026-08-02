import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

const AuthContext = createContext(null);
const API_BASE_URL = "http://localhost:5001";

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
    window.fetch = (input, init = {}) =>
      originalFetch(input, {
        credentials: "include",
        ...init,
      });
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
      throw new Error(data.message || "Login failed");
    }

    setUser(data.user || null);
    return data;
  }, []);

  const logout = useCallback(async () => {
    const response = await withCredentialsFetch(`${API_BASE_URL}/api/auth/logout`, {
      method: "POST",
    });

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.message || "Logout failed");
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
