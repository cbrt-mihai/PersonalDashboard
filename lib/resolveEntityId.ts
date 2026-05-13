import { isUuidLike } from "@/lib/entityKey";
import type { Owner, OwnerEntry, Project, Store, Task, TaskGroup, Worklog } from "@/lib/schemas";

export function findOwnerByIdOrKey(store: Store, idOrKey: string): Owner | undefined {
  const q = idOrKey.trim();
  if (isUuidLike(q)) return store.owners.find((o) => o.id === q);
  return store.owners.find((o) => o.key === q);
}

export function findProjectByIdOrKey(store: Store, idOrKey: string): Project | undefined {
  const q = idOrKey.trim();
  if (isUuidLike(q)) return store.projects.find((p) => p.id === q);
  return store.projects.find((p) => p.key === q);
}

export function findTaskGroupByIdOrKey(store: Store, idOrKey: string): TaskGroup | undefined {
  const q = idOrKey.trim();
  if (isUuidLike(q)) return store.taskGroups.find((g) => g.id === q);
  return store.taskGroups.find((g) => g.key === q);
}

export function findTaskByIdOrKey(store: Store, idOrKey: string): Task | undefined {
  const q = idOrKey.trim();
  if (isUuidLike(q)) return store.tasks.find((t) => t.id === q);
  return store.tasks.find((t) => t.key === q);
}

export function findOwnerEntryByIdOrKey(store: Store, idOrKey: string): OwnerEntry | undefined {
  const q = idOrKey.trim();
  if (isUuidLike(q)) return store.ownerEntries.find((e) => e.id === q);
  return store.ownerEntries.find((e) => e.key === q);
}

export function findWorklogByIdOrKey(store: Store, idOrKey: string): Worklog | undefined {
  const q = idOrKey.trim();
  if (isUuidLike(q)) return store.worklogs.find((w) => w.id === q);
  return store.worklogs.find((w) => w.key === q);
}
