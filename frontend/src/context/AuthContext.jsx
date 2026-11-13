import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { api } from "../lib/api";
import { checkSession } from "./sessionCheck";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  // True when the last /me check got no answer about the session (server unreachable,
  // gateway 503, a 5xx). Only 401/403 mean signed out (sessionCheck.js); RequireRole
  // shows a retry screen for this state instead of sending the user to /login.
  const [unreachable, setUnreachable] = useState(false);

  const refreshUser = useCallback(async () => {
    const outcome = await checkSession(() => api.get("/api/auth/me"));
    setUser(outcome.user);
    setUnreachable(outcome.status === "unreachable");
    return outcome.user;
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

  // The retry screen's button: check the session again, showing the loading state meanwhile.
  const retrySession = useCallback(async () => {
    setLoading(true);
    await refreshUser();
    setLoading(false);
  }, [refreshUser]);

  // Throws the client's ApiError on failure; a suspended account carries
  // `err.body.code === 'ACCOUNT_SUSPENDED'`.
  const login = useCallback(async (payload) => {
    const data = await api.post("/api/auth/login", payload);
    setUser(data?.user || null);
    setUnreachable(false);
    return data;
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.post("/api/auth/logout");
    } catch (error) {
      console.warn("Logout request failed:", error.message);
    } finally {
      setUser(null);
      setUnreachable(false);
    }
  }, []);

  const contextValue = useMemo(
    () => ({
      user,
      loading,
      unreachable,
      login,
      logout,
      refreshUser,
      retrySession,
    }),
    [user, loading, unreachable, login, logout, refreshUser, retrySession]
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
