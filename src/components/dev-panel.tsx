"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useDevLogger, type LogEntry } from "@/lib/dev-logger";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { X, Trash2, ChevronDown, ChevronUp, Users } from "lucide-react";
import { useState, useRef, useEffect } from "react";

const TEST_USERS = [
  { id: "test-user-1", name: "Sarah Chen", role: "Investor" },
  { id: "test-user-2", name: "Marcus Webb", role: "Corporate" },
  { id: "test-user-3", name: "Priya Sharma", role: "Policy" },
  { id: "test-user-4", name: "James Okonkwo", role: "Developer" },
  { id: "test-user-5", name: "Dr. Amira Hassan", role: "Researcher" },
];

/* ── Colour tokens (hardcoded — always dark/terminal) ── */
const LEVEL_BADGE: Record<
  LogEntry["level"],
  { bg: string; text: string }
> = {
  info:  { bg: "bg-[#5B7FA8]/15", text: "text-[#5B7FA8]" },
  warn:  { bg: "bg-[#C9922A]/15", text: "text-[#C9922A]" },
  error: { bg: "bg-[#C94444]/15", text: "text-[#C94444]" },
  debug: { bg: "bg-[#A8B5A6]/15", text: "text-[#A8B5A6]" },
};

export function DevPanel() {
  const { logs, isOpen, setIsOpen, clearLogs, log } = useDevLogger();
  const { user, switchUser, updateUser } = useAuth();
  const [expanded, setExpanded] = useState<string | null>(null);
  const [isMinimized, setIsMinimized] = useState(false);
  const [showUserSwitcher, setShowUserSwitcher] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  /* Auto-scroll to top when new log arrives (logs are newest-first) */
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = 0;
    }
  }, [logs.length]);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: 300, opacity: 0 }}
        animate={{
          y: 0,
          opacity: 1,
          height: isMinimized ? 44 : 340,
        }}
        exit={{ y: 300, opacity: 0 }}
        transition={{ type: "spring", damping: 25, stiffness: 300 }}
        className="fixed bottom-0 left-0 right-0 z-50 overflow-hidden border-t border-[#243318] bg-[#161A14]/98 shadow-2xl backdrop-blur-xl"
      >
        {/* ── Header bar ── */}
        <div className="flex h-11 items-center gap-2.5 border-b border-[#243318] px-3.5">
          <span className="font-mono text-[11px] font-semibold uppercase tracking-widest text-[#8A9A88]">
            Dev Console
          </span>

          <Badge
            variant="secondary"
            className="h-[18px] rounded border-0 bg-[#243318] px-1.5 font-mono text-[10px] font-medium text-[#8A9A88] hover:bg-[#243318]"
          >
            {logs.length}
          </Badge>

          <div className="flex-1" />

          {/* Action buttons */}
          {/* User switcher */}
          <Button
            variant="ghost"
            size="sm"
            className="h-6 gap-1 rounded px-2 font-mono text-[11px] text-[#8A9A88] hover:bg-[#243318] hover:text-[#F5F2EC]"
            onClick={() => setShowUserSwitcher(!showUserSwitcher)}
          >
            <Users className="h-3 w-3" />
            {user?.name?.split(" ")[0] ?? "User"}
          </Button>

          <Button
            variant="ghost"
            size="sm"
            className="h-6 gap-1 rounded px-2 font-mono text-[11px] text-[#8A9A88] hover:bg-[#243318] hover:text-[#F5F2EC]"
            onClick={() => {
              log("info", "Test log entry", {
                timestamp: new Date().toISOString(),
                random: Math.random(),
              });
            }}
          >
            + Test Log
          </Button>

          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-[#8A9A88] hover:bg-[#243318] hover:text-[#F5F2EC]"
            onClick={clearLogs}
          >
            <Trash2 className="h-3 w-3" />
          </Button>

          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-[#8A9A88] hover:bg-[#243318] hover:text-[#F5F2EC]"
            onClick={() => setIsMinimized(!isMinimized)}
          >
            {isMinimized ? (
              <ChevronUp className="h-3 w-3" />
            ) : (
              <ChevronDown className="h-3 w-3" />
            )}
          </Button>

          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-[#8A9A88] hover:bg-[#243318] hover:text-[#F5F2EC]"
            onClick={() => setIsOpen(false)}
          >
            <X className="h-3 w-3" />
          </Button>
        </div>

        {/* ── User switcher bar ── */}
        {!isMinimized && showUserSwitcher && (
          <div className="flex items-center gap-1 border-b border-[#243318] bg-[#1A2412] px-3.5 py-1.5">
            <span className="mr-2 font-mono text-[10px] uppercase tracking-wider text-[#5A6B58]">
              Switch user:
            </span>
            {TEST_USERS.map((tu) => (
              <button
                key={tu.id}
                onClick={async () => {
                  await switchUser(tu.id);
                  setShowUserSwitcher(false);
                  log("info", `Switched to ${tu.name}`, { userId: tu.id });
                }}
                className={`rounded-md px-2 py-1 font-mono text-[11px] transition-colors hover:bg-[#243318] ${
                  user?.id === tu.id
                    ? "bg-[#243318] text-[#7DBF6E]"
                    : "text-[#8A9A88]"
                }`}
              >
                {tu.name.split(" ")[0]}
                <span className="ml-1 text-[9px] text-[#5A6B58]">{tu.role}</span>
              </button>
            ))}
            <div className="mx-1 h-4 w-px bg-[#243318]" />
            <button
              onClick={async () => {
                if (!user?.id) return;
                await fetch("/api/user/profile", {
                  method: "PUT",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ userId: user.id, onboarded_at: null }),
                });
                updateUser({ onboardedAt: null });
                setShowUserSwitcher(false);
                log("info", "Onboarding reset — redirecting...");
              }}
              className="rounded-md px-2 py-1 font-mono text-[11px] text-[#C94444] transition-colors hover:bg-[#243318]"
            >
              Reset Onboarding
            </button>
          </div>
        )}

        {/* ── Log entries ── */}
        {!isMinimized && (
          <div
            ref={scrollRef}
            className="h-[calc(100%-44px)] overflow-y-auto [scrollbar-color:#3A4D38_transparent] [scrollbar-width:thin] [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-[#3A4D38] [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar]:w-1"
          >
            {logs.length === 0 ? (
              <div className="flex h-full items-center justify-center text-sm text-[#5A6B58]">
                No logs yet
              </div>
            ) : (
              <div className="divide-y divide-[#243318]/60">
                {logs.map((entry) => (
                  <button
                    key={entry.id}
                    type="button"
                    onClick={() =>
                      setExpanded(expanded === entry.id ? null : entry.id)
                    }
                    className="flex w-full flex-col px-3.5 py-1.5 text-left transition-colors hover:bg-[#1E2A18]"
                  >
                    <div className="flex items-center gap-2.5">
                      {/* Timestamp */}
                      <span className="shrink-0 font-mono text-[10px] tabular-nums text-[#5A6B58]">
                        {entry.timestamp.toLocaleTimeString("en-US", {
                          hour12: false,
                          hour: "2-digit",
                          minute: "2-digit",
                          second: "2-digit",
                        })}
                      </span>

                      {/* Level badge */}
                      <span
                        className={`${LEVEL_BADGE[entry.level].bg} ${LEVEL_BADGE[entry.level].text} inline-flex h-[16px] items-center rounded px-1.5 font-mono text-[9px] font-semibold uppercase leading-none`}
                      >
                        {entry.level}
                      </span>

                      {/* Message */}
                      <span className="flex-1 truncate font-mono text-xs text-[#F5F2EC]">
                        {entry.message}
                      </span>
                    </div>

                    {/* Expanded data */}
                    {entry.data != null && expanded === entry.id && (
                      <pre className="mt-1.5 overflow-x-auto rounded bg-[#0E120C] p-2.5 font-mono text-[10px] leading-relaxed text-[#8A9A88]">
                        {JSON.stringify(entry.data, null, 2)}
                      </pre>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );
}
