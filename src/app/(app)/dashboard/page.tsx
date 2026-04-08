"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useDevLogger } from "@/lib/dev-logger";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Compass,
  Cpu,
  BrainCircuit,
  CalendarDays,
  Activity,
  Globe,
  Zap,
  Network,
  Newspaper,
} from "lucide-react";
import { DiscoveryTab } from "@/components/discovery-tab";
import { CategoriesTab } from "@/components/categories-tab";
import { EnergyTab } from "@/components/energy-tab";
import { TaxonomyTab } from "@/components/taxonomy-tab";
import { IntelligenceTab } from "@/components/intelligence-tab";

/* ──────────────────────────────────────────────────────────────────────────
   Config
   ────────────────────────────────────────────────────────────────────────── */

const statsConfig = [
  {
    label: "Active Sources",
    value: "0",
    change: "+0",
    icon: Globe,
    iconBg: "bg-accent-emerald/10",
    iconColor: "text-accent-emerald",
  },
  {
    label: "Processing Queue",
    value: "0",
    change: "idle",
    icon: Activity,
    iconBg: "bg-status-info/10",
    iconColor: "text-status-info",
  },
  {
    label: "AI Insights",
    value: "0",
    change: "pending",
    icon: BrainCircuit,
    iconBg: "bg-accent-amber/10",
    iconColor: "text-accent-amber",
  },
  {
    label: "Events Today",
    value: "0",
    change: "none",
    icon: Zap,
    iconBg: "bg-status-warning/10",
    iconColor: "text-status-warning",
  },
];

const tabConfig = [
  {
    value: "intelligence",
    label: "Intelligence",
    icon: Newspaper,
    emptyTitle: "Intelligence",
    emptyDesc:
      "Your personalised daily climate intelligence briefing — AI-synthesised analysis, not just headlines.",
  },
  {
    value: "discovery",
    label: "Discovery",
    icon: Compass,
    emptyTitle: "Discovery",
    emptyDesc:
      "Climate data source discovery and monitoring. Connect sources to begin tracking environmental signals.",
  },
  {
    value: "categories",
    label: "Categories",
    icon: Cpu,
    emptyTitle: "Categories",
    emptyDesc:
      "AI-powered article categorisation using Gemini Flash. Assign articles to the 20-category taxonomy.",
  },
  {
    value: "energy",
    label: "Energy",
    icon: Zap,
    emptyTitle: "Energy Data",
    emptyDesc:
      "Live Australian NEM data from OpenElectricity — generation mix, renewables, emissions, prices.",
  },
  {
    value: "taxonomy",
    label: "Taxonomy",
    icon: Network,
    emptyTitle: "Taxonomy",
    emptyDesc:
      "Manage the 3-level classification hierarchy, entities, signal types, and transmission channels.",
  },
  {
    value: "events",
    label: "Events",
    icon: CalendarDays,
    emptyTitle: "Events",
    emptyDesc:
      "Climate events timeline. Track significant environmental events and their impacts.",
  },
];

/* ──────────────────────────────────────────────────────────────────────────
   Animation variants
   ────────────────────────────────────────────────────────────────────────── */

const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.08 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: "easeOut" as const } },
};

const tabContentVariants = {
  hidden: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.3, ease: "easeOut" as const } },
  exit: { opacity: 0, y: -6, transition: { duration: 0.15 } },
};

/* ──────────────────────────────────────────────────────────────────────────
   Section label — editorial pattern
   ────────────────────────────────────────────────────────────────────────── */

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-5 border-b border-border-subtle pb-2">
      <span className="text-xs font-medium uppercase tracking-[0.1em] text-muted-foreground">
        {children}
      </span>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
   Empty tab content
   ────────────────────────────────────────────────────────────────────────── */

function EmptyTabContent({
  icon: Icon,
  title,
  description,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
}) {
  return (
    <motion.div
      variants={tabContentVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
      className="flex flex-col items-center justify-center py-20 text-center"
    >
      <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-accent-emerald/10">
        <Icon className="h-7 w-7 text-accent-emerald" />
      </div>
      <h3 className="font-display text-lg font-semibold">{title}</h3>
      <p className="mt-1.5 max-w-sm text-sm leading-relaxed text-muted-foreground">
        {description}
      </p>
    </motion.div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
   Dashboard page
   ────────────────────────────────────────────────────────────────────────── */

export default function DashboardPage() {
  const { log } = useDevLogger();
  const [activeTab, setActiveTab] = useState("intelligence");

  useEffect(() => {
    log("info", "Dashboard loaded");
  }, [log]);

  return (
    <div className="mx-auto max-w-screen-2xl p-4 sm:p-6 lg:p-8">
      {/* ── Page header ─────────────────────────────────────────────── */}
      <header className="mb-8">
        <h1 className="font-display text-2xl font-semibold tracking-tight">
          Dashboard
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Climate intelligence overview and monitoring
        </p>
      </header>

      {/* ── Stats overview ──────────────────────────────────────────── */}
      <SectionLabel>Key Metrics</SectionLabel>

      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="show"
        className="mb-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
      >
        {statsConfig.map((stat) => (
          <motion.div key={stat.label} variants={itemVariants}>
            <Card className="border-border/40 transition-colors duration-150 hover:border-border">
              <CardContent className="flex items-center gap-4 p-5">
                <div
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${stat.iconBg}`}
                >
                  <stat.icon className={`h-5 w-5 ${stat.iconColor}`} />
                </div>
                <div className="flex-1 space-y-1">
                  <p className="text-xs font-medium uppercase tracking-[0.1em] text-muted-foreground">
                    {stat.label}
                  </p>
                  <div className="flex items-baseline gap-2">
                    <span className="font-display text-3xl font-semibold tracking-tight">
                      {stat.value}
                    </span>
                    <Badge variant="secondary" className="text-[10px]">
                      {stat.change}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </motion.div>

      {/* ── Main tabs ───────────────────────────────────────────────── */}
      <SectionLabel>Activity</SectionLabel>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.32, duration: 0.4 }}
      >
        <Tabs
          value={activeTab}
          onValueChange={(v) => {
            setActiveTab(v);
            log("info", `Switched to tab: ${v}`);
          }}
        >
          <TabsList
            className="mb-4 w-full justify-start gap-0 rounded-none border-b border-border/40 bg-transparent p-0"
          >
            {tabConfig.map((tab) => (
              <TabsTrigger
                key={tab.value}
                value={tab.value}
                className="relative gap-1.5 rounded-none border-b-2 border-transparent px-4 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground data-active:border-b-accent-emerald data-active:text-foreground data-active:shadow-none"
              >
                <tab.icon className="h-4 w-4" />
                <span className="hidden sm:inline">{tab.label}</span>
              </TabsTrigger>
            ))}
          </TabsList>

          <Card className="border-border/40">
            <TabsContent value="intelligence" className="m-0">
              <IntelligenceTab />
            </TabsContent>
            <TabsContent value="discovery" className="m-0">
              <DiscoveryTab />
            </TabsContent>
            <TabsContent value="categories" className="m-0">
              <CategoriesTab />
            </TabsContent>
            <TabsContent value="energy" className="m-0">
              <EnergyTab />
            </TabsContent>
            <TabsContent value="taxonomy" className="m-0">
              <TaxonomyTab />
            </TabsContent>
            {tabConfig
              .filter((tab) => tab.value !== "intelligence" && tab.value !== "discovery" && tab.value !== "categories" && tab.value !== "energy" && tab.value !== "taxonomy")
              .map((tab) => (
                <TabsContent
                  key={tab.value}
                  value={tab.value}
                  className="m-0"
                >
                  <EmptyTabContent
                    icon={tab.icon}
                    title={tab.emptyTitle}
                    description={tab.emptyDesc}
                  />
                </TabsContent>
              ))}
          </Card>
        </Tabs>
      </motion.div>
    </div>
  );
}
