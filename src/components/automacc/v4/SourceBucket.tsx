"use client";

import { useMemo, useState } from "react";
import { PlusIcon } from "@heroicons/react/24/outline";
import type {
  SourceBucket as SourceBucketId,
  SourceEntry,
  SourceFactor,
} from "@/lib/automacc/v4-types";
import { COLORS, FONTS } from "@/lib/design-tokens";
import { SourceRow } from "./SourceRow";
import { SourcePicker } from "./SourcePicker";

interface Props {
  bucketId: SourceBucketId;
  label: string;
  blurb: string;
  Icon: React.ComponentType<{ width?: number; height?: number; style?: React.CSSProperties }>;
  rows: SourceEntry[];
  factors: SourceFactor[];          // all factors, filtered to this bucket inside
  factorsLoaded: boolean;           // false when SOURCE_FACTORS is still empty
  onAdd: (factor: SourceFactor) => void;
  onUpdate: (rowId: string, patch: Partial<SourceEntry>) => void;
  onRemove: (rowId: string) => void;
}

export function SourceBucketCard({
  bucketId,
  label,
  blurb,
  Icon,
  rows,
  factors,
  factorsLoaded,
  onAdd,
  onUpdate,
  onRemove,
}: Props) {
  const [pickerOpen, setPickerOpen] = useState(false);

  const bucketFactors = useMemo(
    () => factors.filter((f) => f.bucket === bucketId),
    [factors, bucketId],
  );

  const factorById = useMemo(() => {
    const m = new Map<string, SourceFactor>();
    for (const f of bucketFactors) m.set(f.id, f);
    return m;
  }, [bucketFactors]);

  const existingSourceIds = useMemo(
    () => new Set(rows.map((r) => r.sourceId)),
    [rows],
  );

  return (
    <section
      style={{
        background: "#fff",
        border: `1px solid ${COLORS.border}`,
        borderRadius: 10,
        padding: 16,
        fontFamily: FONTS.sans,
      }}
    >
      <header
        style={{
          display: "flex",
          alignItems: "flex-start",
          gap: 12,
          marginBottom: rows.length > 0 ? 12 : 8,
        }}
      >
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: 32,
            height: 32,
            borderRadius: 8,
            background: COLORS.sageTint,
            color: COLORS.forest,
            flexShrink: 0,
          }}
        >
          <Icon width={18} height={18} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h3
            style={{
              margin: 0,
              fontSize: 14,
              fontWeight: 700,
              color: COLORS.ink,
              letterSpacing: "-0.005em",
            }}
          >
            {label}
          </h3>
          <p
            style={{
              margin: "2px 0 0",
              fontSize: 12,
              color: COLORS.inkSec,
              lineHeight: 1.5,
            }}
          >
            {blurb}
          </p>
        </div>
      </header>

      {rows.length > 0 && (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 8,
            marginBottom: 10,
          }}
        >
          {rows.map((row) => (
            <SourceRow
              key={row.id}
              row={row}
              factor={factorById.get(row.sourceId)}
              onChange={(patch) => onUpdate(row.id, patch)}
              onRemove={() => onRemove(row.id)}
            />
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={() => setPickerOpen(true)}
        disabled={!factorsLoaded}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          padding: "7px 12px",
          background: "transparent",
          color: factorsLoaded ? COLORS.forest : COLORS.inkMuted,
          border: `1px dashed ${factorsLoaded ? COLORS.forest : COLORS.border}`,
          borderRadius: 6,
          fontSize: 12,
          fontWeight: 600,
          cursor: factorsLoaded ? "pointer" : "not-allowed",
          fontFamily: FONTS.sans,
        }}
      >
        <PlusIcon width={13} height={13} />
        {factorsLoaded ? "Add source" : "Loading source library…"}
      </button>

      <SourcePicker
        open={pickerOpen}
        bucketLabel={label}
        factors={bucketFactors}
        existingSourceIds={existingSourceIds}
        onSelect={(f) => {
          onAdd(f);
          setPickerOpen(false);
        }}
        onClose={() => setPickerOpen(false)}
      />
    </section>
  );
}
