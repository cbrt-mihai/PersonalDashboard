import {
  allocateEntityKey,
  allocateNoteEntryKey,
  collectEntityKeysFromStorePieces,
  isNoteChildKey,
  isValidEntityKey,
  type DefaultEntityKeyTag,
} from "@/lib/entityKey";
import type { Store } from "@/lib/schemas";
import { readStore } from "@/lib/jsonStore";

/** Allocate a new unique entity `key` (reads current store; call before mutating). */
export function nextEntityKey(tag: DefaultEntityKeyTag | string): string {
  const s = readStore();
  const used = collectEntityKeysFromStorePieces({
    owners: s.owners,
    projects: s.projects,
    taskGroups: s.taskGroups,
    tasks: s.tasks,
    ownerEntries: s.ownerEntries,
    worklogs: s.worklogs,
  });
  return allocateEntityKey(tag, used);
}

/**
 * Note public key: parent owner/project key + hyphen + digits (e.g. `ONE-3435-9`).
 * Prefers owner when both are set.
 */
export function nextOwnerEntryKey(
  store: Store,
  opts: { ownerId: string | null; projectId: string | null },
): string {
  const used = collectEntityKeysFromStorePieces({
    owners: store.owners,
    projects: store.projects,
    taskGroups: store.taskGroups,
    tasks: store.tasks,
    ownerEntries: store.ownerEntries,
    worklogs: store.worklogs,
  });
  let parent: string | undefined;
  if (opts.ownerId) {
    const o = store.owners.find((x) => x.id === opts.ownerId);
    const k = o?.key;
    if (k && isValidEntityKey(k) && !isNoteChildKey(k)) parent = k;
  }
  if (!parent && opts.projectId) {
    const p = store.projects.find((x) => x.id === opts.projectId);
    const k = p?.key;
    if (k && isValidEntityKey(k) && !isNoteChildKey(k)) parent = k;
  }
  if (parent) return allocateNoteEntryKey(parent, used);
  return allocateEntityKey("NTE", used);
}
