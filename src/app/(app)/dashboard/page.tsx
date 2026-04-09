"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { useAuth } from "@/lib/auth-context";
import { useDevLogger } from "@/lib/dev-logger";
import { motion, AnimatePresence } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Compass,
  Cpu,
  BrainCircuit,
  CalendarDays,
  Zap,
  Network,
  Newspaper,
  Globe,
  Sun,
  Moon,
  User,
  Settings,
  LogOut,
  Bug,
  Terminal,
  ChevronLeft,
  ChevronRight,
  LineChart,
} from "lucide-react";
import { DiscoveryTab } from "@/components/discovery-tab";
import { CategoriesTab } from "@/components/categories-tab";
import { EnergyTab } from "@/components/energy-tab";
import { TaxonomyTab } from "@/components/taxonomy-tab";
import { IntelligenceTab } from "@/components/intelligence-tab";
import { MarketsTab } from "@/components/markets-tab";

/* ──────────────────────────────────────────────────────────────────────────
   Config
   ────────────────────────────────────────────────────────────────────────── */

const tabConfig = [
  { value: "intelligence", label: "Intelligence", icon: Newspaper },
  { value: "discovery", label: "Discovery", icon: Compass },
  { value: "categories", label: "Categories", icon: Cpu },
  { value: "energy", label: "Energy", icon: Zap },
  { value: "markets", label: "Markets", icon: LineChart },
  { value: "taxonomy", label: "Taxonomy", icon: Network },
  { value: "events", label: "Events", icon: CalendarDays },
];

/* ──────────────────────────────────────────────────────────────────────────
   Animation variants
   ────────────────────────────────────────────────────────────────────────── */

const tabContentVariants = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.25, ease: "easeOut" as const } },
  exit: { opacity: 0, y: -4, transition: { duration: 0.12 } },
};

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
   Tab content renderer
   ────────────────────────────────────────────────────────────────────────── */

function TabContent({ activeTab }: { activeTab: string }) {
  switch (activeTab) {
    case "intelligence":
      return <IntelligenceTab />;
    case "discovery":
      return <DiscoveryTab />;
    case "categories":
      return <CategoriesTab />;
    case "energy":
      return <EnergyTab />;
    case "markets":
      return <MarketsTab />;
    case "taxonomy":
      return <TaxonomyTab />;
    case "events":
      return (
        <EmptyTabContent
          icon={CalendarDays}
          title="Events"
          description="Climate events timeline. Track significant environmental events and their impacts."
        />
      );
    default:
      return null;
  }
}

/* ──────────────────────────────────────────────────────────────────────────
   Dashboard page — sidebar layout
   ────────────────────────────────────────────────────────────────────────── */

export default function DashboardPage() {
  const { log, isOpen, setIsOpen, logs } = useDevLogger();
  const { user, logout } = useAuth();
  const { theme, setTheme } = useTheme();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("intelligence");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const errorCount = logs.filter((l) => l.level === "error").length;
  const initials = user?.name
    ? user.name
        .split(" ")
        .map((n) => n[0])
        .join("")
    : "?";

  useEffect(() => {
    log("info", "Dashboard loaded");
  }, [log]);

  return (
    <div className="flex h-screen overflow-hidden">
      {/* ── Desktop sidebar ────────────────────────────────────────── */}
      <aside
        className={`hidden md:flex flex-col border-r border-border/40 bg-sidebar transition-all duration-200 ${
          sidebarCollapsed ? "w-[68px]" : "w-[220px]"
        }`}
      >
        {/* Logo area */}
        <div className="flex h-16 items-center gap-3 border-b border-border/40 px-4">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-600 text-white">
            <Globe className="h-5 w-5" />
          </div>
          {!sidebarCollapsed && (
            <span className="font-display text-lg font-semibold tracking-tight text-foreground">
              ClimatePulse
            </span>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-1 px-2 py-4">
          {tabConfig.map((tab) => {
            const isActive = activeTab === tab.value;
            return (
              <button
                key={tab.value}
                onClick={() => {
                  setActiveTab(tab.value);
                  log("info", `Switched to tab: ${tab.value}`);
                }}
                className={`group flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors duration-150 ${
                  isActive
                    ? "bg-accent-emerald/10 text-accent-emerald"
                    : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                } ${sidebarCollapsed ? "justify-center px-0" : ""}`}
                title={sidebarCollapsed ? tab.label : undefined}
              >
                <tab.icon
                  className={`h-[18px] w-[18px] shrink-0 ${
                    isActive ? "text-accent-emerald" : "text-muted-foreground group-hover:text-foreground"
                  }`}
                />
                {!sidebarCollapsed && <span>{tab.label}</span>}
                {isActive && !sidebarCollapsed && (
                  <div className="ml-auto h-1.5 w-1.5 rounded-full bg-accent-emerald" />
                )}
              </button>
            );
          })}
        </nav>

        {/* Bottom controls */}
        <div className="space-y-1 border-t border-border/40 px-2 py-3">
          {/* Dev button */}
          <button
            onClick={() => setIsOpen(!isOpen)}
            className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground ${
              sidebarCollapsed ? "justify-center px-0" : ""
            }`}
            title={sidebarCollapsed ? "Dev Panel" : undefined}
          >
            <Terminal className="h-[18px] w-[18px] shrink-0" />
            {!sidebarCollapsed && (
              <>
                <span className="font-mono text-xs">Dev</span>
                {logs.length > 0 && (
                  <Badge
                    variant={errorCount > 0 ? "destructive" : "secondary"}
                    className="ml-auto h-5 min-w-5 rounded-full px-1.5 text-[10px] font-medium"
                  >
                    {logs.length}
                  </Badge>
                )}
              </>
            )}
            {sidebarCollapsed && logs.length > 0 && (
              <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-accent-emerald" />
            )}
          </button>

          {/* Theme toggle */}
          <button
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground ${
              sidebarCollapsed ? "justify-center px-0" : ""
            }`}
            title={sidebarCollapsed ? "Toggle theme" : undefined}
          >
            <Sun className="h-[18px] w-[18px] shrink-0 dark:hidden" />
            <Moon className="hidden h-[18px] w-[18px] shrink-0 dark:block" />
            {!sidebarCollapsed && <span>Theme</span>}
          </button>

          {/* Collapse toggle */}
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground ${
              sidebarCollapsed ? "justify-center px-0" : ""
            }`}
          >
            {sidebarCollapsed ? (
              <ChevronRight className="h-[18px] w-[18px] shrink-0" />
            ) : (
              <>
                <ChevronLeft className="h-[18px] w-[18px] shrink-0" />
                <span>Collapse</span>
              </>
            )}
          </button>

          {/* User */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground ${
                  sidebarCollapsed ? "justify-center px-0" : ""
                }`}
              >
                <Avatar className="h-7 w-7 shrink-0">
                  <AvatarFallback className="bg-emerald-600/10 text-[11px] font-medium text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                {!sidebarCollapsed && (
                  <span className="truncate text-foreground">{user?.name}</span>
                )}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" side="right" className="w-52">
              <div className="px-3 py-2">
                <p className="text-sm font-medium text-foreground">{user?.name}</p>
                <p className="text-xs text-muted-foreground">{user?.email}</p>
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => router.push("/profile")} className="gap-2 text-sm">
                <User className="h-4 w-4 text-muted-foreground" />
                Profile
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => router.push("/settings")} className="gap-2 text-sm">
                <Settings className="h-4 w-4 text-muted-foreground" />
                Settings
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => { logout(); router.push("/login"); }}
                className="gap-2 text-sm text-destructive focus:text-destructive"
              >
                <LogOut className="h-4 w-4" />
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </aside>

      {/* ── Main content area ──────────────────────────────────────── */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Mobile header */}
        <header className="flex h-14 items-center gap-3 border-b border-border/40 bg-background px-4 md:hidden">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-600 text-white">
            <Globe className="h-4 w-4" />
          </div>
          <span className="font-display text-base font-semibold tracking-tight">ClimatePulse</span>
          <div className="flex-1" />
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          >
            <Sun className="h-4 w-4 dark:hidden" />
            <Moon className="hidden h-4 w-4 dark:block" />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <Avatar className="h-6 w-6">
                  <AvatarFallback className="bg-emerald-600/10 text-[10px] font-medium text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400">
                    {initials}
                  </AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <div className="px-3 py-2">
                <p className="text-sm font-medium">{user?.name}</p>
                <p className="text-xs text-muted-foreground">{user?.email}</p>
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => router.push("/profile")} className="gap-2 text-sm">
                <User className="h-4 w-4 text-muted-foreground" />
                Profile
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => router.push("/settings")} className="gap-2 text-sm">
                <Settings className="h-4 w-4 text-muted-foreground" />
                Settings
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => { logout(); router.push("/login"); }}
                className="gap-2 text-sm text-destructive focus:text-destructive"
              >
                <LogOut className="h-4 w-4" />
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </header>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto pb-20 md:pb-0">
          <div className="mx-auto max-w-screen-2xl p-4 sm:p-6 lg:p-8">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                variants={tabContentVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
              >
                <TabContent activeTab={activeTab} />
              </motion.div>
            </AnimatePresence>
          </div>
        </div>

        {/* ── Mobile bottom tab bar ──────────────────────────────────── */}
        <nav className="fixed inset-x-0 bottom-0 z-50 flex h-16 items-stretch border-t border-border/40 bg-background/95 backdrop-blur-xl md:hidden">
          {tabConfig.map((tab) => {
            const isActive = activeTab === tab.value;
            return (
              <button
                key={tab.value}
                onClick={() => {
                  setActiveTab(tab.value);
                  log("info", `Switched to tab: ${tab.value}`);
                }}
                className={`flex flex-1 flex-col items-center justify-center gap-1 transition-colors ${
                  isActive
                    ? "text-accent-emerald"
                    : "text-muted-foreground"
                }`}
              >
                <tab.icon className="h-5 w-5" />
                <span className="text-[10px] font-medium leading-none">{tab.label}</span>
                {isActive && (
                  <motion.div
                    layoutId="mobile-tab-indicator"
                    className="absolute top-0 h-0.5 w-10 rounded-full bg-accent-emerald"
                  />
                )}
              </button>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
