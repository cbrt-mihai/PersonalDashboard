"use client";

type Props = {
  page: number;
  pageCount: number;
  total: number;
  pageSize: number;
  onPageChange: (next: number) => void;
  className?: string;
};

export function DashboardPager({
  page,
  pageCount,
  total,
  pageSize,
  onPageChange,
  className = "",
}: Props) {
  if (pageCount <= 1 || total === 0) return null;
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);
  return (
    <div
      className={`flex flex-wrap items-center justify-between gap-3 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm dark:border-zinc-800 dark:bg-zinc-900/50 ${className}`}
    >
      <span className="text-zinc-600 dark:text-zinc-400">
        Page {page} of {pageCount} ({from}–{to} of {total})
      </span>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-40 dark:border-zinc-600"
        >
          Previous
        </button>
        <button
          type="button"
          disabled={page >= pageCount}
          onClick={() => onPageChange(page + 1)}
          className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-40 dark:border-zinc-600"
        >
          Next
        </button>
      </div>
    </div>
  );
}

/** Slice for 1-based page. */
export function paginateLocal<T>(items: T[], page: number, pageSize: number): T[] {
  const p = Math.max(1, Math.floor(page));
  const ps = Math.max(1, Math.floor(pageSize));
  const start = (p - 1) * ps;
  return items.slice(start, start + ps);
}

export const DASHBOARD_PAGE_SIZE = 50;
