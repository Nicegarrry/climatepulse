import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import pool from "@/lib/db";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=auth`);
  }

  const cookieStore = await cookies();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        },
      },
    }
  );

  const { data: sessionData, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    console.error("Auth callback error:", error.message);
    return NextResponse.redirect(`${origin}/login?error=auth`);
  }

  // Pre-fill user_profiles.name from OAuth metadata (Google populates
  // user_metadata.full_name and .name). Only overwrites the email-prefix
  // placeholder that onboarding writes when no name is supplied — never
  // clobbers a name the user has set themselves.
  const oauthName =
    (sessionData.user?.user_metadata?.full_name as string | undefined) ??
    (sessionData.user?.user_metadata?.name as string | undefined);
  const userEmail = sessionData.user?.email;
  const userId = sessionData.user?.id;

  if (oauthName && userEmail && userId) {
    try {
      await pool.query(
        `INSERT INTO user_profiles (id, name, email)
         VALUES ($1, $2, $3)
         ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name
           WHERE user_profiles.name IS NULL
              OR user_profiles.name = ''
              OR user_profiles.name = split_part(user_profiles.email, '@', 1)`,
        [userId, oauthName, userEmail]
      );
    } catch (err) {
      // Non-fatal — auth still succeeds, user can edit name later.
      console.warn("OAuth name pre-fill failed:", err);
    }
  }

  const response = NextResponse.redirect(`${origin}/launchpad`);
  // Mark this browser as a returning user so the landing page can
  // redirect them straight to /launchpad on future root-URL visits.
  // Functional cookie — survives logout, cleared only by the user.
  response.cookies.set("cp_returning", "1", {
    maxAge: 60 * 60 * 24 * 365, // 1 year
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    httpOnly: false,
  });
  return response;
}
