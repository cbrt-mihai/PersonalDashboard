import type { Task } from "@/lib/schemas";
import type { StatusDef } from "@/lib/statusConfig";
import { isTerminalStatus, normalizeStatusKey, statusDef } from "@/lib/statusConfig";

/** Derived epic “workflow” state from child tasks (aligned with Epics list). */
export type EpicRollupState = "open" | "in_progress" | "blocked" | "done" | "closed";

function isLikeStatus(
  s: string,
  key: EpicRollupState,
  statusMap: Record<string, StatusDef>,
): boolean {
  const nk = normalizeStatusKey(s);
  if (nk === key) return true;
  const def = statusDef(s, statusMap);
  return normalizeStatusKey(def.label) === key;
}

export function epicRollupStateFromTasks(
  inGroup: Task[],
  statusMap: Record<string, StatusDef>,
): EpicRollupState {
  const total = inGroup.length;
  if (total === 0) return "open";

  const allClosed = inGroup.every((t) => isLikeStatus(t.status, "closed", statusMap));
  const allDoneOrClosed = inGroup.every(
    (t) => isLikeStatus(t.status, "done", statusMap) || isLikeStatus(t.status, "closed", statusMap),
  );
  const hasBlockedStatus = inGroup.some((t) => isLikeStatus(t.status, "blocked", statusMap));
  const hasBlockerPriority = inGroup.some((t) => t.priority.trim().toLowerCase() === "blocker");
  const blocked = hasBlockedStatus || hasBlockerPriority;
  const allOpen = inGroup.every((t) => isLikeStatus(t.status, "open", statusMap));

  if (allClosed) return "closed";
  if (allDoneOrClosed) return "done";
  if (blocked) return "blocked";
  if (allOpen) return "open";
  return "in_progress";
}

export function epicDoneTerminalCount(
  inGroup: Task[],
  statusMap: Record<string, StatusDef>,
): number {
  return inGroup.filter((t) => isTerminalStatus(t.status, statusMap)).length;
}
