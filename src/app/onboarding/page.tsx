"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import { ArrowLeft } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { StepRole } from "@/components/onboarding/step-role";
import { StepSectors } from "@/components/onboarding/step-sectors";
import { StepRegions } from "@/components/onboarding/step-regions";
import type { BriefingDepth } from "@/lib/types";

interface TaxonomyTree {
  domains: {
    id: number;
    slug: string;
    name: string;
    description: string;
    article_count?: number;
    sectors: {
      id: number;
      slug: string;
      name: string;
      microsectors: { id: number; slug: string; name: string }[];
    }[];
  }[];
}

const stepVariants = {
  enter: { opacity: 0, x: 40 },
  center: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -40 },
};

export default function OnboardingPage() {
  const router = useRouter();
  const { user, updateUser } = useAuth();

  const [step, setStep] = useState(0);
  const [roleLens, setRoleLens] = useState<string>("");
  const [displayName, setDisplayName] = useState<string>("");
  const [microsectorSlugs, setMicrosectorSlugs] = useState<string[]>([]);
  const [taxonomy, setTaxonomy] = useState<TaxonomyTree | null>(null);
  const [taxonomyError, setTaxonomyError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Fetch taxonomy on mount. Retriable so a transient failure doesn't leave the
  // user staring at an infinite spinner on Step 1.
  const loadTaxonomy = useCallback(async () => {
    setTaxonomyError(null);
    try {
      const r = await fetch("/api/taxonomy/tree");
      if (!r.ok) throw new Error(`Taxonomy fetch failed: ${r.status}`);
      const data = await r.json();
      if (data.domains?.length) {
        setTaxonomy(data);
      } else {
        throw new Error("Taxonomy returned no domains");
      }
    } catch (err) {
      console.error("Taxonomy load error:", err);
      setTaxonomyError(
        err instanceof Error ? err.message : "Couldn't load sectors"
      );
    }
  }, []);

  useEffect(() => {
    loadTaxonomy();
  }, [loadTaxonomy]);

  // If user is already onboarded and didn't come here intentionally, redirect
  // (The (app)/layout guard handles the main routing — this page can be
  // visited directly via /onboarding for testing or re-onboarding)


  const handleRoleSelect = (roleId: string) => {
    setRoleLens(roleId);
    setStep(1);
  };

  const handleSectorsNext = (slugs: string[]) => {
    setMicrosectorSlugs(slugs);
    setStep(2);
  };

  const handleComplete = async (
    jurisdictions: string[],
    briefingDepth: BriefingDepth,
    name: string
  ) => {
    setIsSubmitting(true);
    setSubmitError(null);
    setDisplayName(name);
    try {
      if (!user?.id) {
        console.error("Onboarding: no authenticated user");
        setSubmitError("You're not signed in. Please refresh and try again.");
        setIsSubmitting(false);
        return;
      }

      const finalName = name.trim() || user.name || user.email.split("@")[0];

      const res = await fetch("/api/user/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user.id,
          email: user.email,
          name: finalName,
          role_lens: roleLens,
          primary_sectors: microsectorSlugs,
          jurisdictions,
          briefing_depth: briefingDepth,
          onboarded_at: new Date().toISOString(),
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        if (res.status === 402 && body?.error === "SECTOR_LIMIT_EXCEEDED") {
          const limit = typeof body.limit === "number" ? body.limit : 3;
          setSubmitError(
            `You picked ${microsectorSlugs.length} sectors, but your plan supports up to ${limit}. Tap back and narrow your selection.`
          );
          setStep(1);
        } else {
          setSubmitError(
            body?.message || body?.error || "We couldn't save your preferences. Please try again."
          );
        }
        setIsSubmitting(false);
        return;
      }

      updateUser({ onboardedAt: new Date().toISOString(), name: finalName });
      // Yield one microtask so the AuthProvider's state update flushes to
      // (app)/layout's guard before we navigate — otherwise the guard can
      // read stale onboardedAt=null and bounce us back to /onboarding.
      await Promise.resolve();
      router.replace("/dashboard");
    } catch (err) {
      console.error("Onboarding save failed:", err);
      setSubmitError("Network error. Check your connection and try again.");
      setIsSubmitting(false);
    }
  };

  const goBack = () => {
    if (step > 0) setStep(step - 1);
  };

  return (
    <div className="flex min-h-screen flex-col bg-surface-0">
      {/* Top bar */}
      <div className="flex h-14 items-center gap-3 px-4 sm:px-6">
        {step > 0 ? (
          <button
            onClick={goBack}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
        ) : (
          <div className="flex items-center gap-2">
            <Image src="/leaf only.svg" alt="Climate Pulse" width={28} height={28} />
            <span className="font-display text-base font-semibold tracking-tight text-plum">
              climate pulse
            </span>
          </div>
        )}
        <div className="flex-1" />
        {/* Step indicator */}
        <div className="flex items-center gap-1.5">
          {[0, 1, 2].map((s) => (
            <div
              key={s}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                s === step
                  ? "w-6 bg-accent-emerald"
                  : s < step
                    ? "w-1.5 bg-accent-emerald/50"
                    : "w-1.5 bg-border"
              }`}
            />
          ))}
        </div>
      </div>

      {/* Error banner — shown when save fails (e.g. SECTOR_LIMIT_EXCEEDED) */}
      {submitError && (
        <div className="mx-auto mt-2 w-full max-w-lg px-4">
          <div
            role="alert"
            className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive"
          >
            {submitError}
          </div>
        </div>
      )}

      {/* Step content */}
      <div className="flex flex-1 items-start justify-center px-4 pt-8 pb-16 sm:pt-16">
        <AnimatePresence mode="wait">
          {step === 0 && (
            <motion.div
              key="role"
              variants={stepVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.25 }}
              className="w-full"
            >
              <StepRole onSelect={handleRoleSelect} />
            </motion.div>
          )}

          {step === 1 && (
            <motion.div
              key="sectors"
              variants={stepVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.25 }}
              className="w-full"
            >
              {taxonomy ? (
                <StepSectors
                  domains={taxonomy.domains}
                  initialSlugs={microsectorSlugs}
                  onNext={handleSectorsNext}
                />
              ) : taxonomyError ? (
                <div className="mx-auto max-w-md px-4 py-16 text-center">
                  <p className="text-sm font-medium text-foreground">
                    Couldn&apos;t load sectors.
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {taxonomyError}. This is usually transient.
                  </p>
                  <button
                    type="button"
                    onClick={loadTaxonomy}
                    className="mt-4 rounded-lg bg-accent-emerald px-4 py-2 text-sm font-medium text-white hover:bg-accent-emerald/90"
                  >
                    Try again
                  </button>
                </div>
              ) : (
                <div className="flex justify-center py-20">
                  <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent-emerald border-t-transparent" />
                </div>
              )}
            </motion.div>
          )}

          {step === 2 && (
            <motion.div
              key="regions"
              variants={stepVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.25 }}
              className="w-full"
            >
              <StepRegions
                initialName={displayName || user?.name || ""}
                onComplete={handleComplete}
                isSubmitting={isSubmitting}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
