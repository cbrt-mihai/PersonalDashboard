"use client";

/** Thin checklist completion bar for tasks that have sub-tasks. */
export function SubtaskProgressBar({
  done,
  total,
  className = "",
  label = "Checklist",
}: {
  done: number;
  total: number;
  className?: string;
  /** Shown in the caption, e.g. "Checklist" or "Sub-tasks". */
  label?: string;
}) {
  if (total <= 0) return null;
  const pct = Math.round((done / total) * 100);
  return (
    <div
      className={`flex min-w-0 flex-col gap-0.5 ${className}`}
      role="group"
      aria-label={`${label}: ${done} of ${total} complete`}
    >
      <div className="h-1.5 w-full max-w-[14rem] overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-700">
        <div
          className="h-full min-w-0 rounded-full bg-emerald-500 transition-[width] duration-200 dark:bg-emerald-400"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-[10px] tabular-nums leading-tight text-zinc-500 dark:text-zinc-400">
        {label} {done}/{total} ({pct}%)
      </span>
    </div>
  );
}
