"use client";

import type { ReactNode } from "react";
import { useI18n } from "@/components/LocaleProvider";

type Props = {
  /** Summary line when the block is collapsed or expanded. */
  title?: string;
  /** Optional class on the outer `<details>` element. */
  className?: string;
  /** Optional class on the `<summary>` element. */
  summaryClassName?: string;
  children: ReactNode;
};

/**
 * Collapsible region for dashboard search/filter grids (native `<details>`).
 */
export function DashboardFilterDisclosure({
  title,
  className = "",
  summaryClassName = "",
  children,
}: Props) {
  const { t } = useI18n();
  const resolvedTitle = title ?? t("common.searchFilters");

  return (
    <details
      className={`group rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950 ${className}`}
    >
      <summary
        className={`cursor-pointer list-none px-4 py-3 text-sm font-medium text-zinc-800 marker:hidden select-none dark:text-zinc-100 [&::-webkit-details-marker]:hidden ${summaryClassName}`}
      >
        <span className="inline-flex items-center gap-2">
          <span
            className="inline-block text-zinc-400 transition-transform duration-200 group-open:rotate-90 dark:text-zinc-500"
            aria-hidden
          >
            ▸
          </span>
          {resolvedTitle}
        </span>
      </summary>
      <div className="border-t border-zinc-100 px-4 pb-4 pt-3 dark:border-zinc-800">{children}</div>
    </details>
  );
}
