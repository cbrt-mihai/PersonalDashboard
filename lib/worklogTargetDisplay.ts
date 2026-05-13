import type {
  Owner,
  OwnerEntry,
  Project,
  Store,
  Task,
  TaskGroup,
  Worklog,
  WorklogTarget,
} from "@/lib/schemas";

export type ResolvedWorklogTarget = {
  kind: Worklog["target"]["kind"];
  href: string;
  /** Public key / id label (task key, note key, project key, etc.). */
  publicId: string;
  /** Human-readable name (task name, note title, …). */
  entryName: string;
  /** Target row no longer exists; prefer snapshot for labels. */
  deleted: boolean;
  ownerId: string | null;
  projectId: string | null;
  taskType?: string;
};

function shortId(uuid: string): string {
  if (uuid.length <= 13) return uuid;
  return `${uuid.slice(0, 8)}…`;
}

export function buildWorklogEntityMaps(
  tasks: Task[],
  groups: TaskGroup[],
  entries: OwnerEntry[],
  projects: Project[],
  owners: Owner[],
) {
  return {
    taskById: new Map(tasks.map((t) => [t.id, t] as const)),
    groupById: new Map(groups.map((g) => [g.id, g] as const)),
    entryById: new Map(entries.map((e) => [e.id, e] as const)),
    projectById: new Map(projects.map((p) => [p.id, p] as const)),
    ownerById: new Map(owners.map((o) => [o.id, o] as const)),
  };
}

export type WorklogEntityMaps = ReturnType<typeof buildWorklogEntityMaps>;

export function resolveWorklogTargetDisplay(w: Worklog, maps: WorklogEntityMaps): ResolvedWorklogTarget {
  const snapKey = w.targetEntryKey;
  const snapName = w.targetEntryName;
  const t = w.target;

  if (t.kind === "task") {
    const task = maps.taskById.get(t.taskId);
    if (task) {
      const group = task.groupId ? maps.groupById.get(task.groupId) : undefined;
      const projectId = group?.projectId ?? null;
      return {
        kind: "task",
        href: `/tasks/${task.id}`,
        publicId: task.key,
        entryName: task.name,
        deleted: false,
        ownerId: task.ownerId,
        projectId,
        taskType: task.type,
      };
    }
    return {
      kind: "task",
      href: `/tasks/${t.taskId}`,
      publicId: snapKey ?? shortId(t.taskId),
      entryName: snapName ?? "Task (removed)",
      deleted: true,
      ownerId: null,
      projectId: null,
      taskType: undefined,
    };
  }

  if (t.kind === "epic") {
    const g = maps.groupById.get(t.groupId);
    if (g) {
      return {
        kind: "epic",
        href: `/epics/${g.id}`,
        publicId: g.key,
        entryName: g.name,
        deleted: false,
        ownerId: g.ownerId,
        projectId: g.projectId,
      };
    }
    return {
      kind: "epic",
      href: `/epics/${t.groupId}`,
      publicId: snapKey ?? shortId(t.groupId),
      entryName: snapName ?? "Epic (removed)",
      deleted: true,
      ownerId: null,
      projectId: null,
    };
  }

  if (t.kind === "note") {
    const e = maps.entryById.get(t.entryId);
    if (e) {
      return {
        kind: "note",
        href: `/notes/${e.id}`,
        publicId: e.key,
        entryName: e.title,
        deleted: false,
        ownerId: e.ownerId,
        projectId: e.projectId,
      };
    }
    return {
      kind: "note",
      href: `/notes/${t.entryId}`,
      publicId: snapKey ?? shortId(t.entryId),
      entryName: snapName ?? "Note (removed)",
      deleted: true,
      ownerId: null,
      projectId: null,
    };
  }

  if (t.kind === "project") {
    const p = maps.projectById.get(t.projectId);
    if (p) {
      return {
        kind: "project",
        href: `/projects/${p.id}`,
        publicId: p.key,
        entryName: p.name,
        deleted: false,
        ownerId: null,
        projectId: p.id,
      };
    }
    return {
      kind: "project",
      href: `/projects/${t.projectId}`,
      publicId: snapKey ?? shortId(t.projectId),
      entryName: snapName ?? "Project (removed)",
      deleted: true,
      ownerId: null,
      projectId: null,
    };
  }

  if (t.kind === "owner") {
    const o = maps.ownerById.get(t.ownerId);
    if (o) {
      return {
        kind: "owner",
        href: `/owners/${o.id}`,
        publicId: o.key,
        entryName: o.name,
        deleted: false,
        ownerId: o.id,
        projectId: null,
      };
    }
    return {
      kind: "owner",
      href: `/owners/${t.ownerId}`,
      publicId: snapKey ?? shortId(t.ownerId),
      entryName: snapName ?? "Owner (removed)",
      deleted: true,
      ownerId: null,
      projectId: null,
    };
  }

  const _exhaust: never = t;
  return _exhaust;
}

/** Persisted on new worklogs so list/table can still show “PublicID - Entry name” after the target is deleted. */
export function snapshotTargetEntryForWorklog(
  store: Store,
  target: WorklogTarget,
): { targetEntryKey?: string; targetEntryName?: string } {
  switch (target.kind) {
    case "task": {
      const task = store.tasks.find((x) => x.id === target.taskId);
      return task ? { targetEntryKey: task.key, targetEntryName: task.name } : {};
    }
    case "epic": {
      const g = store.taskGroups.find((x) => x.id === target.groupId);
      return g ? { targetEntryKey: g.key, targetEntryName: g.name } : {};
    }
    case "note": {
      const e = store.ownerEntries.find((x) => x.id === target.entryId);
      return e ? { targetEntryKey: e.key, targetEntryName: e.title } : {};
    }
    case "project": {
      const p = store.projects.find((x) => x.id === target.projectId);
      return p ? { targetEntryKey: p.key, targetEntryName: p.name } : {};
    }
    case "owner": {
      const o = store.owners.find((x) => x.id === target.ownerId);
      return o ? { targetEntryKey: o.key, targetEntryName: o.name } : {};
    }
    default:
      return {};
  }
}
