# Pre-Deployment Implementation Plan

## Overview

Seven workstreams to take ClimatePulse from dev environment to production. Workstreams are designed for parallel agent execution where dependencies allow.

**Dependency graph:**
```
WS1 (Supabase Auth) ──┬──> WS2 (Roles + Dashboard Cleanup)
                       ├──> WS3 (Account & Settings)
                       └──> WS6 (API Protection)
WS4 (Editor Tab) ─────────> depends on WS2 (needs role gating)
WS5 (Mobile + PWA) ────────> independent, parallel with all
WS7 (Deployment) ──────────> final, depends on all others
```

**Parallelisation plan:**
- **Round 1:** WS1 (Auth) + WS5 (Mobile/PWA) in parallel
- **Round 2:** WS2 (Roles) + WS3 (Account) + WS6 (API Protection) in parallel (all depend on WS1)
- **Round 3:** WS4 (Editor Tab) — depends on WS2
- **Round 4:** WS7 (Deployment) — final integration + deploy

---

## WS1: Supabase Auth with Magic Links

### 1.1 Supabase Project Setup

**Manual steps (user does these):**
- Create Supabase project at supabase.com
- Go to Settings > Auth > Email > SMTP Settings
- Configure custom SMTP with Resend:
  - Host: `smtp.resend.com`
  - Port: 465 (SSL)
  - Username: `resend`
  - Password: `re_YOUR_RESEND_API_KEY`
  - Sender: `Climate Pulse <auth@climatepulse.app>` (or your verified domain)
- Go to Settings > Auth > Email Templates
  - Customise the magic link template (subject, body HTML)
- Note: `Project URL`, `anon key`, and `Database URL` (pooler, port 6543)
- Add these to `.env.local`:
  ```
  NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
  NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
  ```

**Why Resend for auth emails:** Supabase's default email sender has low limits (4/hour on free tier) and poor deliverability. Resend via SMTP gives you branded `@climatepulse.app` emails, better deliverability, and no rate limits. This was the issue with BenchWatch — Supabase default emails were hitting rate limits or going to spam.

### 1.2 Install Dependencies

```bash
npm install @supabase/supabase-js @supabase/ssr
```

### 1.3 Supabase Client Helpers

**Create `src/lib/supabase/client.ts`:**
- Browser client using `createBrowserClient` from `@supabase/ssr`
- Uses `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- Singleton pattern (one client per browser tab)

**Create `src/lib/supabase/server.ts`:**
- Server client using `createServerClient` from `@supabase/ssr`
- Reads/writes cookies via `next/headers`
- Exports `getAuthUser()` helper — returns Supabase user or null
- Exports `requireAuth(minRole?)` — throws if not authenticated or insufficient role
- Exports `getSupabaseClient()` for arbitrary server-side queries

### 1.4 Middleware

**Create `src/middleware.ts`:**
- Refreshes Supabase session on every request (prevents stale cookies)
- Redirects unauthenticated users to `/login` for protected routes
- Skips auth check for: `/login`, `/auth/callback`, `/api/auth/*`, static assets
- Matcher config: `/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)`

**Create `src/app/auth/callback/route.ts`:**
- Handles the magic link redirect from email
- Exchanges auth code for session
- Redirects to `/dashboard` (or `/onboarding` if not onboarded)

### 1.5 Replace Auth Context

**Rewrite `src/lib/auth-context.tsx`:**
- Remove mock login/switchUser/test user logic entirely
- New state: `user` (from Supabase session) + `profile` (from user_profiles) + `role`
- On mount: check Supabase session, fetch profile from `/api/user/profile`
- `login(email)` → calls `supabase.auth.signInWithOtp({ email })`
- `logout()` → calls `supabase.auth.signOut()`, redirects to `/login`
- `onAuthStateChange` listener for session refresh
- Expose: `user`, `profile`, `role`, `isLoading`, `login`, `logout`, `updateProfile`

**New User interface:**
```typescript
interface AuthUser {
  id: string;          // Supabase auth.users.id (UUID)
  email: string;
  name: string;
  role: 'reader' | 'editor' | 'admin';
  onboardedAt: string | null;
}
```

### 1.6 Replace Login Page

**Rewrite `src/app/login/page.tsx`:**
- Email-only input (no password field)
- Submit calls `supabase.auth.signInWithOtp({ email })`
- Two states:
  1. **Email form** — "Enter your email to sign in"
  2. **Check your email** — "We sent a magic link to {email}. Click the link to sign in."
- Back button to return to email form
- Resend link option (with 60s cooldown)
- Error handling: invalid email, rate limit, network error
- Clean design matching the existing warm paper aesthetic
- Logo, tagline, no mention of "demo"

### 1.7 Magic Link Email Template

**Configure in Supabase dashboard (Auth > Email Templates):**

Subject: `Sign in to Climate Pulse`

HTML template (matching the warm editorial style):
- Climate Pulse logo header
- "Click the link below to sign in to Climate Pulse"
- Big CTA button: "Sign in to Climate Pulse" → `{{ .ConfirmationURL }}`
- "If you didn't request this, you can safely ignore this email."
- Footer: "Climate Pulse — Climate & Energy Intelligence"

### 1.8 User Profile Bridging

When a user signs in via Supabase for the first time, they won't have a `user_profiles` row. Handle this:

**Modify `/api/user/profile` GET:**
- Accept Supabase auth user ID (from session, not query param)
- If no profile exists → return `null` (triggers onboarding)

**Modify onboarding flow:**
- On complete, create `user_profiles` row with Supabase `auth.users.id` as the `id`
- Set `user_role = 'reader'` by default
- Set `onboarded_at = NOW()`

### Files changed:
| File | Action |
|------|--------|
| `src/lib/supabase/client.ts` | **Create** |
| `src/lib/supabase/server.ts` | **Create** |
| `src/middleware.ts` | **Create** |
| `src/app/auth/callback/route.ts` | **Create** |
| `src/lib/auth-context.tsx` | **Rewrite** |
| `src/app/login/page.tsx` | **Rewrite** |
| `src/app/onboarding/page.tsx` | **Modify** (use Supabase user ID) |
| `src/app/api/user/profile/route.ts` | **Modify** (auth-aware) |
| `package.json` | **Modify** (add deps) |

---

## WS2: User Roles + Dashboard Cleanup

### 2.1 Add user_role Column

```sql
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS user_role TEXT DEFAULT 'reader'
  CHECK (user_role IN ('reader', 'editor', 'admin'));
```

### 2.2 Refactor Dashboard Tab Config

**Modify `src/app/(app)/dashboard/page.tsx`:**

Replace the `IS_DEV` / `NEXT_PUBLIC_SHOW_DEV_TABS` system with role-based tab config:

```typescript
const readerTabs = [
  { value: "intelligence", label: "Briefing", icon: NewspaperIcon },
  { value: "energy", label: "Energy", icon: BoltIcon },
  { value: "markets", label: "Markets", icon: ChartBarIcon },
  { value: "weekly", label: "Weekly", icon: CalendarDaysIcon },
];

const editorTabs = [
  { value: "editor", label: "Editor", icon: PencilSquareIcon },
];

const adminTabs = [
  { value: "discovery", label: "Discovery", icon: MagnifyingGlassIcon },
  { value: "categories", label: "Categories", icon: TagIcon },
  { value: "taxonomy", label: "Taxonomy", icon: AdjustmentsHorizontalIcon },
];

function getTabsForRole(role: string) {
  const tabs = [...readerTabs];
  if (role === 'editor' || role === 'admin') tabs.push(...editorTabs);
  if (role === 'admin') tabs.push(...adminTabs);
  return tabs;
}
```

### 2.3 Remove Dev Panel

**Modify `src/app/(app)/layout.tsx`:**
- Remove `<DevPanel />` import and rendering entirely
- OR: only render when `role === 'admin'` (useful for debugging in production)
- Remove dev panel button from sidebar

**Modify `src/app/(app)/dashboard/page.tsx`:**
- Remove the dev panel toggle button from sidebar
- Remove `useDevLogger` usage from tab switching (or keep silently for analytics)
- Remove `CommandLineIcon` import

### 2.4 Clean Sidebar

**For readers and editors:**
- No dev button
- No collapse/expand indicator text (just the icon)
- User dropdown: only shows Profile, Settings, Sign out (no dev options)
- Clean, minimal nav with just their allowed tabs

**For admin:**
- Everything visible
- Optional: small "Admin" badge next to admin-only tabs

### 2.5 Remove User Switcher

**Delete or gut `src/components/dev-panel.tsx`:**
- Remove the TEST_USERS array
- Remove switchUser functionality
- If keeping dev panel for admin: remove user switcher section, keep only log console

### 2.6 Update Mobile Nav

Mobile bottom nav should show role-appropriate tabs (max 4-5 items):
- **Reader:** Briefing, Energy, Markets, Weekly
- **Editor:** Briefing, Editor, Markets, Weekly  
- **Admin:** Briefing, Editor, Energy, Weekly (admin tabs accessible via sidebar only on desktop)

### Files changed:
| File | Action |
|------|--------|
| `scripts/migrate-roles.sql` | **Create** |
| `src/app/(app)/dashboard/page.tsx` | **Modify** (role-based tabs, remove dev UI) |
| `src/app/(app)/layout.tsx` | **Modify** (remove/gate DevPanel) |
| `src/components/dev-panel.tsx` | **Delete or gut** |

---

## WS3: Account Management & Settings

### 3.1 Profile Page Improvements

**Modify `src/app/(app)/profile/page.tsx`:**
- Show real user data from Supabase auth + user_profiles
- Editable name (updates both auth metadata and user_profiles)
- Email shown read-only (from Supabase auth)
- Role badge (reader/editor/admin)
- Member since date (from Supabase auth `created_at`)
- "Verified" badge (Supabase confirms email via magic link)
- Remove "Two-factor auth" row (not implementing yet)
- Remove delete account from danger zone (premature for launch)

### 3.2 Settings Enhancements

**Modify `src/app/(app)/settings/page.tsx`:**

Current settings work well. Add:

**Notification Preferences (real, not just local state):**
- Daily briefing ready — toggle (persisted to user_profiles)
- Weekly digest published — toggle
- High-priority alerts (significance > 75) — toggle
- Followed entity updates — toggle
- Store as JSONB `notification_prefs` column on user_profiles

**Account section:**
- Change email (triggers Supabase email change flow + confirmation)
- Sign out of all devices (revokes all Supabase sessions)

**Data & Privacy:**
- Export my data (future — placeholder link)
- Delete account (future — placeholder with "contact us" for now)

### 3.3 Notification Preferences Migration

```sql
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS notification_prefs JSONB DEFAULT '{
  "daily_briefing": true,
  "weekly_digest": true,
  "high_priority_alerts": false,
  "entity_updates": false
}';
```

### Files changed:
| File | Action |
|------|--------|
| `scripts/migrate-notifications.sql` | **Create** |
| `src/app/(app)/profile/page.tsx` | **Modify** (real data, role badge) |
| `src/app/(app)/settings/page.tsx` | **Modify** (persist notifications, account actions) |
| `src/app/api/user/profile/route.ts` | **Modify** (handle notification_prefs) |

---

## WS4: Editor Tab

### 4.1 Editor Tab Component

**Create `src/components/editor/index.tsx`:**
Main orchestrator with 4 sections as sub-tabs or scrollable panels:

**Section A — Intelligence Report Viewer:**
- Fetches latest auto-generated weekly report from `/api/weekly/reports`
- Displays: theme clusters (expandable cards), top numbers, sentiment summary by domain
- "Use this report" button pre-populates the composer

**Section B — Story Picker:**
- Date range selector (default: last 7 days)
- Domain filter dropdown
- Minimum significance slider
- Results: enriched articles as compact rows (title, source, domain, significance, sentiment)
- Star/select articles for inclusion in digest
- "Add selected to digest" button

**Section C — Digest Composer:**
- **Headline:** text input
- **Editorial Narrative:** tall markdown textarea (or rich text if we want to be fancy)
- **Weekly Number:** value, unit, label, context, trend fields
- **Outlook:** textarea for "what to watch"
- **Curated Stories:** drag-reorderable list of selected stories, each with:
  - Headline (pre-filled from article, editable)
  - Source (pre-filled)
  - Editor Take (textarea — this is where the editorial voice goes)
  - Severity dropdown (alert/watch/ready/clear)
  - Sector (pre-filled from domain, editable)
  - Key Metric fields (value, unit, delta — optional)
- **Save Draft** button (POST/PATCH to `/api/weekly/digests`)
- Auto-save on change (debounced)

**Section D — Preview & Publish:**
- Live preview renders the digest using `<CurrentDigest>` component from weekly tab
- Side-by-side on desktop: composer left, preview right
- **Publish** button with confirmation modal:
  - "Publishing will: send email to subscribers, show banner on Intelligence tab, generate LinkedIn draft"
  - Confirm / Cancel
- After publish: shows LinkedIn draft in copyable textarea

### 4.2 API Additions for Editor

**Modify `/api/weekly/digests/route.ts`:**
- Add article search endpoint: `GET /api/weekly/articles?from=2026-04-07&to=2026-04-13&domain=energy-storage&minSignificance=40`
- Returns enriched articles with entity names, suitable for the story picker

### Files changed:
| File | Action |
|------|--------|
| `src/components/editor/index.tsx` | **Create** |
| `src/components/editor/report-viewer.tsx` | **Create** |
| `src/components/editor/story-picker.tsx` | **Create** |
| `src/components/editor/digest-composer.tsx` | **Create** |
| `src/components/editor/preview-panel.tsx` | **Create** |
| `src/app/api/weekly/articles/route.ts` | **Create** (article search for editor) |
| `src/app/(app)/dashboard/page.tsx` | **Modify** (add Editor tab case) |

---

## WS5: Mobile + PWA

### 5.1 Web App Manifest

**Create `public/manifest.json`:**
```json
{
  "name": "Climate Pulse",
  "short_name": "ClimatePulse",
  "description": "Climate & energy intelligence platform",
  "start_url": "/dashboard",
  "display": "standalone",
  "background_color": "#FAF9F7",
  "theme_color": "#1E4D2B",
  "icons": [
    { "src": "/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icon-512.png", "sizes": "512x512", "type": "image/png" },
    { "src": "/icon-maskable.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
  ]
}
```

### 5.2 Meta Tags for iOS/Android

**Modify `src/app/layout.tsx` metadata:**
```typescript
export const metadata: Metadata = {
  title: "Climate Pulse",
  description: "Climate & energy intelligence platform",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Climate Pulse",
  },
  other: {
    "mobile-web-app-capable": "yes",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#1E4D2B",
  viewportFit: "cover",
};
```

### 5.3 iOS-Specific Polish

- Add Apple touch icons: `<link rel="apple-touch-icon" href="/apple-touch-icon.png">`
- Splash screen images for common iOS sizes (optional, can do later)
- `viewport-fit: cover` for edge-to-edge on notched iPhones
- Safe area insets: `env(safe-area-inset-bottom)` on mobile bottom nav
- Status bar: `apple-mobile-web-app-status-bar-style: default` (dark status bar on light bg)

### 5.4 Android-Specific Polish

- Chrome install banner triggers automatically with manifest + service worker
- Theme colour in manifest matches forest green
- Maskable icon for adaptive icon support

### 5.5 Install Prompt (Lightweight)

**Create `src/components/install-prompt.tsx`:**
- Detects if running in browser (not standalone PWA)
- Shows a subtle banner on first visit: "Add Climate Pulse to your home screen for the best experience"
- Dismiss stores in localStorage
- For iOS: shows instructions ("Tap Share > Add to Home Screen")
- For Android: uses `beforeinstallprompt` event if available

### 5.6 Mobile Bottom Nav Polish

- Add `padding-bottom: env(safe-area-inset-bottom)` for iPhone home indicator
- Ensure touch targets are at least 44px
- Haptic feedback consideration (just CSS active states for now)

### 5.7 App Icons

Generate from the existing leaf SVG:
- `public/icon-192.png` — 192x192 with padding
- `public/icon-512.png` — 512x512 with padding
- `public/icon-maskable.png` — 512x512 with extra safe zone padding
- `public/apple-touch-icon.png` — 180x180

### Files changed:
| File | Action |
|------|--------|
| `public/manifest.json` | **Create** |
| `public/icon-192.png` | **Create** (generate from SVG) |
| `public/icon-512.png` | **Create** |
| `public/icon-maskable.png` | **Create** |
| `public/apple-touch-icon.png` | **Create** |
| `src/app/layout.tsx` | **Modify** (metadata, viewport, manifest link) |
| `src/components/install-prompt.tsx` | **Create** |
| `src/app/(app)/dashboard/page.tsx` | **Modify** (safe area padding on mobile nav) |

---

## WS6: API Route Protection

### 6.1 Auth Helper

**Uses `src/lib/supabase/server.ts` from WS1:**

```typescript
export async function requireAuth(minRole?: 'reader' | 'editor' | 'admin') {
  const supabase = createServerClient(...);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated', status: 401 };
  
  if (minRole) {
    const { rows } = await pool.query(
      'SELECT user_role FROM user_profiles WHERE id = $1', [user.id]
    );
    const role = rows[0]?.user_role || 'reader';
    const hierarchy = { reader: 0, editor: 1, admin: 2 };
    if (hierarchy[role] < hierarchy[minRole]) {
      return { error: 'Insufficient permissions', status: 403 };
    }
  }
  
  return { user };
}
```

### 6.2 Apply Auth to Routes

**Pattern for each route:**
```typescript
const auth = await requireAuth('editor');
if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
const { user } = auth;
```

**Routes by tier:**

| Tier | Routes | Check |
|------|--------|-------|
| Public | `/api/auth/*`, `/login` | None |
| Any authenticated | `/api/digest/generate` (GET), `/api/weekly/digests` (GET), `/api/energy/*`, `/api/user/profile`, `/api/podcast/*` (GET), `/api/markets/*` | `requireAuth()` |
| Editor+ | `/api/weekly/digests` (POST/PATCH), `/api/weekly/digests/[id]/publish`, `/api/weekly/articles` | `requireAuth('editor')` |
| Admin | `/api/pipeline/*`, `/api/enrichment/*`, `/api/discovery/*`, `/api/taxonomy/*`, `/api/entities/*`, `/api/channels/*` | `requireAuth('admin')` |
| Cron | POST `/api/pipeline/run`, POST `/api/weekly/generate`, POST `/api/analytics/weekly-pulse/generate` | CRON_SECRET check |

### 6.3 Cron Secret

**Add to all cron-triggered POST handlers:**
```typescript
// Allow both cron secret and admin auth
const cronSecret = req.headers.get("authorization");
if (cronSecret === `Bearer ${process.env.CRON_SECRET}`) {
  // Cron call — proceed
} else {
  const auth = await requireAuth('admin');
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
}
```

### 6.4 User Profile Route Rewrite

**Modify `/api/user/profile/route.ts`:**
- GET: uses Supabase user ID from session (not `?userId=` query param)
- PUT: can only update own profile
- POST: creates profile for authenticated user (onboarding)
- No more arbitrary user ID access

### Files changed:
| File | Action |
|------|--------|
| `src/app/api/user/profile/route.ts` | **Modify** |
| `src/app/api/digest/generate/route.ts` | **Modify** (add auth) |
| `src/app/api/weekly/digests/route.ts` | **Modify** (add auth) |
| `src/app/api/weekly/digests/[id]/route.ts` | **Modify** |
| `src/app/api/weekly/digests/[id]/publish/route.ts` | **Modify** |
| `src/app/api/weekly/generate/route.ts` | **Modify** (cron + admin) |
| `src/app/api/pipeline/run/route.ts` | **Modify** (cron + admin) |
| `src/app/api/enrichment/*/route.ts` | **Modify** (admin) |
| `src/app/api/discovery/*/route.ts` | **Modify** (admin) |
| `src/app/api/taxonomy/*/route.ts` | **Modify** (admin) |
| `src/app/api/entities/*/route.ts` | **Modify** (admin) |
| `src/app/api/energy/*/route.ts` | **Modify** (any auth) |
| `src/app/api/markets/*/route.ts` | **Modify** (any auth) |
| `src/app/api/analytics/*/route.ts` | **Modify** (cron or auth) |

---

## WS7: Vercel Deployment

### 7.1 Pre-Deploy Checklist

- [ ] All migrations run on Supabase Postgres (via MCP or SQL editor)
- [ ] Taxonomy, sources, channels seeded
- [ ] Supabase Auth configured with Resend SMTP
- [ ] Magic link email template customised
- [ ] Supabase Auth redirect URLs include production domain
- [ ] All API routes have auth checks
- [ ] Cron endpoints check CRON_SECRET
- [ ] Dev panel removed or admin-gated
- [ ] No hardcoded test user references in production paths
- [ ] PWA manifest and icons in place
- [ ] `NEXT_PUBLIC_SHOW_DEV_TABS` removed from production env

### 7.2 Vercel Project Setup

```bash
# Link project
npx vercel link

# Set all environment variables
vercel env add DATABASE_URL production
vercel env add GOOGLE_AI_API_KEY production
vercel env add ANTHROPIC_API_KEY production
vercel env add NEXT_PUBLIC_SUPABASE_URL production
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY production
vercel env add CRON_SECRET production
vercel env add RESEND_API_KEY production
vercel env add OPENELECTRICITY_API_KEY production
vercel env add NEXT_PUBLIC_APP_URL production    # e.g. https://climatepulse.app
```

### 7.3 Deploy Sequence

```bash
# 1. Preview deploy — test everything
vercel

# 2. Test on preview URL:
#    - Magic link login flow
#    - Onboarding
#    - All tabs render
#    - Cron endpoints (manual trigger)
#    - Weekly digest publish flow
#    - Mobile experience
#    - PWA install prompt

# 3. Production deploy
vercel --prod

# 4. Verify crons in Vercel dashboard
```

### 7.4 Custom Domain

```bash
# Add domain
vercel domains add climatepulse.app

# Configure DNS (at your registrar):
# A record → 76.76.21.21
# CNAME www → cname.vercel-dns.com
```

**Also update:**
- Supabase Auth > URL Configuration > Site URL → `https://climatepulse.app`
- Supabase Auth > URL Configuration > Redirect URLs → add `https://climatepulse.app/auth/callback`
- Resend > Domains > verify `climatepulse.app` for branded auth emails
- `NEXT_PUBLIC_APP_URL` env var → `https://climatepulse.app`

### 7.5 Seed Admin User

1. Visit production site, enter your email
2. Click magic link in email
3. Complete onboarding (role, sectors, regions)
4. In Supabase SQL editor:
   ```sql
   UPDATE user_profiles SET user_role = 'admin' WHERE email = 'your@email.com';
   ```
5. Refresh the app — admin tabs appear

---

## Agent Team Execution Plan

### Round 1 (Parallel)

**Agent A: Supabase Auth (WS1)**
- Install deps, create client/server helpers, middleware, auth callback route
- Rewrite auth-context.tsx and login page
- Modify onboarding to use Supabase user ID
- Modify user profile API route

**Agent B: Mobile + PWA (WS5)**
- Create manifest.json
- Generate app icons from SVG
- Update layout.tsx metadata/viewport
- Create install prompt component
- Add safe area padding to mobile nav

### Round 2 (Parallel, after Round 1)

**Agent C: Roles + Dashboard Cleanup (WS2)**
- Create migration for user_role column
- Refactor dashboard tabs to role-based config
- Remove dev panel button from sidebar
- Clean up user dropdown (remove dev options)
- Gate dev panel to admin-only or delete
- Update mobile nav for role-appropriate tabs

**Agent D: Account & Settings (WS3)**
- Flesh out profile page with real Supabase data
- Persist notification preferences
- Add notification_prefs migration
- Wire settings to real auth context
- Add account management actions (email change, sign out all)

**Agent E: API Protection (WS6)**
- Add requireAuth to all API routes
- Add CRON_SECRET verification to cron endpoints
- Rewrite user profile route to be auth-aware
- Test all routes return 401/403 appropriately

### Round 3 (Sequential)

**Agent F: Editor Tab (WS4)**
- Create editor component folder and subcomponents
- Build report viewer, story picker, digest composer, preview panel
- Create article search API endpoint
- Wire into dashboard with role gating
- Test full publish workflow

### Round 4 (Sequential)

**Agent G: Deployment (WS7)**
- Run pre-deploy checklist
- Vercel link + env vars
- Preview deploy + verification
- Production deploy
- Domain configuration guidance

---

## Key Risk Mitigations

**Magic link emails going to spam:**
- Use Resend SMTP (not Supabase default) — proven deliverability
- Verify sending domain in Resend (SPF, DKIM, DMARC)
- Test with multiple email providers (Gmail, Outlook, Apple Mail)

**Session management edge cases:**
- Middleware handles session refresh on every request
- Auth callback handles code exchange errors gracefully
- Login page handles expired magic links with "resend" option

**Role escalation:**
- Roles stored in `user_profiles` (our table), not Supabase auth metadata
- Server-side role check on every protected route (not just client-side tab hiding)
- Default role is `reader` — admin promotion only via direct SQL

**Database migration:**
- Run all migrations on Supabase Postgres before deploying
- Test that existing `pg` driver queries work with Supabase connection pooler
- Use port 6543 (transaction mode pooler) for serverless compatibility
