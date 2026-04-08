"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { ROLE_LENS_OPTIONS } from "@/lib/types";
import { ROLE_ICONS } from "@/lib/domain-icons";

interface StepRoleProps {
  onSelect: (roleId: string) => void;
}

export function StepRole({ onSelect }: StepRoleProps) {
  const [selected, setSelected] = useState<string | null>(null);

  const handleSelect = (roleId: string) => {
    setSelected(roleId);
    setTimeout(() => onSelect(roleId), 400);
  };

  return (
    <div className="mx-auto w-full max-w-lg">
      <div className="mb-8 text-center">
        <h1 className="font-display text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
          How do you engage with climate and energy?
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          This shapes how we frame insights for you
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {ROLE_LENS_OPTIONS.map((role, i) => {
          const Icon = ROLE_ICONS[role.id];
          const isSelected = selected === role.id;

          return (
            <motion.button
              key={role.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05, duration: 0.3 }}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => handleSelect(role.id)}
              disabled={selected !== null}
              className={`relative flex items-start gap-3 rounded-xl border p-4 text-left transition-all duration-200 ${
                isSelected
                  ? "border-accent-emerald bg-accent-emerald/5 ring-2 ring-accent-emerald/30"
                  : selected !== null
                    ? "border-border/30 opacity-40"
                    : "border-border/60 bg-card hover:border-accent-emerald/40 hover:bg-accent-emerald/5"
              }`}
            >
              {Icon && (
                <div
                  className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-colors ${
                    isSelected
                      ? "bg-accent-emerald text-white"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  <Icon className="h-4.5 w-4.5" />
                </div>
              )}
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground">
                  {role.label}
                </p>
                <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                  {role.framing}
                </p>
              </div>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
