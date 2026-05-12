import {
  buildStatusMapFromRows,
  isTerminalStatus,
  type StatusDef,
  type TaskStatusRowInput,
} from "@/lib/statusConfig";

/** `closedAt` when creating a note: set if the initial status is terminal. */
export function closedAtForNewNote(
  status: string,
  noteStatusRows: TaskStatusRowInput[],
  createdAtIso: string,
): string | null {
  const map = buildStatusMapFromRows(noteStatusRows);
  return isTerminalStatus(status, map) ? createdAtIso : null;
}

/** Recompute `closedAt` after a note update from current and next workflow status. */
export function closedAtAfterNoteStatusChange(opts: {
  prevStatus: string;
  prevClosedAt: string | null;
  nextStatus: string;
  map: Record<string, StatusDef>;
  nowIso: string;
}): string | null {
  const prevTerm = isTerminalStatus(opts.prevStatus, opts.map);
  const nextTerm = isTerminalStatus(opts.nextStatus, opts.map);
  if (!nextTerm) return null;
  if (!prevTerm) return opts.nowIso;
  return opts.prevClosedAt ?? opts.nowIso;
}
