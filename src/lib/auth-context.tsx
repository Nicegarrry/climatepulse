"use client";

import { createContext, useContext, useState, useCallback } from "react";

interface User {
  id: string;
  email: string;
  name: string;
  avatar?: string;
  onboardedAt?: string | null;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => void;
  switchUser: (userId: string) => Promise<void>;
  updateUser: (updates: Partial<User>) => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const fetchProfile = async (userId: string): Promise<User | null> => {
    try {
      const res = await fetch(`/api/user/profile?userId=${userId}`);
      if (!res.ok) return null;
      const profile = await res.json();
      return {
        id: profile.id,
        email: profile.email,
        name: profile.name,
        onboardedAt: profile.onboarded_at ?? null,
      };
    } catch {
      return null;
    }
  };

  const login = useCallback(async (email: string, _password: string) => {
    setIsLoading(true);
    // Simulate network delay
    await new Promise((r) => setTimeout(r, 400));

    // Try to find a matching test user by email, else default to test-user-1
    const profile = await fetchProfile("test-user-1");
    if (profile) {
      // Check if any test user matches the email
      for (const id of ["test-user-1", "test-user-2", "test-user-3", "test-user-4", "test-user-5"]) {
        const p = await fetchProfile(id);
        if (p && p.email === email) {
          setUser(p);
          setIsLoading(false);
          return true;
        }
      }
      // Default: log in as test-user-1 with the provided email
      setUser({ ...profile, email });
    } else {
      // Fallback if DB is down
      setUser({
        id: "test-user-1",
        email,
        name: "Alex Chen",
        onboardedAt: null,
      });
    }
    setIsLoading(false);
    return true;
  }, []);

  const logout = useCallback(() => {
    setUser(null);
  }, []);

  const switchUser = useCallback(async (userId: string) => {
    setIsLoading(true);
    const profile = await fetchProfile(userId);
    if (profile) {
      setUser(profile);
    }
    setIsLoading(false);
  }, []);

  const updateUser = useCallback((updates: Partial<User>) => {
    setUser((prev) => (prev ? { ...prev, ...updates } : null));
  }, []);

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout, switchUser, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}
