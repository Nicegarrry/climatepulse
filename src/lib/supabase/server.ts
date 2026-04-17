import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import pool from "@/lib/db";
import type { User } from "@supabase/supabase-js";

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cookiesToSet) => {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch {
            // setAll can fail in Server Components where cookies are read-only.
            // This is expected — middleware handles the refresh.
          }
        },
      },
    }
  );
}

/**
 * Returns the authenticated Supabase user, or null if not signed in.
 */
export async function getAuthUser(): Promise<User | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user ?? null;
}

const ROLE_LEVEL: Record<string, number> = {
  reader: 0,
  editor: 1,
  admin: 2,
};

const TIER_LEVEL: Record<string, number> = {
  free: 0,
  launch: 1,
  paid: 1,
  founder: 2,
};

/**
 * Checks auth and role from user_profiles table.
 * Returns { user, profile } on success or { error, status } on failure.
 */
export async function requireAuth(minRole?: "reader" | "editor" | "admin") {
  const user = await getAuthUser();
  if (!user) {
    return { error: "Not authenticated", status: 401 } as const;
  }

  try {
    const result = await pool.query(
      `SELECT id, name, email, user_role, onboarded_at, tier FROM user_profiles WHERE id = $1`,
      [user.id]
    );

    if (result.rows.length === 0) {
      return { error: "Profile not found", status: 404 } as const;
    }

    const profile = result.rows[0];
    const userRole = profile.user_role || "reader";

    if (minRole && (ROLE_LEVEL[userRole] ?? 0) < (ROLE_LEVEL[minRole] ?? 0)) {
      return { error: "Insufficient permissions", status: 403 } as const;
    }

    return { user, profile } as const;
  } catch {
    return { error: "Database error", status: 500 } as const;
  }
}

/**
 * Tier gate. Use after requireAuth when a route needs a paid-or-higher surface.
 * Returns { user, profile } on success or { error, status: 402|403 } on failure.
 */
export async function requireTier(minTier: "launch" | "paid" | "founder") {
  const auth = await requireAuth();
  if ("error" in auth) return auth;

  const tier = auth.profile.tier || "free";
  if ((TIER_LEVEL[tier] ?? 0) < (TIER_LEVEL[minTier] ?? 0)) {
    return { error: "Upgrade required", status: 402 } as const;
  }
  return auth;
}
