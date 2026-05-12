/** Named owner swatches (Settings + owner forms). */
export const NAMED_OWNER_COLOR_PRESETS = [
  { name: "Indigo", color: "#6366f1" },
  { name: "Violet", color: "#8b5cf6" },
  { name: "Pink", color: "#ec4899" },
  { name: "Orange", color: "#f97316" },
  { name: "Amber", color: "#eab308" },
  { name: "Green", color: "#22c55e" },
  { name: "Teal", color: "#14b8a6" },
  { name: "Sky", color: "#0ea5e9" },
  { name: "Slate", color: "#64748b" },
] as const;

/** Hex colors only (legacy helpers). */
export const PRESET_OWNER_COLORS = NAMED_OWNER_COLOR_PRESETS.map((p) => p.color);

/** Task status text / accent color swatches (#RGB / #RRGGBB). */
export const STATUS_TEXT_COLOR_SWATCHES = [
  "#64748b",
  "#737373",
  "#525252",
  "#2563eb",
  "#6366f1",
  "#7c3aed",
  "#a855f7",
  "#ec4899",
  "#f97316",
  "#ca8a04",
  "#16a34a",
  "#15803d",
  "#0d9488",
  "#0ea5e9",
  "#dc2626",
  "#b91c1c",
] as const;

/** Task status badge background tints (CSS color strings). */
export const STATUS_BG_SWATCHES = [
  "rgba(100,116,139,0.15)",
  "rgba(115,115,115,0.12)",
  "rgba(82,82,82,0.12)",
  "rgba(37,99,235,0.12)",
  "rgba(99,102,241,0.12)",
  "rgba(124,58,237,0.12)",
  "rgba(168,85,247,0.12)",
  "rgba(236,72,153,0.12)",
  "rgba(249,115,22,0.12)",
  "rgba(202,138,4,0.14)",
  "rgba(22,163,74,0.12)",
  "rgba(21,128,61,0.12)",
  "rgba(13,148,136,0.12)",
  "rgba(14,165,233,0.12)",
  "rgba(220,38,38,0.12)",
  "rgba(185,28,28,0.12)",
] as const;

const HEX = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

/** Migrate legacy `string[]` presets and coerce invalid rows for Zod. */
export function normalizeOwnerColorPresetsForParse(input: unknown): unknown {
  if (!Array.isArray(input)) return input;
  const named = NAMED_OWNER_COLOR_PRESETS as readonly { name: string; color: string }[];
  return input.map((entry, i) => {
    if (typeof entry === "string") {
      const color = entry.trim();
      if (HEX.test(color)) {
        const hit = named.find((p) => p.color.toLowerCase() === color.toLowerCase());
        return hit ? { name: hit.name, color: hit.color } : { name: `Swatch ${i + 1}`, color };
      }
      return { name: `Swatch ${i + 1}`, color: "#64748b" };
    }
    if (entry && typeof entry === "object" && "color" in entry) {
      let color = String((entry as { color: unknown }).color).trim();
      if (!HEX.test(color)) color = "#64748b";
      const rawName = (entry as { name?: unknown }).name;
      const name =
        typeof rawName === "string" && rawName.trim()
          ? rawName.trim().slice(0, 80)
          : `Swatch ${i + 1}`;
      return { name, color };
    }
    return { name: `Swatch ${i + 1}`, color: "#64748b" };
  });
}
