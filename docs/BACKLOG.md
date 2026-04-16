# Deployment Backlog

## Strategy: Deploy First, Build in Public

Deploy with what works now. The weekly digest LinkedIn funnel is the growth engine — every week without it live is a week of missed audience building. Features 1-5 below are growth/stickiness features that benefit from user feedback, not guesswork.

---

## Pre-Deploy Build Order

Everything in this section must be done before the first production deployment. Estimated total: 2-3 sessions.

### Step 1. Supabase Project Setup

Create a Supabase project (free tier). This gives you:
- PostgreSQL database (replaces Docker locally and Railway for prod)
- Auth with magic links (replaces mock auth)
- Dashboard for user management
- Connection string for the `pg` driver (existing code works unchanged)

**Actions:**
- Create Supabase project at supabase.com
- Note the project URL, anon key, and database connection string
- Run all migration scripts against Supabase Postgres (via Supabase SQL editor or `psql`)
- Seed taxonomy, sources, channels, test users

### Step 2. Supabase Auth (Magic Links)

Replace the mock auth-context with real Supabase Auth.

**New files:**
- `src/lib/supabase/client.ts` — browser Supabase client
- `src/lib/supabase/server.ts` — server Supabase client + `getAuthUser()` helper
- `src/middleware.ts` — refresh Supabase session cookie on every request

**Modified files:**
- `src/lib/auth-context.tsx` — wrap Supabase session state, expose `user` + `role`
- `src/app/login/page.tsx` — email input only, `signInWithOtp()`, check-your-email screen
- `src/app/(app)/layout.tsx` — guard with Supabase session, remove DevPanel (or admin-only)

**Dependencies:** `@supabase/supabase-js`, `@supabase/ssr`

**Environment variables:**
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

**User registration:** Invite-only. Create users in Supabase dashboard. No public signup page.

### Step 3. User Roles (Three-Tier Access)

```sql
ALTER TABLE user_profiles ADD COLUMN user_role TEXT DEFAULT 'reader'
  CHECK (user_role IN ('reader', 'editor', 'admin'));
```

| Role | Tabs | Capabilities |
|------|------|-------------|
| **reader** | Briefing, Energy, Markets, Weekly | Read digests, personalise briefing, listen to podcast |
| **editor** | + Editor tab | Create/edit/publish weekly digests, query enriched articles |
| **admin** | + Discovery, Categories, Taxonomy | Pipeline control, taxonomy management, enrichment runs |

**Implementation:**
- Fetch `user_role` from `user_profiles` at login, store in auth context
- Dashboard renders tabs conditionally based on role (replaces `NEXT_PUBLIC_SHOW_DEV_TABS`)
- Remove dev panel from production (or admin-only)
- Remove user-switcher dropdown

### Step 4. API Route Protection

Add auth checks to all API routes:

**Route protection tiers:**
- **Public:** `/api/auth/*`, health check
- **Authenticated (any role):** `/api/digest/*` (GET), `/api/weekly/digests` (GET), `/api/energy/*`, `/api/user/profile`, `/api/podcast/*` (GET)
- **Editor+:** `/api/weekly/digests` (POST/PATCH), `/api/weekly/digests/[id]/publish`, `/api/weekly/generate`
- **Admin only:** `/api/pipeline/*`, `/api/enrichment/*`, `/api/discovery/*`, `/api/taxonomy/*`, `/api/entities/*`
- **Cron only:** POST to `/api/pipeline/run`, `/api/weekly/generate` (when called by Vercel cron, verify `CRON_SECRET`)

### Step 5. Cron Endpoint Security

```typescript
const authHeader = req.headers.get("authorization");
if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}
```

### Step 6. Editor Tab

Visible to `editor` and `admin` roles. The weekly digest workflow in a UI.

**Sections:**
- **Report Viewer:** Latest auto-generated intelligence report (theme clusters, top numbers, sentiment)
- **Story Picker:** Query enriched articles by date range, domain, significance — star stories for inclusion
- **Digest Composer:** Headline, editorial narrative (markdown textarea), weekly number fields, outlook
- **Story Editor:** Per story: headline, source, editor_take, severity dropdown, sector, key_metric
- **Preview:** Live preview rendered with existing Weekly tab components
- **Publish:** Button calls publish endpoint, confirms before sending email + setting banner

**New files:** `src/components/editor/` folder with subcomponents

### Step 7. Vercel Deployment

**7a. Link project to Vercel:**
```bash
npx vercel link
```

**7b. Set environment variables:**
```bash
vercel env add DATABASE_URL production
vercel env add GOOGLE_AI_API_KEY production
vercel env add ANTHROPIC_API_KEY production
vercel env add NEXT_PUBLIC_SUPABASE_URL production
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY production
vercel env add CRON_SECRET production
vercel env add RESEND_API_KEY production
```

**7c. Preview deploy (test everything):**
```bash
vercel
```
Verify: login flow, onboarding, briefing tab, weekly tab, energy tab, podcast player, cron endpoints (manual trigger).

**7d. Production deploy:**
```bash
vercel --prod
```

**7e. Configure domain:**
- Add custom domain in Vercel dashboard (climatepulse.app or similar)
- Update Supabase redirect URLs to include the production domain
- Update `NEXT_PUBLIC_APP_URL` if used in email templates

**7f. Verify crons:**
- Check Vercel dashboard > Crons tab — should show daily pipeline + weekly report schedules
- Manually trigger each cron once to verify they work with `CRON_SECRET`

**7g. Seed admin user:**
1. Visit the live site, log in with your email (magic link)
2. Complete onboarding
3. In Supabase SQL editor:
   ```sql
   UPDATE user_profiles SET user_role = 'admin' WHERE email = 'your@email.com';
   ```

---

## Post-Deploy Feature Roadmap

Ordered by impact and dependency. Build in this sequence.

### Phase A: Search (High value, moderate effort)

AI-powered topic search across the article database.

**Concept:**
- Search bar in nav or as a dedicated modal
- Query hits enriched articles (full-text search via PostgreSQL `tsvector` or `ILIKE` on title/snippet)
- Results: matching articles ranked by relevance + significance
- AI summary: one Gemini Flash call to synthesize a 2-3 sentence answer from top 5 results
- Layered prompting: if user's role_lens is set, frame the answer through that lens

**Implementation sketch:**
- Add `tsvector` column to `raw_articles` for full-text search (or use `ILIKE` to start)
- New API route: `/api/search?q=...` — returns articles + AI summary
- New component: search modal with results list + AI answer card
- Cost: ~$0.001 per search (one Gemini Flash call)

### Phase B: Events Timeline

Climate events calendar/timeline.

**Concept:**
- Upcoming policy decisions, report releases, conferences, earnings
- Manual + auto-populated from article entities (regulation dates, project milestones)
- "What to watch this week" feed

**Status:** Tab exists as placeholder. Needs schema + UI.

### Phase C: Learn ("Climate 101")

Semi-curated learning modules leveraging the taxonomy.

**Concept:**
- Each microsector (108) gets a "101 module" — pre-written explainer (what it is, why it matters, key players, recent trends)
- Learning journey: user picks domains of interest, gets a suggested reading path
- Snippets: short "did you know" cards surfaced in the daily briefing sidebar
- Progress tracking: which modules completed, knowledge score

**This is big.** The 101 content needs to be written (AI-assisted but human-edited). Suggest:
1. Start with the 12 domain-level explainers (manageable scope)
2. Then the ~30 sector-level modules
3. Microsector modules generated on-demand via AI with editorial review
4. Track completion in a new `user_learning_progress` table

**Schema sketch:**
```sql
CREATE TABLE learning_modules (
  id SERIAL PRIMARY KEY,
  taxonomy_level TEXT CHECK (taxonomy_level IN ('domain', 'sector', 'microsector')),
  taxonomy_id INTEGER,
  title TEXT,
  content TEXT,          -- markdown
  difficulty TEXT,       -- beginner, intermediate, advanced
  estimated_minutes INTEGER,
  status TEXT DEFAULT 'draft'
);

CREATE TABLE user_learning_progress (
  user_id TEXT,
  module_id INTEGER,
  completed_at TIMESTAMPTZ,
  quiz_score INTEGER,
  PRIMARY KEY (user_id, module_id)
);
```

### Phase D: Gamification Refinements

Build on existing streak/completion tracking.

**Ideas:**
- Desktop gamification elements (streak flames, weekly badges, sector mastery indicators)
- Podcast listening stats (episodes completed, total listen time)
- "Climate Pulse Score" — composite of: briefing streak, sectors covered, modules completed, digest reads
- Achievements: "First Week", "5-Day Streak", "All Domains Covered", "Podcast Regular"
- Leaderboard (when user base > 20, per the existing cohort threshold)

### Phase E: Community

The biggest feature. Delay until you have active users to test with.

**Options (from lightest to heaviest):**
1. **Comments on digest stories** — simplest, one table, moderated
2. **Discussion threads per topic/domain** — forum-lite, needs moderation
3. **Expert Q&A** — curated questions, you (or guest experts) answer
4. **Peer recommendations** — "stories I found valuable this week" from other readers

**Recommendation:** Start with option 1 (comments on weekly digest stories) and see if engagement warrants more. Don't build a forum until you know people will use it.

---

## Auth Implementation Details

### Supabase Auth with Magic Links

**What changes:**
- `src/lib/supabase/client.ts` — browser client (`createBrowserClient`)
- `src/lib/supabase/server.ts` — server client (`createServerClient`) + `getAuthUser()` helper
- `src/lib/auth-context.tsx` — new provider wrapping Supabase session, exposes `user`, `role`, `login`, `logout`
- `src/app/login/page.tsx` — email-only form, calls `supabase.auth.signInWithOtp()`, shows "check your email" state
- `src/middleware.ts` — refreshes Supabase session cookie, redirects unauthenticated to `/login`
- `src/app/(app)/layout.tsx` — removes DevPanel (or gates to admin), removes user-switcher

### API Route Auth Helper

```typescript
// src/lib/supabase/server.ts
export async function requireAuth(req: NextRequest, minRole?: 'reader' | 'editor' | 'admin') {
  const user = await getAuthUser();
  if (!user) throw new AuthError('Not authenticated');
  
  if (minRole) {
    const profile = await getProfile(user.id);
    const hierarchy = { reader: 0, editor: 1, admin: 2 };
    if (hierarchy[profile.user_role] < hierarchy[minRole]) {
      throw new AuthError('Insufficient permissions');
    }
  }
  
  return user;
}
```

### Database Strategy

Use Supabase Postgres for everything:
- Auth tables managed by Supabase automatically
- Application tables (articles, enrichment, taxonomy, etc.) in the same database
- `DATABASE_URL` points to Supabase connection string (pooler for serverless)
- Existing `pg` driver code works unchanged — just a different connection string
- Run all migration scripts via Supabase SQL editor or MCP

---

## Environment Variables (Complete List)

### Production (Vercel)
```
DATABASE_URL=                      # Supabase Postgres pooler connection string
GOOGLE_AI_API_KEY=                 # Gemini for enrichment + TTS
ANTHROPIC_API_KEY=                 # Claude for digest + podcast script
NEXT_PUBLIC_SUPABASE_URL=          # Supabase project URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=     # Supabase anon key
CRON_SECRET=                       # Random string for cron auth
RESEND_API_KEY=                    # Email delivery
OPENELECTRICITY_API_KEY=           # Australian NEM data
NEXT_PUBLIC_APP_URL=               # Production URL for email links
```

### Local Development
```
DATABASE_URL=                      # Docker Postgres (existing)
GOOGLE_AI_API_KEY=                 # Same key
ANTHROPIC_API_KEY=                 # Same key
NEXT_PUBLIC_SUPABASE_URL=          # Supabase project URL (same project, different client)
NEXT_PUBLIC_SUPABASE_ANON_KEY=     # Same anon key
NEXT_PUBLIC_SHOW_DEV_TABS=true     # Keep for local dev until role system is live
OPENELECTRICITY_API_KEY=           # Same key
```
