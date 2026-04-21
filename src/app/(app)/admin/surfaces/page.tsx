import Link from "next/link";
import { redirect } from "next/navigation";
import pool from "@/lib/db";
import { requireAuth } from "@/lib/supabase/server";
import { COLORS, FONTS } from "@/lib/design-tokens";
import {
  PlusIcon,
  MagnifyingGlassIcon,
  PencilSquareIcon,
  EyeIcon,
  UsersIcon,
} from "@heroicons/react/24/outline";

export const dynamic = "force-dynamic";

interface SurfaceRow {
  id: string;
  slug: string;
  title: string;
  template: string;
  lifecycle: string;
  owner_user_id: string;
  owner_name: string | null;
  owner_email: string | null;
  updated_at: string;
  published_at: string | null;
  member_count: number;
}

interface Props {
  searchParams: Promise<{ q?: string }>;
}

function LifecycleBadge({ lifecycle }: { lifecycle: string }) {
  const colour =
    lifecycle === "published"
      ? { bg: COLORS.sageTint, fg: COLORS.forest }
      : lifecycle === "preview"
      ? { bg: COLORS.plumLight, fg: COLORS.plum }
      : lifecycle === "archived"
      ? { bg: COLORS.paperDark, fg: COLORS.inkMuted }
      : { bg: COLORS.paperDark, fg: COLORS.inkSec };
  return (
    <span
      style={{
        display: "inline-block",
        padding: "2px 8px",
        fontSize: 10,
        letterSpacing: 0.5,
        textTransform: "uppercase",
        fontFamily: FONTS.sans,
        fontWeight: 600,
        background: colour.bg,
        color: colour.fg,
        borderRadius: 3,
      }}
    >
      {lifecycle}
    </span>
  );
}

export default async function SurfacesAdminPage({ searchParams }: Props) {
  const auth = await requireAuth();
  if ("error" in auth) {
    redirect("/login");
  }
  const isAdmin = auth.profile.user_role === "admin";

  const sp = await searchParams;
  const q = sp.q?.trim() ?? "";

  const clauses: string[] = [];
  const params: unknown[] = [];
  if (!isAdmin) {
    params.push(auth.user.id);
    clauses.push(`s.owner_user_id = $${params.length}`);
  }
  if (q) {
    params.push(`%${q}%`);
    clauses.push(`s.title ILIKE $${params.length}`);
  }
  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";

  const { rows } = await pool.query<SurfaceRow>(
    `SELECT s.id, s.slug, s.title, s.template, s.lifecycle, s.owner_user_id,
            s.updated_at, s.published_at,
            u.name AS owner_name, u.email AS owner_email,
            (SELECT COUNT(*)::int FROM knowledge_surface_members m
              WHERE m.surface_id = s.id AND m.revoked_at IS NULL) AS member_count
       FROM knowledge_surfaces s
       LEFT JOIN user_profiles u ON u.id = s.owner_user_id
       ${where}
       ORDER BY s.updated_at DESC
       LIMIT 100`,
    params,
  );

  return (
    <div
      style={{
        padding: "24px 32px",
        fontFamily: FONTS.sans,
        background: COLORS.bg,
        minHeight: "100vh",
      }}
    >
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          marginBottom: 32,
          paddingBottom: 16,
          borderBottom: `1px solid ${COLORS.border}`,
        }}
      >
        <div>
          <h1
            style={{
              fontFamily: FONTS.serif,
              fontSize: 28,
              color: COLORS.ink,
              margin: 0,
              fontWeight: 500,
            }}
          >
            Knowledge Surfaces
          </h1>
          <p
            style={{
              fontSize: 12,
              color: COLORS.inkMuted,
              margin: "4px 0 0",
              letterSpacing: 0.3,
            }}
          >
            {rows.length} surface{rows.length === 1 ? "" : "s"}
            {isAdmin ? " (all)" : " (owned by you)"}
          </p>
        </div>
        <Link
          href="/admin/surfaces/new"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: "8px 14px",
            background: COLORS.forest,
            color: "#fff",
            fontSize: 13,
            fontWeight: 500,
            borderRadius: 4,
            textDecoration: "none",
          }}
        >
          <PlusIcon width={14} height={14} />
          New surface
        </Link>
      </header>

      <form method="get" style={{ marginBottom: 20 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "8px 12px",
            background: COLORS.surface,
            border: `1px solid ${COLORS.border}`,
            borderRadius: 4,
            maxWidth: 420,
          }}
        >
          <MagnifyingGlassIcon
            width={14}
            height={14}
            style={{ color: COLORS.inkMuted }}
          />
          <input
            type="text"
            name="q"
            placeholder="Search by title"
            defaultValue={q}
            style={{
              border: "none",
              outline: "none",
              background: "transparent",
              flex: 1,
              fontSize: 13,
              color: COLORS.ink,
              fontFamily: FONTS.sans,
            }}
          />
        </div>
      </form>

      {rows.length === 0 ? (
        <div
          style={{
            padding: "60px 16px",
            textAlign: "center",
            color: COLORS.inkMuted,
            fontSize: 13,
          }}
        >
          No surfaces yet.{" "}
          <Link
            href="/admin/surfaces/new"
            style={{ color: COLORS.forest, textDecoration: "underline" }}
          >
            Create the first one.
          </Link>
        </div>
      ) : (
        <div
          style={{
            background: COLORS.surface,
            border: `1px solid ${COLORS.border}`,
            borderRadius: 4,
            overflow: "hidden",
          }}
        >
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              fontSize: 13,
            }}
          >
            <thead>
              <tr style={{ background: COLORS.paperDark }}>
                {["Title", "Template", "Status", "Owner", "Members", "Updated", "Actions"].map(
                  (h) => (
                    <th
                      key={h}
                      style={{
                        textAlign: "left",
                        padding: "10px 14px",
                        fontSize: 10,
                        textTransform: "uppercase",
                        letterSpacing: 0.6,
                        color: COLORS.inkMuted,
                        fontWeight: 600,
                        borderBottom: `1px solid ${COLORS.border}`,
                      }}
                    >
                      {h}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr
                  key={r.id}
                  style={{ borderBottom: `1px solid ${COLORS.borderLight}` }}
                >
                  <td style={{ padding: "12px 14px" }}>
                    <div style={{ color: COLORS.ink, fontWeight: 500 }}>
                      {r.title}
                    </div>
                    <div
                      style={{
                        color: COLORS.inkMuted,
                        fontSize: 11,
                        fontFamily: "monospace",
                      }}
                    >
                      /{r.slug}
                    </div>
                  </td>
                  <td style={{ padding: "12px 14px", color: COLORS.inkSec }}>
                    {r.template}
                  </td>
                  <td style={{ padding: "12px 14px" }}>
                    <LifecycleBadge lifecycle={r.lifecycle} />
                  </td>
                  <td
                    style={{
                      padding: "12px 14px",
                      color: COLORS.inkSec,
                      fontSize: 12,
                    }}
                  >
                    {r.owner_name || r.owner_email || r.owner_user_id.slice(0, 8)}
                  </td>
                  <td
                    style={{
                      padding: "12px 14px",
                      color: COLORS.inkSec,
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    {r.member_count}
                  </td>
                  <td
                    style={{
                      padding: "12px 14px",
                      color: COLORS.inkMuted,
                      fontSize: 12,
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    {new Date(r.updated_at).toLocaleDateString("en-AU", {
                      day: "numeric",
                      month: "short",
                    })}
                  </td>
                  <td style={{ padding: "12px 14px" }}>
                    <div style={{ display: "flex", gap: 10 }}>
                      <Link
                        href={`/admin/surfaces/${r.slug}/edit`}
                        title="Edit"
                        style={{ color: COLORS.inkSec }}
                      >
                        <PencilSquareIcon width={16} height={16} />
                      </Link>
                      <Link
                        href={`/s/${r.slug}?preview=1`}
                        title="Preview"
                        target="_blank"
                        style={{ color: COLORS.inkSec }}
                      >
                        <EyeIcon width={16} height={16} />
                      </Link>
                      <Link
                        href={`/admin/surfaces/${r.slug}/members`}
                        title="Members"
                        style={{ color: COLORS.inkSec }}
                      >
                        <UsersIcon width={16} height={16} />
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
