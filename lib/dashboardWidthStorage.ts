export const DASHBOARD_WIDTH_STORAGE_KEY = "dashboard-max-width";
export const DASHBOARD_WIDTH_CSS_VAR = "--dashboard-w";
export const DASHBOARD_WIDTH_EVENT = "dashboard-width";

/** Matches the previous hard-coded `max-w-[min(100%,96rem)]` cap (1536 px). */
export const DEFAULT_DASHBOARD_WIDTH = "96rem";

export const MIN_DASHBOARD_WIDTH_PX = 960;
export const MAX_DASHBOARD_WIDTH_PX = 2800;

export type DashboardWidthPresetId = "normal" | "wide" | "xwide" | "full";

export type DashboardWidthPreset = {
  id: DashboardWidthPresetId;
  labelKey: string;
  value: string;
};

export const DASHBOARD_WIDTH_PRESETS: readonly DashboardWidthPreset[] = [
  { id: "normal", labelKey: "settings.widthNormal", value: "96rem" },
  { id: "wide", labelKey: "settings.widthWide", value: "1800px" },
  { id: "xwide", labelKey: "settings.widthExtraWide", value: "2200px" },
  { id: "full", labelKey: "settings.widthFull", value: "100%" },
] as const;

/**
 * Inline `<script>` placed before React paints; sets `--dashboard-w` on
 * `:root` from `localStorage` so dashboards/Nav don't flash at default width.
 */
export const INIT_DASHBOARD_WIDTH_SCRIPT = `(function(){try{var k=${JSON.stringify(
  DASHBOARD_WIDTH_STORAGE_KEY,
)};var v=localStorage.getItem(k)||${JSON.stringify(
  DEFAULT_DASHBOARD_WIDTH,
)};document.documentElement.style.setProperty(${JSON.stringify(
  DASHBOARD_WIDTH_CSS_VAR,
)},v);}catch(e){}})();`;

function isValidWidthValue(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const v = value.trim();
  if (!v) return false;
  if (v === "100%") return true;
  if (/^\d+(\.\d+)?(px|rem)$/.test(v)) return true;
  return false;
}

export function readStoredDashboardWidth(): string {
  if (typeof window === "undefined") return DEFAULT_DASHBOARD_WIDTH;
  try {
    const v = window.localStorage.getItem(DASHBOARD_WIDTH_STORAGE_KEY);
    if (isValidWidthValue(v)) return v;
  } catch {
    /* ignore */
  }
  return DEFAULT_DASHBOARD_WIDTH;
}

/** Set the CSS variable on `:root` without persisting. Use for live drag. */
export function setDashboardWidthCssVar(value: string): void {
  if (typeof document === "undefined") return;
  document.documentElement.style.setProperty(DASHBOARD_WIDTH_CSS_VAR, value);
}

/** Persist + apply + notify subscribers (Settings panel, Nav, etc.). */
export function applyDashboardWidth(value: string): void {
  if (typeof window === "undefined") return;
  const next = isValidWidthValue(value) ? value : DEFAULT_DASHBOARD_WIDTH;
  try {
    window.localStorage.setItem(DASHBOARD_WIDTH_STORAGE_KEY, next);
  } catch {
    /* ignore */
  }
  setDashboardWidthCssVar(next);
  window.dispatchEvent(new CustomEvent(DASHBOARD_WIDTH_EVENT, { detail: next }));
}

export function clampWidthPx(px: number): number {
  if (!Number.isFinite(px)) return MIN_DASHBOARD_WIDTH_PX;
  return Math.min(MAX_DASHBOARD_WIDTH_PX, Math.max(MIN_DASHBOARD_WIDTH_PX, Math.round(px)));
}

/** Best-effort numeric resolution of the current width for nudging/dragging. */
export function resolveDashboardWidthPx(value: string): number | null {
  const v = value.trim();
  if (v === "100%") return null;
  const remMatch = /^(\d+(?:\.\d+)?)rem$/.exec(v);
  if (remMatch && typeof document !== "undefined") {
    const root = document.documentElement;
    const fontSize = parseFloat(getComputedStyle(root).fontSize || "16") || 16;
    return Math.round(parseFloat(remMatch[1]!) * fontSize);
  }
  const pxMatch = /^(\d+(?:\.\d+)?)px$/.exec(v);
  if (pxMatch) return Math.round(parseFloat(pxMatch[1]!));
  return null;
}

export function findPresetByValue(value: string): DashboardWidthPreset | null {
  return DASHBOARD_WIDTH_PRESETS.find((p) => p.value === value) ?? null;
}
