"use client";

import { useDashboardConfig } from "@/components/DashboardSettingsProvider";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { archiveNowIso, isArchived } from "@/lib/archive";
import type { Owner, OwnerEntry, Project, Task, TaskGroup } from "@/lib/schemas";
import { EditPageArchiveField } from "./EditPageArchiveField";
import { EntityArchivedBanner } from "./EntityArchivedMark";
import { NOTE_ENTRY_TYPES } from "@/lib/noteEntryFormOptions";
import { noteEntryAttributionForSwatch } from "@/lib/noteEntryAttributionDisplay";
import { noteEntryViewHref } from "@/lib/noteEntryPaths";
import { dedupeTags, normalizeTagKey } from "@/lib/noteTags";
import { SearchableSingleSelect } from "./SearchableSingleSelect";
import { TASK_FORM_PRIORITIES } from "@/lib/taskFormOptions";
import { NoteTagsEditor } from "./NoteTagsEditor";
import { MarkdownField } from "./MarkdownField";
import { MarkdownView } from "./MarkdownView";
import { NoteStatusSelect } from "./NoteStatusSelect";
import { OwnerSwatch } from "@/components/OwnerSwatch";
import { StatusBadge } from "./StatusBadge";

function sectionCard(className = "") {
  return `min-w-0 rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950 ${className}`;
}

export function OwnerEntryEditClient({
  entryId,
  ownerId,
}: {
  entryId: string;
  /** When set (owner-scoped URL), the loaded note must belong to this owner; attribution can still be edited. */
  ownerId?: string;
}) {
  const { settings, noteStatusKeys } = useDashboardConfig();
  const defaultNoteStatus = noteStatusKeys[0] ?? "open";
  const noteTypes = settings?.noteTypes ?? [...NOTE_ENTRY_TYPES];
  const priorities = settings?.taskPriorities
    ? settings.taskPriorities.map((r) => r.label)
    : [...TASK_FORM_PRIORITIES];

  const [entry, setEntry] = useState<OwnerEntry | null>(null);
  const [owners, setOwners] = useState<Owner[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [groups, setGroups] = useState<TaskGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [attribOwnerId, setAttribOwnerId] = useState("");
  const [attribProjectId, setAttribProjectId] = useState("");
  const [attribTaskId, setAttribTaskId] = useState("");
  const [attribGroupId, setAttribGroupId] = useState("");

  const [metaEdit, setMetaEdit] = useState(false);
  const [bodyEdit, setBodyEdit] = useState(false);
  const [savingMeta, setSavingMeta] = useState(false);
  const [savingBody, setSavingBody] = useState(false);

  const [title, setTitle] = useState("");
  const [status, setStatus] = useState(defaultNoteStatus);
  const [type, setType] = useState("Note");
  const [priority, setPriority] = useState("Medium");
  const [tags, setTags] = useState<string[]>([]);
  const [body, setBody] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const [er, paList, pjList, tkList, grList] = await Promise.all([
        fetch(`/api/entries/${entryId}`),
        fetch("/api/owners"),
        fetch("/api/projects"),
        fetch("/api/tasks"),
        fetch("/api/groups"),
      ]);
      if (!er.ok) throw new Error("Note not found");
      const en: OwnerEntry = await er.json();
      if (ownerId != null && ownerId !== "" && en.ownerId !== ownerId) {
        setErr("This note does not belong to this owner.");
        setEntry(null);
        return;
      }
      setEntry(en);
      setTitle(en.title);
      setStatus(en.status ?? defaultNoteStatus);
      setType(en.type ?? "Note");
      setPriority(en.priority ?? "Medium");
      setTags(en.tags ?? []);
      setBody(en.body);
      setAttribOwnerId(en.ownerId ?? "");
      setAttribProjectId(en.projectId ?? "");
      setAttribTaskId(en.taskId ?? "");
      setAttribGroupId(en.taskGroupId ?? "");
      const pals = paList.ok ? await paList.json() : [];
      const pjs = pjList.ok ? await pjList.json() : [];
      const tks = tkList.ok ? await tkList.json() : [];
      const grs = grList.ok ? await grList.json() : [];
      setOwners(Array.isArray(pals) ? pals : []);
      setProjects(Array.isArray(pjs) ? pjs : []);
      setTasks(Array.isArray(tks) ? tks : []);
      setGroups(Array.isArray(grs) ? grs : []);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to load");
      setEntry(null);
    } finally {
      setLoading(false);
    }
  }, [ownerId, entryId, defaultNoteStatus, setBody]);

  useEffect(() => {
    queueMicrotask(() => {
      void load();
    });
  }, [load]);

  function cancelMetaEdit() {
    if (!entry) return;
    setTitle(entry.title);
    setStatus(entry.status ?? defaultNoteStatus);
    setType(entry.type ?? "Note");
    setPriority(entry.priority ?? "Medium");
    setTags(entry.tags ?? []);
    setAttribOwnerId(entry.ownerId ?? "");
    setAttribProjectId(entry.projectId ?? "");
    setAttribTaskId(entry.taskId ?? "");
    setAttribGroupId(entry.taskGroupId ?? "");
    setMetaEdit(false);
  }

  function cancelBodyEdit() {
    if (!entry) return;
    setBody(entry.body);
    setBodyEdit(false);
  }

  async function saveMeta() {
    if (!entry || !title.trim()) return;
    const nextOwnerId = attribOwnerId || null;
    const nextProjectId = attribProjectId || null;
    const nextTaskId = attribTaskId || null;
    const nextGroupId = attribGroupId || null;
    if (nextOwnerId == null && nextProjectId == null && nextTaskId == null && nextGroupId == null) {
      setErr("Link the note to at least one owner, project, task, or epic.");
      return;
    }
    setSavingMeta(true);
    setErr(null);
    try {
      const r = await fetch(`/api/entries/${entryId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          status,
          type,
          priority,
          tags: dedupeTags(tags),
          ownerId: nextOwnerId,
          projectId: nextProjectId,
          taskId: nextTaskId,
          taskGroupId: nextGroupId,
        }),
      });
      if (!r.ok) throw new Error("Could not save");
      const next: OwnerEntry = await r.json();
      setEntry(next);
      setAttribOwnerId(next.ownerId ?? "");
      setAttribProjectId(next.projectId ?? "");
      setAttribTaskId(next.taskId ?? "");
      setAttribGroupId(next.taskGroupId ?? "");
      setMetaEdit(false);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSavingMeta(false);
    }
  }

  async function saveBody() {
    setSavingBody(true);
    setErr(null);
    try {
      const r = await fetch(`/api/entries/${entryId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body }),
      });
      if (!r.ok) throw new Error("Could not save");
      const next: OwnerEntry = await r.json();
      setEntry(next);
      setBodyEdit(false);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSavingBody(false);
    }
  }

  if (loading) return <p className="text-zinc-500">Loading…</p>;
  if (err && !entry) {
    const backHref =
      ownerId != null && ownerId !== "" ? `/owners/${ownerId}` : "/notes";
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
        {err}{" "}
        <Link href={backHref} className="underline">
          Back
        </Link>
      </div>
    );
  }
  if (!entry) return null;

  const sw = noteEntryAttributionForSwatch(entry, owners, projects);

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-8">
      <div className="flex flex-wrap items-start gap-4">
        <OwnerSwatch
          owner={sw.owner}
          color={sw.color}
          iconDataUrl={sw.iconDataUrl}
          className="h-12 w-12 shrink-0 rounded-xl"
          title={sw.title}
        />
        <div className="min-w-0 flex-1">
        <Link
          href={noteEntryViewHref(entry)}
          className="text-sm text-blue-600 hover:underline dark:text-blue-400"
        >
          ← Back to note
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          Edit note
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          {entry.ownerId ? (
            <>
              Owner:{" "}
              <Link
                href={`/owners/${entry.ownerId}`}
                className="text-blue-600 hover:underline dark:text-blue-400"
              >
                {owners.find((x) => x.id === entry.ownerId)?.name ?? entry.ownerId}
              </Link>
            </>
          ) : (
            "Owner: —"
          )}
          {" · "}
          {entry.projectId ? (
            <>
              Project:{" "}
              <Link
                href={`/projects/${entry.projectId}`}
                className="text-blue-600 hover:underline dark:text-blue-400"
              >
                {projects.find((p) => p.id === entry.projectId)?.name ?? entry.projectId}
              </Link>
            </>
          ) : (
            "Project: —"
          )}
          {" · "}
          {entry.taskId ? (
            <>
              Task:{" "}
              <Link
                href={`/tasks/${entry.taskId}`}
                className="text-blue-600 hover:underline dark:text-blue-400"
              >
                {tasks.find((t) => t.id === entry.taskId)?.name ?? entry.taskId}
              </Link>
            </>
          ) : (
            "Task: —"
          )}
          {" · "}
          {entry.taskGroupId ? (
            <>
              Epic:{" "}
              <Link
                href={`/epics/${entry.taskGroupId}`}
                className="text-blue-600 hover:underline dark:text-blue-400"
              >
                {groups.find((g) => g.id === entry.taskGroupId)?.name ?? entry.taskGroupId}
              </Link>
            </>
          ) : (
            "Epic: —"
          )}
        </p>
        <p className="mt-2 text-sm text-zinc-500">
          Use <strong>Edit details</strong> for title, status, type, priority, and tags. Use{" "}
          <strong>Edit body</strong> for Markdown content.
        </p>
        </div>
      </div>

      {err ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
          {err}
        </div>
      ) : null}

      <EntityArchivedBanner entity={entry} kind="note" />

      <EditPageArchiveField
        archived={isArchived(entry)}
        onCommit={async (next) => {
          const r = await fetch(`/api/entries/${entryId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ archivedAt: next ? archiveNowIso() : null }),
          });
          if (!r.ok) throw new Error("Could not update archive state");
          const en: OwnerEntry = await r.json();
          setEntry(en);
        }}
      />

      <section className={sectionCard()}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
            Details
          </h2>
          {!metaEdit ? (
            <button
              type="button"
              onClick={() => setMetaEdit(true)}
              className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm font-medium hover:bg-zinc-50 dark:border-zinc-600 dark:hover:bg-zinc-900"
            >
              Edit details
            </button>
          ) : null}
        </div>
        {!metaEdit ? (
          <dl className="mt-4 grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <dt className="text-xs font-medium text-zinc-500 uppercase">Attribution</dt>
              <dd className="mt-1 text-sm text-zinc-800 dark:text-zinc-200">
                {entry.ownerId
                  ? owners.find((p) => p.id === entry.ownerId)?.name ?? entry.ownerId
                  : "—"}
                {" · "}
                {entry.projectId
                  ? projects.find((p) => p.id === entry.projectId)?.name ?? entry.projectId
                  : "—"}
                {" · "}
                {entry.taskId ? (
                  <Link
                    href={`/tasks/${entry.taskId}`}
                    className="text-blue-600 hover:underline dark:text-blue-400"
                  >
                    {tasks.find((t) => t.id === entry.taskId)?.name ?? entry.taskId}
                  </Link>
                ) : (
                  "—"
                )}
                {" · "}
                {entry.taskGroupId ? (
                  <Link
                    href={`/epics/${entry.taskGroupId}`}
                    className="text-blue-600 hover:underline dark:text-blue-400"
                  >
                    {groups.find((g) => g.id === entry.taskGroupId)?.name ?? entry.taskGroupId}
                  </Link>
                ) : (
                  "—"
                )}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-zinc-500 uppercase">Title</dt>
              <dd className="mt-1 text-zinc-900 dark:text-zinc-100">{entry.title}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-zinc-500 uppercase">Status</dt>
              <dd className="mt-1">
                <StatusBadge variant="note" status={entry.status ?? defaultNoteStatus} />
              </dd>
            </div>
            {entry.closedAt ? (
              <div>
                <dt className="text-xs font-medium text-zinc-500 uppercase">Closed</dt>
                <dd className="mt-1 text-sm text-zinc-800 dark:text-zinc-200">
                  <time dateTime={entry.closedAt}>{new Date(entry.closedAt).toLocaleString()}</time>
                </dd>
              </div>
            ) : null}
            <div>
              <dt className="text-xs font-medium text-zinc-500 uppercase">Type</dt>
              <dd className="mt-1 text-zinc-800 dark:text-zinc-200">{entry.type ?? "Note"}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-zinc-500 uppercase">Priority</dt>
              <dd className="mt-1 text-zinc-800 dark:text-zinc-200">{entry.priority ?? "Medium"}</dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-xs font-medium text-zinc-500 uppercase">Tags</dt>
              <dd className="mt-1">
                {(entry.tags ?? []).length ? (
                  <div className="flex flex-wrap gap-1">
                    {(entry.tags ?? []).map((t) => (
                      <span
                        key={normalizeTagKey(t)}
                        className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200"
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                ) : (
                  <span className="text-zinc-500">—</span>
                )}
              </dd>
            </div>
          </dl>
        ) : (
          <div className="mt-4 flex flex-col gap-4">
            <SearchableSingleSelect
              label="Owner (optional)"
              value={attribOwnerId}
              onChange={setAttribOwnerId}
              placeholder="None"
              options={[
                { value: "", label: "None" },
                ...owners.map((p) => ({ value: p.id, label: p.name })),
              ]}
            />
            <SearchableSingleSelect
              label="Project (optional)"
              value={attribProjectId}
              onChange={setAttribProjectId}
              placeholder="None"
              options={[
                { value: "", label: "None" },
                ...projects.map((p) => ({ value: p.id, label: p.name })),
              ]}
            />
            <SearchableSingleSelect
              label="Task (optional)"
              value={attribTaskId}
              onChange={setAttribTaskId}
              placeholder="None"
              options={[
                { value: "", label: "None" },
                ...tasks
                  .slice()
                  .sort((a, b) => a.name.localeCompare(b.name))
                  .map((t) => ({ value: t.id, label: `${t.name} (${t.key})` })),
              ]}
            />
            <SearchableSingleSelect
              label="Epic (optional)"
              value={attribGroupId}
              onChange={setAttribGroupId}
              placeholder="None"
              options={[
                { value: "", label: "None" },
                ...groups
                  .slice()
                  .sort((a, b) => a.name.localeCompare(b.name))
                  .map((g) => ({ value: g.id, label: `${g.name} (${g.key})` })),
              ]}
            />
            <label className="text-sm">
              <span className="text-zinc-500">Title</span>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 dark:border-zinc-600 dark:bg-zinc-900"
              />
            </label>
            <label className="text-sm">
              <span className="text-zinc-500">Status</span>
              <NoteStatusSelect
                value={status}
                onChange={setStatus}
                className="mt-1 w-full rounded-lg border border-zinc-300 px-2 py-2 dark:border-zinc-600 dark:bg-zinc-900"
              />
            </label>
            <label className="text-sm">
              <span className="text-zinc-500">Type</span>
              <select
                value={type}
                onChange={(e) => setType(e.target.value)}
                className="mt-1 w-full rounded-lg border border-zinc-300 px-2 py-2 dark:border-zinc-600 dark:bg-zinc-900"
              >
                {noteTypes.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm">
              <span className="text-zinc-500">Priority</span>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                className="mt-1 w-full rounded-lg border border-zinc-300 px-2 py-2 dark:border-zinc-600 dark:bg-zinc-900"
              >
                {priorities.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </label>
            <NoteTagsEditor tags={tags} onChange={setTags} />
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={savingMeta}
                onClick={() => void saveMeta()}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {savingMeta ? "Saving…" : "Save details"}
              </button>
              <button
                type="button"
                onClick={cancelMetaEdit}
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
          <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">Body</h2>
          {!bodyEdit ? (
            <button
              type="button"
              onClick={() => setBodyEdit(true)}
              className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm font-medium hover:bg-zinc-50 dark:border-zinc-600 dark:hover:bg-zinc-900"
            >
              Edit body
            </button>
          ) : null}
        </div>
        {!bodyEdit ? (
          <div className="mt-4 text-sm text-zinc-800 dark:text-zinc-200">
            {entry.body?.trim() ? (
              <MarkdownView markdown={entry.body} />
            ) : (
              <p className="text-zinc-500 italic">No body yet.</p>
            )}
          </div>
        ) : (
          <div className="mt-4 flex flex-col gap-4">
            <MarkdownField label="Markdown body" value={body} onChange={setBody} rows={14} />
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={savingBody}
                onClick={() => void saveBody()}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {savingBody ? "Saving…" : "Save body"}
              </button>
              <button
                type="button"
                onClick={cancelBodyEdit}
                className="rounded-lg border border-zinc-300 px-4 py-2 text-sm dark:border-zinc-600"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </section>

      <p className="text-sm">
        <Link
          href={noteEntryViewHref(entry)}
          className="text-blue-600 hover:underline dark:text-blue-400"
        >
          Done — view note
        </Link>
      </p>
    </div>
  );
}
