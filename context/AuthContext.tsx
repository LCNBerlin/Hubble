import type { Session, User } from "@supabase/supabase-js";
import { createContext, ReactNode, useCallback, useContext, useEffect, useState } from "react";
import { upsertProfileForUser } from "../lib/supabase-profiles";
import supabase from "../lib/supabase";

type AuthContextType = {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  isSupabaseConfigured: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string) => Promise<{ error: Error | null; data?: { user: User } }>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(!!supabase);

  useEffect(() => {
    if (!supabase) {
      setIsLoading(false);
      return;
    }

    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      setUser(s?.user ?? null);
      setIsLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      setUser(s?.user ?? null);
      setIsLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Ensure profile row exists for the current user (sign-in/sign-up)
  useEffect(() => {
    if (!user || !supabase) return;
    upsertProfileForUser(user).catch(() => {});
  }, [user?.id]);

  const signIn = useCallback(async (email: string, password: string) => {
    if (!supabase) {
      return {
        error: new Error(
          "Supabase is not configured. Add EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY to .env"
        ) as Error,
      };
    }
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error ?? null };
  }, []);

  const signUp = useCallback(async (email: string, password: string) => {
    if (!supabase) {
      return {
        error: new Error(
          "Supabase is not configured. Add EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY to .env"
        ) as Error,
      };
    }
    const { data: signUpData, error } = await supabase.auth.signUp({ email, password });
    return { error: error ?? null, data: signUpData?.user ? { user: signUpData.user } : undefined };
  }, []);

  const signOut = useCallback(async () => {
    if (supabase) await supabase.auth.signOut();
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        isLoading,
        isSupabaseConfigured: !!supabase,
        signIn,
        signUp,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
