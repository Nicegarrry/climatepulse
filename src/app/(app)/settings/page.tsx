"use client";

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { useAuth } from "@/lib/auth-context";
import { useDevLogger } from "@/lib/dev-logger";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { StepSectors } from "@/components/onboarding/step-sectors";
import { ROLE_ICONS } from "@/lib/domain-icons";
import { ROLE_LENS_OPTIONS } from "@/lib/types";
import type { UserProfile, BriefingDepth, RoleLens } from "@/lib/types";
import {
  ChevronRight,
  ArrowLeft,
  X,
  User,
  Newspaper,
  BookOpen,
  Info,
  Lock,
  Clock,
  Zap,
  MapPin,
  LogOut,
  Loader2,
} from "lucide-react";

const fadeUp = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.35, ease: [0.23, 1, 0.32, 1] as [number, number, number, number] },
};

// ─── Taxonomy types ───────────────────────────────────────────────────────

interface TaxonomyDomain {
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
}

// ─── Section components ───────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-4 border-b border-border/40 pb-2">
      <h3 className="text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground">
        {children}
      </h3>
    </div>
  );
}

function SettingRow({
  label,
  value,
  onClick,
}: {
  label: string;
  value: React.ReactNode;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={!onClick}
      className="flex w-full items-center justify-between gap-4 rounded-lg px-1 py-2.5 text-left transition-colors hover:bg-muted/30 disabled:cursor-default disabled:hover:bg-transparent"
    >
      <span className="text-sm font-medium text-foreground">{label}</span>
      <span className="flex items-center gap-1 text-sm text-muted-foreground">
        {value}
        {onClick && <ChevronRight className="h-4 w-4" />}
      </span>
    </button>
  );
}

// ─── Sub-pages (overlays) ─────────────────────────────────────────────────

type Overlay = null | "role" | "sectors" | "regions" | "depth" | "time" | "entities" | "storylines";

const AU_STATES = [
  { id: "nsw", label: "NSW" }, { id: "vic", label: "VIC" },
  { id: "qld", label: "QLD" }, { id: "sa", label: "SA" },
  { id: "wa", label: "WA" }, { id: "tas", label: "TAS" },
  { id: "act", label: "ACT" }, { id: "nt", label: "NT" },
];
const INTERNATIONAL = [
  { id: "eu", label: "EU" }, { id: "us", label: "United States" },
  { id: "china", label: "China" }, { id: "india", label: "India" },
  { id: "southeast-asia", label: "Southeast Asia" }, { id: "japan-korea", label: "Japan / Korea" },
];

const DEPTH_OPTIONS: { id: BriefingDepth; label: string; desc: string; stories: string; icon: typeof Zap }[] = [
  { id: "quick", label: "Quick", desc: "The essentials in 2 minutes", stories: "3–5 stories", icon: Zap },
  { id: "standard", label: "Standard", desc: "A solid morning briefing", stories: "5–8 stories", icon: Newspaper },
  { id: "deep", label: "Deep", desc: "Comprehensive coverage", stories: "8–12 stories", icon: BookOpen },
];

// ─── Notification preferences ─────────────────────────────────────────────

type NotificationPrefs = {
  daily_briefing: boolean;
  weekly_digest: boolean;
  high_priority_alerts: boolean;
  entity_updates: boolean;
};

const DEFAULT_NOTIFICATION_PREFS: NotificationPrefs = {
  daily_briefing: true,
  weekly_digest: true,
  high_priority_alerts: false,
  entity_updates: false,
};

// ─── Main settings page ───────────────────────────────────────────────────

export default function SettingsPage() {
  const { user } = useAuth();
  const { log } = useDevLogger();

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [overlay, setOverlay] = useState<Overlay>(null);
  const [taxonomy, setTaxonomy] = useState<TaxonomyDomain[]>([]);

  // Notification preferences — persisted to user_profiles.notification_prefs
  const [notifPrefs, setNotifPrefs] = useState<NotificationPrefs>(DEFAULT_NOTIFICATION_PREFS);

  // "Sign out of all devices" state
  const [signingOutAll, setSigningOutAll] = useState(false);

  const userId = user?.id;

  // Fetch profile (includes notification_prefs)
  const fetchProfile = useCallback(async () => {
    if (!userId) {
      setLoading(false);
      return;
    }
    try {
      const res = await fetch(`/api/user/profile?userId=${userId}`);
      const data = await res.json();
      setProfile(data);
      if (data?.notification_prefs && typeof data.notification_prefs === "object") {
        setNotifPrefs({
          ...DEFAULT_NOTIFICATION_PREFS,
          ...(data.notification_prefs as Partial<NotificationPrefs>),
        });
      }
    } catch (err) {
      console.error("Failed to load profile:", err);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => { fetchProfile(); }, [fetchProfile]);

  // Fetch taxonomy for sector picker
  useEffect(() => {
    fetch("/api/taxonomy/tree")
      .then((r) => r.json())
      .then((data) => setTaxonomy(data.domains ?? []))
      .catch(console.error);
  }, []);

  // Save profile field(s)
  const saveProfile = async (updates: Partial<UserProfile>) => {
    setSaving(true);
    try {
      await fetch("/api/user/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, ...updates }),
      });
      setProfile((prev) => prev ? { ...prev, ...updates } : prev);
      log("info", "Profile updated", updates);
    } catch (err) {
      console.error("Save failed:", err);
    } finally {
      setSaving(false);
    }
  };

  // Toggle a single notification pref with optimistic UI + rollback on failure
  const toggleNotif = async (key: keyof NotificationPrefs, value: boolean) => {
    const previous = notifPrefs;
    const next: NotificationPrefs = { ...notifPrefs, [key]: value };
    setNotifPrefs(next); // optimistic
    try {
      const res = await fetch("/api/user/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, notification_prefs: next }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      log("info", "Notification pref updated", { key, value });
    } catch (err) {
      console.error("Notification pref save failed:", err);
      log("warn", "Notification pref save failed — rolling back", { key, err: String(err) });
      setNotifPrefs(previous); // rollback
    }
  };

  // Sign out of every active Supabase session across all devices
  const signOutEverywhere = async () => {
    if (signingOutAll) return;
    setSigningOutAll(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signOut({ scope: "global" });
      if (error) throw error;
      log("info", "Signed out of all devices");
      // onAuthStateChange listener in AuthProvider will redirect via logout flow
      window.location.href = "/login";
    } catch (err) {
      console.error("Global sign out failed:", err);
      log("warn", "Global sign out failed", { err: String(err) });
      setSigningOutAll(false);
    }
  };

  if (loading || !profile) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent-emerald border-t-transparent" />
      </div>
    );
  }

  const roleLensLabel = ROLE_LENS_OPTIONS.find((r) => r.id === profile.role_lens)?.label ?? "General Interest";
  const RoleIcon = ROLE_ICONS[profile.role_lens] ?? User;

  // Count selected domains
  const selectedDomainCount = taxonomy.filter((d) =>
    d.sectors.some((s) => s.microsectors.some((ms) => profile.primary_sectors.includes(ms.slug)))
  ).length;

  const regionDisplay = profile.jurisdictions
    .filter((j) => j !== "australia")
    .map((j) => j.toUpperCase())
    .join(", ");

  // ─── Overlay content ──────────────────────────────────────────────────

  if (overlay) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
        <motion.div {...fadeUp} className="space-y-6">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setOverlay(null)}
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <h1 className="font-display text-xl tracking-tight">
              {overlay === "role" && "Change Role"}
              {overlay === "sectors" && "Edit Sectors"}
              {overlay === "regions" && "Edit Regions"}
              {overlay === "depth" && "Briefing Depth"}
              {overlay === "time" && "Delivery Time"}
              {overlay === "entities" && "Followed Entities"}
              {overlay === "storylines" && "Followed Storylines"}
            </h1>
            {saving && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
          </div>

          {/* Role picker */}
          {overlay === "role" && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {ROLE_LENS_OPTIONS.map((role) => {
                const Icon = ROLE_ICONS[role.id];
                const isSelected = profile.role_lens === role.id;
                return (
                  <button
                    key={role.id}
                    onClick={async () => {
                      await saveProfile({ role_lens: role.id as RoleLens });
                      setOverlay(null);
                    }}
                    className={`flex items-start gap-3 rounded-xl border p-4 text-left transition-all ${
                      isSelected
                        ? "border-accent-emerald bg-accent-emerald/5 ring-2 ring-accent-emerald/30"
                        : "border-border/60 bg-card hover:border-accent-emerald/40"
                    }`}
                  >
                    {Icon && (
                      <div className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                        isSelected ? "bg-accent-emerald text-white" : "bg-muted text-muted-foreground"
                      }`}>
                        <Icon className="h-4.5 w-4.5" />
                      </div>
                    )}
                    <div>
                      <p className="text-sm font-medium">{role.label}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">{role.framing}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {/* Sector picker (reuses onboarding component) */}
          {overlay === "sectors" && taxonomy.length > 0 && (
            <StepSectors
              domains={taxonomy}
              initialSlugs={profile.primary_sectors}
              onNext={async (slugs) => {
                await saveProfile({ primary_sectors: slugs });
                setOverlay(null);
              }}
            />
          )}

          {/* Region picker */}
          {overlay === "regions" && (
            <RegionPicker
              jurisdictions={profile.jurisdictions}
              onSave={async (jurisdictions) => {
                await saveProfile({ jurisdictions });
                setOverlay(null);
              }}
            />
          )}

          {/* Briefing depth */}
          {overlay === "depth" && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {DEPTH_OPTIONS.map((opt) => {
                const Icon = opt.icon;
                const isSelected = profile.briefing_depth === opt.id;
                return (
                  <button
                    key={opt.id}
                    onClick={async () => {
                      await saveProfile({ briefing_depth: opt.id });
                      setOverlay(null);
                    }}
                    className={`flex flex-col items-center gap-2 rounded-xl border p-4 text-center transition-all ${
                      isSelected
                        ? "border-accent-emerald bg-accent-emerald/5 ring-2 ring-accent-emerald/30"
                        : "border-border/60 bg-card hover:border-accent-emerald/40"
                    }`}
                  >
                    <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${
                      isSelected ? "bg-accent-emerald text-white" : "bg-muted text-muted-foreground"
                    }`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <p className="text-sm font-medium">{opt.label}</p>
                    <p className="text-xs text-muted-foreground">{opt.desc}</p>
                    <p className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" /> {opt.stories}
                    </p>
                  </button>
                );
              })}
            </div>
          )}

          {/* Delivery time */}
          {overlay === "time" && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Choose when your daily briefing is ready each morning.
              </p>
              <Input
                type="time"
                defaultValue={profile.digest_time}
                className="w-40"
                onChange={(e) => {
                  // Debounced save on blur
                }}
                onBlur={async (e) => {
                  if (e.target.value !== profile.digest_time) {
                    await saveProfile({ digest_time: e.target.value });
                    setOverlay(null);
                  }
                }}
              />
              <Button variant="outline" size="sm" onClick={() => setOverlay(null)}>
                Done
              </Button>
            </div>
          )}

          {/* Followed entities */}
          {overlay === "entities" && (
            <FollowedList
              items={profile.followed_entities}
              emptyMessage="No followed entities yet. Tap entity names in your briefing to follow them."
              onRemove={async (item) => {
                const updated = profile.followed_entities.filter((e) => e !== item);
                await saveProfile({ followed_entities: updated });
              }}
            />
          )}

          {/* Followed storylines */}
          {overlay === "storylines" && (
            <FollowedList
              items={profile.followed_storylines}
              emptyMessage="No followed storylines yet. Follow storylines from the briefing to track them."
              onRemove={async (item) => {
                const updated = profile.followed_storylines.filter((s) => s !== item);
                await saveProfile({ followed_storylines: updated });
              }}
            />
          )}
        </motion.div>
      </div>
    );
  }

  // ─── Main settings view ────────────────────────────────────────────────

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
      <motion.div {...fadeUp} className="space-y-6">
        <div>
          <h1 className="font-display text-2xl tracking-tight">Settings</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage your briefing preferences
          </p>
        </div>

        {/* Profile */}
        <Card className="border-border/40 bg-card/50">
          <CardContent className="p-6">
            <SectionLabel>Profile</SectionLabel>
            <div className="space-y-1">
              <SettingRow label="Name" value={profile.name} />
              <SettingRow label="Email" value={profile.email} />
            </div>
          </CardContent>
        </Card>

        {/* Your Briefing */}
        <Card className="border-border/40 bg-card/50">
          <CardContent className="p-6">
            <SectionLabel>Your Briefing</SectionLabel>
            <div className="space-y-1">
              <SettingRow
                label="Role"
                value={
                  <span className="flex items-center gap-1.5">
                    <RoleIcon className="h-3.5 w-3.5" />
                    {roleLensLabel}
                  </span>
                }
                onClick={() => setOverlay("role")}
              />
              <SettingRow
                label="Sectors"
                value={`${selectedDomainCount} domain${selectedDomainCount !== 1 ? "s" : ""}, ${profile.primary_sectors.length} micro-sectors`}
                onClick={() => setOverlay("sectors")}
              />
              <SettingRow
                label="Regions"
                value={
                  <span className="flex items-center gap-1">
                    <MapPin className="h-3 w-3" />
                    Australia{regionDisplay ? `, ${regionDisplay}` : ""}
                  </span>
                }
                onClick={() => setOverlay("regions")}
              />
              <SettingRow
                label="Briefing Depth"
                value={profile.briefing_depth.charAt(0).toUpperCase() + profile.briefing_depth.slice(1)}
                onClick={() => setOverlay("depth")}
              />
              <SettingRow
                label="Delivery Time"
                value={profile.digest_time}
                onClick={() => setOverlay("time")}
              />
            </div>
          </CardContent>
        </Card>

        {/* Following */}
        <Card className="border-border/40 bg-card/50">
          <CardContent className="p-6">
            <SectionLabel>Following</SectionLabel>
            <div className="space-y-1">
              <SettingRow
                label="Entities"
                value={`${profile.followed_entities.length} followed`}
                onClick={() => setOverlay("entities")}
              />
              <SettingRow
                label="Storylines"
                value={`${profile.followed_storylines.length} followed`}
                onClick={() => setOverlay("storylines")}
              />
            </div>
          </CardContent>
        </Card>

        {/* Notifications */}
        <Card className="border-border/40 bg-card/50">
          <CardContent className="p-6">
            <SectionLabel>Notifications</SectionLabel>
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <Label className="text-sm font-medium">Daily briefing ready</Label>
                  <p className="text-xs text-muted-foreground">Notified when your morning briefing is generated</p>
                </div>
                <Switch
                  checked={notifPrefs.daily_briefing}
                  onCheckedChange={(v) => toggleNotif("daily_briefing", v)}
                />
              </div>
              <div className="flex items-center justify-between gap-4">
                <div>
                  <Label className="text-sm font-medium">Weekly digest</Label>
                  <p className="text-xs text-muted-foreground">The Weekly Pulse email on Sunday evenings</p>
                </div>
                <Switch
                  checked={notifPrefs.weekly_digest}
                  onCheckedChange={(v) => toggleNotif("weekly_digest", v)}
                />
              </div>
              <div className="flex items-center justify-between gap-4">
                <div>
                  <Label className="text-sm font-medium">High-priority alerts (75+)</Label>
                  <p className="text-xs text-muted-foreground">Breaking stories with significance score above 75</p>
                </div>
                <Switch
                  checked={notifPrefs.high_priority_alerts}
                  onCheckedChange={(v) => toggleNotif("high_priority_alerts", v)}
                />
              </div>
              <div className="flex items-center justify-between gap-4">
                <div>
                  <Label className="text-sm font-medium">Followed entity alerts</Label>
                  <p className="text-xs text-muted-foreground">When a followed entity appears in a new story</p>
                </div>
                <Switch
                  checked={notifPrefs.entity_updates}
                  onCheckedChange={(v) => toggleNotif("entity_updates", v)}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Account */}
        <Card className="border-border/40 bg-card/50">
          <CardContent className="p-6">
            <SectionLabel>Account</SectionLabel>
            <div className="flex items-center justify-between gap-4">
              <div>
                <Label className="text-sm font-medium">Sign out of all devices</Label>
                <p className="text-xs text-muted-foreground">
                  Ends every active session, including this one
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={signOutEverywhere}
                disabled={signingOutAll}
                className="shrink-0"
              >
                {signingOutAll ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <>
                    <LogOut className="mr-1.5 h-3.5 w-3.5" />
                    Sign out everywhere
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* About */}
        <Card className="border-border/40 bg-card/50">
          <CardContent className="p-6">
            <SectionLabel>About</SectionLabel>
            <div className="space-y-1">
              <SettingRow label="Data sources" value={<Info className="h-3.5 w-3.5" />} />
              <SettingRow label="How scoring works" value={<Info className="h-3.5 w-3.5" />} />
              <SettingRow label="Feedback" value={<ChevronRight className="h-3.5 w-3.5" />} />
              <SettingRow label="Terms & Privacy" value={<ChevronRight className="h-3.5 w-3.5" />} />
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}

// ─── Region picker sub-component ──────────────────────────────────────────

function RegionPicker({
  jurisdictions,
  onSave,
}: {
  jurisdictions: string[];
  onSave: (jurisdictions: string[]) => Promise<void>;
}) {
  const [selected, setSelected] = useState<Set<string>>(() => new Set(jurisdictions));

  const toggle = (id: string) => {
    if (id === "australia") return;
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  return (
    <div className="space-y-6">
      {/* Australia locked */}
      <div>
        <div className="mb-3 flex items-center gap-2">
          <div className="flex items-center gap-1.5 rounded-full border border-accent-emerald bg-accent-emerald/10 px-3 py-1.5 text-xs font-medium text-accent-emerald">
            <Lock className="h-3 w-3" /> Australia
          </div>
        </div>

        <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">States</p>
        <div className="mb-4 flex flex-wrap gap-2">
          {AU_STATES.map((s) => {
            const isActive = selected.has(s.id);
            return (
              <button
                key={s.id}
                onClick={() => toggle(s.id)}
                className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-all ${
                  isActive
                    ? "border-accent-emerald bg-accent-emerald/10 text-accent-emerald"
                    : "border-border bg-card text-muted-foreground hover:border-accent-emerald/40"
                }`}
              >
                {s.label}
              </button>
            );
          })}
        </div>

        <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">International</p>
        <div className="flex flex-wrap gap-2">
          {INTERNATIONAL.map((r) => {
            const isActive = selected.has(r.id);
            return (
              <button
                key={r.id}
                onClick={() => toggle(r.id)}
                className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-all ${
                  isActive
                    ? "border-accent-emerald bg-accent-emerald/10 text-accent-emerald"
                    : "border-border bg-card text-muted-foreground hover:border-accent-emerald/40"
                }`}
              >
                {r.label}
              </button>
            );
          })}
        </div>
      </div>

      <Button
        onClick={() => onSave(Array.from(selected))}
        className="bg-accent-emerald text-white hover:bg-accent-emerald/90"
      >
        Save Regions
      </Button>
    </div>
  );
}

// ─── Followed items list ──────────────────────────────────────────────────

function FollowedList({
  items,
  emptyMessage,
  onRemove,
}: {
  items: string[];
  emptyMessage: string;
  onRemove: (item: string) => Promise<void>;
}) {
  const [removing, setRemoving] = useState<string | null>(null);

  if (items.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border/60 py-12 text-center">
        <p className="text-sm text-muted-foreground">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {items.map((item) => (
        <div
          key={item}
          className="flex items-center justify-between rounded-lg border border-border/40 bg-card/50 px-4 py-3"
        >
          <span className="text-sm font-medium">{item}</span>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1 text-xs text-muted-foreground hover:text-destructive"
            disabled={removing === item}
            onClick={async () => {
              setRemoving(item);
              await onRemove(item);
              setRemoving(null);
            }}
          >
            {removing === item ? <Loader2 className="h-3 w-3 animate-spin" /> : <X className="h-3 w-3" />}
            Unfollow
          </Button>
        </div>
      ))}
    </div>
  );
}
