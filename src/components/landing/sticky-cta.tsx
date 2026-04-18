"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

/**
 * A thin sticky bar with the primary CTA that appears only after the
 * hero has scrolled out of view. Respects the safe area inset on mobile.
 */
export function StickyCTA() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const sentinel = document.getElementById("landing-hero-sentinel");
    if (!sentinel) return;
    const observer = new IntersectionObserver(
      ([entry]) => setVisible(!entry.isIntersecting),
      { threshold: 0 }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      aria-hidden={!visible}
      className={`fixed inset-x-0 bottom-0 z-40 border-t border-[#E8E5E0] bg-white/95 px-4 py-3 backdrop-blur transition-transform duration-300 md:hidden ${
        visible ? "translate-y-0" : "translate-y-full"
      }`}
      style={{ paddingBottom: "max(12px, env(safe-area-inset-bottom))" }}
    >
      <Link
        href="/login"
        className="flex h-12 w-full items-center justify-center rounded-md bg-[#1E4D2B] text-[15px] font-semibold tracking-tight text-white transition-colors hover:bg-[#163a21]"
        style={{ fontFamily: "'Source Sans 3', system-ui, sans-serif" }}
      >
        Get early access
      </Link>
    </div>
  );
}
