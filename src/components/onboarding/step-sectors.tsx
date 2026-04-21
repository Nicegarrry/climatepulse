"use client";

import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DOMAIN_ICONS } from "@/lib/domain-icons";

interface TaxonomyMicrosector {
  id: number;
  slug: string;
  name: string;
}

interface TaxonomySector {
  id: number;
  slug: string;
  name: string;
  microsectors: TaxonomyMicrosector[];
}

interface TaxonomyDomain {
  id: number;
  slug: string;
  name: string;
  description: string;
  article_count?: number;
  sectors: TaxonomySector[];
}

interface StepSectorsProps {
  domains: TaxonomyDomain[];
  initialSlugs?: string[];
  onNext: (microsectorSlugs: string[]) => void;
}

const MAX_DOMAINS = 6;

export function StepSectors({ domains, initialSlugs = [], onNext }: StepSectorsProps) {
  // Track selected microsector slugs
  const [selectedSlugs, setSelectedSlugs] = useState<Set<string>>(() => new Set(initialSlugs));
  // Track which domains have their accordion expanded
  const [expandedDomain, setExpandedDomain] = useState<string | null>(null);

  // Derive which domains are "selected" (have any microsector selected)
  const selectedDomainSlugs = useMemo(() => {
    const domainSlugs = new Set<string>();
    for (const domain of domains) {
      const allMicrosectors = domain.sectors.flatMap((s) => s.microsectors);
      if (allMicrosectors.some((ms) => selectedSlugs.has(ms.slug))) {
        domainSlugs.add(domain.slug);
      }
    }
    return domainSlugs;
  }, [domains, selectedSlugs]);

  const allMicrosectorsForDomain = (domain: TaxonomyDomain) =>
    domain.sectors.flatMap((s) => s.microsectors);

  const isDomainFullySelected = (domain: TaxonomyDomain) => {
    const all = allMicrosectorsForDomain(domain);
    return all.length > 0 && all.every((ms) => selectedSlugs.has(ms.slug));
  };

  const toggleDomain = (domain: TaxonomyDomain) => {
    const all = allMicrosectorsForDomain(domain);
    const allSlugs = all.map((ms) => ms.slug);
    const isCurrentlySelected = selectedDomainSlugs.has(domain.slug);

    setSelectedSlugs((prev) => {
      const next = new Set(prev);
      if (isCurrentlySelected) {
        // Deselect all microsectors in this domain
        for (const slug of allSlugs) next.delete(slug);
        if (expandedDomain === domain.slug) setExpandedDomain(null);
      } else {
        // Check domain cap
        if (selectedDomainSlugs.size >= MAX_DOMAINS) return prev;
        // Select all microsectors in this domain
        for (const slug of allSlugs) next.add(slug);
      }
      return next;
    });
  };

  const toggleMicrosector = (slug: string) => {
    setSelectedSlugs((prev) => {
      const next = new Set(prev);
      if (next.has(slug)) {
        next.delete(slug);
      } else {
        next.add(slug);
      }
      return next;
    });
  };

  const toggleExpand = (domainSlug: string) => {
    setExpandedDomain((prev) => (prev === domainSlug ? null : domainSlug));
  };

  // Rough story count estimate based on article_count
  const storyHint = (domain: TaxonomyDomain) => {
    const count = domain.article_count ?? 0;
    if (count === 0) return "New";
    const weekly = Math.round((count / 30) * 7);
    return `~${weekly}/week`;
  };

  return (
    <div className="mx-auto w-full max-w-3xl">
      <div className="mb-8 text-center">
        <h1 className="font-display text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
          What areas do you follow?
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Pick the domains that matter to you. You can get specific if you want.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        {domains.map((domain, i) => {
          const Icon = DOMAIN_ICONS[domain.slug];
          const isSelected = selectedDomainSlugs.has(domain.slug);
          const isExpanded = expandedDomain === domain.slug;
          const atCap = selectedDomainSlugs.size >= MAX_DOMAINS && !isSelected;

          return (
            <motion.div
              key={domain.slug}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03, duration: 0.25 }}
              className={`col-span-1 ${isExpanded ? "col-span-2 sm:col-span-3" : ""}`}
            >
              <div
                className={`relative flex w-full items-stretch rounded-xl border text-left transition-all duration-200 ${
                  isSelected
                    ? "border-accent-emerald bg-accent-emerald/5"
                    : atCap
                      ? "cursor-not-allowed border-border/30 opacity-40"
                      : "border-border/60 bg-card hover:border-accent-emerald/40"
                }`}
              >
                <button
                  type="button"
                  onClick={() => toggleDomain(domain)}
                  disabled={atCap}
                  aria-pressed={isSelected}
                  className="flex flex-1 items-center gap-3 rounded-l-xl p-4 text-left disabled:cursor-not-allowed"
                >
                  {/* Checkbox indicator */}
                  <div
                    className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-colors ${
                      isSelected
                        ? "border-accent-emerald bg-accent-emerald text-white"
                        : "border-border bg-background"
                    }`}
                  >
                    {isSelected && <Check className="h-3 w-3" />}
                  </div>

                  {Icon && (
                    <div
                      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg transition-colors ${
                        isSelected
                          ? "bg-accent-emerald/15 text-accent-emerald"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      <Icon className="h-5 w-5" />
                    </div>
                  )}

                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium leading-tight text-foreground">
                      {domain.name}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {storyHint(domain)}
                    </p>
                  </div>
                </button>

                {/* Expand toggle — always visible so users can preview micro-sectors before committing */}
                <button
                  type="button"
                  onClick={() => toggleExpand(domain.slug)}
                  aria-label={isExpanded ? `Collapse ${domain.name}` : `Customise ${domain.name}`}
                  aria-expanded={isExpanded}
                  className={`flex w-11 shrink-0 items-center justify-center rounded-r-xl border-l transition-colors ${
                    isSelected
                      ? "border-accent-emerald/30 text-accent-emerald hover:bg-accent-emerald/10"
                      : "border-border/50 text-muted-foreground hover:bg-muted/50"
                  }`}
                >
                  <ChevronDown
                    className={`h-4 w-4 transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`}
                  />
                </button>
              </div>

              {/* Accordion: sector/microsector drill-down */}
              <AnimatePresence>
                {isExpanded && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div className="mt-2 space-y-3 rounded-lg border border-border/40 bg-muted/30 p-3">
                      {/* Select/deselect all */}
                      <button
                        onClick={() => {
                          const all = allMicrosectorsForDomain(domain);
                          const allSelected = isDomainFullySelected(domain);
                          setSelectedSlugs((prev) => {
                            const next = new Set(prev);
                            for (const ms of all) {
                              if (allSelected) next.delete(ms.slug);
                              else next.add(ms.slug);
                            }
                            return next;
                          });
                        }}
                        className="text-xs font-medium text-accent-emerald hover:underline"
                      >
                        {isDomainFullySelected(domain) ? "Deselect all" : "Select all"}
                      </button>

                      {domain.sectors.map((sector) => (
                        <div key={sector.slug}>
                          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                            {sector.name}
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {sector.microsectors.map((ms) => {
                              const isActive = selectedSlugs.has(ms.slug);
                              return (
                                <button
                                  key={ms.slug}
                                  onClick={() => toggleMicrosector(ms.slug)}
                                  className={`rounded-full border px-3 py-1 text-xs transition-all ${
                                    isActive
                                      ? "border-accent-emerald bg-accent-emerald/10 text-accent-emerald"
                                      : "border-border bg-background text-muted-foreground hover:border-accent-emerald/40"
                                  }`}
                                >
                                  {ms.name}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })}
      </div>

      {/* Domain + microsector counts + Next */}
      <div className="mt-8 flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          {selectedDomainSlugs.size} of {MAX_DOMAINS} domains
          <span className="mx-1.5 text-muted-foreground/60">·</span>
          {selectedSlugs.size} {selectedSlugs.size === 1 ? "sector" : "sectors"}
        </p>
        <Button
          onClick={() => onNext(Array.from(selectedSlugs))}
          disabled={selectedSlugs.size === 0}
          className="bg-accent-emerald text-white hover:bg-accent-emerald/90"
        >
          Next
        </Button>
      </div>
    </div>
  );
}
