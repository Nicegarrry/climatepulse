"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Globe } from "lucide-react";
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
  const [microsectorSlugs, setMicrosectorSlugs] = useState<string[]>([]);
  const [taxonomy, setTaxonomy] = useState<TaxonomyTree | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch taxonomy on mount
  useEffect(() => {
    fetch("/api/taxonomy/tree")
      .then((r) => r.json())
      .then((data) => setTaxonomy(data))
      .catch(console.error);
  }, []);

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
    briefingDepth: BriefingDepth
  ) => {
    setIsSubmitting(true);
    try {
      const userId = user?.id || "test-user-1";

      await fetch("/api/user/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          role_lens: roleLens,
          primary_sectors: microsectorSlugs,
          jurisdictions,
          briefing_depth: briefingDepth,
          onboarded_at: new Date().toISOString(),
        }),
      });

      // Update auth context
      updateUser({ onboardedAt: new Date().toISOString() });

      // Navigate to dashboard
      router.push("/dashboard");
    } catch (err) {
      console.error("Onboarding save failed:", err);
      setIsSubmitting(false);
    }
  };

  const goBack = () => {
    if (step > 0) setStep(step - 1);
  };

  return (
    <div className="flex min-h-screen flex-col bg-[#FAFAF8] dark:bg-[#0D1B2A]">
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
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-emerald-600 text-white">
              <Globe className="h-3.5 w-3.5" />
            </div>
            <span className="font-display text-base font-semibold tracking-tight text-foreground">
              ClimatePulse
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
