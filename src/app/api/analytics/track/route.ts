import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";

interface IncomingEvent {
  event_name: string;
  properties: Record<string, unknown>;
  session_id: string;
  timestamp: string;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { userId, events } = body as {
      userId: string;
      events: IncomingEvent[];
    };

    if (!userId || !Array.isArray(events) || events.length === 0) {
      return NextResponse.json(
        { error: "userId and events[] required" },
        { status: 400 }
      );
    }

    // Batch insert using a single multi-row INSERT
    const values: unknown[] = [];
    const placeholders: string[] = [];
    let idx = 1;

    for (const evt of events) {
      placeholders.push(
        `($${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++})`
      );
      values.push(
        userId,
        evt.event_name,
        JSON.stringify(evt.properties),
        evt.session_id || null,
        evt.timestamp || new Date().toISOString()
      );
    }

    await pool.query(
      `INSERT INTO analytics_events (user_id, event_name, properties, session_id, created_at)
       VALUES ${placeholders.join(", ")}`,
      values
    );

    return NextResponse.json({ ok: true, count: events.length });
  } catch (error) {
    console.error("[analytics/track] Error:", error);
    return NextResponse.json(
      { error: "Failed to track events" },
      { status: 500 }
    );
  }
}
