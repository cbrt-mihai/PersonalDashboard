"use client";

import { isArchived } from "@/lib/archive";

export type EntityArchivedMarkEntity = { archivedAt?: string | null } | null | undefined;

/** Compact label for tables and cards — separate from status/type content. */
export function EntityArchivedBadge({ entity }: { entity: EntityArchivedMarkEntity }) {
  if (!entity || !isArchived(entity)) return null;
  return (
    <span
      data-pd-archived="true"
      className="inline-flex shrink-0 items-center rounded border border-amber-500/70 bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-950 shadow-sm dark:border-amber-600 dark:bg-amber-950/55 dark:text-amber-100"
      title="Archived — stored fields are unchanged; only the archive flag applies."
    >
      Archived
    </span>
  );
}

export type EntityArchivedBannerKind = "note" | "task" | "epic" | "project" | "owner" | "record";

const BANNER_LEAD: Record<EntityArchivedBannerKind, string> = {
  note: "This note is archived.",
  task: "This task is archived.",
  epic: "This epic is archived.",
  project: "This project is archived.",
  owner: "This owner is archived.",
  record: "This record is archived.",
};

/**
 * Prominent archive notice for full pages. Does not replace or alter status/type/body UI.
 * Marked with `data-pd-archived` for programmatic detection alongside `archivedAt` in JSON.
 */
export function EntityArchivedBanner({
  entity,
  kind = "record",
}: {
  entity: EntityArchivedMarkEntity;
  kind?: EntityArchivedBannerKind;
}) {
  if (!entity || !isArchived(entity)) return null;
  return (
    <div
      data-pd-archived="true"
      role="status"
      aria-live="polite"
      className="rounded-lg border border-amber-400/90 bg-amber-50 px-3 py-2.5 text-sm text-amber-950 shadow-sm dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-50"
    >
      <div className="text-xs font-bold uppercase tracking-wide text-amber-900 dark:text-amber-200">
        Archived
      </div>
      <p className="mt-1 text-[13px] leading-snug text-amber-950/90 dark:text-amber-100/90">
        {BANNER_LEAD[kind]} Status, type, tags, and descriptions are unchanged; archiving is only an extra
        flag for visibility and filtering.
      </p>
    </div>
  );
}
