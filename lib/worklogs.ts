import type { Store, Worklog, WorklogTarget } from "@/lib/schemas";
import {
  buildWorklogEntityMaps,
  resolveWorklogOwnerGroupKey,
  resolveWorklogTargetDisplay,
  type WorklogEntityMaps,
} from "@/lib/worklogTargetDisplay";

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
  /** Resolved owner group keys (see `resolveWorklogOwnerGroupKey`), OR semantics within the array. */
  ownerIds?: readonly string[] | null;
  /** Resolved project ids; use `"__none__"` for entries with no project. OR semantics within the array. */
  projectIds?: readonly string[] | null;
  /** `Worklog["target"]["kind"]` values. OR semantics within the array. */
  kinds?: readonly string[] | null;
  /** Case-insensitive substring match on key, comment, snapshot fields, and resolved target labels. */
  search?: string | null;
};

export type WorklogUiFilters = {
  ownerIds?: readonly string[] | null;
  projectIds?: readonly string[] | null;
  kinds?: readonly string[] | null;
};

export function worklogMatchesUiFilters(w: Worklog, maps: WorklogEntityMaps, f: WorklogUiFilters): boolean {
  const t = w.target;
  if (f.ownerIds?.length) {
    if (!f.ownerIds.includes(resolveWorklogOwnerGroupKey(w, maps))) return false;
  }
  if (f.projectIds?.length) {
    const r = resolveWorklogTargetDisplay(w, maps);
    const pid = r.projectId ?? "__none__";
    if (!f.projectIds.includes(pid)) return false;
  }
  if (f.kinds?.length) {
    if (!f.kinds.includes(t.kind)) return false;
  }
  return true;
}

export function filterWorklogs(store: Store, f: WorklogListFilters): Worklog[] {
  const { from, to } = f;
  const fromD = from?.trim().slice(0, 10) ?? "";
  const toD = to?.trim().slice(0, 10) ?? "";
  const maps = buildWorklogEntityMaps(
    store.tasks,
    store.taskGroups,
    store.ownerEntries,
    store.projects,
    store.owners,
  );
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
    if (!worklogMatchesUiFilters(w, maps, f)) return false;
    const sq = f.search?.trim();
    if (sq) {
      const ql = sq.toLowerCase();
      const r = resolveWorklogTargetDisplay(w, maps);
      const parts = [
        w.key,
        w.comment ?? "",
        w.targetEntryKey ?? "",
        w.targetEntryName ?? "",
        r.publicId,
        r.entryName,
      ];
      if (!parts.some((p) => p.toLowerCase().includes(ql))) return false;
    }
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
