"use client";

import { useCallback, useLayoutEffect, useRef, useState, type ReactNode } from "react";

type Props = {
  children: ReactNode;
  /** Native tooltip only when clamped; not used when `suppressTitle` is true. */
  fullTitle?: string;
  /** Summary / description columns: clamp only, no hover title. */
  suppressTitle?: boolean;
  className?: string;
};

export function TableClampCell({
  children,
  fullTitle,
  suppressTitle = false,
  className = "",
}: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [title, setTitle] = useState<string | undefined>(undefined);

  const measure = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    if (suppressTitle) {
      setTitle(undefined);
      return;
    }
    const t = fullTitle?.trim();
    if (!t) {
      setTitle(undefined);
      return;
    }
    const clamped = el.scrollHeight > el.clientHeight + 1;
    setTitle(clamped ? t : undefined);
  }, [fullTitle, suppressTitle]);

  useLayoutEffect(() => {
    measure();
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => measure());
    ro.observe(el);
    return () => ro.disconnect();
  }, [measure]);

  useLayoutEffect(() => {
    const id = requestAnimationFrame(() => measure());
    return () => cancelAnimationFrame(id);
  }, [measure, fullTitle]);

  const outer = `flex w-full min-h-[2lh] items-center text-sm leading-normal ${className}`.trim();
  return (
    <div className={outer}>
      <div
        ref={ref}
        className="min-w-0 w-full overflow-hidden text-start pd-clamp-2 break-words leading-normal"
        title={title}
      >
        {children}
      </div>
    </div>
  );
}

/** Same vertical slot as `TableClampCell` for badges, selects, and plain values. */
export function TableCellSlot({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`flex w-full min-h-[2lh] items-center gap-2 text-sm leading-normal ${className}`.trim()}
    >
      {children}
    </div>
  );
}
