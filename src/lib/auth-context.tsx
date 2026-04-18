"use client";

import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { User as SupabaseUser } from "@supabase/supabase-js";

// ─── Types ─────────────────────────────────────────────────────────────────

export type UserRole = "reader" | "editor" | "admin";
export type UserTier = "founder" | "launch" | "paid" | "free";

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  tier: UserTier;
  onboardedAt: string | null;
}

interface AuthContextType {
  user: AuthUser | null;
  isLoading: boolean;
  login: (email: string) => Promise<{ ok: boolean; error?: string }>;
  verifyCode: (email: string, token: string) => Promise<{ ok: boolean; error?: string }>;
  logout: () => Promise<void>;
  updateUser: (updates: Partial<AuthUser>) => void;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

// ─── Helpers ───────────────────────────────────────────────────────────────

async function fetchProfile(supabaseUser: SupabaseUser): Promise<AuthUser | null> {
  try {
    const res = await fetch(`/api/user/profile?userId=${supabaseUser.id}`);
    if (!res.ok) {
      // Profile doesn't exist yet — return minimal user so onboarding can trigger
      return {
        id: supabaseUser.id,
        email: supabaseUser.email ?? "",
        name: (supabaseUser.user_metadata?.name as string) ?? "",
        role: "reader",
        tier: "free",
        onboardedAt: null,
      };
    }
    const profile = await res.json();
    return {
      id: profile.id ?? supabaseUser.id,
      email: profile.email ?? supabaseUser.email ?? "",
      name: profile.name ?? "",
      role: (profile.user_role as UserRole) ?? "reader",
      tier: (profile.tier as UserTier) ?? "free",
      onboardedAt: profile.onboarded_at ?? null,
    };
  } catch {
    return null;
  }
}

// ─── Provider ──────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  // Initial session check + auth state listener
  useEffect(() => {
    const supabase = createClient();
    let mounted = true;

    // Check existing session on mount
    (async () => {
      try {
        const {
          data: { user: supabaseUser },
        } = await supabase.auth.getUser();

        if (!mounted) return;

        if (supabaseUser) {
          const profile = await fetchProfile(supabaseUser);
          if (mounted) setUser(profile);
        } else {
          setUser(null);
        }
      } catch (err) {
        console.warn("Auth initialisation error:", err);
      } finally {
        if (mounted) setIsLoading(false);
      }
    })();

    // Listen for auth state changes (sign in, sign out, token refresh)
    const { data: subscription } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return;

      if (event === "SIGNED_IN" && session?.user) {
        const profile = await fetchProfile(session.user);
        if (mounted) setUser(profile);
      } else if (event === "SIGNED_OUT") {
        setUser(null);
      } else if (event === "USER_UPDATED" && session?.user) {
        const profile = await fetchProfile(session.user);
        if (mounted) setUser(profile);
      }
    });

    return () => {
      mounted = false;
      subscription.subscription.unsubscribe();
    };
  }, []);

  const login = useCallback(async (email: string): Promise<{ ok: boolean; error?: string }> => {
    const supabase = createClient();

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) {
      return { ok: false, error: error.message };
    }

    return { ok: true };
  }, []);

  const verifyCode = useCallback(async (email: string, token: string): Promise<{ ok: boolean; error?: string }> => {
    const supabase = createClient();

    const { data, error } = await supabase.auth.verifyOtp({
      email,
      token: token.trim(),
      type: "email",
    });

    if (error) {
      return { ok: false, error: error.message };
    }

    if (data.user) {
      const profile = await fetchProfile(data.user);
      setUser(profile);
    }

    return { ok: true };
  }, []);

  const logout = useCallback(async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    setUser(null);
    router.push("/login");
  }, [router]);

  const updateUser = useCallback((updates: Partial<AuthUser>) => {
    setUser((prev) => (prev ? { ...prev, ...updates } : null));
  }, []);

  const refreshProfile = useCallback(async () => {
    const supabase = createClient();
    const { data: { user: supabaseUser } } = await supabase.auth.getUser();
    if (supabaseUser) {
      const profile = await fetchProfile(supabaseUser);
      setUser(profile);
    }
  }, []);

  return (
    <AuthContext.Provider value={{ user, isLoading, login, verifyCode, logout, updateUser, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}
