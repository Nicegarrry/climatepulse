import { NextResponse } from "next/server";
import { put } from "@vercel/blob";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function wantsJson(request: Request) {
  return (
    request.headers.get("accept")?.includes("application/json") ||
    request.headers.get("x-requested-with") === "fetch"
  );
}

function redirectToStatus(request: Request, capture: "success" | "error") {
  const url = new URL("/", request.url);
  url.searchParams.set("capture", capture);
  return NextResponse.redirect(url, 303);
}

function result(request: Request, capture: "success" | "error", status: number, message: string) {
  if (wantsJson(request)) {
    return NextResponse.json({ ok: capture === "success", message }, { status });
  }

  return redirectToStatus(request, capture);
}

async function digestEmail(email: string) {
  const bytes = new TextEncoder().encode(email);
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(hash))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const email = String(formData.get("email") ?? "").trim().toLowerCase();

    if (!EMAIL_RE.test(email)) {
      return result(request, "error", 400, "Enter a valid email address.");
    }

    const submittedAt = new Date().toISOString();
    const emailHash = await digestEmail(email);
    const pathname = [
      "shutdown-interest",
      submittedAt.slice(0, 10),
      `${submittedAt.replace(/[:.]/g, "-")}-${emailHash.slice(0, 16)}-${crypto.randomUUID()}.json`,
    ].join("/");

    await put(
      pathname,
      JSON.stringify(
        {
          email,
          email_hash: emailHash,
          source: "holding_page",
          submitted_at: submittedAt,
          referrer: request.headers.get("referer"),
          user_agent: request.headers.get("user-agent"),
        },
        null,
        2
      ),
      {
        access: "private",
        contentType: "application/json",
        addRandomSuffix: false,
      }
    );

    return result(request, "success", 200, "Thanks. We will be in touch.");
  } catch (error) {
    console.error("Holding interest capture failed", error);
    return result(request, "error", 503, "Email capture is temporarily unavailable.");
  }
}

export function GET(request: Request) {
  return redirectToStatus(request, "error");
}
