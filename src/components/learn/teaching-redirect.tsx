"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { COLORS, FONTS } from "@/lib/design-tokens";

/**
 * Mirrors LearnRedirect — dashboard "Teaching" tab navigates out to the
 * standalone /teaching cockpit route.
 */
export function TeachingRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.push("/teaching");
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
      <p style={{ fontSize: 14 }}>Opening Teaching…</p>
      <Link
        href="/teaching"
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
