"use client";

import { useState, useEffect } from "react";
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
  | { step: "sent"; email: string };

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<LoginState>({ step: "email" });
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const { login } = useAuth();

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
      setState({ step: "sent", email });
      setResendCooldown(60);
    } else {
      setError(result.error || "Could not send magic link. Please try again.");
    }
  }

  async function handleResend() {
    if (resendCooldown > 0 || state.step !== "sent") return;
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
                    Enter your email to receive a magic link.
                  </p>

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
                  key="sent-state"
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
                    Check your email
                  </p>
                  <p className="mb-5 text-center text-sm text-foreground">
                    We sent a magic link to
                  </p>
                  <p className="mb-6 text-center text-sm font-medium text-forest">
                    {state.email}
                  </p>
                  <p className="mb-6 text-center text-xs text-muted-foreground">
                    Click the link in your email to sign in. You can close this window.
                  </p>

                  {error && <p className="mb-3 text-sm text-destructive">{error}</p>}

                  <div className="space-y-3">
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full h-10"
                      onClick={handleResend}
                      disabled={submitting || resendCooldown > 0}
                    >
                      {submitting ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Resending...
                        </>
                      ) : resendCooldown > 0 ? (
                        `Resend in ${resendCooldown}s`
                      ) : (
                        "Resend magic link"
                      )}
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
