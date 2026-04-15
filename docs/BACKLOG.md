# Deployment Backlog

## Auth & Access Control (Pre-Deploy — Required)

### 1. Supabase Auth with Magic Links

Replace the mock auth-context with Supabase Auth. Magic links first (no password management), Google OAuth later.

**What changes:**
- Add `@supabase/supabase-js` and `@supabase/ssr` dependencies
- Create `src/lib/supabase/client.ts` (browser client) and `src/lib/supabase/server.ts` (server client)
- Replace `src/lib/auth-context.tsx` — new `AuthProvider` wraps Supabase session state
- Replace `src/app/login/page.tsx` — email input only, calls `supabase.auth.signInWithOtp()`
- Add `src/middleware.ts` — refresh Supabase session cookie on every request
- Supabase project needed (free tier is fine for launch)

**Environment variables:**
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

**User registration approach:** Invite-only at launch. You create users manually in the Supabase dashboard or via a seed script. No public signup page.

### 2. User Roles (Three-Tier Access)

Add a `user_role` column to `user_profiles`:

```sql
ALTER TABLE user_profiles ADD COLUMN user_role TEXT DEFAULT 'reader'
  CHECK (user_role IN ('reader', 'editor', 'admin'));
```

| Role | Sees | Can Do |
|------|------|--------|
| **reader** | Briefing, Energy, Markets, Weekly | Read digests, personalise briefing |
| **editor** | Reader tabs + Editor tab | Create/edit/publish weekly digests, query pipeline data |
| **admin** | All tabs incl. Discovery, Categories, Taxonomy | Full pipeline control, manage taxonomy, run enrichment |

**Implementation:**
- `user_role` is fetched from `user_profiles` at login and stored in auth context
- Dashboard conditionally renders tabs based on role (replaces `NEXT_PUBLIC_SHOW_DEV_TABS`)
- No middleware-level RBAC needed yet — just client-side tab gating + API route checks

### 3. API Route Protection

Every API route needs to verify the Supabase JWT:

```typescript
// src/lib/supabase/server.ts — helper for route handlers
import { createClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function getAuthUser() {
  const supabase = createClient(...);
  const { data: { user } } = await supabase.auth.getUser();
  return user; // null if not authenticated
}
```

**Route protection tiers:**
- **Public:** Login, health check
- **Reader:** `/api/digest/*`, `/api/weekly/digests` (GET only), `/api/energy/*`, `/api/user/profile`
- **Editor:** `/api/weekly/digests` (POST/PATCH), `/api/weekly/digests/[id]/publish`, `/api/weekly/generate`
- **Admin:** `/api/pipeline/*`, `/api/enrichment/*`, `/api/discovery/*`, `/api/taxonomy/*`, `/api/entities/*`

### 4. Cron Endpoint Security

Pipeline and weekly generation endpoints must verify a secret when called by Vercel Crons:

```typescript
// In route handler
const authHeader = req.headers.get("authorization");
if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}
```

**Environment variables:**
```
CRON_SECRET=           # Random string, set in Vercel + vercel.json headers
```

### 5. Remove Dev Panel from Production

- Remove `<DevPanel />` from `src/app/(app)/layout.tsx`
- OR: only render when `user_role === 'admin'`
- Remove the user-switcher dropdown entirely
- Remove `NEXT_PUBLIC_SHOW_DEV_TABS` — replaced by role-based tab gating

---

## Editor Tab (Pre-Deploy — Required)

### 6. Weekly Digest Editor UI

A new tab visible only to `editor` and `admin` roles. Replaces the need for curl commands.

**Features:**
- **Report Viewer:** Fetch latest auto-generated weekly report, display theme clusters, top numbers, sentiment
- **Story Picker:** Query enriched articles by date range, domain, significance — select stories for the digest
- **Digest Composer:** Form with fields for headline, editorial narrative (markdown editor), weekly number, outlook
- **Story Editor:** For each curated story: headline, source, editor_take (textarea), severity (dropdown), sector, key_metric
- **Preview:** Live preview of the digest as it will appear on the Weekly tab
- **Publish Button:** Calls `/api/weekly/digests/[id]/publish` — confirms before sending

**Implementation approach:**
- New `src/components/editor/` folder with subcomponents
- Add `editor` to `tabConfig` in dashboard (gated by role)
- Reuse existing Weekly tab components for preview
- The composer POSTs to `/api/weekly/digests` on save, PATCH on edit

---

## Deployment Configuration (Pre-Deploy — Required)

### 7. Environment Setup

Vercel environment variables needed:
```
DATABASE_URL=              # Production PostgreSQL (Railway or Supabase)
GOOGLE_AI_API_KEY=         # Gemini for enrichment
ANTHROPIC_API_KEY=         # Claude for digest generation
NEXT_PUBLIC_SUPABASE_URL=  # Supabase project URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=  # Supabase anon key
CRON_SECRET=               # Random string for cron auth
RESEND_API_KEY=            # Email delivery
DIGEST_TEST_EMAIL=         # Override for testing
```

### 8. Database Migration Strategy

Current: Docker PostgreSQL locally. Production options:
- **Railway PostgreSQL** (per CLAUDE.md plan) — simple, pay-per-use
- **Supabase PostgreSQL** — get auth + database in one, but more opinionated

Decision needed: If using Supabase Auth, using Supabase Postgres too makes sense (auth tables are co-located). But the `pg` driver still works — just point `DATABASE_URL` at the Supabase connection string.

### 9. Seed Admin User

After deploying with Supabase Auth:
1. Create your account via magic link (you'll land on onboarding)
2. Run SQL to promote yourself:
   ```sql
   UPDATE user_profiles SET user_role = 'admin' WHERE email = 'your@email.com';
   ```
3. All future users default to `reader`

---

## Post-Launch Backlog (Delay)

### 10. Google OAuth
Add as second auth option after magic links are working. Low effort with Supabase.

### 11. Public Signup
Currently invite-only. Add a signup page when ready for growth. Consider a waitlist or approval flow.

### 12. Multi-Writer Editorial Workflow
- Draft/review/publish states with ownership
- Digest assignment (which editor writes this week)
- Editorial comments/feedback on drafts
- Version history

### 13. Email Preferences
- Per-user: opt in/out of weekly digest email
- Frequency: weekly / breaking only / digest + daily
- Unsubscribe via email link (required for CAN-SPAM)

### 14. Reader Analytics Dashboard
- How many readers per digest
- Open rates / click-through (needs tracking pixel or Resend webhooks)
- Most-read stories
- Subscriber growth over time

### 15. LinkedIn Auto-Post
- Integrate LinkedIn API for direct posting
- Currently: LinkedIn draft text is generated, user copies manually
- Future: OAuth + auto-post on publish (with approval step)

### 16. Mobile Push Notifications
- Requires service worker / PWA setup
- "New weekly digest" push on Sunday morning
- Breaking news push for significance > 90

### 17. Content Access Gating
- Free tier: Weekly digest only
- Pro tier: Daily briefing + full archive + Energy tab
- Requires Stripe integration
