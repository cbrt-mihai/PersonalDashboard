"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import type { Owner, OwnerEntry, Project, Task, TaskGroup, TaskSubtask } from "@/lib/schemas";
import { dashboardIconBtnPrimaryClass } from "@/lib/dashboardTableActionClasses";
import { isArchived } from "@/lib/archive";
import { DetailCollapsibleSection } from "./DetailCollapsibleSection";
import { WorklogSection } from "./WorklogSection";
import { EntityArchivedBanner } from "./EntityArchivedMark";
import { StatusBadge } from "./StatusBadge";
import { TaskDetailsMarkdown } from "./TaskDetailsMarkdown";
import { normalizeTagKey } from "@/lib/noteTags";
import { TaskPriorityBadge, TaskTypeBadge } from "./TaskMetaBadges";
import { OwnerSwatch } from "./OwnerSwatch";
import { PencilIcon, TrashIcon } from "./icons";
import { noteEntryEditHref, noteEntryViewHref } from "@/lib/noteEntryPaths";
import { SubtaskProgressBar } from "./SubtaskProgressBar";

export function TaskViewClient({ taskId }: { taskId: string }) {
  const router = useRouter();
  const [task, setTask] = useState<Task | null>(null);
  const [owner, setOwner] = useState<Owner | null>(null);
  const [group, setGroup] = useState<TaskGroup | null>(null);
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [subtaskSavingId, setSubtaskSavingId] = useState<string | null>(null);
  const [taskNotes, setTaskNotes] = useState<OwnerEntry[]>([]);
  const [noteTitle, setNoteTitle] = useState("");
  const [noteSaving, setNoteSaving] = useState(false);
  const [noteErr, setNoteErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const tr = await fetch(`/api/tasks/${taskId}`);
      if (!tr.ok) throw new Error("Task not found");
      const t: Task = await tr.json();
      setTask(t);
      const pr = await fetch(`/api/owners/${t.ownerId}`);
      if (pr.ok) setOwner(await pr.json());
      else setOwner(null);
      if (t.groupId) {
        const gr = await fetch(`/api/groups/${t.groupId}`);
        const g: TaskGroup | null = gr.ok ? await gr.json() : null;
        setGroup(g);
        if (g?.projectId) {
          const pj = await fetch(`/api/projects/${g.projectId}`);
          setProject(pj.ok ? await pj.json() : null);
        } else {
          setProject(null);
        }
      } else {
        setGroup(null);
        setProject(null);
      }
      const enr = await fetch(`/api/entries?taskId=${encodeURIComponent(t.id)}`);
      const enraw: unknown = enr.ok ? await enr.json() : [];
      const list = Array.isArray(enraw)
        ? enraw
        : enraw &&
            typeof enraw === "object" &&
            "items" in enraw &&
            Array.isArray((enraw as { items: unknown }).items)
          ? (enraw as { items: OwnerEntry[] }).items
          : [];
      setTaskNotes(list);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to load");
      setTask(null);
    } finally {
      setLoading(false);
    }
  }, [taskId]);

  useEffect(() => {
    queueMicrotask(() => {
      void load();
    });
  }, [load]);

  async function toggleSubtask(st: TaskSubtask) {
    if (!task || isArchived(task)) return;
    const list = task.subtasks ?? [];
    const next: TaskSubtask[] = list.map((x) =>
      x.id === st.id ? { ...x, done: !x.done } : x,
    );
    setTask({ ...task, subtasks: next });
    setSubtaskSavingId(st.id);
    try {
      const r = await fetch(`/api/tasks/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subtasks: next }),
      });
      if (!r.ok) throw new Error("update failed");
      setTask(await r.json());
    } catch {
      await load();
    } finally {
      setSubtaskSavingId(null);
    }
  }

  async function createTaskNote(ev: FormEvent) {
    ev.preventDefault();
    if (!task || isArchived(task)) return;
    const title = noteTitle.trim();
    if (!title) {
      setNoteErr("Title is required.");
      return;
    }
    setNoteErr(null);
    setNoteSaving(true);
    try {
      const r = await fetch("/api/entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          taskId: task.id,
          ownerId: task.ownerId,
          projectId: project?.id ?? null,
          taskGroupId: task.groupId ?? null,
        }),
      });
      const payload = (await r.json().catch(() => null)) as OwnerEntry | { error?: unknown } | null;
      if (!r.ok) {
        const er = payload && typeof payload === "object" && "error" in payload ? payload.error : null;
        setNoteErr(typeof er === "string" ? er : "Could not create note.");
        return;
      }
      if (!payload || typeof payload !== "object" || !("id" in payload)) {
        setNoteErr("Invalid response from server.");
        return;
      }
      const entry = payload as OwnerEntry;
      setNoteTitle("");
      router.push(noteEntryEditHref(entry));
      router.refresh();
    } finally {
      setNoteSaving(false);
    }
  }

  async function onDelete() {
    if (!task || !confirm("Delete this task permanently?")) return;
    const r = await fetch(`/api/tasks/${task.id}`, { method: "DELETE" });
    if (!r.ok) return;
    router.push(owner ? `/owners/${owner.id}` : "/");
    router.refresh();
  }

  if (loading) return <p className="text-zinc-500">Loading…</p>;
  if (err || !task) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
        {err ?? "Not found"}{" "}
        <Link href="/" className="underline">
          Home
        </Link>
      </div>
    );
  }

  const accent = owner?.color ?? "#6366f1";
  const archived = isArchived(task);
  const subtasks = task.subtasks ?? [];
  const doneCount = subtasks.filter((s) => s.done).length;

  return (
    <div className="flex flex-col gap-8">
      <EntityArchivedBanner entity={task} kind="task" />
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap gap-2 text-sm text-zinc-500">
            <Link href="/" className="text-blue-600 hover:underline dark:text-blue-400">
              Tasks
            </Link>
            {owner ? (
              <>
                <span aria-hidden>/</span>
                <Link
                  href={`/owners/${owner.id}`}
                  className="text-blue-600 hover:underline dark:text-blue-400"
                >
                  {owner.name}
                </Link>
              </>
            ) : null}
            {project ? (
              <>
                <span aria-hidden>/</span>
                <Link
                  href={`/projects/${project.id}`}
                  className="text-blue-600 hover:underline dark:text-blue-400"
                >
                  {project.name}
                </Link>
              </>
            ) : null}
          </div>
          <h1
            className="mt-2 text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50"
            style={{ borderLeftWidth: 4, borderLeftColor: accent, paddingLeft: "0.75rem" }}
          >
            {task.name}
          </h1>
          {subtasks.length > 0 ? (
            <div className="mt-2 pl-3" style={{ borderLeftWidth: 4, borderLeftColor: accent }}>
              <SubtaskProgressBar done={doneCount} total={subtasks.length} className="max-w-md" />
            </div>
          ) : null}
          <p className="mt-2 text-xs text-zinc-500">
            Key <code className="rounded bg-zinc-200 px-1 dark:bg-zinc-800">{task.key}</code>
            {" · "}
            Wiki:{" "}
            <code className="rounded bg-zinc-200 px-1 dark:bg-zinc-800">{`[[task:${task.key}]]`}</code>{" "}
            or{" "}
            <code className="rounded bg-zinc-200 px-1 dark:bg-zinc-800">{`[[task:${task.id}]]`}</code>
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href={`/tasks/${task.id}/edit`}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            <PencilIcon className="h-4 w-4 shrink-0" />
            Edit
          </Link>
          <button
            type="button"
            onClick={() => void onDelete()}
            className="inline-flex items-center justify-center rounded-lg border border-red-300 p-2 text-red-700 hover:bg-red-50 dark:border-red-800 dark:text-red-300 dark:hover:bg-red-950/40"
            aria-label="Delete task"
            title="Delete task"
          >
            <TrashIcon />
          </button>
        </div>
      </div>

      <dl className="grid gap-4 rounded-xl border border-zinc-200 bg-white p-5 text-sm dark:border-zinc-800 dark:bg-zinc-950 sm:grid-cols-2">
        <div>
          <dt className="text-zinc-500">Status</dt>
          <dd className="mt-1">
            <StatusBadge status={task.status} />
          </dd>
        </div>
        <div>
          <dt className="text-zinc-500">Type</dt>
          <dd className="mt-1">
            <TaskTypeBadge type={task.type} />
          </dd>
        </div>
        <div>
          <dt className="text-zinc-500">Priority</dt>
          <dd className="mt-1">
            <TaskPriorityBadge priority={task.priority} />
          </dd>
        </div>
        <div>
          <dt className="text-zinc-500">Date</dt>
          <dd className="mt-1 font-medium text-zinc-900 dark:text-zinc-100">{task.date}</dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="text-zinc-500">Epic</dt>
          <dd className="mt-1 text-zinc-900 dark:text-zinc-100">
            {group ? (
              <Link
                href={`/owners/${task.ownerId}#epic-${group.id}`}
                className="text-blue-600 hover:underline dark:text-blue-400"
              >
                {group.name}
              </Link>
            ) : (
              "—"
            )}
          </dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="text-zinc-500">Project</dt>
          <dd className="mt-1">
            {project ? (
              <Link
                href={`/projects/${project.id}`}
                className="inline-flex items-center gap-2 font-medium text-blue-600 hover:underline dark:text-blue-400"
              >
                <OwnerSwatch
                  color={project.color}
                  iconDataUrl={project.iconDataUrl}
                  className="h-8 w-8 rounded-lg"
                  title={project.name}
                />
                {project.name}
              </Link>
            ) : (
              <span className="text-zinc-500">—</span>
            )}
          </dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="text-zinc-500">Owner</dt>
          <dd className="mt-1">
            {owner ? (
              <Link
                href={`/owners/${owner.id}`}
                className="font-medium text-blue-600 hover:underline dark:text-blue-400"
              >
                {owner.name}
              </Link>
            ) : (
              task.ownerId
            )}
          </dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="text-zinc-500">Tags</dt>
          <dd className="mt-1">
            {(task.tags ?? []).length ? (
              <div className="flex flex-wrap gap-1">
                {(task.tags ?? []).map((t) => (
                  <span
                    key={normalizeTagKey(t)}
                    className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
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

      <section>
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Description</h2>
        <div className="mt-3">
          {task.description?.trim() ? (
            <TaskDetailsMarkdown markdown={task.description} variant="page" />
          ) : (
            <p className="text-sm text-zinc-500 italic">No description.</p>
          )}
        </div>
      </section>

      {subtasks.length > 0 ? (
        <section>
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Subtasks</h2>
          <p className="mt-1 text-sm text-zinc-500">
            {doneCount} / {subtasks.length} complete
            {archived ? " · Archived — checklist is read-only." : null}
          </p>
          <ul className="mt-3 list-none space-y-2 p-0">
            {subtasks.map((s) => (
              <li key={s.id} className="flex items-start gap-3 text-sm">
                <input
                  type="checkbox"
                  checked={s.done}
                  disabled={archived || subtaskSavingId === s.id}
                  onChange={() => void toggleSubtask(s)}
                  className="mt-0.5 rounded border-zinc-300 dark:border-zinc-600"
                  aria-busy={subtaskSavingId === s.id}
                  aria-label={s.done ? `Mark not done: ${s.title}` : `Mark done: ${s.title}`}
                />
                <span
                  className={
                    s.done
                      ? "text-zinc-500 line-through dark:text-zinc-400"
                      : "text-zinc-800 dark:text-zinc-200"
                  }
                >
                  {s.title}
                </span>
              </li>
            ))}
          </ul>
          {!archived ? (
            <p className="mt-3 text-xs text-zinc-500">
              Add or remove items on the{" "}
              <Link href={`/tasks/${task.id}/edit`} className="text-blue-600 hover:underline dark:text-blue-400">
                edit
              </Link>{" "}
              page.
            </p>
          ) : null}
        </section>
      ) : null}

      <WorklogSection target={{ kind: "task", taskId: task.id }} disabled={archived} />

      <section className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Notes</h2>
        <p className="mt-1 text-sm text-zinc-500">
          Notes linked to this task. Open the{" "}
          <Link href="/notes" className="text-blue-600 hover:underline dark:text-blue-400">
            Notes
          </Link>{" "}
          dashboard to browse all.
        </p>
        {noteErr ? (
          <p className="mt-2 text-sm text-red-600 dark:text-red-400">{noteErr}</p>
        ) : null}
        {!archived ? (
          <form className="mt-4 flex flex-wrap items-end gap-2" onSubmit={(e) => void createTaskNote(e)}>
            <label className="min-w-[12rem] flex-1 text-sm text-zinc-700 dark:text-zinc-200">
              <span className="text-zinc-500">New note title</span>
              <input
                value={noteTitle}
                onChange={(e) => setNoteTitle(e.target.value)}
                placeholder="e.g. Meeting recap"
                className="mt-1 w-full rounded-lg border border-zinc-300 px-2 py-2 dark:border-zinc-600 dark:bg-zinc-900"
              />
            </label>
            <button
              type="submit"
              disabled={noteSaving}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {noteSaving ? "Creating…" : "Add note"}
            </button>
          </form>
        ) : (
          <p className="mt-3 text-sm text-zinc-500 italic">Archived task — notes are read-only here.</p>
        )}
        <ul className="mt-4 list-none space-y-2 p-0">
          {taskNotes.map((n) => (
            <li
              key={n.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-zinc-100 px-3 py-2 text-sm dark:border-zinc-800"
            >
              <div className="min-w-0 flex-1">
                <Link
                  href={noteEntryViewHref(n)}
                  className="font-medium text-blue-600 hover:underline dark:text-blue-400"
                >
                  {n.title}
                </Link>
                <div className="mt-1">
                  <StatusBadge variant="note" status={n.status ?? "open"} />
                </div>
              </div>
              <Link
                href={noteEntryEditHref(n)}
                className={`shrink-0 ${dashboardIconBtnPrimaryClass}`}
                aria-label="Edit note"
                title="Edit note"
              >
                <PencilIcon />
              </Link>
            </li>
          ))}
        </ul>
        {taskNotes.length === 0 ? (
          <p className="mt-2 text-sm text-zinc-500">No notes on this task yet.</p>
        ) : null}
      </section>

      <DetailCollapsibleSection title="Activity" titleClassName="text-base font-semibold text-zinc-900 dark:text-zinc-50">
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Created {new Date(task.createdAt).toLocaleString()} · Updated{" "}
          {new Date(task.updatedAt).toLocaleString()}
        </p>
      </DetailCollapsibleSection>
    </div>
  );
}
