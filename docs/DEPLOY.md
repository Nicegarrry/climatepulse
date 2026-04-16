# ClimatePulse Deployment Guide

Step-by-step deployment to Vercel with Supabase Auth + Postgres, Resend email, and custom domain.

## Prerequisites

- GitHub repo pushed up
- Supabase account (free tier is fine)
- Resend account (free tier: 100 emails/day is plenty for launch)
- Vercel account
- Domain (optional — can use Vercel's auto-generated URL first)

---

## Step 1: Create Supabase Project

1. Go to https://supabase.com → New Project
2. Name: `climatepulse-prod` (or whatever)
3. Region: Pick one close to your users (Sydney if AU audience)
4. Pick a strong DB password and save it
5. Wait ~2 min for provisioning

### Get credentials

From the Supabase dashboard:
- **Project URL:** Settings → API → `Project URL` (looks like `https://xxx.supabase.co`)
- **Anon key:** Settings → API → `anon public` key
- **DB connection string:** Settings → Database → Connection string → **Use the "Transaction" pooler URL** (port 6543). This is important for serverless compatibility.

Save these three values — we'll add them as Vercel env vars.

---

## Step 2: Configure Supabase Auth with Resend SMTP

This is the critical step that avoids the email deliverability issues we hit with BenchWatch.

### 2a. Verify your domain in Resend

1. Go to https://resend.com → Domains → Add Domain
2. Enter your domain (e.g. `climatepulse.app`)
3. Add the DNS records shown (SPF, DKIM, DMARC) at your registrar
4. Wait for verification (usually 5-30 min)

### 2b. Create a Resend API key

Resend → API Keys → Create API Key → "Full access" → save the `re_xxx` key

### 2c. Configure Supabase SMTP

In Supabase dashboard: Settings → Auth → SMTP Settings → Enable Custom SMTP

```
Host: smtp.resend.com
Port: 465
Username: resend
Password: <your re_xxx API key>
Sender name: Climate Pulse
Sender email: auth@climatepulse.app  (or any address at your verified domain)
```

Save and send a test email to yourself.

### 2d. Customize magic link email template

Supabase → Auth → Email Templates → Magic Link

Subject: `Sign in to Climate Pulse`

HTML (replace the default template):

```html
<div style="font-family: Georgia, serif; max-width: 600px; margin: 0 auto; padding: 24px; background: #FAF9F7; color: #1A1A1A;">
  <div style="border-bottom: 2px solid #1E4D2B; padding-bottom: 16px; margin-bottom: 24px;">
    <h1 style="font-size: 24px; font-weight: 400; margin: 0; color: #1E4D2B;">Climate Pulse</h1>
    <p style="font-size: 11px; letter-spacing: 1.5px; text-transform: uppercase; color: #8C8C8C; font-family: sans-serif; margin: 4px 0 0;">
      Climate & Energy Intelligence
    </p>
  </div>

  <p style="font-size: 16px; line-height: 1.5;">Click the link below to sign in to Climate Pulse.</p>

  <a href="{{ .ConfirmationURL }}" style="display: inline-block; background: #1E4D2B; color: #fff; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-family: sans-serif; font-size: 14px; font-weight: 500; margin: 16px 0;">
    Sign in to Climate Pulse
  </a>

  <p style="font-size: 13px; color: #5C5C5C; line-height: 1.5; margin-top: 20px;">
    This link expires in 1 hour. If you didn't request this, you can safely ignore this email.
  </p>

  <p style="font-size: 11px; color: #8C8C8C; margin-top: 32px; padding-top: 16px; border-top: 1px solid #E8E5E0; font-family: sans-serif;">
    Climate Pulse {"\u00B7"} Invite only
  </p>
</div>
```

### 2e. Configure redirect URLs

Supabase → Auth → URL Configuration:
- **Site URL:** `https://climatepulse.app` (or Vercel URL if no custom domain yet)
- **Redirect URLs:** Add both:
  - `https://climatepulse.app/auth/callback`
  - `http://localhost:3000/auth/callback` (for local dev)

---

## Step 3: Migrate Database to Supabase

Run all migration scripts against the new Supabase Postgres.

### Option A: Supabase SQL Editor (recommended for visibility)
Copy-paste each migration file into the SQL editor in order:

```
scripts/migrate.sql
scripts/migrate-enrichment.sql
scripts/seed-taxonomy.sql
scripts/seed-sources.sql
scripts/migrate-pipeline.sql
scripts/migrate-weekly-pulse.sql
scripts/migrate-two-stage.sql
scripts/migrate-entity-redesign.sql
scripts/migrate-user-profiles.sql
scripts/migrate-onboarding.sql
scripts/migrate-analytics.sql
scripts/migrate-streaks.sql
scripts/migrate-reports.sql
scripts/migrate-storylines.sql
scripts/migrate-markets.sql
scripts/seed-channels.sql
scripts/migrate-weekly-digest.sql
scripts/migrate-podcast.sql
scripts/migrate-roles.sql
scripts/migrate-notifications.sql
```

### Option B: CLI via psql
```bash
export DB_URL="postgresql://postgres.xxx:PASSWORD@aws-0-region.pooler.supabase.com:6543/postgres"
for f in scripts/migrate*.sql scripts/seed-*.sql; do
  psql "$DB_URL" -f "$f"
done
```

**Note:** The test users (`test-user-1` through `test-user-5`) in `migrate-onboarding.sql` were seeded for local dev. You may want to skip that migration or delete those rows in production.

---

## Step 4: Vercel Deployment

### 4a. Link the project
```bash
cd /Users/sa/Desktop/climatepulse
npx vercel link
```

### 4b. Set environment variables

Use `vercel env add` or the Vercel dashboard (Settings → Environment Variables):

**Required:**
```
DATABASE_URL=postgresql://...    # Supabase Transaction pooler URL (port 6543)
GOOGLE_AI_API_KEY=AIz...         # Gemini for enrichment + TTS
ANTHROPIC_API_KEY=sk-ant-...     # Claude for digest + podcast
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
CRON_SECRET=<generate random 32+ char string>
RESEND_API_KEY=re_...            # Same key used for Supabase SMTP
OPENELECTRICITY_API_KEY=...      # Australian NEM data
NEXT_PUBLIC_APP_URL=https://climatepulse.app
```

**Optional (can skip for now):**
```
DIGEST_TEST_EMAIL=you@example.com  # Override recipient for weekly digest test emails
NEWSAPI_AI_KEY=...                  # EventRegistry
NEWSAPI_ORG_KEY=...                 # NewsAPI backup
```

**Generate CRON_SECRET:**
```bash
openssl rand -hex 32
```

### 4c. Preview deploy (test before going live)
```bash
vercel
```

Verify on the preview URL:
- [ ] Login flow works (enter email → receive magic link → click → land on /dashboard or /onboarding)
- [ ] Onboarding completes and persists
- [ ] Briefing tab loads
- [ ] Weekly tab loads
- [ ] Mobile bottom nav has proper safe area padding
- [ ] PWA install prompt shows on mobile
- [ ] API routes return 401 when not authenticated
- [ ] Admin user sees Discovery/Categories/Taxonomy tabs
- [ ] Editor tab accessible to editor/admin

### 4d. Production deploy
```bash
vercel --prod
```

### 4e. Verify crons
Vercel dashboard → Crons tab. You should see:
- `/api/pipeline/run` — daily 19:00 UTC
- `/api/analytics/weekly-pulse/generate` — Sunday 20:00 UTC
- `/api/weekly/generate` — Friday 04:00 UTC

Vercel automatically sends `Authorization: Bearer <CRON_SECRET>` header with cron requests.

---

## Step 5: Custom Domain

### 5a. Add domain to Vercel
```bash
vercel domains add climatepulse.app
```

Or via dashboard: Settings → Domains → Add.

### 5b. Configure DNS
At your registrar, add:
- **A record** (for apex): `@` → `76.76.21.21`
- **CNAME** (for www): `www` → `cname.vercel-dns.com`

### 5c. Update Supabase & env vars

After domain is live:
- Supabase → Auth → URL Configuration → Site URL: `https://climatepulse.app`
- Supabase → Auth → URL Configuration → Redirect URLs: add `https://climatepulse.app/auth/callback`
- Vercel → Environment Variables → Update `NEXT_PUBLIC_APP_URL=https://climatepulse.app`
- Redeploy: `vercel --prod`

---

## Step 6: Seed Your Admin Account

1. Go to `https://climatepulse.app/login`
2. Enter your email
3. Click magic link in email
4. Complete onboarding
5. In Supabase SQL editor:
   ```sql
   UPDATE user_profiles SET user_role = 'admin' WHERE email = 'your@email.com';
   ```
6. Refresh the app — admin tabs (Discovery, Categories, Taxonomy) + Editor tab should now appear

---

## Step 7: Add Other Users (Invite-Only)

For each new subscriber:

1. Supabase dashboard → Authentication → Users → Invite user (or they can sign up themselves if signups are enabled)
2. Optionally promote to editor:
   ```sql
   UPDATE user_profiles SET user_role = 'editor' WHERE email = 'writer@example.com';
   ```

---

## Troubleshooting

### Magic link emails not arriving
- Check Resend dashboard → Logs for bounces/spam
- Verify your domain DNS (SPF, DKIM, DMARC) — Resend dashboard shows verification status
- Check Supabase → Logs → Auth Log for email send errors
- Test with a Gmail + Outlook address to rule out one provider filtering

### Cron endpoints returning 401
- Verify `CRON_SECRET` env var is set in Vercel production
- Check Vercel → Deployments → Logs for the cron invocation
- Vercel automatically sends the header — you don't need to configure it elsewhere

### User sees "Profile not found" forever
- The /api/user/profile GET returns 404 for unprovisioned users
- The app should redirect them to /onboarding automatically
- If stuck: check that middleware.ts is refreshing the session

### Database connection errors on Vercel
- Make sure you're using the **Transaction pooler** URL (port 6543), not direct connection (port 5432)
- Transaction pooler is required for Vercel serverless functions

### Dev panel showing in production
- Dev panel is gated by `user.role === "admin"` in `src/app/(app)/layout.tsx`
- If you see it in prod, your account is set to admin — that's expected

---

## Post-Deploy Checklist

- [ ] Magic link login works end-to-end
- [ ] Onboarding flow creates user_profile row with correct user_role
- [ ] All tabs render for your admin account
- [ ] All tabs render for a reader test account (no Discovery/Categories/Taxonomy/Editor)
- [ ] Weekly digest publish flow sends email via Resend
- [ ] Daily pipeline cron runs (check Vercel cron logs)
- [ ] Mobile PWA install works on iOS Safari and Android Chrome
- [ ] No references to `test-user-1` or other dev fallbacks in production paths
- [ ] `NEXT_PUBLIC_SHOW_DEV_TABS` removed from production env vars (not needed anymore)

---

## What's Next (Post-Launch Priorities)

From `docs/BACKLOG.md`:
1. Search (AI-powered topic search across articles)
2. Events timeline
3. Learn modules (climate 101 per microsector)
4. Gamification refinements
5. Community features (comments on digests → forum later)
