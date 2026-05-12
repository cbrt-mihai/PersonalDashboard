"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";
import {
  applyDashboardTheme,
  DASHBOARD_THEME_STORAGE_KEY,
  type ThemeMode,
  readStoredTheme,
} from "@/lib/themeStorage";
import {
  DASHBOARD_THEME_NAV_TOGGLE_KEY,
  type ThemeNavToggleVariant,
  readStoredThemeNavToggle,
} from "@/lib/themeNavToggleStorage";

type ThemeContextValue = {
  theme: ThemeMode;
  setTheme: (t: ThemeMode) => void;
  /** Resolved after paint (for code blocks, etc.). */
  resolvedDark: boolean;
  themeNavToggle: ThemeNavToggleVariant;
  setThemeNavToggle: (v: ThemeNavToggleVariant) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

function subscribeToThemeResolved(onChange: () => void) {
  if (typeof window === "undefined") return () => {};
  const on = () => onChange();
  window.addEventListener("dashboard-theme", on);
  const mq = window.matchMedia("(prefers-color-scheme: dark)");
  mq.addEventListener("change", on);
  return () => {
    window.removeEventListener("dashboard-theme", on);
    mq.removeEventListener("change", on);
  };
}

function getResolvedDarkSnapshot() {
  if (typeof document === "undefined") return false;
  return document.documentElement.classList.contains("dark");
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<ThemeMode>("system");
  // IMPORTANT: keep server + client initial render identical.
  // We'll hydrate to the stored value after mount.
  const [themeNavToggle, setThemeNavToggleState] =
    useState<ThemeNavToggleVariant>("classic");

  useEffect(() => {
    queueMicrotask(() => {
      const t = readStoredTheme();
      setThemeState(t);
      applyDashboardTheme(t);
    });
  }, []);

  useEffect(() => {
    queueMicrotask(() => {
      setThemeNavToggleState(readStoredThemeNavToggle());
    });
  }, []);

  const setTheme = useCallback((t: ThemeMode) => {
    setThemeState(t);
    try {
      localStorage.setItem(DASHBOARD_THEME_STORAGE_KEY, t);
    } catch {
      /* ignore */
    }
    applyDashboardTheme(t);
  }, []);

  const setThemeNavToggle = useCallback((v: ThemeNavToggleVariant) => {
    setThemeNavToggleState(v);
    try {
      localStorage.setItem(DASHBOARD_THEME_NAV_TOGGLE_KEY, v);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    if (theme !== "system") return;
    applyDashboardTheme("system");
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => applyDashboardTheme("system");
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [theme]);

  const resolvedDark = useSyncExternalStore(
    subscribeToThemeResolved,
    getResolvedDarkSnapshot,
    () => false,
  );

  const value = useMemo(
    () => ({ theme, setTheme, resolvedDark, themeNavToggle, setThemeNavToggle }),
    [theme, setTheme, resolvedDark, themeNavToggle, setThemeNavToggle],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return ctx;
}
