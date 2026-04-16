"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { useDevLogger } from "@/lib/dev-logger";
import { motion, AnimatePresence } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  NewspaperIcon,
  BoltIcon,
  ChartBarIcon,
  CalendarDaysIcon,
  MagnifyingGlassIcon,
  TagIcon,
  AdjustmentsHorizontalIcon,
  CommandLineIcon,
  ChevronRightIcon,
  RssIcon,
} from "@heroicons/react/24/outline";
import { COLORS, FONTS, GRAIN, NAV_ITEMS } from "@/lib/design-tokens";
import { DiscoveryTab } from "@/components/discovery-tab";
import { CategoriesTab } from "@/components/categories-tab";
import { EnergyTab } from "@/components/energy-tab";
import { TaxonomyTab } from "@/components/taxonomy-tab";
import { MarketsTab } from "@/components/markets-tab";
import WeeklyTab from "@/components/weekly";
import EditorTab from "@/components/editor";
import IntelligenceTab from "@/components/intelligence";
import { NewsroomTab } from "@/components/newsroom/NewsroomTab";

/* ──────────────────────────────────────────────────────────────────────────
   Config
   ────────────────────────────────────────────────────────────────────────── */

// Tab definitions by access tier
const readerTabs = [
  { value: "intelligence", label: "Briefing", icon: NewspaperIcon },
  { value: "newsroom", label: "Newsroom", icon: RssIcon },
  { value: "energy", label: "Energy", icon: BoltIcon },
  { value: "markets", label: "Markets", icon: ChartBarIcon },
  { value: "weekly", label: "Weekly", icon: CalendarDaysIcon },
];

const editorTabs = [
  { value: "editor", label: "Editor", icon: CalendarDaysIcon },
];

const adminTabs = [
  { value: "discovery", label: "Discovery", icon: MagnifyingGlassIcon },
  { value: "categories", label: "Categories", icon: TagIcon },
  { value: "taxonomy", label: "Taxonomy", icon: AdjustmentsHorizontalIcon },
];

function getTabsForRole(role: "reader" | "editor" | "admin") {
  // Order: Briefing, (admin tabs between), Energy, Markets, Editor, Weekly
  const base = [...readerTabs];
  if (role === "admin") {
    // Insert admin tabs between Briefing (index 0) and Energy (index 1)
    base.splice(1, 0, ...adminTabs);
  }
  if (role === "editor" || role === "admin") {
    // Editor tab goes just before Weekly (last position in readerTabs)
    const weeklyIdx = base.findIndex((t) => t.value === "weekly");
    if (weeklyIdx >= 0) base.splice(weeklyIdx, 0, ...editorTabs);
    else base.push(...editorTabs);
  }
  return base;
}

function getMobileNavForRole(role: "reader" | "editor" | "admin") {
  // Mobile has max 4 slots — prioritise based on role
  if (role === "admin") {
    return [
      { icon: NewspaperIcon, label: "Briefing", value: "intelligence" },
      { icon: MagnifyingGlassIcon, label: "Explore", value: "discovery" },
      { icon: BoltIcon, label: "Energy", value: "energy" },
      { icon: CalendarDaysIcon, label: "Weekly", value: "weekly" },
    ];
  }
  if (role === "editor") {
    return [
      { icon: NewspaperIcon, label: "Briefing", value: "intelligence" },
      { icon: CalendarDaysIcon, label: "Editor", value: "editor" },
      { icon: ChartBarIcon, label: "Markets", value: "markets" },
      { icon: CalendarDaysIcon, label: "Weekly", value: "weekly" },
    ];
  }
  return [
    { icon: NewspaperIcon, label: "Briefing", value: "intelligence" },
    { icon: BoltIcon, label: "Energy", value: "energy" },
    { icon: ChartBarIcon, label: "Markets", value: "markets" },
    { icon: CalendarDaysIcon, label: "Weekly", value: "weekly" },
  ];
}

/* ──────────────────────────────────────────────────────────────────────────
   Animation variants
   ────────────────────────────────────────────────────────────────────────── */

const tabContentVariants = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.25, ease: "easeOut" as const } },
  exit: { opacity: 0, y: -4, transition: { duration: 0.12 } },
};

/* ──────────────────────────────────────────────────────────────────────────
   Tab content renderer (non-Intelligence tabs)
   ────────────────────────────────────────────────────────────────────────── */

function TabContent({ activeTab }: { activeTab: string }) {
  switch (activeTab) {
    case "discovery":
      return <DiscoveryTab />;
    case "categories":
      return <CategoriesTab />;
    case "energy":
      return <EnergyTab />;
    case "markets":
      return <MarketsTab />;
    case "weekly":
      return <WeeklyTab />;
    case "editor":
      return <EditorTab />;
    case "taxonomy":
      return <TaxonomyTab />;
    case "newsroom":
      return <NewsroomTab />;
    default:
      return null;
  }
}

/* ──────────────────────────────────────────────────────────────────────────
   Mobile bottom nav items
   ────────────────────────────────────────────────────────────────────────── */

/* ──────────────────────────────────────────────────────────────────────────
   Dashboard page — editorial nav rail layout
   ────────────────────────────────────────────────────────────────────────── */

export default function DashboardPage() {
  const { log, isOpen, setIsOpen, logs } = useDevLogger();
  const { user, logout } = useAuth();
  const role = user?.role ?? "reader";
  const tabConfig = getTabsForRole(role);
  const mobileNav = getMobileNavForRole(role);
  const isAdmin = role === "admin";
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("intelligence");
  const [sidebarOpen, setSidebarOpen] = useState(false);

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

  // Guard: if current tab isn't allowed for role, revert to intelligence
  useEffect(() => {
    const allowed = tabConfig.some((t) => t.value === activeTab);
    if (!allowed) setActiveTab("intelligence");
  }, [tabConfig, activeTab]);

  const isIntelligence = activeTab === "intelligence";
  const isWeekly = activeTab === "weekly";
  const isNewsroom = activeTab === "newsroom";

  return (
    <div
      style={{
        display: "flex",
        height: "100vh",
        background: COLORS.bg,
        fontFamily: FONTS.sans,
        overflow: "hidden",
      }}
      className="paper-grain"
    >
      {/* ── Desktop nav rail ────────────────────────────────────────── */}
      <nav
        className="hidden md:flex"
        style={{
          width: sidebarOpen ? 150 : 52,
          flexShrink: 0,
          borderRight: `1px solid ${COLORS.border}`,
          flexDirection: "column",
          alignItems: sidebarOpen ? "stretch" : "center",
          paddingTop: 18,
          transition: "width 150ms ease",
          overflow: "hidden",
        }}
      >
        {/* Logo */}
        <div
          onClick={() => setSidebarOpen(!sidebarOpen)}
          style={{
            cursor: "pointer",
            marginBottom: 22,
            marginLeft: sidebarOpen ? 12 : 0,
            flexShrink: 0,
            height: sidebarOpen ? 56 : 28,
            display: "flex",
            alignItems: "center",
            transition: "height 150ms ease",
          }}
        >
          {sidebarOpen ? (
            <img src="/logo.svg" alt="Climate Pulse" height={56} style={{ height: 56, width: "auto" }} />
          ) : (
            <img src="/leaf only.svg" alt="Climate Pulse" width={28} height={28} />
          )}
        </div>

        {/* Nav items */}
        {tabConfig.map((tab) => {
          const isActive = activeTab === tab.value;
          return (
            <div
              key={tab.value}
              onClick={() => {
                setActiveTab(tab.value);
                log("info", `Switched to tab: ${tab.value}`);
              }}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 9,
                padding: sidebarOpen ? "8px 12px" : "0",
                width: sidebarOpen ? "auto" : 34,
                height: sidebarOpen ? "auto" : 34,
                justifyContent: sidebarOpen ? "flex-start" : "center",
                borderRadius: 6,
                marginBottom: 2,
                cursor: "pointer",
                background: isActive ? COLORS.sageTint : "transparent",
                color: isActive ? COLORS.forest : COLORS.inkMuted,
                fontSize: 14,
                transition: "all 150ms ease",
              }}
            >
              <tab.icon style={{ width: 18, height: 18, flexShrink: 0 }} />
              {sidebarOpen && (
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: isActive ? 500 : 400,
                    whiteSpace: "nowrap",
                  }}
                >
                  {tab.label}
                </span>
              )}
            </div>
          );
        })}

        {/* Spacer */}
        <div style={{ flex: 1 }} />

        {/* Dev button — admin only */}
        {isAdmin && (
          <div
            onClick={() => setIsOpen(!isOpen)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 9,
              padding: sidebarOpen ? "8px 12px" : "0",
              width: sidebarOpen ? "auto" : 34,
              height: sidebarOpen ? "auto" : 34,
              justifyContent: sidebarOpen ? "flex-start" : "center",
              borderRadius: 6,
              marginBottom: 2,
              cursor: "pointer",
              color: COLORS.inkMuted,
              fontSize: 12,
              transition: "all 150ms ease",
            }}
          >
            <CommandLineIcon style={{ width: 18, height: 18, flexShrink: 0 }} />
            {sidebarOpen && (
              <span style={{ fontFamily: "monospace", fontSize: 11 }}>
                Dev
                {logs.length > 0 && (
                  <Badge
                    variant={errorCount > 0 ? "destructive" : "secondary"}
                    className="ml-2 h-4 min-w-4 rounded px-1 text-[9px]"
                  >
                    {logs.length}
                  </Badge>
                )}
              </span>
            )}
          </div>
        )}

        {/* Collapse/expand toggle */}
        <div
          onClick={() => setSidebarOpen(!sidebarOpen)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 9,
            padding: sidebarOpen ? "8px 12px" : "0",
            width: sidebarOpen ? "auto" : 34,
            height: sidebarOpen ? "auto" : 34,
            justifyContent: sidebarOpen ? "flex-start" : "center",
            borderRadius: 6,
            marginBottom: 2,
            cursor: "pointer",
            color: COLORS.inkMuted,
            fontSize: 12,
            transition: "all 150ms ease",
          }}
        >
          <ChevronRightIcon style={{ width: 16, height: 16, flexShrink: 0, transition: "transform 150ms ease", transform: sidebarOpen ? "rotate(180deg)" : "rotate(0deg)" }} />
          {sidebarOpen && <span style={{ fontSize: 11 }}>Collapse</span>}
        </div>

        {/* User */}
        <div style={{ padding: sidebarOpen ? "8px 12px" : "8px 0", marginBottom: 12 }}>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  cursor: "pointer",
                  justifyContent: sidebarOpen ? "flex-start" : "center",
                }}
              >
                <Avatar className="h-6 w-6 shrink-0">
                  <AvatarFallback
                    style={{
                      background: COLORS.sageTint,
                      color: COLORS.forest,
                      fontSize: 10,
                      fontWeight: 500,
                    }}
                  >
                    {initials}
                  </AvatarFallback>
                </Avatar>
                {sidebarOpen && (
                  <span style={{ fontSize: 11, color: COLORS.inkSec, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {user?.name}
                  </span>
                )}
              </div>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" side="right" className="w-52">
              <div className="px-3 py-2">
                <p className="text-sm font-medium">{user?.name}</p>
                <p className="text-xs text-muted-foreground">{user?.email}</p>
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => router.push("/profile")} className="gap-2 text-sm">
                Profile
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => router.push("/settings")} className="gap-2 text-sm">
                Settings
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => {
                  logout();
                  router.push("/login");
                }}
                className="gap-2 text-sm text-destructive focus:text-destructive"
              >
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </nav>

      {/* ── Main content area ──────────────────────────────────────── */}
      <div className="flex flex-1 flex-col overflow-hidden md:flex-row">
        {/* Mobile header */}
        <header
          className="flex md:hidden"
          style={{
            height: 44,
            background: COLORS.surface,
            borderBottom: `1px solid ${COLORS.border}`,
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0 18px",
            flexShrink: 0,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <img src="/leaf only.svg" alt="Climate Pulse" width={22} height={22} />
            <img src="/logo.svg" alt="Climate Pulse" height={22} style={{ height: 22, width: "auto" }} />
          </div>
          <span
            style={{
              fontSize: 10,
              color: COLORS.inkMuted,
              fontVariantNumeric: "tabular-nums",
            }}
          >
            14 Apr 2026
          </span>
        </header>

        {/* Content */}
        <div className="flex flex-1 overflow-hidden">
          {isIntelligence ? (
            <IntelligenceTab />
          ) : isWeekly ? (
            <WeeklyTab />
          ) : isNewsroom ? (
            <div className="flex-1 overflow-y-auto pb-20 md:pb-0">
              <NewsroomTab />
            </div>
          ) : (
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
          )}
        </div>

        {/* ── Mobile bottom nav ────────────────────────────────────── */}
        <div
          className="flex md:hidden"
          style={{
            minHeight: 50,
            paddingBottom: "env(safe-area-inset-bottom)",
            borderTop: `1px solid ${COLORS.border}`,
            background: COLORS.surface,
            alignItems: "center",
            justifyContent: "space-around",
            flexShrink: 0,
          }}
        >
          {mobileNav.map((item) => {
            const isActive = activeTab === item.value;
            return (
              <div
                key={item.value}
                onClick={() => {
                  setActiveTab(item.value);
                  log("info", `Switched to tab: ${item.value}`);
                }}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 1,
                  cursor: "pointer",
                }}
              >
                <item.icon
                  style={{
                    width: 20,
                    height: 20,
                    color: isActive ? COLORS.forest : COLORS.inkMuted,
                  }}
                />
                <span
                  style={{
                    fontSize: 8,
                    color: isActive ? COLORS.forest : COLORS.inkMuted,
                    fontWeight: isActive ? 600 : 400,
                  }}
                >
                  {item.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
