"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useSyncExternalStore,
} from "react";
import {
  DASHBOARD_WIDTH_EVENT,
  DEFAULT_DASHBOARD_WIDTH,
  applyDashboardWidth,
  readStoredDashboardWidth,
  setDashboardWidthCssVar,
} from "@/lib/dashboardWidthStorage";

type DashboardWidthContextValue = {
  width: string;
  setWidth: (value: string) => void;
  resetWidth: () => void;
};

const DashboardWidthContext = createContext<DashboardWidthContextValue | null>(
  null,
);

function subscribe(onChange: () => void) {
  if (typeof window === "undefined") return () => {};
  const handler = () => onChange();
  window.addEventListener(DASHBOARD_WIDTH_EVENT, handler);
  window.addEventListener("storage", handler);
  return () => {
    window.removeEventListener(DASHBOARD_WIDTH_EVENT, handler);
    window.removeEventListener("storage", handler);
  };
}

function getSnapshot(): string {
  return readStoredDashboardWidth();
}

function getServerSnapshot(): string {
  return DEFAULT_DASHBOARD_WIDTH;
}

export function DashboardWidthProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const width = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  // Re-apply on mount in case the inline init script was skipped or stripped.
  useEffect(() => {
    setDashboardWidthCssVar(readStoredDashboardWidth());
  }, []);

  const setWidth = useCallback((value: string) => {
    applyDashboardWidth(value);
  }, []);

  const resetWidth = useCallback(() => {
    applyDashboardWidth(DEFAULT_DASHBOARD_WIDTH);
  }, []);

  const value = useMemo(
    () => ({ width, setWidth, resetWidth }),
    [width, setWidth, resetWidth],
  );

  return (
    <DashboardWidthContext.Provider value={value}>
      {children}
    </DashboardWidthContext.Provider>
  );
}

export function useDashboardWidth(): DashboardWidthContextValue {
  const ctx = useContext(DashboardWidthContext);
  if (ctx) return ctx;
  return {
    width: DEFAULT_DASHBOARD_WIDTH,
    setWidth: () => {},
    resetWidth: () => {},
  };
}
