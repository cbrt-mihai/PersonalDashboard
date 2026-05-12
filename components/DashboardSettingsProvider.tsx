"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { DashboardSettings } from "@/lib/schemas";
import {
  STATUS_MAP,
  buildStatusMapFromRows,
  taskStatusKeysFromMap,
  type StatusDef,
} from "@/lib/statusConfig";

type DashboardConfigContextValue = {
  settings: DashboardSettings | null;
  statusMap: Record<string, StatusDef>;
  statusKeys: string[];
  noteStatusMap: Record<string, StatusDef>;
  noteStatusKeys: string[];
  loading: boolean;
  reload: () => Promise<void>;
};

const DashboardConfigContext = createContext<DashboardConfigContextValue | null>(
  null,
);

export function DashboardSettingsProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [settings, setSettings] = useState<DashboardSettings | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/settings");
      if (!r.ok) throw new Error("settings");
      const data: DashboardSettings = await r.json();
      setSettings(data);
    } catch {
      setSettings(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    queueMicrotask(() => {
      void load();
    });
  }, [load]);

  const statusMap = useMemo(
    () => (settings ? buildStatusMapFromRows(settings.taskStatuses) : STATUS_MAP),
    [settings],
  );
  const statusKeys = useMemo(() => taskStatusKeysFromMap(statusMap), [statusMap]);

  const noteStatusMap = useMemo(
    () => (settings ? buildStatusMapFromRows(settings.noteStatuses) : STATUS_MAP),
    [settings],
  );
  const noteStatusKeys = useMemo(() => taskStatusKeysFromMap(noteStatusMap), [noteStatusMap]);

  const value = useMemo(
    () => ({
      settings,
      statusMap,
      statusKeys,
      noteStatusMap,
      noteStatusKeys,
      loading,
      reload: load,
    }),
    [settings, statusMap, statusKeys, noteStatusMap, noteStatusKeys, loading, load],
  );

  return (
    <DashboardConfigContext.Provider value={value}>
      {children}
    </DashboardConfigContext.Provider>
  );
}

export function useDashboardConfig(): DashboardConfigContextValue {
  const ctx = useContext(DashboardConfigContext);
  if (!ctx) {
    return {
      settings: null,
      statusMap: STATUS_MAP,
      statusKeys: taskStatusKeysFromMap(STATUS_MAP),
      noteStatusMap: STATUS_MAP,
      noteStatusKeys: taskStatusKeysFromMap(STATUS_MAP),
      loading: false,
      reload: async () => {},
    };
  }
  return ctx;
}
