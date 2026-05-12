"use client";

import type { ReactNode } from "react";

function Chevron({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="currentColor"
      className={className}
      aria-hidden
    >
      <path
        fillRule="evenodd"
        d="M5.23 7.21a.75.75 0 0 1 1.06.02L10 11.168l3.71-3.937a.75.75 0 1 1 1.08 1.04l-4.25 4.51a.75.75 0 0 1-1.08 0l-4.25-4.51a.75.75 0 0 1 .02-1.06Z"
        clipRule="evenodd"
      />
    </svg>
  );
}

/**
 * Collapsible block for detail pages — use for lists and secondary content, not overview
 * or core field grids (status, tags, description body, etc.).
 */
export function DetailCollapsibleSection({
  title,
  children,
  defaultOpen = true,
  titleClassName = "text-lg font-semibold text-zinc-900 dark:text-zinc-50",
  className = "",
}: {
  title: string;
  children: ReactNode;
  /** When false, section starts collapsed. */
  defaultOpen?: boolean;
  titleClassName?: string;
  className?: string;
}) {
  return (
    <details
      open={defaultOpen}
      className={`group rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950 ${className}`}
    >
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 marker:hidden hover:bg-zinc-50/80 [&::-webkit-details-marker]:hidden dark:hover:bg-zinc-900/40">
        <h2 className={titleClassName}>{title}</h2>
        <Chevron className="h-5 w-5 shrink-0 text-zinc-500 transition-transform group-open:rotate-180 dark:text-zinc-400" />
      </summary>
      <div className="border-t border-zinc-200 px-4 pb-4 pt-3 dark:border-zinc-800">{children}</div>
    </details>
  );
}
