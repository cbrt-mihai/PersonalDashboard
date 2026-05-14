"use client";

import { useCallback, useRef } from "react";
import { useI18n } from "@/components/LocaleProvider";
import { useDashboardWidth } from "@/components/DashboardWidthProvider";
import {
  DEFAULT_DASHBOARD_WIDTH,
  MAX_DASHBOARD_WIDTH_PX,
  MIN_DASHBOARD_WIDTH_PX,
  applyDashboardWidth,
  clampWidthPx,
  resolveDashboardWidthPx,
  setDashboardWidthCssVar,
} from "@/lib/dashboardWidthStorage";

type DashboardShellProps = {
  children: React.ReactNode;
  /** Render the wrapper as `<main>` (default) or `<div>` (e.g. audit page). */
  as?: "main" | "div";
  /** Extra classes appended to the default container classes. */
  className?: string;
};

const KEY_NUDGE_PX = 16;

function widthFromPointerX(pointerX: number, viewportWidth: number): string {
  const center = viewportWidth / 2;
  const half = Math.abs(pointerX - center);
  const newPx = Math.round(half * 2);
  if (newPx >= viewportWidth - 8) return "100%";
  return `${clampWidthPx(newPx)}px`;
}

export function DashboardShell({
  children,
  as = "main",
  className,
}: DashboardShellProps) {
  const Tag = as;
  const { t } = useI18n();
  const { width, setWidth } = useDashboardWidth();
  const handleRef = useRef<HTMLButtonElement | null>(null);
  const draggingRef = useRef(false);
  const lastWidthRef = useRef<string>(width);

  const onPointerDown = useCallback((e: React.PointerEvent<HTMLButtonElement>) => {
    if (e.button !== 0) return;
    e.preventDefault();
    const handle = handleRef.current;
    if (!handle) return;
    handle.setPointerCapture(e.pointerId);
    draggingRef.current = true;
    document.body.style.cursor = "ew-resize";
    document.body.style.userSelect = "none";
  }, []);

  const onPointerMove = useCallback((e: React.PointerEvent<HTMLButtonElement>) => {
    if (!draggingRef.current) return;
    const next = widthFromPointerX(e.clientX, window.innerWidth);
    lastWidthRef.current = next;
    setDashboardWidthCssVar(next);
  }, []);

  const finishDrag = useCallback(
    (e: React.PointerEvent<HTMLButtonElement>) => {
      if (!draggingRef.current) return;
      draggingRef.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      const handle = handleRef.current;
      if (handle && handle.hasPointerCapture(e.pointerId)) {
        handle.releasePointerCapture(e.pointerId);
      }
      applyDashboardWidth(lastWidthRef.current);
    },
    [],
  );

  const onDoubleClick = useCallback(() => {
    setWidth(DEFAULT_DASHBOARD_WIDTH);
  }, [setWidth]);

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLButtonElement>) => {
      const isLeft = e.key === "ArrowLeft";
      const isRight = e.key === "ArrowRight";
      if (!isLeft && !isRight) {
        if (e.key === "Home") {
          e.preventDefault();
          setWidth(`${MIN_DASHBOARD_WIDTH_PX}px`);
        } else if (e.key === "End") {
          e.preventDefault();
          setWidth("100%");
        } else if (e.key === "Escape") {
          e.preventDefault();
          setWidth(DEFAULT_DASHBOARD_WIDTH);
        }
        return;
      }
      e.preventDefault();
      const step = (e.shiftKey ? 4 : 1) * KEY_NUDGE_PX;
      const currentPx =
        resolveDashboardWidthPx(width) ??
        (typeof window !== "undefined" ? window.innerWidth : MAX_DASHBOARD_WIDTH_PX);
      const nextPx = clampWidthPx(currentPx + (isRight ? step : -step));
      setWidth(`${nextPx}px`);
    },
    [width, setWidth],
  );

  const wrapperClass = [
    "relative mx-auto w-full flex-1 px-4 py-8",
    className ?? "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <Tag className={wrapperClass} style={{ maxWidth: "var(--dashboard-w, 96rem)" }}>
      {children}
      <button
        ref={handleRef}
        type="button"
        aria-label={t("dashboardShell.resizeHandle")}
        title={t("dashboardShell.resizeHandle")}
        role="separator"
        aria-orientation="vertical"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={finishDrag}
        onPointerCancel={finishDrag}
        onDoubleClick={onDoubleClick}
        onKeyDown={onKeyDown}
        className="absolute right-0 top-0 hidden h-full w-2 cursor-ew-resize touch-none select-none bg-transparent transition-colors hover:bg-blue-500/30 focus-visible:bg-blue-500/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/70 sm:block"
      />
    </Tag>
  );
}
