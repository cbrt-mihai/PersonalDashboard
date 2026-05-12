"use client";

import { useDashboardConfig } from "@/components/DashboardSettingsProvider";
import { DEFAULT_DASHBOARD_SETTINGS } from "@/lib/defaultDashboardSettings";

type MetaRow = { label: string; color: string; bg: string; icon: string };

function expandHex(s: string): string {
  const t = s.trim();
  if (/^#[0-9a-fA-F]{3}$/.test(t)) {
    const a = t.slice(1);
    return `#${a[0]!}${a[0]!}${a[1]!}${a[1]!}${a[2]!}${a[2]!}`.toLowerCase();
  }
  if (/^#[0-9a-fA-F]{6}$/.test(t)) return t.toLowerCase();
  return "#64748b";
}

function matchRow(rows: readonly MetaRow[], value: string): MetaRow | undefined {
  const v = value.trim().toLowerCase();
  if (!v) return undefined;
  return rows.find((r) => r.label.trim().toLowerCase() === v);
}

function MetaBadge({
  label,
  color,
  bg,
  icon,
  title,
}: {
  label: string;
  color: string;
  bg?: string;
  icon?: string;
  title?: string;
}) {
  const c = expandHex(color);
  const b = bg?.trim() ? bg : `${c}1f`;
  return (
    <span
      className="inline-flex max-w-[12rem] items-center gap-1.5 truncate rounded-full px-2 py-0.5 text-xs font-medium"
      style={{ color: c, backgroundColor: b }}
      title={title ?? label}
    >
      {icon?.trim() ? <span aria-hidden>{icon}</span> : null}
      <span className="truncate">{label}</span>
    </span>
  );
}

export function TaskTypeBadge({ type }: { type: string }) {
  const { settings } = useDashboardConfig();
  const rows = (settings?.taskTypes ?? DEFAULT_DASHBOARD_SETTINGS.taskTypes) as MetaRow[];
  const hit = matchRow(rows, type);
  const label = hit?.label ?? type;
  const color = hit?.color ?? "#64748b";
  const bg = hit?.bg ?? "";
  const icon = hit?.icon ?? "";
  return <MetaBadge label={label} color={color} bg={bg} icon={icon} title={type} />;
}

export function TaskPriorityBadge({ priority }: { priority: string }) {
  const { settings } = useDashboardConfig();
  const rows = (settings?.taskPriorities ?? DEFAULT_DASHBOARD_SETTINGS.taskPriorities) as MetaRow[];
  const hit = matchRow(rows, priority);
  const label = hit?.label ?? priority;
  const color = hit?.color ?? "#64748b";
  const bg = hit?.bg ?? "";
  const icon = hit?.icon ?? "";
  return <MetaBadge label={label} color={color} bg={bg} icon={icon} title={priority} />;
}

