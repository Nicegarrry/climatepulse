# Backlog

## Deployment Requirements

- **Pipeline auth:** Add `CRON_SECRET` env var and `Authorization: Bearer` header check to `POST /api/pipeline/run` before deploying to production. Vercel crons can be configured to send this header automatically. Without this, the endpoint is publicly triggerable.
