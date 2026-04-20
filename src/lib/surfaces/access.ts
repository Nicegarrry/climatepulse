/**
 * Access control for knowledge surfaces.
 *
 * Flow: anonymous → authenticated → authorised. resolveAccess() returns a
 * structured decision; every route that serves surface content calls it
 * before doing any work. Revoking membership is soft (revoked_at tombstone)
 * so we keep an audit trail.
 */
import crypto from "node:crypto";
import pool from "@/lib/db";
import type {
  AccessDecision,
  AccessKind,
  AccessLevel,
  KnowledgeSurface,
  SurfaceAccess,
  SurfaceMember,
} from "./types";
import { parseSurface } from "./config";

export interface Viewer {
  user_id: string | null;
  email?: string | null;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function domainOf(email: string | null | undefined): string | null {
  if (!email || !EMAIL_RE.test(email)) return null;
  return email.split("@")[1]!.toLowerCase();
}

export function hashCohortCode(code: string): string {
  return crypto
    .createHash("sha256")
    .update(code.trim().normalize("NFKC"))
    .digest("hex");
}

/**
 * Fetch a surface by slug. Returns null for archived or not-found.
 * Archived surfaces are 404'd rather than 403'd to avoid leaking existence.
 */
export async function fetchSurfaceBySlug(
  slug: string,
): Promise<KnowledgeSurface | null> {
  const { rows } = await pool.query<Record<string, unknown>>(
    `SELECT * FROM knowledge_surfaces
      WHERE slug = $1 AND archived_at IS NULL`,
    [slug],
  );
  if (rows.length === 0) return null;
  return parseSurface(rows[0]);
}

async function findActiveMember(
  surfaceId: string,
  viewer: Viewer,
): Promise<SurfaceMember | null> {
  const emailLc = viewer.email ? viewer.email.trim().toLowerCase() : null;
  const domain = domainOf(emailLc);

  const { rows } = await pool.query<SurfaceMember>(
    `SELECT * FROM knowledge_surface_members
      WHERE surface_id = $1
        AND revoked_at IS NULL
        AND (
          ($2::text IS NOT NULL AND user_id = $2)
          OR ($3::text IS NOT NULL AND lower(email) = $3)
          OR ($4::text IS NOT NULL AND lower(domain) = $4)
        )
      ORDER BY
        CASE WHEN user_id IS NOT NULL THEN 0
             WHEN email   IS NOT NULL THEN 1
             ELSE 2 END
      LIMIT 1`,
    [surfaceId, viewer.user_id, emailLc, domain],
  );
  return rows[0] ?? null;
}

/**
 * Core decision. Evaluated against already-fetched `surface` and the current
 * `viewer` session.
 */
export async function resolveAccess(
  surface: KnowledgeSurface | null,
  viewer: Viewer,
): Promise<AccessDecision> {
  if (!surface) return { allowed: false, reason: "surface_not_found" };
  if (surface.lifecycle === "archived") {
    return { allowed: false, reason: "archived" };
  }

  const access: SurfaceAccess = surface.access;
  const kind: AccessKind = access.kind;

  // Public — anyone.
  if (kind === "public" || kind === "unlisted") {
    return {
      allowed: true,
      reason: kind === "public" ? "public" : "unlisted_ok",
      access_level: "viewer",
    };
  }

  // Authenticated — signed-in users only.
  if (kind === "authenticated") {
    if (!viewer.user_id) {
      return { allowed: false, reason: "needs_sign_in", requires: "sign_in" };
    }
    return { allowed: true, reason: "authenticated_ok", access_level: "viewer" };
  }

  // Member-based (email_allowlist, domain_allowlist, cohort_code).
  if (!viewer.user_id) {
    return { allowed: false, reason: "needs_sign_in", requires: "sign_in" };
  }

  const member = await findActiveMember(surface.id, viewer);
  if (member) {
    let reason: AccessDecision["reason"] = "member_user";
    if (member.redeemed_via_code) reason = "cohort_redeemed";
    else if (member.user_id) reason = "member_user";
    else if (member.email) reason = "member_email";
    else if (member.domain) reason = "member_domain";
    return { allowed: true, reason, access_level: member.access_level };
  }

  // No membership row — check allowlists directly for email/domain kinds.
  const emailLc = viewer.email ? viewer.email.trim().toLowerCase() : null;
  const domain = domainOf(emailLc);

  if (kind === "email_allowlist" && emailLc && access.emails?.includes(emailLc)) {
    // Lazily materialise a viewer membership for audit.
    await upsertMember(surface.id, {
      user_id: viewer.user_id,
      email: emailLc,
      access_level: "viewer",
      granted_by: null,
      reason: "email_allowlist_auto",
    });
    return { allowed: true, reason: "member_email", access_level: "viewer" };
  }
  if (kind === "domain_allowlist" && domain && access.domains?.includes(domain)) {
    await upsertMember(surface.id, {
      user_id: viewer.user_id,
      domain,
      access_level: "viewer",
      granted_by: null,
      reason: "domain_allowlist_auto",
    });
    return { allowed: true, reason: "member_domain", access_level: "viewer" };
  }

  if (kind === "cohort_code") {
    return { allowed: false, reason: "not_authorised", requires: "cohort_code" };
  }

  return { allowed: false, reason: "not_authorised", requires: "member_invite" };
}

interface UpsertMemberInput {
  user_id?: string | null;
  email?: string | null;
  domain?: string | null;
  access_level: AccessLevel;
  granted_by: string | null;
  reason: string;
  redeemed_via_code?: boolean;
}

/**
 * Insert-or-reactivate a membership row. If an identical active row exists,
 * do nothing. If a revoked row exists, reactivate it. Writes an audit entry.
 */
export async function upsertMember(
  surfaceId: string,
  input: UpsertMemberInput,
): Promise<string> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { rows } = await client.query<{ id: string }>(
      `INSERT INTO knowledge_surface_members
         (surface_id, user_id, email, domain, access_level,
          redeemed_via_code, granted_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT DO NOTHING
       RETURNING id`,
      [
        surfaceId,
        input.user_id ?? null,
        input.email ?? null,
        input.domain ?? null,
        input.access_level,
        input.redeemed_via_code ?? false,
        input.granted_by,
      ],
    );

    let memberId: string | null = rows[0]?.id ?? null;

    if (!memberId) {
      // Row already exists — reactivate if revoked.
      const { rows: existing } = await client.query<{ id: string }>(
        `UPDATE knowledge_surface_members
            SET revoked_at = NULL,
                access_level = $2,
                granted_by = COALESCE($3, granted_by),
                granted_at = NOW()
          WHERE surface_id = $1
            AND (
              ($4::text IS NOT NULL AND user_id = $4)
              OR ($5::text IS NOT NULL AND email = $5)
              OR ($6::text IS NOT NULL AND domain = $6)
            )
            AND revoked_at IS NOT NULL
          RETURNING id`,
        [
          surfaceId,
          input.access_level,
          input.granted_by,
          input.user_id ?? null,
          input.email ?? null,
          input.domain ?? null,
        ],
      );
      memberId = existing[0]?.id ?? null;
    }

    if (memberId) {
      await logAudit(client, {
        surface_id: surfaceId,
        actor_user_id: input.granted_by,
        subject_user_id: input.user_id ?? null,
        action: "grant",
        reason: input.reason,
        metadata: {
          email: input.email ?? null,
          domain: input.domain ?? null,
          access_level: input.access_level,
          redeemed_via_code: !!input.redeemed_via_code,
        },
      });
    }

    await client.query("COMMIT");
    return memberId ?? "";
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

export async function revokeMember(
  memberId: string,
  actor_user_id: string | null,
  reason: string,
): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { rows } = await client.query<{ surface_id: string; user_id: string | null }>(
      `UPDATE knowledge_surface_members
          SET revoked_at = NOW()
        WHERE id = $1 AND revoked_at IS NULL
        RETURNING surface_id, user_id`,
      [memberId],
    );
    if (rows[0]) {
      await logAudit(client, {
        surface_id: rows[0].surface_id,
        actor_user_id,
        subject_user_id: rows[0].user_id,
        action: "revoke",
        reason,
        metadata: { member_id: memberId },
      });
    }
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

export async function redeemCohortCode(
  surfaceId: string,
  code: string,
  viewer: Viewer,
): Promise<AccessDecision> {
  if (!viewer.user_id) {
    return { allowed: false, reason: "needs_sign_in", requires: "sign_in" };
  }
  const { rows } = await pool.query<{ access: SurfaceAccess }>(
    `SELECT access FROM knowledge_surfaces WHERE id = $1 AND archived_at IS NULL`,
    [surfaceId],
  );
  if (rows.length === 0) return { allowed: false, reason: "surface_not_found" };
  const access = rows[0].access;
  if (access.kind !== "cohort_code" || !access.cohort_code_hash) {
    return { allowed: false, reason: "not_authorised" };
  }
  const provided = hashCohortCode(code);
  // Constant-time compare.
  const ok =
    provided.length === access.cohort_code_hash.length &&
    crypto.timingSafeEqual(
      Buffer.from(provided, "hex"),
      Buffer.from(access.cohort_code_hash, "hex"),
    );
  if (!ok) {
    return { allowed: false, reason: "not_authorised", requires: "cohort_code" };
  }
  await upsertMember(surfaceId, {
    user_id: viewer.user_id,
    email: viewer.email ?? null,
    access_level: "viewer",
    granted_by: null,
    redeemed_via_code: true,
    reason: "cohort_code_redeemed",
  });
  return { allowed: true, reason: "cohort_redeemed", access_level: "viewer" };
}

/**
 * Best-effort access audit. Lives as analytics rows with metric='export' and
 * metadata.audit=true — we reuse the table rather than add a new one.
 * Failures never block the caller.
 */
interface AuditInput {
  surface_id: string;
  actor_user_id: string | null;
  subject_user_id: string | null;
  action: "grant" | "revoke" | "redeem" | "deny";
  reason: string;
  metadata?: Record<string, unknown>;
}

async function logAudit(
  client: { query: (sql: string, params: unknown[]) => Promise<unknown> },
  entry: AuditInput,
): Promise<void> {
  try {
    const today = new Date().toISOString().slice(0, 10);
    await client.query(
      `INSERT INTO knowledge_surface_analytics
         (surface_id, day, metric, user_id, count, metadata)
       VALUES ($1, $2, 'export', $3, 1, $4::jsonb)`,
      [
        entry.surface_id,
        today,
        entry.subject_user_id,
        JSON.stringify({
          audit: true,
          action: entry.action,
          reason: entry.reason,
          actor_user_id: entry.actor_user_id,
          ...(entry.metadata ?? {}),
        }),
      ],
    );
  } catch (err) {
    console.error("[surfaces/access] audit write failed:", err);
  }
}
