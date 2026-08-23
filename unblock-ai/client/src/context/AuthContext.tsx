import { createContext, useContext, useState, useCallback } from "react";
import type { ReactNode } from "react";
import { AuthAPI } from "../api/resources";

interface UserInfo {
  id: string;
  name: string;
  email: string;
  role: "ADMIN" | "OPS" | "ANALYST";
}

interface AuthContextValue {
  user: UserInfo | null;
  token: string | null;
  loading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserInfo | null>(() => {
    const raw = localStorage.getItem("unblock_user");
    return raw ? JSON.parse(raw) : null;
  });
  const [token, setToken] = useState<string | null>(() => localStorage.getItem("unblock_token"));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const login = useCallback(async (email: string, password: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await AuthAPI.login(email, password);
      const { token: t, user: u } = res.data.data;
      localStorage.setItem("unblock_token", t);
      localStorage.setItem("unblock_user", JSON.stringify(u));
      setToken(t);
      setUser(u);
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || "Login failed");
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem("unblock_token");
    localStorage.removeItem("unblock_user");
    setToken(null);
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, token, loading, error, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
