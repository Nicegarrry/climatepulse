"use client";

import { useState } from "react";
import Link from "next/link";
import { COLORS, FONTS } from "@/lib/design-tokens";

export function AutomaccTab() {
  const [unlocked, setUnlocked] = useState(() => {
    if (typeof window !== "undefined") {
      return sessionStorage.getItem("automacc_unlocked") === "1";
    }
    return false;
  });
  const [pw, setPw] = useState("");
  const [error, setError] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (pw.toLowerCase() === "bootcamp") {
      sessionStorage.setItem("automacc_unlocked", "1");
      setUnlocked(true);
    } else {
      setError(true);
      setPw("");
    }
  }

  if (unlocked) {
    return (
      <div
        style={{
          padding: "64px 24px",
          textAlign: "center",
          fontFamily: FONTS.sans,
        }}
      >
        <p
          style={{
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            color: COLORS.forest,
            marginBottom: 12,
          }}
        >
          AutoMACC
        </p>
        <h2
          style={{
            fontSize: 22,
            fontWeight: 700,
            color: COLORS.ink,
            marginBottom: 8,
            letterSpacing: "-0.01em",
          }}
        >
          MACC Curve Builder
        </h2>
        <p
          style={{
            fontSize: 14,
            color: COLORS.inkSec,
            maxWidth: 360,
            margin: "0 auto 32px",
            lineHeight: 1.6,
          }}
        >
          AI-powered marginal abatement cost curves — allocate levers, model
          NPV, and explore sensitivity in real time.
        </p>
        <Link
          href="/automacc"
          style={{
            display: "inline-block",
            padding: "10px 28px",
            background: COLORS.forest,
            color: "#fff",
            borderRadius: 6,
            fontSize: 14,
            fontWeight: 600,
            textDecoration: "none",
            letterSpacing: "0.01em",
          }}
        >
          Open AutoMACC →
        </Link>
      </div>
    );
  }

  return (
    <div
      style={{
        padding: "80px 24px",
        textAlign: "center",
        fontFamily: FONTS.sans,
      }}
    >
      <p
        style={{
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          color: COLORS.forest,
          marginBottom: 12,
        }}
      >
        AutoMACC
      </p>
      <h2
        style={{
          fontSize: 20,
          fontWeight: 700,
          color: COLORS.ink,
          marginBottom: 8,
        }}
      >
        Access Required
      </h2>
      <p
        style={{
          fontSize: 14,
          color: COLORS.inkSec,
          marginBottom: 32,
        }}
      >
        Enter the access code to continue.
      </p>
      <form
        onSubmit={handleSubmit}
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 12,
        }}
      >
        <input
          type="password"
          value={pw}
          onChange={(e) => {
            setPw(e.target.value);
            setError(false);
          }}
          placeholder="Access code"
          autoFocus
          style={{
            border: `1px solid ${error ? "#ef4444" : COLORS.border}`,
            borderRadius: 6,
            padding: "9px 14px",
            fontSize: 14,
            width: 220,
            fontFamily: FONTS.sans,
            color: COLORS.ink,
            outline: "none",
            background: "#fff",
          }}
        />
        {error && (
          <p style={{ fontSize: 12, color: "#ef4444", margin: 0 }}>
            Incorrect code
          </p>
        )}
        <button
          type="submit"
          style={{
            padding: "9px 24px",
            background: COLORS.forest,
            color: "#fff",
            borderRadius: 6,
            fontSize: 14,
            fontWeight: 600,
            border: "none",
            cursor: "pointer",
            fontFamily: FONTS.sans,
          }}
        >
          Unlock
        </button>
      </form>
    </div>
  );
}
