"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { useTheme } from "next-themes";
import { useDevLogger } from "@/lib/dev-logger";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Palette, Bell, Database, Shield, Key, Monitor } from "lucide-react";

const fadeUp = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.45, ease: [0.23, 1, 0.32, 1] as [number, number, number, number] },
};

const palettes = [
  { name: "Emerald", color: "bg-accent-emerald" },
  { name: "Teal", color: "bg-status-info" },
  { name: "Sky", color: "bg-[#5B8DB8]" },
  { name: "Amber", color: "bg-accent-amber" },
  { name: "Rose", color: "bg-status-error" },
  { name: "Violet", color: "bg-[#7C5CBF]" },
];

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-5 border-b border-border/40 pb-3">
      <h3 className="text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground">
        {children}
      </h3>
    </div>
  );
}

function ToggleRow({
  label,
  description,
  children,
}: {
  label: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-1">
      <div className="space-y-0.5">
        <Label className="text-sm font-medium">{label}</Label>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      {children}
    </div>
  );
}

export default function SettingsPage() {
  const { theme, setTheme } = useTheme();
  const { log } = useDevLogger();
  const [notifications, setNotifications] = useState(true);
  const [emailDigest, setEmailDigest] = useState(false);

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
      <motion.div {...fadeUp} className="space-y-8">
        {/* Page heading */}
        <div>
          <h1 className="font-display text-2xl tracking-tight">Settings</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Configure your workspace and preferences
          </p>
        </div>

        <Tabs defaultValue="appearance">
          <TabsList className="mb-6 w-full justify-start gap-1 rounded-none border-b border-border/40 bg-transparent p-0">
            {[
              { value: "appearance", icon: Palette, label: "Appearance" },
              { value: "notifications", icon: Bell, label: "Notifications" },
              { value: "data", icon: Database, label: "Data" },
              { value: "security", icon: Shield, label: "Security" },
            ].map((tab) => (
              <TabsTrigger
                key={tab.value}
                value={tab.value}
                className="relative gap-1.5 rounded-none border-b-2 border-transparent px-4 pb-3 pt-1.5 text-sm text-muted-foreground transition-colors data-[state=active]:border-foreground data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:shadow-none"
              >
                <tab.icon className="h-3.5 w-3.5" />
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>

          {/* Appearance */}
          <TabsContent value="appearance">
            <Card className="border-border/40 bg-card/50 backdrop-blur-sm">
              <CardContent className="p-6 space-y-6">
                <SectionLabel>Theme</SectionLabel>

                <ToggleRow
                  label="Color scheme"
                  description="Select your preferred appearance"
                >
                  <Select
                    value={theme}
                    onValueChange={(v) => {
                      setTheme(v);
                      log("info", `Theme changed to: ${v}`);
                    }}
                  >
                    <SelectTrigger className="w-32 border-border/50">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="dark">Dark</SelectItem>
                      <SelectItem value="light">Light</SelectItem>
                      <SelectItem value="system">System</SelectItem>
                    </SelectContent>
                  </Select>
                </ToggleRow>

                <Separator className="bg-border/40" />

                <div className="space-y-3">
                  <div className="mb-4 border-b border-border/40 pb-3">
                    <h3 className="text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                      Color Palette
                    </h3>
                  </div>
                  <div className="flex gap-3">
                    {palettes.map((c) => (
                      <button
                        key={c.name}
                        className={`h-9 w-9 rounded-full ${c.color} ring-2 ring-transparent ring-offset-2 ring-offset-background transition-all hover:scale-110 hover:ring-primary/50 focus:ring-primary`}
                        title={c.name}
                        onClick={() =>
                          log("info", `Color selected: ${c.name}`)
                        }
                      />
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Accent color customization (coming soon)
                  </p>
                </div>

                <Separator className="bg-border/40" />

                <SectionLabel>Layout</SectionLabel>

                <ToggleRow
                  label="Compact density"
                  description="Reduce spacing for denser layouts"
                >
                  <Switch
                    onCheckedChange={(v) =>
                      log("info", `Compact mode: ${v}`)
                    }
                  />
                </ToggleRow>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Notifications */}
          <TabsContent value="notifications">
            <Card className="border-border/40 bg-card/50 backdrop-blur-sm">
              <CardContent className="p-6 space-y-6">
                <SectionLabel>Alerts</SectionLabel>

                <ToggleRow
                  label="Push notifications"
                  description="Receive alerts for climate events"
                >
                  <Switch
                    checked={notifications}
                    onCheckedChange={(v) => {
                      setNotifications(v);
                      log("info", `Notifications: ${v}`);
                    }}
                  />
                </ToggleRow>

                <Separator className="bg-border/40" />

                <SectionLabel>Digests</SectionLabel>

                <ToggleRow
                  label="Email digest"
                  description="Weekly summary of climate intelligence"
                >
                  <Switch
                    checked={emailDigest}
                    onCheckedChange={(v) => {
                      setEmailDigest(v);
                      log("info", `Email digest: ${v}`);
                    }}
                  />
                </ToggleRow>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Data */}
          <TabsContent value="data">
            <Card className="border-border/40 bg-card/50 backdrop-blur-sm">
              <CardContent className="p-6 space-y-6">
                <SectionLabel>Storage</SectionLabel>

                <ToggleRow
                  label="Database status"
                  description="Local Docker PostgreSQL"
                >
                  <Badge
                    variant="secondary"
                    className="bg-status-warning/10 text-status-warning text-xs font-medium"
                  >
                    Not connected
                  </Badge>
                </ToggleRow>

                <Separator className="bg-border/40" />

                <SectionLabel>Connection</SectionLabel>

                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">
                    Database URL
                  </Label>
                  <Input
                    readOnly
                    value="postgresql://localhost:5432/climatepulse"
                    className="bg-muted/30 font-mono text-xs"
                  />
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="border-border/50 text-muted-foreground hover:text-foreground"
                  onClick={() =>
                    log("info", "Test database connection clicked")
                  }
                >
                  <Monitor className="mr-1.5 h-3.5 w-3.5" />
                  Test Connection
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Security */}
          <TabsContent value="security">
            <Card className="border-border/40 bg-card/50 backdrop-blur-sm">
              <CardContent className="p-6 space-y-6">
                <SectionLabel>Authentication</SectionLabel>

                <ToggleRow
                  label="Two-factor authentication"
                  description="Add an extra layer of security"
                >
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-border/50 text-muted-foreground hover:text-foreground"
                    onClick={() => log("info", "Enable 2FA clicked")}
                  >
                    <Shield className="mr-1.5 h-3.5 w-3.5" />
                    Enable
                  </Button>
                </ToggleRow>

                <Separator className="bg-border/40" />

                <SectionLabel>Access</SectionLabel>

                <ToggleRow
                  label="API keys"
                  description="Manage your API access tokens"
                >
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-border/50 text-muted-foreground hover:text-foreground"
                    onClick={() => log("info", "Manage API keys clicked")}
                  >
                    <Key className="mr-1.5 h-3.5 w-3.5" />
                    Manage
                  </Button>
                </ToggleRow>

                <Separator className="bg-border/40" />

                <SectionLabel>Sessions</SectionLabel>

                <ToggleRow
                  label="Active sessions"
                  description="1 active session"
                >
                  <Badge
                    variant="secondary"
                    className="text-xs font-medium"
                  >
                    Current device
                  </Badge>
                </ToggleRow>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </motion.div>
    </div>
  );
}
