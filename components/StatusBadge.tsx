"use client";

import { useDashboardConfig } from "@/components/DashboardSettingsProvider";
import { statusDef } from "@/lib/statusConfig";

export function StatusBadge({
  status,
  variant = "task",
}: {
  status: string;
  /** `note` uses Settings → Notes statuses; `task` uses task statuses. */
  variant?: "task" | "note";
}) {
  const { statusMap, noteStatusMap } = useDashboardConfig();
  const map = variant === "note" ? noteStatusMap : statusMap;
  const d = statusDef(status, map);
  return (
    <span
      className="inline-flex max-w-[10rem] truncate rounded-full px-2 py-0.5 text-xs font-medium"
      style={{ color: d.color, backgroundColor: d.bg }}
      title={status}
    >
      {d.label}
    </span>
  );
}
