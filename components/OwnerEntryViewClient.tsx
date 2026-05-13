"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useDashboardConfig } from "@/components/DashboardSettingsProvider";
import { useCallback, useEffect, useState } from "react";
import { normalizeTagKey } from "@/lib/noteTags";
import { noteEntrySwatchFromEntities } from "@/lib/noteEntryAttributionDisplay";
import { noteEntryEditHref, noteWikiLinkSyntax } from "@/lib/noteEntryPaths";
import type { Owner, OwnerEntry, Project } from "@/lib/schemas";
import { isArchived } from "@/lib/archive";
import { OwnerSwatch } from "@/components/OwnerSwatch";
import { EntityArchivedBanner } from "./EntityArchivedMark";
import { WorklogSection } from "./WorklogSection";
import { StatusBadge } from "./StatusBadge";
import { TaskDetailsMarkdown } from "./TaskDetailsMarkdown";
import { TrashIcon } from "./icons";

export function OwnerEntryViewClient({
  entryId,
  ownerId: routeOwnerId,
}: {
  entryId: string;
  /** When set (owner-scoped URL), the note must belong to this owner. */
  ownerId?: string;
}) {
  const router = useRouter();
  const { noteStatusKeys } = useDashboardConfig();
  const defaultNoteStatus = noteStatusKeys[0] ?? "open";
  const [entry, setEntry] = useState<OwnerEntry | null>(null);
  const [owner, setOwner] = useState<Owner | null>(null);
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const er = await fetch(`/api/entries/${entryId}`);
      if (!er.ok) throw new Error("Note not found");
      const en: OwnerEntry = await er.json();
      if (routeOwnerId != null && routeOwnerId !== "" && en.ownerId !== routeOwnerId) {
        setErr("This note does not belong to this owner.");
        setEntry(null);
        return;
      }
      setEntry(en);
      if (en.ownerId) {
        const pr = await fetch(`/api/owners/${en.ownerId}`);
        setOwner(pr.ok ? await pr.json() : null);
      } else {
        setOwner(null);
      }
      if (en.projectId) {
        const pj = await fetch(`/api/projects/${en.projectId}`);
        setProject(pj.ok ? await pj.json() : null);
      } else {
        setProject(null);
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to load");
      setEntry(null);
    } finally {
      setLoading(false);
    }
  }, [entryId, routeOwnerId]);

  useEffect(() => {
    queueMicrotask(() => {
      void load();
    });
  }, [load]);

  async function onDelete() {
    if (!entry || !confirm("Delete this note permanently?")) return;
    const r = await fetch(`/api/entries/${entry.id}`, { method: "DELETE" });
    if (!r.ok) return;
    if (entry.ownerId) {
      router.push(`/owners/${entry.ownerId}`);
    } else if (entry.projectId) {
      router.push(`/projects/${entry.projectId}`);
    } else {
      router.push("/notes");
    }
    router.refresh();
  }

  if (loading) return <p className="text-zinc-500">Loading…</p>;
  if (err || !entry) {
    const backHref =
      routeOwnerId != null && routeOwnerId !== ""
        ? `/owners/${routeOwnerId}`
        : "/notes";
    const backLabel =
      routeOwnerId != null && routeOwnerId !== "" ? "Back to owner" : "All notes";
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
        {err ?? "Not found"}{" "}
        <Link href={backHref} className="underline">
          {backLabel}
        </Link>
      </div>
    );
  }

  const accent = owner?.color ?? project?.color ?? "#6366f1";
  const scopedOwnerId = routeOwnerId ?? entry.ownerId ?? null;
  const sw = noteEntrySwatchFromEntities(owner, project);

  return (
    <div className="flex flex-col gap-8">
      <nav className="flex flex-wrap gap-2 text-sm text-zinc-500">
        {routeOwnerId != null && routeOwnerId !== "" ? (
          <>
            <Link href="/owners" className="text-blue-600 hover:underline dark:text-blue-400">
              Owners
            </Link>
            <span aria-hidden>/</span>
            <Link
              href={`/owners/${routeOwnerId}`}
              className="text-blue-600 hover:underline dark:text-blue-400"
            >
              {owner?.name ?? "Owner"}
            </Link>
            <span aria-hidden>/</span>
            <span className="text-zinc-700 dark:text-zinc-300">Note</span>
          </>
        ) : (
          <>
            <Link href="/notes" className="text-blue-600 hover:underline dark:text-blue-400">
              Notes
            </Link>
            <span aria-hidden>/</span>
            <span className="text-zinc-700 dark:text-zinc-300">Note</span>
          </>
        )}
      </nav>

      <EntityArchivedBanner entity={entry} kind="note" />

      <header
        className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950"
        style={{ borderTopWidth: 4, borderTopColor: accent }}
      >
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-0 flex-1 flex-wrap items-start gap-4">
            <OwnerSwatch
              owner={sw.owner}
              color={sw.color}
              iconDataUrl={sw.iconDataUrl}
              className="h-14 w-14 shrink-0 rounded-xl"
              title={sw.title}
            />
            <div className="min-w-0 flex-1">
            <p className="text-xs font-medium tracking-wide text-zinc-500 uppercase">Note</p>
            <h1 className="mt-1 text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
              {entry.title}
            </h1>
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-zinc-600 dark:text-zinc-400">
              {owner ? (
                <span>
                  Owner:{" "}
                  <Link
                    href={`/owners/${owner.id}`}
                    className="font-medium text-blue-600 hover:underline dark:text-blue-400"
                  >
                    {owner.name}
                  </Link>
                </span>
              ) : (
                <span>Owner: —</span>
              )}
              {project ? (
                <span>
                  Project:{" "}
                  <Link
                    href={`/projects/${project.id}`}
                    className="font-medium text-blue-600 hover:underline dark:text-blue-400"
                  >
                    {project.name}
                  </Link>
                </span>
              ) : (
                <span>Project: —</span>
              )}
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <StatusBadge variant="note" status={entry.status ?? defaultNoteStatus} />
              <span className="rounded-md bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                {entry.type ?? "Note"}
              </span>
              <span className="rounded-md bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                {entry.priority ?? "Medium"}
              </span>
            </div>
            {(entry.tags ?? []).length ? (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {(entry.tags ?? []).map((t) => (
                  <span
                    key={normalizeTagKey(t)}
                    className="rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
                  >
                    {t}
                  </span>
                ))}
              </div>
            ) : null}
            <p className="mt-3 text-sm text-zinc-500">
              Created{" "}
              <time dateTime={entry.createdAt}>{new Date(entry.createdAt).toLocaleString()}</time>
            </p>
            {entry.closedAt ? (
              <p className="mt-1 text-sm text-zinc-500">
                Closed{" "}
                <time dateTime={entry.closedAt}>{new Date(entry.closedAt).toLocaleString()}</time>
              </p>
            ) : null}
            <p className="mt-2 text-xs text-zinc-500">
              Wiki link:{" "}
              <code className="rounded bg-zinc-200 px-1 dark:bg-zinc-800">
                {noteWikiLinkSyntax(entry)}
              </code>
            </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href={noteEntryEditHref(entry)}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              Edit
            </Link>
            <button
              type="button"
              onClick={() => void onDelete()}
              className="inline-flex items-center justify-center rounded-lg border border-red-300 p-2 text-red-700 hover:bg-red-50 dark:border-red-800 dark:text-red-300 dark:hover:bg-red-950/40"
              aria-label="Delete note"
              title="Delete note"
            >
              <TrashIcon />
            </button>
          </div>
        </div>
      </header>

      <section className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
        <h2 className="text-sm font-semibold tracking-wide text-zinc-500 uppercase">Body</h2>
        <div className="mt-4">
          {entry.body?.trim() ? (
            <TaskDetailsMarkdown markdown={entry.body} variant="page" />
          ) : (
            <p className="text-sm text-zinc-500 italic">No body content.</p>
          )}
        </div>
      </section>

      <WorklogSection target={{ kind: "note", entryId: entry.id }} disabled={isArchived(entry)} />

      <p className="text-sm">
        {scopedOwnerId ? (
          <Link
            href={`/owners/${scopedOwnerId}`}
            className="text-blue-600 hover:underline dark:text-blue-400"
          >
            ← Back to {owner?.name ?? "Owner"}
          </Link>
        ) : entry.projectId ? (
          <Link
            href={`/projects/${entry.projectId}`}
            className="text-blue-600 hover:underline dark:text-blue-400"
          >
            ← Back to {project?.name ?? "project"}
          </Link>
        ) : (
          <Link href="/notes" className="text-blue-600 hover:underline dark:text-blue-400">
            ← All notes
          </Link>
        )}
      </p>
    </div>
  );
}
