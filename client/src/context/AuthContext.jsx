import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { TOKEN_KEY } from "../config";
import { authApi } from "../api/services";
import { setUnauthorizedHandler } from "../api/client";
import { isTokenExpired } from "../lib/jwt";

const AuthContext = createContext(null);

const readStoredToken = () => {
  const token = localStorage.getItem(TOKEN_KEY);
  if (token && isTokenExpired(token)) {
    localStorage.removeItem(TOKEN_KEY);
    return null;
  }
  return token;
};

export function AuthProvider({ children }) {
  const [token, setToken] = useState(readStoredToken);
  const [user, setUser] = useState(null);
  // "loading" while a stored session is being verified with the server.
  const [status, setStatus] = useState(() => (readStoredToken() ? "loading" : "ready"));
  const [notice, setNotice] = useState("");
  // True after a deliberate sign-out, so route guards send people home rather than to the sign-in form.
  const [manualSignOut, setManualSignOut] = useState(false);

  // No message = the user chose to sign out. A message = the session ended for them (expired/rejected).
  const signOut = useCallback((message = "") => {
    localStorage.removeItem(TOKEN_KEY);
    setToken(null);
    setUser(null);
    setStatus("ready");
    setNotice(message);
    setManualSignOut(!message);
  }, []);

  const signIn = useCallback(({ token: newToken, user: newUser }) => {
    localStorage.setItem(TOKEN_KEY, newToken);
    setToken(newToken);
    setUser(newUser);
    setStatus("ready");
    setNotice("");
    setManualSignOut(false);
  }, []);

  // Restore the session on first load.
  useEffect(() => {
    if (!token || user) return;
    let cancelled = false;
    authApi.me()
      .then((u) => { if (!cancelled) { setUser(u); setStatus("ready"); } })
      .catch((err) => {
        if (cancelled) return;
        // Only a rejected token ends the session; a network blip keeps it and lets the user retry.
        if (err.response?.status === 401) signOut("Your session has expired. Please sign in again.");
        else setStatus("ready");
      });
    return () => { cancelled = true; };
  }, [token, user, signOut]);

  useEffect(() => {
    setUnauthorizedHandler((message) => signOut(message || "Your session has expired. Please sign in again."));
  }, [signOut]);

  const value = useMemo(
    () => ({ token, user, status, isAuthenticated: Boolean(token), notice, manualSignOut, clearNotice: () => setNotice(""), signIn, signOut }),
    [token, user, status, notice, manualSignOut, signIn, signOut]
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
