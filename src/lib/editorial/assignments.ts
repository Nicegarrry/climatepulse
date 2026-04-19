import pool from "@/lib/db";

/**
 * Returns true if `user_id` has an editor_assignments row covering today
 * in Sydney-local time. Swallows DB errors (treats as no assignment) so
 * requireAuth can't be broken by a missing migration.
 */
export async function hasActiveEditorAssignment(userId: string): Promise<boolean> {
  try {
    const { rows } = await pool.query(
      `SELECT 1
         FROM editor_assignments
        WHERE user_id = $1
          AND week_start <= (NOW() AT TIME ZONE 'Australia/Sydney')::date
          AND week_end   >= (NOW() AT TIME ZONE 'Australia/Sydney')::date
        LIMIT 1`,
      [userId]
    );
    return rows.length > 0;
  } catch (err) {
    console.warn("[editor-assignments] lookup failed:", err);
    return false;
  }
}
