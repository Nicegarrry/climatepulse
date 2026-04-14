"use client";

import { useRouter, usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import { useAuth } from "@/lib/auth-context";
import { useDevLogger } from "@/lib/dev-logger";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import Image from "next/image";
import {
  Sun,
  Moon,
  User,
  Settings,
  LogOut,
  Bug,
  Terminal,
} from "lucide-react";

export function AppHeader() {
  const { user, logout } = useAuth();
  const { theme, setTheme } = useTheme();
  const { isOpen, setIsOpen, logs } = useDevLogger();
  const router = useRouter();
  const pathname = usePathname();

  const initials = user?.name
    ? user.name
        .split(" ")
        .map((n) => n[0])
        .join("")
    : "?";

  const errorCount = logs.filter((l) => l.level === "error").length;

  const currentPage = pathname.split("/").pop() || "dashboard";

  return (
    <header className="sticky top-0 z-50 h-14 border-b border-border/40 bg-background/95 backdrop-blur-xl">
      <div className="mx-auto flex h-full max-w-screen-2xl items-center gap-3 px-4 sm:px-6">
        {/* Logo */}
        <button
          onClick={() => router.push("/dashboard")}
          className="flex items-center gap-2.5 transition-opacity duration-150 hover:opacity-80"
        >
          <Image src="/leaf only.svg" alt="Climate Pulse" width={28} height={28} />
          <span className="hidden font-display text-base font-semibold tracking-tight text-plum sm:block">
            climate pulse
          </span>
        </button>

        {/* Breadcrumb separator */}
        <div className="hidden items-center gap-1.5 text-sm sm:flex">
          <span className="text-muted-foreground/40">/</span>
          <span className="capitalize text-muted-foreground">
            {currentPage}
          </span>
        </div>

        <div className="flex-1" />

        {/* Right-side actions */}
        <div className="flex items-center gap-1">
          {/* Dev button */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsOpen(!isOpen)}
            className="relative h-8 gap-1.5 rounded-md px-2.5 font-mono text-[11px] text-muted-foreground transition-colors duration-150 hover:text-foreground"
          >
            <Terminal className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Dev</span>
            {logs.length > 0 && (
              <Badge
                variant={errorCount > 0 ? "destructive" : "secondary"}
                className="ml-0.5 h-4 min-w-4 rounded-full px-1 text-[10px] font-medium"
              >
                {logs.length}
              </Badge>
            )}
            {errorCount > 0 && (
              <Bug className="h-3 w-3 text-destructive" />
            )}
          </Button>

          {/* Subtle separator */}
          <div className="mx-1 h-4 w-px bg-border/50" />

          {/* Theme toggle */}
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-md text-muted-foreground transition-colors duration-150 hover:text-foreground"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          >
            <Sun className="h-4 w-4 rotate-0 scale-100 transition-all duration-200 dark:-rotate-90 dark:scale-0" />
            <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all duration-200 dark:rotate-0 dark:scale-100" />
            <span className="sr-only">Toggle theme</span>
          </Button>

          {/* Subtle separator */}
          <div className="mx-1 h-4 w-px bg-border/50" />

          {/* User menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                className="h-8 gap-2 rounded-md px-2 transition-colors duration-150"
              >
                <Avatar className="h-6 w-6">
                  <AvatarFallback className="bg-accent-emerald/10 text-[11px] font-medium text-accent-emerald">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <span className="hidden text-sm font-medium text-foreground sm:block">
                  {user?.name}
                </span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <div className="px-3 py-2">
                <p className="text-sm font-medium text-foreground">
                  {user?.name}
                </p>
                <p className="text-xs text-muted-foreground">{user?.email}</p>
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => router.push("/profile")}
                className="gap-2 text-sm"
              >
                <User className="h-4 w-4 text-muted-foreground" />
                Profile
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => router.push("/settings")}
                className="gap-2 text-sm"
              >
                <Settings className="h-4 w-4 text-muted-foreground" />
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
                <LogOut className="h-4 w-4" />
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
