import type { Store } from "@/lib/schemas";

export type NoteAnchors = {
  ownerId: string | null;
  projectId: string | null;
  taskId: string | null;
  taskGroupId: string | null;
};

/**
 * Validates and normalizes anchors for a new or updated note.
 * - At least one of owner, project, task, or epic must be set (after normalization).
 * - When `taskId` is set, the task must exist; `ownerId` is filled from the task if omitted.
 * - When `taskGroupId` is set, the epic must exist; `ownerId` is filled from the epic if omitted.
 * - If both `taskId` and `taskGroupId` are set, the task must belong to that epic.
 */
export function normalizeNoteAnchors(
  store: Store,
  input: NoteAnchors,
): { ok: true; anchors: NoteAnchors } | { ok: false; error: string; status: number } {
  let ownerId = input.ownerId;
  const { projectId, taskId, taskGroupId } = input;

  if (taskId) {
    const t = store.tasks.find((x) => x.id === taskId);
    if (!t) return { ok: false, error: "Task not found", status: 400 };
    if (ownerId != null && ownerId !== t.ownerId) {
      return { ok: false, error: "Owner does not match task", status: 400 };
    }
    ownerId = ownerId ?? t.ownerId;
    if (taskGroupId != null) {
      if (t.groupId == null || t.groupId !== taskGroupId) {
        return { ok: false, error: "Epic does not match task", status: 400 };
      }
    }
  }

  if (taskGroupId) {
    const g = store.taskGroups.find((x) => x.id === taskGroupId);
    if (!g) return { ok: false, error: "Epic not found", status: 400 };
    if (ownerId != null && ownerId !== g.ownerId) {
      return { ok: false, error: "Owner does not match epic", status: 400 };
    }
    ownerId = ownerId ?? g.ownerId;
  }

  const hasAnchor =
    ownerId != null || projectId != null || taskId != null || taskGroupId != null;
  if (!hasAnchor) {
    return {
      ok: false,
      error: "Note must be linked to an owner, project, task, or epic",
      status: 400,
    };
  }

  if (ownerId != null && !store.owners.some((p) => p.id === ownerId)) {
    return { ok: false, error: "Owner not found", status: 400 };
  }
  if (projectId != null && !store.projects.some((p) => p.id === projectId)) {
    return { ok: false, error: "Project not found", status: 400 };
  }

  return { ok: true, anchors: { ownerId, projectId, taskId, taskGroupId } };
}

/** @deprecated Use normalizeNoteAnchors; kept for gradual migration of call sites. */
export function validateNoteAttribution(
  ownerId: string | null,
  projectId: string | null,
  store: Store,
): { ok: true } | { ok: false; error: string; status: number } {
  const r = normalizeNoteAnchors(store, {
    ownerId,
    projectId,
    taskId: null,
    taskGroupId: null,
  });
  if (!r.ok) return r;
  return { ok: true };
}
