"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const MIN_W = 56;
const MAX_W = 720;

function clamp(n: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, n));
}

/**
 * Persisted pixel widths for `table-layout: fixed` dashboards. Keys are stable column ids
 * (e.g. `__lead`, `name`, `__actions`). Drag the handle on a header cell’s right edge.
 */
export function useTableColumnWidths(
  storageKey: string,
  columnKeys: readonly string[],
  defaultWidth: (key: string) => number,
) {
  const [map, setMap] = useState<Record<string, number>>({});
  const dragRef = useRef<{ key: string; startX: number; startW: number } | null>(null);
  const loadedKey = useRef<string | null>(null);

  useEffect(() => {
    if (loadedKey.current === storageKey) return;
    loadedKey.current = storageKey;
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return;
      const o = JSON.parse(raw) as Record<string, unknown>;
      const next: Record<string, number> = {};
      for (const [k, v] of Object.entries(o)) {
        if (typeof v === "number" && Number.isFinite(v)) next[k] = clamp(v, MIN_W, MAX_W);
      }
      if (Object.keys(next).length) setMap(next);
    } catch {
      /* ignore */
    }
  }, [storageKey]);

  useEffect(() => {
    try {
      const subset: Record<string, number> = {};
      for (const k of columnKeys) {
        if (map[k] != null) subset[k] = map[k]!;
      }
      if (Object.keys(subset).length) localStorage.setItem(storageKey, JSON.stringify(subset));
    } catch {
      /* ignore */
    }
  }, [storageKey, columnKeys, map]);

  const px = useCallback(
    (key: string) => clamp(map[key] ?? defaultWidth(key), MIN_W, MAX_W),
    [map, defaultWidth],
  );

  const startResize = useCallback(
    (key: string, clientX: number) => {
      if (key === "__lead") return;
      const startW = px(key);
      dragRef.current = { key, startX: clientX, startW };
      const onMove = (ev: MouseEvent) => {
        const d = dragRef.current;
        if (!d) return;
        const dx = ev.clientX - d.startX;
        setMap((m) => ({
          ...m,
          [d.key]: clamp(d.startW + dx, MIN_W, MAX_W),
        }));
      };
      const onUp = () => {
        dragRef.current = null;
        document.removeEventListener("mousemove", onMove);
        document.removeEventListener("mouseup", onUp);
      };
      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup", onUp);
    },
    [px],
  );

  const ColGroup = useCallback(() => {
    return (
      <colgroup>
        {columnKeys.map((k) => (
          <col
            key={k}
            style={{
              width: px(k),
              minWidth: k === "__lead" ? 52 : MIN_W,
            }}
          />
        ))}
      </colgroup>
    );
  }, [columnKeys, px]);

  return { ColGroup, px, startResize };
}

export function TableColumnResizeHandle({
  columnKey,
  disabled,
  onStart,
}: {
  columnKey: string;
  disabled?: boolean;
  onStart: (key: string, clientX: number) => void;
}) {
  if (disabled) return null;
  return (
    <span
      role="separator"
      aria-orientation="vertical"
      title="Drag to resize column"
      className="absolute right-0 top-0 z-10 h-full w-1.5 cursor-col-resize select-none hover:bg-blue-500/20 dark:hover:bg-blue-400/20"
      onMouseDown={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onStart(columnKey, e.clientX);
      }}
    />
  );
}
