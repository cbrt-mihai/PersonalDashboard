import type { StatusDef } from "@/lib/statusConfig";
import {
  isTerminalStatus,
  normalizeStatusKey,
  statusDef,
} from "@/lib/statusConfig";

type TaskLike = { status: string };

function statusSegments(
  tasks: TaskLike[],
  statusMap: Record<string, StatusDef>,
): { statusKey: string; count: number; color: string; label: string; order: number }[] {
  const counts = new Map<string, number>();
  for (const t of tasks) {
    const k = normalizeStatusKey(t.status);
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([statusKey, count]) => {
      const def = statusDef(statusKey, statusMap);
      return {
        statusKey,
        count,
        color: def.color,
        label: def.label,
        order: def.order,
      };
    })
    .sort((a, b) => a.order - b.order || a.label.localeCompare(b.label));
}

export function ProgressBar({
  tasks,
  statusMap,
}: {
  tasks: TaskLike[];
  statusMap: Record<string, StatusDef>;
}) {
  const total = tasks.length;
  const done = tasks.filter((t) => isTerminalStatus(t.status, statusMap)).length;
  const pct = total <= 0 ? 0 : Math.round((done / total) * 100);

  if (total === 0) {
    return (
      <div className="flex min-w-[120px] flex-col gap-1">
        <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-700" />
        <span className="text-xs tabular-nums text-zinc-500 dark:text-zinc-400">
          No tasks
        </span>
      </div>
    );
  }

  const segments = statusSegments(tasks, statusMap);

  return (
    <div className="flex min-w-[120px] flex-col gap-1">
      <div
        className="flex h-2 w-full overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-700"
        role="img"
        aria-label={segments
          .map((s) => `${s.label}: ${s.count}`)
          .join(", ")}
      >
        {segments.map(({ statusKey, count, color, label }) => (
          <div
            key={statusKey}
            className="h-full min-w-0 transition-all"
            style={{
              flexGrow: count,
              flexBasis: 0,
              backgroundColor: color,
            }}
            title={`${label}: ${count}`}
          />
        ))}
      </div>
      <span className="text-xs tabular-nums text-zinc-500 dark:text-zinc-400">
        {done} / {total} done ({pct}%)
      </span>
    </div>
  );
}
