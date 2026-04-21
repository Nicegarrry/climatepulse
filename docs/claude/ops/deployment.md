# Deployment

Prod has been on Vercel Pro since 2026-04-17. Assume production constraints on all new work.

## Hosting

- **App + cron**: Vercel Pro (project `climatepulse`)
- **Auth + Postgres + pgvector**: Supabase (project `sixyxxuvplvpjcnkthed`)
- **Audio**: Vercel Blob store `climatepulse-blob`
- **Email**: Resend

Custom domains: `climatepulse.app` (prod), `climatepulse-iota.vercel.app` (staging).

## Supabase × Vercel linking

Linked via the **Vercel Marketplace Supabase integration** (`vercel.com/marketplace/supabase`) — **not** manual env-var copy-paste.

The integration auto-provisions:
- `DATABASE_URL` (transaction pooler, correctly SSL-configured)
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

…and keeps them in sync when Supabase keys rotate. This is the default path for any new web project needing Supabase in prod — it sidesteps the SSL cert-chain and pooler-URL footguns that manual setup hit during the April 2026 migration (pooler port 6543 vs direct port 5432 confusion, `?sslmode=require` parsed as `verify-full`, `SELF_SIGNED_CERT_IN_CHAIN` against AWS-signed cert, etc.).

The SSL-strip workaround in `src/lib/db.ts` is still in place as belt-and-braces but isn't required with the integration.

## Env vars

```
# ─── Data + AI ───────────────────────────────────────────────────────────
GOOGLE_AI_API_KEY=                  # Gemini 2.5 Flash for enrichment + Newsroom + TTS
NEWSAPI_AI_KEY=                     # EventRegistry API
NEWSAPI_ORG_KEY=                    # NewsAPI.org (backup)
OPENELECTRICITY_API_KEY=            # Australian NEM energy data
ANTHROPIC_API_KEY=                  # Claude Sonnet for digest + podcast script
RESEND_API_KEY=                     # Email delivery

# ─── Supabase (auto-provisioned by Marketplace integration) ──────────────
DATABASE_URL=
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=          # Server-only — bypasses RLS, never expose

# ─── Storage + Cron + Push ───────────────────────────────────────────────
BLOB_READ_WRITE_TOKEN=              # Auto-provisioned by Vercel Blob store link
CRON_SECRET=                        # Bearer token required by all cron routes
VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
VAPID_SUBJECT=                      # mailto:ops@climatepulse.app
NEXT_PUBLIC_VAPID_PUBLIC_KEY=       # Same as VAPID_PUBLIC_KEY, exposed for browser subscribe
NEXT_PUBLIC_APP_URL=                # e.g. https://climatepulse.app (used in push payload `url`)
```

Newsroom gracefully no-ops on push when VAPID vars are missing — the feature still works in dev without them; only urgency-5 dispatch is skipped (intent is logged to `newsroom_push_log` for audit either way).

## Local dev

- Mirror Vercel env with: `vercel env pull .env.local`
- Docker Compose provides Postgres 16 for the rare case you need it; most dev hits Supabase dev project directly
- `NEXT_PUBLIC_SHOW_DEV_TABS` is no longer referenced in the code — tabs are RBAC-gated

## Git workflow

- **Small fixes → straight to `main` and push.** Typos, single-file bug fixes, one-line config tweaks, docs updates. Prod auto-deploys from `main` and small fixes are easy to revert.
- **Major changes → ask first: branch + PR, or main?** New features, migrations, multi-subsystem work, risky refactors. Default assumption is branch + PR.
- If uncertain, ask.

## Cron count

Vercel Pro caps cron schedules. Current count includes the 5 pipeline routes, 2 newsroom (AEST + AEDT), markets, and weekly. Check `vercel.json` before adding a new cron — if you're near the ceiling you'll need to consolidate or move a step to a worker pattern.
