"use client";

import { createContext, useContext, useState, useCallback } from "react";

export interface LogEntry {
  id: string;
  timestamp: Date;
  level: "info" | "warn" | "error" | "debug";
  message: string;
  data?: unknown;
}

interface DevLoggerContextType {
  logs: LogEntry[];
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  log: (level: LogEntry["level"], message: string, data?: unknown) => void;
  clearLogs: () => void;
}

const DevLoggerContext = createContext<DevLoggerContextType | null>(null);

let logCounter = 0;

export function DevLoggerProvider({ children }: { children: React.ReactNode }) {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isOpen, setIsOpen] = useState(false);

  const log = useCallback(
    (level: LogEntry["level"], message: string, data?: unknown) => {
      const entry: LogEntry = {
        id: String(++logCounter),
        timestamp: new Date(),
        level,
        message,
        data,
      };
      setLogs((prev) => [entry, ...prev].slice(0, 200));
      // Also output to browser console
      const consoleFn =
        level === "error"
          ? console.error
          : level === "warn"
            ? console.warn
            : level === "debug"
              ? console.debug
              : console.log;
      consoleFn(`[ClimatePulse:${level}] ${message}`, data ?? "");
    },
    [],
  );

  const clearLogs = useCallback(() => setLogs([]), []);

  return (
    <DevLoggerContext.Provider
      value={{ logs, isOpen, setIsOpen, log, clearLogs }}
    >
      {children}
    </DevLoggerContext.Provider>
  );
}

export function useDevLogger() {
  const context = useContext(DevLoggerContext);
  if (!context)
    throw new Error("useDevLogger must be used within DevLoggerProvider");
  return context;
}
