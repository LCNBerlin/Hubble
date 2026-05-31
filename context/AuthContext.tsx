import AsyncStorage from "@react-native-async-storage/async-storage";
import { createContext, ReactNode, useCallback, useContext, useEffect, useState } from "react";
import { API_URL } from "../lib/config";
import { storeTokens, clearTokens, getStoredTokens } from "../lib/api";

export type HubbleUser = {
  id: string;
  email: string;
};

export type HubbleSession = {
  accessToken: string;
  refreshToken: string;
};

type AuthContextType = {
  user: HubbleUser | null;
  session: HubbleSession | null;
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string) => Promise<{ error: Error | null; data?: { user: HubbleUser } }>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | null>(null);

function parseJwt(token: string): { sub: string; email: string } | null {
  try {
    const payload = token.split(".")[1];
    const decoded = JSON.parse(atob(payload));
    return decoded;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<HubbleUser | null>(null);
  const [session, setSession] = useState<HubbleSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { accessToken, refreshToken } = await getStoredTokens();
      if (accessToken && refreshToken) {
        const payload = parseJwt(accessToken);
        if (payload) {
          setUser({ id: payload.sub, email: payload.email });
          setSession({ accessToken, refreshToken });
        }
      }
      setIsLoading(false);
    })();
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    try {
      const res = await fetch(`${API_URL}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        return { error: new Error(body.message || "Invalid credentials") };
      }
      const { accessToken, refreshToken } = await res.json();
      await storeTokens(accessToken, refreshToken);
      const payload = parseJwt(accessToken);
      const u: HubbleUser = { id: payload?.sub ?? "", email };
      setUser(u);
      setSession({ accessToken, refreshToken });
      return { error: null };
    } catch (e) {
      return { error: e instanceof Error ? e : new Error("Sign in failed") };
    }
  }, []);

  const signUp = useCallback(async (email: string, password: string) => {
    try {
      const res = await fetch(`${API_URL}/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        return { error: new Error(body.message || "Registration failed") };
      }
      const { accessToken, refreshToken } = await res.json();
      await storeTokens(accessToken, refreshToken);
      const payload = parseJwt(accessToken);
      const u: HubbleUser = { id: payload?.sub ?? "", email };
      setUser(u);
      setSession({ accessToken, refreshToken });
      return { error: null, data: { user: u } };
    } catch (e) {
      return { error: e instanceof Error ? e : new Error("Sign up failed") };
    }
  }, []);

  const signOut = useCallback(async () => {
    try {
      const { accessToken } = await getStoredTokens();
      if (accessToken) {
        await fetch(`${API_URL}/api/auth/logout`, {
          method: "POST",
          headers: { Authorization: `Bearer ${accessToken}` },
        }).catch(() => {});
      }
    } finally {
      await clearTokens();
      setUser(null);
      setSession(null);
    }
  }, []);

  return (
    <AuthContext.Provider value={{ user, session, isLoading, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
