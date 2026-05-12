export const DASHBOARD_THEME_NAV_TOGGLE_KEY = "dashboard-theme-nav-toggle";

export type ThemeNavToggleVariant = "classic" | "scenic";

export function readStoredThemeNavToggle(): ThemeNavToggleVariant {
  if (typeof window === "undefined") return "classic";
  const v = localStorage.getItem(DASHBOARD_THEME_NAV_TOGGLE_KEY);
  if (v === "scenic") return "scenic";
  return "classic";
}

export function isThemeNavToggleVariant(v: unknown): v is ThemeNavToggleVariant {
  return v === "classic" || v === "scenic";
}
