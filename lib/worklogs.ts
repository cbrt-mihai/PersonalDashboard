import type { Store, Worklog, WorklogTarget } from "@/lib/schemas";

const YMD = /^\d{4}-\d{2}-\d{2}$/;

function startedDate(w: Worklog): string {
  return w.startedAt.trim().slice(0, 10);
}

export function worklogMatchesTarget(w: Worklog, target: WorklogTarget): boolean {
  if (w.target.kind !== target.kind) return false;
  switch (w.target.kind) {
    case "task":
      return target.kind === "task" && w.target.taskId === target.taskId;
    case "epic":
      return target.kind === "epic" && w.target.groupId === target.groupId;
    case "note":
      return target.kind === "note" && w.target.entryId === target.entryId;
    case "project":
      return target.kind === "project" && w.target.projectId === target.projectId;
    case "owner":
      return target.kind === "owner" && w.target.ownerId === target.ownerId;
    default:
      return false;
  }
}

export type WorklogListFilters = {
  taskId?: string | null;
  groupId?: string | null;
  entryId?: string | null;
  projectId?: string | null;
  ownerId?: string | null;
  from?: string | null;
  to?: string | null;
};

export function filterWorklogs(store: Store, f: WorklogListFilters): Worklog[] {
  const { from, to } = f;
  const fromD = from?.trim().slice(0, 10) ?? "";
  const toD = to?.trim().slice(0, 10) ?? "";
  return store.worklogs.filter((w) => {
    const t = w.target;
    if (f.taskId && (t.kind !== "task" || t.taskId !== f.taskId)) return false;
    if (f.groupId && (t.kind !== "epic" || t.groupId !== f.groupId)) return false;
    if (f.entryId && (t.kind !== "note" || t.entryId !== f.entryId)) return false;
    if (f.projectId && (t.kind !== "project" || t.projectId !== f.projectId)) return false;
    if (f.ownerId && (t.kind !== "owner" || t.ownerId !== f.ownerId)) return false;
    const d = startedDate(w);
    if (fromD && YMD.test(fromD) && d < fromD) return false;
    if (toD && YMD.test(toD) && d > toD) return false;
    return true;
  });
}

export type WorklogAggregate = {
  totalMinutes: number;
  entryCount: number;
  firstStartedAt: string | null;
  lastStartedAt: string | null;
};

export function aggregateWorklogsForTarget(
  allLogs: Worklog[],
  target: WorklogTarget,
  range?: { from?: string | null; to?: string | null },
): WorklogAggregate {
  let scoped = allLogs.filter((w) => worklogMatchesTarget(w, target));
  const fromD = range?.from?.trim().slice(0, 10) ?? "";
  const toD = range?.to?.trim().slice(0, 10) ?? "";
  if (fromD && YMD.test(fromD)) scoped = scoped.filter((w) => startedDate(w) >= fromD);
  if (toD && YMD.test(toD)) scoped = scoped.filter((w) => startedDate(w) <= toD);
  let totalMinutes = 0;
  let first: string | null = null;
  let last: string | null = null;
  for (const w of scoped) {
    totalMinutes += w.durationMinutes;
    const s = w.startedAt;
    if (!first || s < first) first = s;
    if (!last || s > last) last = s;
  }
  return {
    totalMinutes,
    entryCount: scoped.length,
    firstStartedAt: first,
    lastStartedAt: last,
  };
}
