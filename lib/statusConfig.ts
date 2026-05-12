export type StatusDef = {
  label: string;
  color: string;
  bg: string;
  order: number;
  terminal?: boolean;
};

/** Keys are normalized lowercase status ids; tasks may use any string and map here or fall back. */
export const STATUS_MAP: Record<string, StatusDef> = {
  open: {
    label: "Open",
    color: "#64748b",
    bg: "rgba(100,116,139,0.15)",
    order: 0,
  },
  in_progress: {
    label: "In progress",
    color: "#2563eb",
    bg: "rgba(37,99,235,0.12)",
    order: 1,
  },
  blocked: {
    label: "Blocked",
    color: "#dc2626",
    bg: "rgba(220,38,38,0.12)",
    order: 2,
  },
  done: {
    label: "Done",
    color: "#16a34a",
    bg: "rgba(22,163,74,0.12)",
    order: 3,
    terminal: true,
  },
  closed: {
    label: "Closed",
    color: "#15803d",
    bg: "rgba(21,128,61,0.12)",
    order: 4,
    terminal: true,
  },
};

export type TaskStatusRowInput = {
  id: string;
  label: string;
  color: string;
  bg: string;
  order: number;
  terminal?: boolean;
};

export function normalizeStatusKey(status: string): string {
  return status.trim().toLowerCase().replace(/\s+/g, "_");
}

/** Build workflow map from persisted settings rows (ids normalized to keys). */
export function buildStatusMapFromRows(rows: TaskStatusRowInput[]): Record<string, StatusDef> {
  const out: Record<string, StatusDef> = {};
  for (const r of rows) {
    const key = normalizeStatusKey(r.id);
    out[key] = {
      label: r.label,
      color: r.color,
      bg: r.bg,
      order: r.order,
      terminal: r.terminal,
    };
  }
  return out;
}

export function taskStatusKeysFromMap(map: Record<string, StatusDef>): string[] {
  return (Object.entries(map) as [string, StatusDef][])
    .sort((a, b) => a[1].order - b[1].order)
    .map(([k]) => k);
}

export function statusDef(
  status: string,
  map: Record<string, StatusDef> = STATUS_MAP,
): StatusDef {
  const key = normalizeStatusKey(status);
  const hit = map[key];
  if (hit) return hit;
  return {
    label: status,
    color: "#737373",
    bg: "rgba(115,115,115,0.12)",
    order: 99,
  };
}

export function isTerminalStatus(
  status: string,
  map: Record<string, StatusDef> = STATUS_MAP,
): boolean {
  const key = normalizeStatusKey(status);
  return Boolean(map[key]?.terminal);
}

export function statusSortKey(
  status: string,
  map: Record<string, StatusDef> = STATUS_MAP,
): number {
  return statusDef(status, map).order;
}

/** Canonical keys for built-in map (sorted by workflow order). */
export const TASK_STATUS_SELECT_KEYS = taskStatusKeysFromMap(STATUS_MAP);

/**
 * Map stored task status to a `<select>` value (known key or raw custom string).
 */
export function taskStatusSelectValue(
  stored: string,
  map: Record<string, StatusDef> = STATUS_MAP,
): string {
  const n = normalizeStatusKey(stored);
  if (map[n]) return n;
  return stored;
}

export function isKnownTaskStatus(
  stored: string,
  map: Record<string, StatusDef> = STATUS_MAP,
): boolean {
  return Boolean(map[normalizeStatusKey(stored)]);
}

/** First status id by workflow order (for API / form defaults). */
export function firstStatusIdByOrder(rows: TaskStatusRowInput[]): string {
  const sorted = [...rows].sort((a, b) => a.order - b.order);
  return sorted[0]?.id ?? "open";
}
