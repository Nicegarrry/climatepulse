"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import Image from "next/image";
import { Loader2, ArrowLeft, Mail } from "lucide-react";

type LoginState =
  | { step: "email" }
  | { step: "code"; email: string };

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [state, setState] = useState<LoginState>({ step: "email" });
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const { login, loginWithGoogle, verifyCode } = useAuth();
  const router = useRouter();
  const codeInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (state.step === "code") {
      codeInputRef.current?.focus();
    }
  }, [state.step]);

  // Cooldown timer for resend button
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const id = setInterval(() => setResendCooldown((s) => s - 1), 1000);
    return () => clearInterval(id);
  }, [resendCooldown]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSubmitting(true);

    const result = await login(email);
    setSubmitting(false);

    if (result.ok) {
      setState({ step: "code", email });
      setCode("");
      setResendCooldown(60);
    } else {
      setError(result.error || "Could not send sign-in code. Please try again.");
    }
  }

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    if (state.step !== "code") return;
    setError("");
    setSubmitting(true);

    const result = await verifyCode(state.email, code);
    setSubmitting(false);

    if (result.ok) {
      router.push("/dashboard");
    } else {
      setError(result.error || "That code didn't work. Check the email and try again.");
    }
  }

  async function handleGoogle() {
    setError("");
    setSubmitting(true);
    const result = await loginWithGoogle();
    if (!result.ok) {
      setSubmitting(false);
      setError(result.error || "Could not start Google sign-in. Please try again.");
    }
    // On success, the browser redirects to Google; no further UI handling needed.
  }

  async function handleResend() {
    if (resendCooldown > 0 || state.step !== "code") return;
    setError("");
    setSubmitting(true);
    const result = await login(state.email);
    setSubmitting(false);
    if (result.ok) {
      setResendCooldown(60);
    } else {
      setError(result.error || "Could not resend. Try again shortly.");
    }
  }

  function goBack() {
    setState({ step: "email" });
    setCode("");
    setError("");
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] }}
        className="w-full max-w-[400px]"
      >
        {/* Logo area */}
        <div className="mb-10 text-center">
          <motion.div
            initial={{ scale: 0.85, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.1, duration: 0.5, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] }}
            className="mx-auto mb-4"
          >
            <Image src="/logo.svg" alt="Climate Pulse" width={280} height={120} className="mx-auto" />
          </motion.div>
          <p className="text-sm text-muted-foreground">
            Climate & Energy Intelligence
          </p>
        </div>

        {/* Auth card */}
        <Card className="border-border/40 bg-white shadow-sm">
          <CardContent className="pt-7 pb-7 px-7">
            <AnimatePresence mode="wait">
              {state.step === "email" ? (
                <motion.div
                  key="email-form"
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 8 }}
                  transition={{ duration: 0.2 }}
                >
                  <p className="mb-2 text-xs font-medium uppercase tracking-widest text-muted-foreground">
                    Sign In
                  </p>
                  <p className="mb-6 text-sm text-muted-foreground">
                    Continue with Google, or get a sign-in code by email.
                  </p>

                  <Button
                    type="button"
                    variant="outline"
                    className="w-full h-10 mb-5 gap-2"
                    onClick={handleGoogle}
                    disabled={submitting}
                  >
                    <svg aria-hidden="true" className="h-4 w-4" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.75h3.56c2.08-1.92 3.28-4.74 3.28-8.08Z"/>
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.67l-3.56-2.75c-.99.66-2.25 1.06-3.72 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z"/>
                      <path fill="#FBBC05" d="M5.84 14.11a6.6 6.6 0 0 1 0-4.22V7.05H2.18a11 11 0 0 0 0 9.9l3.66-2.84Z"/>
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.2 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.05l3.66 2.84C6.71 7.3 9.14 5.38 12 5.38Z"/>
                    </svg>
                    Continue with Google
                  </Button>

                  <div className="relative mb-5">
                    <div className="absolute inset-0 flex items-center">
                      <span className="w-full border-t border-border/60" />
                    </div>
                    <div className="relative flex justify-center text-[10px] uppercase tracking-widest">
                      <span className="bg-white px-2 text-muted-foreground">or</span>
                    </div>
                  </div>

                  <form onSubmit={handleSubmit} className="space-y-5">
                    <div className="space-y-2">
                      <Label htmlFor="email" className="text-xs font-medium text-muted-foreground">
                        Email
                      </Label>
                      <Input
                        id="email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="you@example.com"
                        required
                        autoFocus
                        autoComplete="email"
                        className="h-10"
                      />
                    </div>

                    {error && <p className="text-sm text-destructive">{error}</p>}

                    <Button
                      type="submit"
                      className="w-full h-10 bg-forest hover:bg-forest/90 text-white"
                      disabled={submitting || !email}
                    >
                      {submitting ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Sending...
                        </>
                      ) : (
                        "Continue with email"
                      )}
                    </Button>
                  </form>
                </motion.div>
              ) : (
                <motion.div
                  key="code-state"
                  initial={{ opacity: 0, x: 8 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -8 }}
                  transition={{ duration: 0.2 }}
                >
                  <div className="mb-5 flex items-center justify-center">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-forest/10">
                      <Mail className="h-6 w-6 text-forest" />
                    </div>
                  </div>
                  <p className="mb-2 text-center text-xs font-medium uppercase tracking-widest text-muted-foreground">
                    Enter sign-in code
                  </p>
                  <p className="mb-1 text-center text-sm text-foreground">
                    We sent a 6-digit code to
                  </p>
                  <p className="mb-5 text-center text-sm font-medium text-forest">
                    {state.email}
                  </p>

                  <form onSubmit={handleVerify} className="space-y-5">
                    <div className="space-y-2">
                      <Label htmlFor="code" className="sr-only">
                        Code
                      </Label>
                      <button
                        type="button"
                        onClick={() => codeInputRef.current?.focus()}
                        className="flex w-full justify-center gap-2"
                        aria-label="Enter 6-digit code"
                      >
                        {Array.from({ length: 6 }).map((_, i) => {
                          const char = code[i] ?? "";
                          const isCursor = i === code.length;
                          return (
                            <span
                              key={i}
                              className={`flex h-12 w-11 items-center justify-center rounded-md border font-mono text-xl tabular-nums transition-colors ${
                                char
                                  ? "border-forest/50 bg-forest/5 text-foreground"
                                  : isCursor
                                    ? "border-forest ring-2 ring-forest/30 text-muted-foreground"
                                    : "border-border bg-muted/30 text-muted-foreground"
                              }`}
                            >
                              {char || (isCursor ? <span className="animate-pulse">|</span> : "")}
                            </span>
                          );
                        })}
                      </button>
                      <input
                        ref={codeInputRef}
                        id="code"
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        value={code}
                        onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                        required
                        autoFocus
                        autoComplete="one-time-code"
                        maxLength={6}
                        className="sr-only"
                      />
                    </div>

                    {error && <p className="text-center text-sm text-destructive">{error}</p>}

                    <Button
                      type="submit"
                      className="w-full h-10 bg-forest hover:bg-forest/90 text-white"
                      disabled={submitting || code.length !== 6}
                    >
                      {submitting ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Verifying...
                        </>
                      ) : (
                        "Sign in"
                      )}
                    </Button>
                  </form>

                  <p className="mt-4 text-center text-xs text-muted-foreground">
                    The email also has a magic link you can click instead.
                  </p>

                  <div className="mt-5 space-y-3">
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full h-10"
                      onClick={handleResend}
                      disabled={submitting || resendCooldown > 0}
                    >
                      {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : "Resend code"}
                    </Button>

                    <button
                      type="button"
                      onClick={goBack}
                      className="flex w-full items-center justify-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <ArrowLeft className="h-3 w-3" />
                      Use a different email
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </CardContent>
        </Card>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          Climate Pulse {"\u00B7"} Invite only
        </p>
      </motion.div>
    </div>
  );
}
