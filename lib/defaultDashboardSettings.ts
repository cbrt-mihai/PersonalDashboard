import { NOTE_ENTRY_TYPES } from "@/lib/noteEntryFormOptions";
import { NAMED_OWNER_COLOR_PRESETS } from "@/lib/presetColors";
import { STATUS_BG_SWATCHES, STATUS_TEXT_COLOR_SWATCHES } from "@/lib/presetColors";
import {
  STATUS_MAP,
  normalizeStatusKey,
  type StatusDef,
  type TaskStatusRowInput,
} from "@/lib/statusConfig";
import { TASK_FORM_PRIORITIES, TASK_FORM_TYPES } from "@/lib/taskFormOptions";

export function taskStatusRowsFromDefaultMap(): TaskStatusRowInput[] {
  return (Object.entries(STATUS_MAP) as [string, StatusDef][])
    .map(([id, def]) => ({
      id,
      label: def.label,
      color: def.color,
      bg: def.bg,
      order: def.order,
      terminal: def.terminal,
    }))
    .sort((a, b) => a.order - b.order);
}

/** Default first note status (`todo`); order before workflow rows so it sorts first. */
export const DEFAULT_TODO_NOTE_STATUS_ROW: TaskStatusRowInput = {
  id: "todo",
  label: "Todo",
  color: "#64748b",
  bg: "rgba(100,116,139,0.15)",
  order: -1,
};

/** Note workflow rows: Todo plus the same built-in set as task statuses (independent lists). */
export function defaultNoteStatusRows(): TaskStatusRowInput[] {
  return [
    { ...DEFAULT_TODO_NOTE_STATUS_ROW },
    ...taskStatusRowsFromDefaultMap().map((r) => ({ ...r })),
  ];
}

/** Ensure `todo` exists (for stores created before Todo was a first-class note status). */
export function ensureTodoNoteStatusInRows(raw: unknown): TaskStatusRowInput[] {
  if (!Array.isArray(raw) || raw.length === 0) {
    return defaultNoteStatusRows();
  }
  const rows = raw as TaskStatusRowInput[];
  if (rows.some((r) => normalizeStatusKey(String(r?.id ?? "")) === "todo")) {
    return rows;
  }
  if (rows.length >= 40) return rows;
  return [{ ...DEFAULT_TODO_NOTE_STATUS_ROW }, ...rows];
}

function hexToTintRgba(hex: string, alpha = 0.12): string {
  const t = hex.trim();
  const m = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.exec(t);
  if (!m) return `rgba(100,116,139,${alpha})`;
  const h = m[1]!.length === 3 ? m[1]!.split("").map((c) => c + c).join("") : m[1]!;
  const n = parseInt(h, 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return `rgba(${r},${g},${b},${alpha})`;
}

function defaultTaskTypeRows() {
  const styles: Record<string, { color: string; icon: string }> = {
    Task: { color: "#2563eb", icon: "🧩" },
    Spike: { color: "#7c3aed", icon: "🧪" },
    Bug: { color: "#dc2626", icon: "🐛" },
  };
  return [...TASK_FORM_TYPES].map((label) => ({
    label,
    color: styles[label]?.color ?? "#64748b",
    bg: hexToTintRgba(styles[label]?.color ?? "#64748b", 0.12),
    icon: styles[label]?.icon ?? "",
  }));
}

function defaultTaskPriorityRows() {
  const styles: Record<string, { color: string; icon: string }> = {
    Trivial: { color: "#64748b", icon: "•" },
    Low: { color: "#0ea5e9", icon: "↓" },
    Medium: { color: "#f59e0b", icon: "→" },
    High: { color: "#f97316", icon: "↑" },
    Critical: { color: "#dc2626", icon: "🔥" },
    Blocker: { color: "#991b1b", icon: "⛔" },
  };
  return [...TASK_FORM_PRIORITIES].map((label) => ({
    label,
    color: styles[label]?.color ?? "#64748b",
    bg: hexToTintRgba(styles[label]?.color ?? "#64748b", 0.12),
    icon: styles[label]?.icon ?? "",
  }));
}

/** Used when seeding store / reset; must match `dashboardSettingsSchema` shape. */
export const DEFAULT_DASHBOARD_SETTINGS = {
  ownerColorPresets: NAMED_OWNER_COLOR_PRESETS.map(({ name, color }) => ({
    name,
    color,
  })),
  statusTextColorSwatches: STATUS_TEXT_COLOR_SWATCHES.map((value) => ({ name: value, value })),
  statusBgSwatches: STATUS_BG_SWATCHES.map((value) => ({ name: value, value })),
  taskTypes: defaultTaskTypeRows(),
  taskPriorities: defaultTaskPriorityRows(),
  noteTypes: [...NOTE_ENTRY_TYPES] as string[],
  taskStatuses: taskStatusRowsFromDefaultMap(),
  /** Workflow for owner-attributed notes (separate from task statuses). */
  noteStatuses: defaultNoteStatusRows(),
};
