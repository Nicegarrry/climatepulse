"use client";

import { FormEvent, useState } from "react";
import Image from "next/image";
import "./landing.css";

type CaptureStatus = "idle" | "success" | "error";

const STATUS_COPY: Record<Exclude<CaptureStatus, "idle">, string> = {
  success: "Thanks. We will be in touch.",
  error: "Something went wrong. Please try again.",
};

export function Landing({ initialStatus = "idle" }: { initialStatus?: CaptureStatus }) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<CaptureStatus>(initialStatus);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function submitInterest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setStatus("idle");

    try {
      const formData = new FormData(event.currentTarget);
      const response = await fetch("/api/holding-interest", {
        method: "POST",
        body: formData,
        headers: {
          Accept: "application/json",
          "X-Requested-With": "fetch",
        },
      });

      if (!response.ok) {
        throw new Error("Capture failed");
      }

      setEmail("");
      setStatus("success");
    } catch {
      setStatus("error");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="cp-holding">
      <section className="cp-holding__hero" aria-labelledby="holding-title">
        <div className="cp-holding__brand">
          <Image
            className="cp-holding__logo"
            src="/logo.svg"
            alt="Climate Pulse"
            width={808}
            height={347}
            priority
          />
        </div>

        <div className="cp-holding__copy">
          <h1 id="holding-title">
            Thanks for the support. We will be in touch about a renewed Climate Pulse
            experience and our other new products.
          </h1>

          <form
            className="cp-holding__form"
            action="/api/holding-interest"
            method="post"
            onSubmit={submitInterest}
          >
            <label className="cp-holding__label" htmlFor="holding-email">
              Email
            </label>
            <div className="cp-holding__capture">
              <input
                id="holding-email"
                name="email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
                autoComplete="email"
                inputMode="email"
                required
              />
              <button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Sending" : "Keep me posted"}
              </button>
            </div>
            {status !== "idle" && (
              <p
                className={`cp-holding__status cp-holding__status--${status}`}
                role="status"
                aria-live="polite"
              >
                {STATUS_COPY[status]}
              </p>
            )}
          </form>
        </div>

        <a className="cp-holding__contact" href="mailto:hello@climatepulse.app">
          hello@climatepulse.app
        </a>
      </section>
    </main>
  );
}
