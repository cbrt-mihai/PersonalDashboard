"use client";

import { useDashboardConfig } from "@/components/DashboardSettingsProvider";
import { isKnownTaskStatus, taskStatusSelectValue } from "@/lib/statusConfig";

/** Status `<select>` for owner-attributed notes (uses Settings → Notes statuses only). */
export function NoteStatusSelect({
  id,
  value,
  onChange,
  className,
}: {
  id?: string;
  value: string;
  onChange: (status: string) => void;
  className?: string;
}) {
  const { noteStatusMap, noteStatusKeys } = useDashboardConfig();
  const map = noteStatusMap;
  const keys = noteStatusKeys;

  const known = isKnownTaskStatus(value, map);
  const selectValue = known ? taskStatusSelectValue(value, map) : (keys[0] ?? "");

  return (
    <select
      id={id}
      value={selectValue}
      onChange={(e) => onChange(e.target.value)}
      className={className}
    >
      {keys.map((k) => (
        <option key={k} value={k}>
          {map[k]?.label ?? k}
        </option>
      ))}
    </select>
  );
}
