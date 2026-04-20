"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { COLORS, FONTS } from "@/lib/design-tokens";

/**
 * Clicking the dashboard Learn tab now navigates to the standalone /learn
 * section. Kept as a client component so we can push on mount without
 * forcing a full-page flash. Shows a fallback link for no-JS / slow nav.
 */
export function LearnRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.push("/learn");
  }, [router]);

  return (
    <div
      style={{
        padding: "48px 24px",
        textAlign: "center",
        fontFamily: FONTS.sans,
        color: COLORS.inkSec,
      }}
    >
      <p style={{ fontSize: 14 }}>Opening Learn…</p>
      <Link
        href="/learn"
        style={{
          display: "inline-block",
          marginTop: 8,
          fontSize: 13,
          color: COLORS.forest,
          textTransform: "uppercase",
          letterSpacing: "0.04em",
        }}
      >
        Continue →
      </Link>
    </div>
  );
}
