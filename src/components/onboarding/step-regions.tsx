"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Lock, Clock, Zap, Newspaper, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { BriefingDepth } from "@/lib/types";

interface StepRegionsProps {
  initialJurisdictions?: string[];
  initialDepth?: BriefingDepth;
  initialName?: string;
  onComplete: (
    jurisdictions: string[],
    briefingDepth: BriefingDepth,
    name: string
  ) => void;
  isSubmitting?: boolean;
}

const AU_STATES = [
  { id: "nsw", label: "NSW" },
  { id: "vic", label: "VIC" },
  { id: "qld", label: "QLD" },
  { id: "sa", label: "SA" },
  { id: "wa", label: "WA" },
  { id: "tas", label: "TAS" },
  { id: "act", label: "ACT" },
  { id: "nt", label: "NT" },
];

const INTERNATIONAL = [
  { id: "eu", label: "EU" },
  { id: "us", label: "United States" },
  { id: "china", label: "China" },
  { id: "india", label: "India" },
  { id: "southeast-asia", label: "Southeast Asia" },
  { id: "japan-korea", label: "Japan / Korea" },
];

const DEPTH_OPTIONS: {
  id: BriefingDepth;
  label: string;
  description: string;
  stories: string;
  icon: typeof Zap;
}[] = [
  {
    id: "quick",
    label: "Quick",
    description: "The essentials in 2 minutes",
    stories: "3–5 stories",
    icon: Zap,
  },
  {
    id: "standard",
    label: "Standard",
    description: "A solid morning briefing",
    stories: "5–8 stories",
    icon: Newspaper,
  },
  {
    id: "deep",
    label: "Deep",
    description: "Comprehensive coverage",
    stories: "8–12 stories",
    icon: BookOpen,
  },
];

export function StepRegions({
  initialJurisdictions = ["australia"],
  initialDepth = "standard",
  initialName = "",
  onComplete,
  isSubmitting = false,
}: StepRegionsProps) {
  const [jurisdictions, setJurisdictions] = useState<Set<string>>(
    () => new Set(initialJurisdictions.length > 0 ? initialJurisdictions : ["australia"])
  );
  const [depth, setDepth] = useState<BriefingDepth>(initialDepth);
  const [name, setName] = useState<string>(initialName);

  const toggleJurisdiction = (id: string) => {
    if (id === "australia") return; // locked
    setJurisdictions((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="mx-auto w-full max-w-lg">
      <div className="mb-8 text-center">
        <h1 className="font-display text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
          Almost there
        </h1>
      </div>

      {/* Name — optional, matters for greeting copy on the dashboard */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="mb-8"
      >
        <label
          htmlFor="onboarding-name"
          className="mb-1 block text-sm font-medium text-foreground"
        >
          What should we call you?
        </label>
        <p className="mb-2 text-xs text-muted-foreground">
          Just a first name is fine. You can change this later in settings.
        </p>
        <input
          id="onboarding-name"
          type="text"
          autoComplete="given-name"
          value={name}
          onChange={(e) => setName(e.target.value.slice(0, 60))}
          placeholder="First name"
          className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground focus:border-accent-emerald focus:outline-none focus:ring-2 focus:ring-accent-emerald/30"
        />
      </motion.div>

      {/* Regions */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05, duration: 0.3 }}
        className="mb-8"
      >
        <h2 className="mb-1 text-sm font-medium text-foreground">
          Which regions matter to you beyond Australia?
        </h2>
        <p className="mb-4 text-xs text-muted-foreground">
          Australia is always included. Add regions to boost relevant stories.
        </p>

        {/* Australia locked chip */}
        <div className="mb-3 flex items-center gap-2">
          <div className="flex items-center gap-1.5 rounded-full border border-accent-emerald bg-accent-emerald/10 px-3 py-1.5 text-xs font-medium text-accent-emerald">
            <Lock className="h-3 w-3" />
            Australia
          </div>
        </div>

        {/* State toggles */}
        <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
          States
        </p>
        <div className="mb-4 flex flex-wrap gap-2">
          {AU_STATES.map((state) => {
            const isActive = jurisdictions.has(state.id);
            return (
              <button
                key={state.id}
                onClick={() => toggleJurisdiction(state.id)}
                className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-all ${
                  isActive
                    ? "border-accent-emerald bg-accent-emerald/10 text-accent-emerald"
                    : "border-border bg-card text-muted-foreground hover:border-accent-emerald/40"
                }`}
              >
                {state.label}
              </button>
            );
          })}
        </div>

        {/* International toggles */}
        <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
          International
        </p>
        <div className="flex flex-wrap gap-2">
          {INTERNATIONAL.map((region) => {
            const isActive = jurisdictions.has(region.id);
            return (
              <button
                key={region.id}
                onClick={() => toggleJurisdiction(region.id)}
                className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-all ${
                  isActive
                    ? "border-accent-emerald bg-accent-emerald/10 text-accent-emerald"
                    : "border-border bg-card text-muted-foreground hover:border-accent-emerald/40"
                }`}
              >
                {region.label}
              </button>
            );
          })}
        </div>
      </motion.div>

      {/* Briefing Depth */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1, duration: 0.3 }}
        className="mb-8"
      >
        <h2 className="mb-1 text-sm font-medium text-foreground">
          How much do you want each morning?
        </h2>
        <p className="mb-4 text-xs text-muted-foreground">
          You can change this anytime in settings.
        </p>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {DEPTH_OPTIONS.map((option) => {
            const Icon = option.icon;
            const isSelected = depth === option.id;
            return (
              <motion.button
                key={option.id}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setDepth(option.id)}
                className={`flex flex-col items-center gap-2 rounded-xl border p-4 text-center transition-all duration-200 ${
                  isSelected
                    ? "border-accent-emerald bg-accent-emerald/5 ring-2 ring-accent-emerald/30"
                    : "border-border/60 bg-card hover:border-accent-emerald/40"
                }`}
              >
                <div
                  className={`flex h-10 w-10 items-center justify-center rounded-lg transition-colors ${
                    isSelected
                      ? "bg-accent-emerald text-white"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  <Icon className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {option.label}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {option.description}
                  </p>
                  <p className="mt-1 flex items-center justify-center gap-1 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    {option.stories}
                  </p>
                </div>
              </motion.button>
            );
          })}
        </div>
      </motion.div>

      {/* CTA */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2, duration: 0.3 }}
      >
        <Button
          onClick={() => onComplete(Array.from(jurisdictions), depth, name)}
          disabled={isSubmitting}
          className="h-12 w-full bg-accent-emerald text-base font-medium text-white hover:bg-accent-emerald/90"
        >
          {isSubmitting ? "Building your briefing..." : "Start my first briefing"}
        </Button>
      </motion.div>
    </div>
  );
}
