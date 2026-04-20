import { redirect, notFound } from "next/navigation";
import pool from "@/lib/db";
import { requireAuth } from "@/lib/supabase/server";
import { parseSurface } from "@/lib/surfaces/config";
import type { KnowledgeSurface } from "@/lib/surfaces/types";
import { EditSurfaceForm } from "./editor";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ slug: string }>;
}

export default async function EditSurfacePage({ params }: Props) {
  const auth = await requireAuth();
  if ("error" in auth) redirect("/login");
  const { slug } = await params;

  const { rows } = await pool.query(
    `SELECT * FROM knowledge_surfaces WHERE slug = $1`,
    [slug],
  );
  if (!rows[0]) notFound();

  const isAdmin = auth.profile.user_role === "admin";
  if (!isAdmin && rows[0].owner_user_id !== auth.user.id) {
    return (
      <div style={{ padding: 40 }}>403 — Not authorised to edit this surface.</div>
    );
  }

  const surface: KnowledgeSurface = parseSurface(rows[0]);
  const cohortCodeSet =
    surface.access.kind === "cohort_code" && !!surface.access.cohort_code_hash;

  // Strip hash before handing to client — never leak it.
  const safeAccess = { ...surface.access };
  delete safeAccess.cohort_code_hash;

  return (
    <EditSurfaceForm
      surface={{ ...surface, access: safeAccess }}
      cohortCodeSet={cohortCodeSet}
    />
  );
}
