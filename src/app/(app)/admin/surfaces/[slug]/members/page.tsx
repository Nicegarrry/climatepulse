import { redirect, notFound } from "next/navigation";
import pool from "@/lib/db";
import { requireAuth } from "@/lib/supabase/server";
import { MembersRoster } from "./roster";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ slug: string }>;
}

export default async function MembersPage({ params }: Props) {
  const auth = await requireAuth();
  if ("error" in auth) redirect("/login");
  const { slug } = await params;

  const { rows } = await pool.query(
    `SELECT id, slug, title, owner_user_id, lifecycle
       FROM knowledge_surfaces WHERE slug = $1`,
    [slug],
  );
  if (!rows[0]) notFound();

  const isAdmin = auth.profile.user_role === "admin";
  if (!isAdmin && rows[0].owner_user_id !== auth.user.id) {
    return (
      <div style={{ padding: 40 }}>403 — Not authorised to manage this roster.</div>
    );
  }

  return <MembersRoster surface={rows[0]} />;
}
