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
  UserIcon,
  Cog6ToothIcon,
  ArrowRightOnRectangleIcon,
  EllipsisHorizontalIcon,
  MicrophoneIcon,
  AcademicCapIcon,
} from "@heroicons/react/24/outline";
import {
  NewspaperIcon as NewspaperIconSolid,
  BoltIcon as BoltIconSolid,
  ChartBarIcon as ChartBarIconSolid,
  CalendarDaysIcon as CalendarDaysIconSolid,
  MagnifyingGlassIcon as MagnifyingGlassIconSolid,
  TagIcon as TagIconSolid,
  AdjustmentsHorizontalIcon as AdjustmentsHorizontalIconSolid,
  RssIcon as RssIconSolid,
  EllipsisHorizontalIcon as EllipsisHorizontalIconSolid,
  MicrophoneIcon as MicrophoneIconSolid,
  AcademicCapIcon as AcademicCapIconSolid,
} from "@heroicons/react/24/solid";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
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
import { PodcastAdminTab } from "@/components/podcast-admin-tab";
import { FlagshipScheduler } from "@/components/flagship-scheduler";
import { LearnRedirect } from "@/components/learn/learn-redirect";

/* ──────────────────────────────────────────────────────────────────────────
   Config
   ────────────────────────────────────────────────────────────────────────── */

// Tab definitions by access tier. `iconSolid` is the bolder filled variant
// shown when the tab is the active one — matches iOS-style tab bar behaviour.
const readerTabs = [
  { value: "intelligence", label: "Briefing", icon: NewspaperIcon, iconSolid: NewspaperIconSolid },
  { value: "learn", label: "Learn", icon: AcademicCapIcon, iconSolid: AcademicCapIconSolid },
  { value: "newsroom", label: "Newsroom", icon: RssIcon, iconSolid: RssIconSolid },
  { value: "energy", label: "Energy", icon: BoltIcon, iconSolid: BoltIconSolid },
  { value: "markets", label: "Markets", icon: ChartBarIcon, iconSolid: ChartBarIconSolid },
  { value: "weekly", label: "Weekly", icon: CalendarDaysIcon, iconSolid: CalendarDaysIconSolid },
];

const editorTabs = [
  { value: "editor", label: "Editor", icon: CalendarDaysIcon, iconSolid: CalendarDaysIconSolid },
  { value: "flagship", label: "Flagship", icon: MicrophoneIcon, iconSolid: MicrophoneIconSolid },
];

const adminTabs = [
  { value: "discovery", label: "Discovery", icon: MagnifyingGlassIcon, iconSolid: MagnifyingGlassIconSolid },
  { value: "categories", label: "Categories", icon: TagIcon, iconSolid: TagIconSolid },
  { value: "taxonomy", label: "Taxonomy", icon: AdjustmentsHorizontalIcon, iconSolid: AdjustmentsHorizontalIconSolid },
  { value: "podcast-admin", label: "Podcast", icon: MicrophoneIcon, iconSolid: MicrophoneIconSolid },
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
  // Mobile reserves 3 primary slots + a "More" slot on the right.
  if (role === "admin") {
    return [
      { icon: NewspaperIcon, iconSolid: NewspaperIconSolid, label: "Briefing", value: "intelligence" },
      { icon: MagnifyingGlassIcon, iconSolid: MagnifyingGlassIconSolid, label: "Explore", value: "discovery" },
      { icon: BoltIcon, iconSolid: BoltIconSolid, label: "Energy", value: "energy" },
    ];
  }
  if (role === "editor") {
    return [
      { icon: NewspaperIcon, iconSolid: NewspaperIconSolid, label: "Briefing", value: "intelligence" },
      { icon: CalendarDaysIcon, iconSolid: CalendarDaysIconSolid, label: "Editor", value: "editor" },
      { icon: ChartBarIcon, iconSolid: ChartBarIconSolid, label: "Markets", value: "markets" },
    ];
  }
  return [
    { icon: NewspaperIcon, iconSolid: NewspaperIconSolid, label: "Briefing", value: "intelligence" },
    { icon: RssIcon, iconSolid: RssIconSolid, label: "Newsroom", value: "newsroom" },
    { icon: BoltIcon, iconSolid: BoltIconSolid, label: "Energy", value: "energy" },
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
    case "learn":
      return <LearnRedirect />;
    case "podcast-admin":
      return <PodcastAdminTab />;
    case "flagship":
      return <FlagshipScheduler />;
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
  const [moreOpen, setMoreOpen] = useState(false);

  const mobileNavValues = new Set(mobileNav.map((n) => n.value));
  const moreTabs = tabConfig.filter((t) => !mobileNavValues.has(t.value));

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
        height: "100dvh",
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
        {/* Mobile header — hidden on Intelligence tab; that tab renders its
            own larger, in-flow header inside the scroll container so the
            header scrolls away iOS-style and gives more vertical space. */}
        <header
          className={isIntelligence ? "hidden" : "flex md:hidden"}
          style={{
            minHeight: 48,
            paddingTop: "env(safe-area-inset-top)",
            background: COLORS.surface,
            borderBottom: `1px solid ${COLORS.border}`,
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0 14px 0 16px",
            flexShrink: 0,
          }}
        >
          <div
            onClick={() => setActiveTab("intelligence")}
            style={{ display: "flex", alignItems: "center", cursor: "pointer" }}
          >
            <img src="/logo.svg" alt="Climate Pulse" height={22} style={{ height: 22, width: "auto" }} />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span
              style={{
                fontSize: 11,
                color: COLORS.inkMuted,
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {new Date().toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" })}
            </span>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  aria-label="Account menu"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: 32,
                    height: 32,
                    borderRadius: "50%",
                    background: "transparent",
                    border: "none",
                    cursor: "pointer",
                    padding: 0,
                  }}
                >
                  <Avatar className="h-8 w-8">
                    <AvatarFallback
                      style={{
                        background: COLORS.sageTint,
                        color: COLORS.forest,
                        fontSize: 11,
                        fontWeight: 600,
                      }}
                    >
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <div className="px-3 py-2">
                  <p className="text-sm font-medium">{user?.name}</p>
                  <p className="text-xs text-muted-foreground">{user?.email}</p>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => router.push("/profile")} className="gap-2 text-sm">
                  <UserIcon className="h-4 w-4 text-muted-foreground" />
                  Profile
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => router.push("/settings")} className="gap-2 text-sm">
                  <Cog6ToothIcon className="h-4 w-4 text-muted-foreground" />
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
                  <ArrowRightOnRectangleIcon className="h-4 w-4" />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
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

        {/* ── Mobile bottom nav ──────────────────────────────────────
            Uses `calc(env(safe-area-inset-bottom) + 14px)` so the nav sits
            visibly above the Safari URL bar / home indicator on iOS and
            still has a comfortable lift on Android / browsers that report
            no inset. 16px top padding rounds out the vertical symmetry. */}
        <div
          className="flex md:hidden"
          style={{
            minHeight: 60,
            paddingTop: 10,
            paddingBottom: "calc(env(safe-area-inset-bottom) + 14px)",
            borderTop: `1px solid ${COLORS.border}`,
            background: COLORS.surface,
            alignItems: "center",
            justifyContent: "space-around",
            flexShrink: 0,
          }}
        >
          {mobileNav.map((item) => {
            const isActive = activeTab === item.value;
            const Icon = isActive ? item.iconSolid : item.icon;
            return (
              <button
                key={item.value}
                onClick={() => {
                  setActiveTab(item.value);
                  log("info", `Switched to tab: ${item.value}`);
                }}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 3,
                  cursor: "pointer",
                  background: "transparent",
                  border: "none",
                  padding: "6px 10px",
                  minHeight: 44,
                  flex: 1,
                }}
              >
                <Icon
                  style={{
                    width: 22,
                    height: 22,
                    color: isActive ? COLORS.forest : COLORS.inkMuted,
                  }}
                />
                <span
                  style={{
                    fontSize: 10,
                    color: isActive ? COLORS.forest : COLORS.inkMuted,
                    fontWeight: isActive ? 600 : 500,
                  }}
                >
                  {item.label}
                </span>
              </button>
            );
          })}

          {/* More — opens sheet with any tabs not in the primary slots */}
          {(() => {
            const moreActive = moreTabs.some((t) => t.value === activeTab);
            const MoreIcon = moreActive ? EllipsisHorizontalIconSolid : EllipsisHorizontalIcon;
            return (
              <button
                onClick={() => setMoreOpen(true)}
                aria-label="More tabs"
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 3,
                  cursor: "pointer",
                  background: "transparent",
                  border: "none",
                  padding: "6px 10px",
                  minHeight: 44,
                  flex: 1,
                }}
              >
                <MoreIcon
                  style={{
                    width: 22,
                    height: 22,
                    color: moreActive ? COLORS.forest : COLORS.inkMuted,
                  }}
                />
                <span
                  style={{
                    fontSize: 10,
                    color: moreActive ? COLORS.forest : COLORS.inkMuted,
                    fontWeight: moreActive ? 600 : 500,
                  }}
                >
                  More
                </span>
              </button>
            );
          })()}
        </div>

        {/* More sheet — all remaining tabs + quick account actions */}
        <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
          <SheetContent
            side="bottom"
            className="md:hidden rounded-t-2xl"
            style={{ paddingBottom: "max(env(safe-area-inset-bottom), 16px)" }}
          >
            <SheetHeader>
              <SheetTitle>More</SheetTitle>
            </SheetHeader>
            <div style={{ padding: "0 8px 8px", display: "flex", flexDirection: "column", gap: 2 }}>
              {moreTabs.map((tab) => {
                const isActive = activeTab === tab.value;
                return (
                  <button
                    key={tab.value}
                    onClick={() => {
                      setActiveTab(tab.value);
                      setMoreOpen(false);
                      log("info", `Switched to tab: ${tab.value}`);
                    }}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      padding: "14px 12px",
                      borderRadius: 8,
                      border: "none",
                      background: isActive ? COLORS.sageTint : "transparent",
                      color: isActive ? COLORS.forest : COLORS.ink,
                      fontSize: 15,
                      fontWeight: isActive ? 600 : 500,
                      textAlign: "left",
                      cursor: "pointer",
                      minHeight: 48,
                    }}
                  >
                    <tab.icon style={{ width: 20, height: 20, color: isActive ? COLORS.forest : COLORS.inkSec }} />
                    {tab.label}
                  </button>
                );
              })}
              {moreTabs.length === 0 && (
                <p style={{ padding: 16, fontSize: 13, color: COLORS.inkMuted, margin: 0 }}>
                  No additional tabs for this role.
                </p>
              )}
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </div>
  );
}
