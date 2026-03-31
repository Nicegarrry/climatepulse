"use client";

import { motion } from "framer-motion";
import { useAuth } from "@/lib/auth-context";
import { useDevLogger } from "@/lib/dev-logger";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Mail, Shield, Clock, Edit2, AlertTriangle } from "lucide-react";

const fadeUp = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.45, ease: [0.23, 1, 0.32, 1] as [number, number, number, number] },
};

export default function ProfilePage() {
  const { user } = useAuth();
  const { log } = useDevLogger();

  const initials = user?.name
    ? user.name
        .split(" ")
        .map((n) => n[0])
        .join("")
    : "?";

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
                {user?.name}
              </h2>
              <p className="text-sm text-muted-foreground">{user?.email}</p>
              <div className="flex gap-2 pt-0.5">
                <Badge
                  variant="secondary"
                  className="bg-secondary/60 text-xs font-medium"
                >
                  Free Plan
                </Badge>
                <Badge
                  variant="secondary"
                  className="bg-accent-emerald/8 text-accent-emerald border-accent-emerald/15 text-xs font-medium"
                >
                  Active
                </Badge>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="border-border/50 text-muted-foreground hover:text-foreground"
              onClick={() => log("info", "Edit profile clicked")}
            >
              <Edit2 className="mr-1.5 h-3.5 w-3.5" />
              Edit
            </Button>
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
              <div className="space-y-2">
                <Label htmlFor="name" className="text-xs text-muted-foreground">
                  Full Name
                </Label>
                <Input
                  id="name"
                  defaultValue={user?.name}
                  readOnly
                  className="bg-muted/30 text-sm"
                />
              </div>
              <div className="space-y-2">
                <Label
                  htmlFor="email"
                  className="text-xs text-muted-foreground"
                >
                  Email
                </Label>
                <Input
                  id="email"
                  defaultValue={user?.email}
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
                  <Shield className="h-4 w-4 text-muted-foreground" />
                </div>
                <span className="text-muted-foreground">Two-factor auth</span>
                <Badge
                  variant="secondary"
                  className="ml-auto text-xs font-medium"
                >
                  Not enabled
                </Badge>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted/50">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                </div>
                <span className="text-muted-foreground">Member since</span>
                <span className="ml-auto font-mono text-xs text-muted-foreground">
                  {new Date().toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "short",
                  })}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Danger zone */}
        <Card className="border-destructive/20 bg-destructive/[0.02]">
          <CardContent className="p-6">
            <div className="mb-4 flex items-center gap-2 border-b border-destructive/15 pb-3">
              <AlertTriangle className="h-3.5 w-3.5 text-destructive/70" />
              <h3 className="text-xs font-semibold uppercase tracking-[0.1em] text-destructive/80">
                Danger Zone
              </h3>
            </div>
            <p className="mb-4 text-sm text-muted-foreground">
              Permanently delete your account and all associated data. This
              action cannot be undone.
            </p>
            <Button
              variant="outline"
              size="sm"
              className="border-destructive/25 text-destructive hover:bg-destructive/10"
              onClick={() => log("warn", "Delete account clicked")}
            >
              Delete Account
            </Button>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
