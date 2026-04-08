"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { useAuth } from "@/lib/auth-context";
import { useDevLogger } from "@/lib/dev-logger";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Globe, Loader2 } from "lucide-react";

export default function LoginPage() {
  const [email, setEmail] = useState("demo@climatepulse.io");
  const [password, setPassword] = useState("password");
  const [error, setError] = useState("");
  const { login, isLoading } = useAuth();
  const { log } = useDevLogger();
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    log("info", "Login attempt", { email });

    const success = await login(email, password);
    if (success) {
      log("info", "Login successful", { email });
      // Check onboarding status — auth context login fetches the profile
      // and sets onboardedAt. The (app) layout will redirect to /onboarding
      // if needed, but we can also check here for immediate redirect.
      router.push("/dashboard");
    } else {
      log("warn", "Login failed", { email });
      setError("Invalid credentials");
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#FAFAF8] dark:bg-[#0D1B2A] p-4">
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
            className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-accent-emerald text-white"
          >
            <Globe className="h-7 w-7" />
          </motion.div>
          <h1 className="font-display text-[1.75rem] font-medium tracking-tight text-foreground">
            ClimatePulse
          </h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Climate Intelligence Platform
          </p>
        </div>

        {/* Sign-in card */}
        <Card className="border-border/40 bg-white shadow-sm dark:bg-[#1B2B3A]">
          <CardContent className="pt-7 pb-7 px-7">
            {/* Editorial section label */}
            <p className="mb-6 text-xs font-medium uppercase tracking-widest text-muted-foreground">
              Sign In
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
                  className="h-10"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password" className="text-xs font-medium text-muted-foreground">
                  Password
                </Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter password"
                  required
                  className="h-10"
                />
              </div>

              {error && (
                <p className="text-sm text-destructive">{error}</p>
              )}

              <Button
                type="submit"
                className="w-full h-10 bg-accent-emerald hover:bg-accent-emerald/90 text-white"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Signing in...
                  </>
                ) : (
                  "Sign In"
                )}
              </Button>
            </form>

            <p className="mt-5 text-center text-xs text-muted-foreground">
              Demo: any email/password works
            </p>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
