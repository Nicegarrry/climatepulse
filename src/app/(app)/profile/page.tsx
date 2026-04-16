"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useAuth, type UserRole } from "@/lib/auth-context";
import { useDevLogger } from "@/lib/dev-logger";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Mail, Clock, Check, Loader2 } from "lucide-react";

const fadeUp = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.45, ease: [0.23, 1, 0.32, 1] as [number, number, number, number] },
};

// ─── Role badge styling ────────────────────────────────────────────────────
// reader → neutral grey, editor → plum, admin → forest
function RoleBadge({ role }: { role: UserRole }) {
  const styles: Record<UserRole, { label: string; className: string }> = {
    reader: {
      label: "Reader",
      className: "bg-muted/60 text-muted-foreground border-border/60",
    },
    editor: {
      label: "Editor",
      // Plum tokens from design-tokens.ts (#3D1F3D / #F5EEF5)
      className: "border-[#3D1F3D]/20 bg-[#F5EEF5] text-[#3D1F3D]",
    },
    admin: {
      label: "Admin",
      // Forest tokens (#1E4D2B / #EFF4EC)
      className: "border-[#1E4D2B]/20 bg-[#EFF4EC] text-[#1E4D2B]",
    },
  };
  const s = styles[role] ?? styles.reader;
  return (
    <Badge
      variant="secondary"
      className={`text-xs font-medium ${s.className}`}
    >
      {s.label}
    </Badge>
  );
}

export default function ProfilePage() {
  const { user, updateUser } = useAuth();
  const { log } = useDevLogger();

  // Editable name state, seeded from the auth context
  const [nameDraft, setNameDraft] = useState(user?.name ?? "");
  const [saving, setSaving] = useState(false);
  const [justSaved, setJustSaved] = useState(false);

  // Keep the draft in sync when the auth user resolves or updates
  useEffect(() => {
    if (user?.name !== undefined) setNameDraft(user.name);
  }, [user?.name]);

  const initials = user?.name
    ? user.name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .slice(0, 2)
        .toUpperCase()
    : "?";

  const canSaveName =
    nameDraft.trim().length > 0 &&
    nameDraft.trim() !== (user?.name ?? "").trim() &&
    !saving;

  const saveName = async () => {
    if (!user || !canSaveName) return;
    const trimmed = nameDraft.trim();
    setSaving(true);
    try {
      const res = await fetch("/api/user/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id, name: trimmed }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      // Optimistically reflect the change in the auth context
      updateUser({ name: trimmed });
      log("info", "Name updated", { name: trimmed });
      setJustSaved(true);
      setTimeout(() => setJustSaved(false), 1800);
    } catch (err) {
      console.error("Name save failed:", err);
      log("warn", "Name save failed", { err: String(err) });
    } finally {
      setSaving(false);
    }
  };

  const memberSince = user?.onboardedAt
    ? new Date(user.onboardedAt).toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
      })
    : new Date().toLocaleDateString("en-US", { year: "numeric", month: "short" });

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6 sm:py-12">
      <motion.div {...fadeUp} className="space-y-8">
        {/* Page heading */}
        <div>
          <h1 className="font-display text-2xl tracking-tight">Profile</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Your account at a glance
          </p>
        </div>

        {/* Avatar section card */}
        <Card className="border-border/40 bg-card/50 backdrop-blur-sm">
          <CardContent className="flex items-center gap-6 p-6">
            <Avatar className="h-20 w-20 ring-2 ring-border/30 ring-offset-2 ring-offset-background">
              <AvatarFallback className="bg-primary/8 font-display text-2xl text-primary">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 space-y-2">
              <h2 className="font-display text-xl tracking-tight">
                {user?.name || "Unnamed"}
              </h2>
              <p className="text-sm text-muted-foreground">{user?.email}</p>
              <div className="flex gap-2 pt-0.5">
                {user?.role && <RoleBadge role={user.role} />}
                <Badge
                  variant="secondary"
                  className="bg-accent-emerald/8 text-accent-emerald border-accent-emerald/15 text-xs font-medium"
                >
                  Active
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Account Details card */}
        <Card className="border-border/40 bg-card/50 backdrop-blur-sm">
          <CardContent className="p-6">
            <div className="mb-5 border-b border-border/40 pb-3">
              <h3 className="text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                Account Details
              </h3>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {/* Editable full name */}
              <div className="space-y-2">
                <Label htmlFor="name" className="text-xs text-muted-foreground">
                  Full Name
                </Label>
                <div className="flex gap-2">
                  <Input
                    id="name"
                    value={nameDraft}
                    onChange={(e) => setNameDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") saveName();
                    }}
                    disabled={saving}
                    placeholder="Your name"
                    className="bg-background text-sm"
                  />
                  <Button
                    type="button"
                    size="sm"
                    onClick={saveName}
                    disabled={!canSaveName}
                    className="shrink-0"
                  >
                    {saving ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : justSaved ? (
                      <Check className="h-3.5 w-3.5" />
                    ) : (
                      "Save"
                    )}
                  </Button>
                </div>
              </div>

              {/* Read-only email (managed by Supabase Auth) */}
              <div className="space-y-2">
                <Label htmlFor="email" className="text-xs text-muted-foreground">
                  Email
                </Label>
                <Input
                  id="email"
                  defaultValue={user?.email ?? ""}
                  readOnly
                  className="bg-muted/30 text-sm"
                />
              </div>
            </div>

            <Separator className="my-5 bg-border/40" />

            <div className="space-y-3.5">
              <div className="flex items-center gap-3 text-sm">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted/50">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                </div>
                <span className="text-muted-foreground">Email verified</span>
                <Badge
                  variant="secondary"
                  className="bg-status-success/10 text-status-success ml-auto text-xs font-medium"
                >
                  Verified
                </Badge>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted/50">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                </div>
                <span className="text-muted-foreground">Member since</span>
                <span className="ml-auto font-mono text-xs text-muted-foreground">
                  {memberSince}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
