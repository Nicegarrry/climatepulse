// Push notification fanout for urgency-5 Newsroom items.
//
// Sends web-push notifications to all opted-in subscribers whose primary
// sectors overlap (or are empty) with the item's domain. Rate-limited to
// 3 sends per user per hour. On 410/404 from the push endpoint we mark the
// subscription failed; once failure_count reaches 5 we stop selecting it.
//
// Gracefully no-ops if VAPID keys are not configured — useful in dev and
// before the push infra has been set up.

import pool from "@/lib/db";
import type { NewsroomPushPayload } from "./types";

const RATE_LIMIT_PER_HOUR = 3;
const FAILURE_PURGE_THRESHOLD = 5;

interface PushModule {
  setVapidDetails(subject: string, publicKey: string, privateKey: string): void;
  sendNotification(
    subscription: { endpoint: string; keys: { p256dh: string; auth: string } },
    payload: string
  ): Promise<{ statusCode?: number }>;
}

let webPushClient: PushModule | null = null;
let webPushReady: boolean | null = null;

async function ensurePushClient(): Promise<PushModule | null> {
  if (webPushReady !== null) return webPushReady ? webPushClient : null;

  const { VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT } = process.env;
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY || !VAPID_SUBJECT) {
    webPushReady = false;
    return null;
  }

  try {
    // Dynamic import keeps the runtime dependency optional — if the package
    // isn't installed (e.g. minimal env), we silently disable push instead
    // of crashing. Now that web-push is in package.json, the import
    // succeeds in normal envs.
    const mod = (await import("web-push").catch(() => null)) as unknown as {
      default?: PushModule;
    } | null;
    const client = (mod?.default ?? (mod as unknown as PushModule)) ?? null;
    if (!client) {
      webPushReady = false;
      return null;
    }
    client.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
    webPushClient = client;
    webPushReady = true;
    return client;
  } catch {
    webPushReady = false;
    return null;
  }
}

interface SubscriptionRow {
  id: string;
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  failure_count: number;
}

/**
 * Send urgency-5 push notifications for newly-inserted newsroom items.
 * Returns the number of pushes successfully dispatched.
 */
export async function fanoutUrgency5(itemIds: string[]): Promise<number> {
  if (itemIds.length === 0) return 0;

  const client = await ensurePushClient();
  if (!client) {
    // No VAPID keys — log and skip silently. The schema still records the
    // intended pushes via newsroom_push_log so we can audit later.
    console.log(
      `[newsroom.fanout] VAPID not configured — skipping push for ${itemIds.length} item(s).`
    );
    return 0;
  }

  let sent = 0;

  for (const itemId of itemIds) {
    const itemRes = await pool.query<{
      id: string;
      raw_article_id: string;
      primary_domain: string;
      teaser: string;
      source_name: string;
      published_at: string;
      title: string;
      article_url: string;
    }>(
      `SELECT ni.id, ni.raw_article_id, ni.primary_domain, ni.teaser,
              ni.source_name, ni.published_at, ra.title, ra.article_url
         FROM newsroom_items ni
         JOIN raw_articles ra ON ra.id = ni.raw_article_id
        WHERE ni.id = $1`,
      [itemId]
    );

    if (itemRes.rows.length === 0) continue;
    const item = itemRes.rows[0];

    // Subscribers opted in, sector-matched (or empty primary_sectors = all),
    // and not over the per-hour rate limit.
    const subscribers = await pool.query<SubscriptionRow>(
      `SELECT s.id, s.user_id, s.endpoint, s.p256dh, s.auth, s.failure_count
         FROM user_push_subscriptions s
         JOIN user_profiles u ON u.id = s.user_id
        WHERE s.failure_count < $1
          AND COALESCE((u.notification_prefs->>'urgency5_push')::boolean, false) = true
          AND (
            cardinality(u.primary_sectors) = 0
            OR $2 = ANY(u.primary_sectors)
          )
          AND (
            SELECT COUNT(*) FROM newsroom_push_log
             WHERE user_id = s.user_id
               AND status = 'sent'
               AND sent_at > NOW() - interval '1 hour'
          ) < $3`,
      [FAILURE_PURGE_THRESHOLD, item.primary_domain, RATE_LIMIT_PER_HOUR]
    );

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://climatepulse.app";
    const payload: NewsroomPushPayload = {
      v: 1,
      kind: "newsroom_urgency5",
      item_id: item.id,
      raw_article_id: item.raw_article_id,
      title: item.title,
      teaser: item.teaser,
      source: item.source_name,
      domain: item.primary_domain,
      url: `${baseUrl}/dashboard?tab=newsroom&item=${item.id}`,
      published_at: item.published_at,
    };

    const payloadStr = JSON.stringify(payload);

    for (const sub of subscribers.rows) {
      try {
        const res = await client.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          payloadStr
        );
        await pool.query(
          `UPDATE user_push_subscriptions
             SET last_success_at = NOW(), failure_count = 0
           WHERE id = $1`,
          [sub.id]
        );
        await pool.query(
          `INSERT INTO newsroom_push_log (user_id, newsroom_item_id, status)
           VALUES ($1, $2, 'sent')`,
          [sub.user_id, item.id]
        );
        sent++;
        void res;
      } catch (err) {
        const e = err as { statusCode?: number; message?: string };
        const expired = e?.statusCode === 410 || e?.statusCode === 404;
        await pool.query(
          `UPDATE user_push_subscriptions
             SET last_error_at = NOW(),
                 failure_count = failure_count + 1
           WHERE id = $1`,
          [sub.id]
        );
        await pool.query(
          `INSERT INTO newsroom_push_log (user_id, newsroom_item_id, status)
           VALUES ($1, $2, $3)`,
          [sub.user_id, item.id, expired ? "expired" : "failed"]
        );
      }
    }
  }

  return sent;
}
