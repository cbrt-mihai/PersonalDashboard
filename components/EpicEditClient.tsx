"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { archiveNowIso, isArchived } from "@/lib/archive";
import { EntityArchivedBanner } from "./EntityArchivedMark";
import type { Owner, Project, TaskGroup } from "@/lib/schemas";
import { EditPageArchiveField } from "./EditPageArchiveField";
import { MarkdownField } from "./MarkdownField";
import { MarkdownView } from "./MarkdownView";
import { NoteTagsEditor } from "./NoteTagsEditor";
import { TrashIcon } from "./icons";

function sectionCard(className = "") {
  return `min-w-0 rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950 ${className}`;
}

export function EpicEditClient({ epicId }: { epicId: string }) {
  const router = useRouter();
  const [epic, setEpic] = useState<TaskGroup | null>(null);
  const [owner, setOwner] = useState<Owner | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [detailsEdit, setDetailsEdit] = useState(false);
  const [descEdit, setDescEdit] = useState(false);
  const [savingDetails, setSavingDetails] = useState(false);
  const [savingDesc, setSavingDesc] = useState(false);

  const [form, setForm] = useState({
    name: "",
    description: "",
    tags: [] as string[],
    projectId: "" as string,
  });

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const [gr, pj] = await Promise.all([
        fetch(`/api/groups/${epicId}`),
        fetch("/api/projects").then((r) => (r.ok ? r.json() : [])),
      ]);
      if (!gr.ok) throw new Error("Epic not found");
      const g: TaskGroup = await gr.json();
      setEpic(g);
      setProjects(Array.isArray(pj) ? pj : []);
      setForm({
        name: g.name,
        description: g.description ?? "",
        tags: g.tags ?? [],
        projectId: g.projectId ?? "",
      });
      const pr = await fetch(`/api/owners/${g.ownerId}`).then((r) => (r.ok ? r.json() : null));
      setOwner(pr);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to load");
      setEpic(null);
    } finally {
      setLoading(false);
    }
  }, [epicId]);

  useEffect(() => {
    queueMicrotask(() => {
      void load();
    });
  }, [load]);

  function cancelDetailsEdit() {
    if (!epic) return;
    setForm((f) => ({
      ...f,
      name: epic.name,
      tags: epic.tags ?? [],
      projectId: epic.projectId ?? "",
    }));
    setDetailsEdit(false);
  }

  function cancelDescEdit() {
    if (!epic) return;
    setForm((f) => ({ ...f, description: epic.description ?? "" }));
    setDescEdit(false);
  }

  async function saveDetails() {
    if (!epic || !form.name.trim()) return;
    setSavingDetails(true);
    setErr(null);
    try {
      const r = await fetch(`/api/groups/${epicId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          tags: form.tags,
          projectId: form.projectId ? form.projectId : null,
        }),
      });
      if (!r.ok) throw new Error("Could not save");
      const next: TaskGroup = await r.json();
      setEpic(next);
      setForm((f) => ({
        ...f,
        name: next.name,
        tags: next.tags ?? [],
        projectId: next.projectId ?? "",
      }));
      setDetailsEdit(false);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSavingDetails(false);
    }
  }

  async function saveDescription() {
    if (!epic) return;
    setSavingDesc(true);
    setErr(null);
    try {
      const r = await fetch(`/api/groups/${epicId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: form.description }),
      });
      if (!r.ok) throw new Error("Could not save");
      const next: TaskGroup = await r.json();
      setEpic(next);
      setForm((f) => ({ ...f, description: next.description ?? "" }));
      setDescEdit(false);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSavingDesc(false);
    }
  }

  async function onDelete() {
    if (!epic || !confirm("Delete this epic? Tasks will become ungrouped.")) return;
    const r = await fetch(`/api/groups/${epic.id}`, { method: "DELETE" });
    if (!r.ok) return;
    router.push(owner ? `/owners/${owner.id}` : "/epics");
    router.refresh();
  }

  if (loading) return <p className="text-zinc-500">Loading…</p>;
  if (err && !epic) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
        {err}{" "}
        <Link href="/epics" className="underline">
          Epics
        </Link>
      </div>
    );
  }
  if (!epic) return null;

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link
            href={`/epics/${epicId}`}
            className="text-sm text-blue-600 hover:underline dark:text-blue-400"
          >
            ← Back to epic
          </Link>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            Edit epic
          </h1>
          {owner ? (
            <p className="mt-1 text-sm text-zinc-500">
              Owner:{" "}
              <Link
                href={`/owners/${owner.id}`}
                className="text-blue-600 hover:underline dark:text-blue-400"
              >
                {owner.name}
              </Link>
            </p>
          ) : null}
          <p className="mt-2 text-sm text-zinc-500">
            <strong>Edit details</strong> for name and tags. <strong>Edit description</strong> for
            Markdown only.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void onDelete()}
          className="inline-flex items-center justify-center rounded-lg border border-red-300 p-2 text-red-700 hover:bg-red-50 dark:border-red-800 dark:text-red-300 dark:hover:bg-red-950/40"
          aria-label="Delete epic"
          title="Delete epic"
        >
          <TrashIcon />
        </button>
      </div>

      {err ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
          {err}
        </div>
      ) : null}

      <EntityArchivedBanner entity={epic} kind="epic" />

      <EditPageArchiveField
        archived={isArchived(epic)}
        onCommit={async (next) => {
          const r = await fetch(`/api/groups/${epicId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ archivedAt: next ? archiveNowIso() : null }),
          });
          if (!r.ok) throw new Error("Could not update archive state");
          const nextEpic: TaskGroup = await r.json();
          setEpic(nextEpic);
        }}
      />

      <section className={sectionCard()}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">Details</h2>
          {!detailsEdit ? (
            <button
              type="button"
              onClick={() => setDetailsEdit(true)}
              className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm font-medium hover:bg-zinc-50 dark:border-zinc-600 dark:hover:bg-zinc-900"
            >
              Edit details
            </button>
          ) : null}
        </div>
        {!detailsEdit ? (
          <dl className="mt-4 grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <dt className="text-xs font-medium text-zinc-500 uppercase">Name</dt>
              <dd className="mt-1 text-zinc-900 dark:text-zinc-100">{epic.name}</dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-xs font-medium text-zinc-500 uppercase">Project</dt>
              <dd className="mt-1 text-zinc-800 dark:text-zinc-200">
                {epic.projectId
                  ? projects.find((p) => p.id === epic.projectId)?.name ?? epic.projectId
                  : "—"}
              </dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-xs font-medium text-zinc-500 uppercase">Tags</dt>
              <dd className="mt-1 text-zinc-800 dark:text-zinc-200">
                {(epic.tags ?? []).length ? (epic.tags ?? []).join(", ") : "—"}
              </dd>
            </div>
          </dl>
        ) : (
          <div className="mt-4 flex flex-col gap-4">
            <label className="text-sm">
              <span className="text-zinc-500">Name</span>
              <input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-zinc-300 px-2 py-2 dark:border-zinc-600 dark:bg-zinc-900"
              />
            </label>
            <label className="text-sm">
              <span className="text-zinc-500">Project</span>
              <select
                value={form.projectId}
                onChange={(e) => setForm((f) => ({ ...f, projectId: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-zinc-300 px-2 py-2 dark:border-zinc-600 dark:bg-zinc-900"
              >
                <option value="">None</option>
                {projects
                  .slice()
                  .sort((a, b) => a.name.localeCompare(b.name))
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
              </select>
            </label>
            <NoteTagsEditor
              tags={form.tags}
              onChange={(tags) => setForm((f) => ({ ...f, tags }))}
            />
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={savingDetails}
                onClick={() => void saveDetails()}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {savingDetails ? "Saving…" : "Save details"}
              </button>
              <button
                type="button"
                onClick={cancelDetailsEdit}
                className="rounded-lg border border-zinc-300 px-4 py-2 text-sm dark:border-zinc-600"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </section>

      <section className={sectionCard()}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">Description</h2>
          {!descEdit ? (
            <button
              type="button"
              onClick={() => setDescEdit(true)}
              className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm font-medium hover:bg-zinc-50 dark:border-zinc-600 dark:hover:bg-zinc-900"
            >
              Edit description
            </button>
          ) : null}
        </div>
        {!descEdit ? (
          <div className="mt-4 text-sm text-zinc-800 dark:text-zinc-200">
            {epic.description?.trim() ? (
              <MarkdownView markdown={epic.description} />
            ) : (
              <p className="text-zinc-500 italic">No description.</p>
            )}
          </div>
        ) : (
          <div className="mt-4 flex flex-col gap-4">
            <MarkdownField
              label="Description (Markdown)"
              value={form.description}
              onChange={(v) => setForm((f) => ({ ...f, description: v }))}
              rows={12}
            />
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={savingDesc}
                onClick={() => void saveDescription()}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {savingDesc ? "Saving…" : "Save description"}
              </button>
              <button
                type="button"
                onClick={cancelDescEdit}
                className="rounded-lg border border-zinc-300 px-4 py-2 text-sm dark:border-zinc-600"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

