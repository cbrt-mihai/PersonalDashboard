"use client";

import { useDashboardConfig } from "@/components/DashboardSettingsProvider";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { archiveNowIso, isArchived } from "@/lib/archive";
import type { Owner, Task, TaskGroup, TaskSubtask } from "@/lib/schemas";
import { EditPageArchiveField } from "./EditPageArchiveField";
import { EntityArchivedBanner } from "./EntityArchivedMark";
import { TASK_FORM_PRIORITIES, TASK_FORM_TYPES } from "@/lib/taskFormOptions";
import { MarkdownField } from "./MarkdownField";
import { MarkdownView } from "./MarkdownView";
import { NoteTagsEditor } from "./NoteTagsEditor";
import { TaskPriorityBadge, TaskTypeBadge } from "./TaskMetaBadges";
import { TaskStatusSelect } from "./TaskStatusSelect";

function sectionCard(className = "") {
  return `min-w-0 rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950 ${className}`;
}

export function TaskEditClient({ taskId }: { taskId: string }) {
  const { settings } = useDashboardConfig();
  const taskTypes = settings?.taskTypes ? settings.taskTypes.map((r) => r.label) : [...TASK_FORM_TYPES];
  const taskPriorities = settings?.taskPriorities
    ? settings.taskPriorities.map((r) => r.label)
    : [...TASK_FORM_PRIORITIES];

  const [task, setTask] = useState<Task | null>(null);
  const [owner, setOwner] = useState<Owner | null>(null);
  const [groups, setGroups] = useState<TaskGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [detailsEdit, setDetailsEdit] = useState(false);
  const [descEdit, setDescEdit] = useState(false);
  const [savingDetails, setSavingDetails] = useState(false);
  const [savingDesc, setSavingDesc] = useState(false);
  const [subtasksEdit, setSubtasksEdit] = useState(false);
  const [savingSubtasks, setSavingSubtasks] = useState(false);

  const [form, setForm] = useState({
    groupId: "" as string,
    name: "",
    description: "",
    type: "Task",
    status: "todo",
    date: "",
    priority: "Medium",
    tags: [] as string[],
    subtasks: [] as TaskSubtask[],
  });

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const tr = await fetch(`/api/tasks/${taskId}`);
      if (!tr.ok) throw new Error("Task not found");
      const t: Task = await tr.json();
      setTask(t);
      const [pr, gr] = await Promise.all([
        fetch(`/api/owners/${t.ownerId}`).then((r) => (r.ok ? r.json() : null)),
        fetch(`/api/owners/${t.ownerId}/groups`).then((r) => (r.ok ? r.json() : [])),
      ]);
      setOwner(pr);
      setGroups(Array.isArray(gr) ? gr : []);
      setForm({
        groupId: t.groupId ?? "",
        name: t.name,
        description: t.description,
        type: t.type,
        status: t.status,
        date: t.date.slice(0, 10),
        priority: t.priority,
        tags: t.tags ?? [],
        subtasks: [...(t.subtasks ?? [])],
      });
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to load");
      setTask(null);
    } finally {
      setLoading(false);
    }
  }, [taskId, setErr, setForm, setGroups, setLoading, setOwner, setTask]);

  useEffect(() => {
    queueMicrotask(() => {
      void load();
    });
  }, [load]);

  function cancelDetailsEdit() {
    if (!task) return;
    setForm((f) => ({
      ...f,
      groupId: task.groupId ?? "",
      name: task.name,
      type: task.type,
      status: task.status,
      date: task.date.slice(0, 10),
      priority: task.priority,
      tags: task.tags ?? [],
      subtasks: [...(task.subtasks ?? [])],
    }));
    setDetailsEdit(false);
  }

  function cancelDescEdit() {
    if (!task) return;
    setForm((f) => ({ ...f, description: task.description }));
    setDescEdit(false);
  }

  function cancelSubtasksEdit() {
    if (!task) return;
    setForm((f) => ({ ...f, subtasks: [...(task.subtasks ?? [])] }));
    setSubtasksEdit(false);
  }

  async function saveSubtasks() {
    if (!task) return;
    const cleaned = form.subtasks
      .map((s) => ({ ...s, title: s.title.trim() }))
      .filter((s) => s.title.length > 0);
    setSavingSubtasks(true);
    setErr(null);
    try {
      const r = await fetch(`/api/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subtasks: cleaned }),
      });
      if (!r.ok) throw new Error("Could not save");
      const next: Task = await r.json();
      setTask(next);
      setForm((f) => ({ ...f, subtasks: [...(next.subtasks ?? [])] }));
      setSubtasksEdit(false);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSavingSubtasks(false);
    }
  }

  async function saveDetails() {
    if (!task || !form.name.trim()) return;
    setSavingDetails(true);
    setErr(null);
    try {
      const r = await fetch(`/api/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          groupId: form.groupId ? form.groupId : null,
          name: form.name.trim(),
          type: form.type,
          status: form.status,
          date: form.date,
          priority: form.priority,
          tags: form.tags,
        }),
      });
      if (!r.ok) throw new Error("Could not save");
      const next: Task = await r.json();
      setTask(next);
      setForm((f) => ({
        ...f,
        groupId: next.groupId ?? "",
        name: next.name,
        description: next.description,
        type: next.type,
        status: next.status,
        date: next.date.slice(0, 10),
        priority: next.priority,
        tags: next.tags ?? [],
        subtasks: [...(next.subtasks ?? [])],
      }));
      setDetailsEdit(false);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSavingDetails(false);
    }
  }

  async function saveDescription() {
    if (!task) return;
    setSavingDesc(true);
    setErr(null);
    try {
      const r = await fetch(`/api/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: form.description }),
      });
      if (!r.ok) throw new Error("Could not save");
      const next: Task = await r.json();
      setTask(next);
      setForm((f) => ({
        ...f,
        description: next.description,
        subtasks: [...(next.subtasks ?? [])],
      }));
      setDescEdit(false);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSavingDesc(false);
    }
  }

  if (loading) return <p className="text-zinc-500">Loading…</p>;
  if (err && !task) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
        {err}{" "}
        <Link href="/" className="underline">
          Home
        </Link>
      </div>
    );
  }
  if (!task) return null;

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-8">
      <div>
        <Link
          href={`/tasks/${taskId}`}
          className="text-sm text-blue-600 hover:underline dark:text-blue-400"
        >
          ← Back to task
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          Edit task
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
          <strong>Edit details</strong> for epic, summary, type, status, date, and priority.{" "}
          <strong>Edit description</strong> for Markdown only. <strong>Edit subtasks</strong> for
          checklist items.
        </p>
      </div>

      {err ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
          {err}
        </div>
      ) : null}

      <EntityArchivedBanner entity={task} kind="task" />

      <EditPageArchiveField
        archived={isArchived(task)}
        onCommit={async (next) => {
          const r = await fetch(`/api/tasks/${taskId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ archivedAt: next ? archiveNowIso() : null }),
          });
          if (!r.ok) throw new Error("Could not update archive state");
          const t: Task = await r.json();
          setTask(t);
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
              <dt className="text-xs font-medium text-zinc-500 uppercase">Summary</dt>
              <dd className="mt-1 text-zinc-900 dark:text-zinc-100">{task.name}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-zinc-500 uppercase">Epic</dt>
              <dd className="mt-1 text-zinc-800 dark:text-zinc-200">
                {task.groupId
                  ? (groups.find((g) => g.id === task.groupId)?.name ?? "—")
                  : "None"}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-zinc-500 uppercase">Type</dt>
              <dd className="mt-1">
                <TaskTypeBadge type={task.type} />
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-zinc-500 uppercase">Status</dt>
              <dd className="mt-1 text-zinc-800 dark:text-zinc-200">{task.status}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-zinc-500 uppercase">Date</dt>
              <dd className="mt-1 text-zinc-800 dark:text-zinc-200">{task.date.slice(0, 10)}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-zinc-500 uppercase">Priority</dt>
              <dd className="mt-1">
                <TaskPriorityBadge priority={task.priority} />
              </dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-xs font-medium text-zinc-500 uppercase">Tags</dt>
              <dd className="mt-1 text-zinc-800 dark:text-zinc-200">
                {(task.tags ?? []).length ? (task.tags ?? []).join(", ") : "—"}
              </dd>
            </div>
          </dl>
        ) : (
          <div className="mt-4 flex flex-col gap-4">
            <label className="text-sm">
              <span className="text-zinc-500">Epic</span>
              <select
                value={form.groupId}
                onChange={(e) => setForm((f) => ({ ...f, groupId: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-zinc-300 px-2 py-2 dark:border-zinc-600 dark:bg-zinc-900"
              >
                <option value="">None</option>
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm">
              <span className="text-zinc-500">Summary / title</span>
              <input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-zinc-300 px-2 py-2 dark:border-zinc-600 dark:bg-zinc-900"
              />
            </label>
            <label className="text-sm">
              <span className="text-zinc-500">Type</span>
              <select
                value={form.type}
                onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-zinc-300 px-2 py-2 dark:border-zinc-600 dark:bg-zinc-900"
              >
                {taskTypes.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm">
              <span className="text-zinc-500">Status</span>
              <TaskStatusSelect
                value={form.status}
                onChange={(v) => setForm((f) => ({ ...f, status: v }))}
                className="mt-1 w-full rounded-lg border border-zinc-300 px-2 py-2 dark:border-zinc-600 dark:bg-zinc-900"
              />
            </label>
            <label className="text-sm">
              <span className="text-zinc-500">Date</span>
              <input
                type="date"
                value={form.date}
                onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-zinc-300 px-2 py-2 dark:border-zinc-600 dark:bg-zinc-900"
              />
            </label>
            <label className="text-sm">
              <span className="text-zinc-500">Priority</span>
              <select
                value={form.priority}
                onChange={(e) => setForm((f) => ({ ...f, priority: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-zinc-300 px-2 py-2 dark:border-zinc-600 dark:bg-zinc-900"
              >
                {taskPriorities.map((p) => (
                  <option key={p} value={p}>
                    {p}
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
            {task.description?.trim() ? (
              <MarkdownView markdown={task.description} />
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

      <section className={sectionCard()}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">Subtasks</h2>
          {!subtasksEdit ? (
            <button
              type="button"
              onClick={() => setSubtasksEdit(true)}
              className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm font-medium hover:bg-zinc-50 dark:border-zinc-600 dark:hover:bg-zinc-900"
            >
              Edit subtasks
            </button>
          ) : null}
        </div>
        {!subtasksEdit ? (
          <ul className="mt-4 list-none space-y-2 p-0">
            {(task.subtasks ?? []).length ? (
              (task.subtasks ?? []).map((s) => (
                <li key={s.id} className="flex items-start gap-2 text-sm text-zinc-800 dark:text-zinc-200">
                  <input
                    type="checkbox"
                    checked={s.done}
                    readOnly
                    disabled
                    className="mt-0.5 rounded border-zinc-300 dark:border-zinc-600"
                    aria-hidden
                  />
                  <span className={s.done ? "text-zinc-500 line-through" : undefined}>{s.title}</span>
                </li>
              ))
            ) : (
              <p className="text-sm text-zinc-500 italic">No subtasks yet.</p>
            )}
          </ul>
        ) : (
          <div className="mt-4 flex flex-col gap-3">
            {form.subtasks.length ? (
              form.subtasks.map((s, idx) => (
                <div key={s.id} className="flex flex-wrap items-center gap-2">
                  <div className="flex shrink-0 flex-col gap-0.5">
                    <button
                      type="button"
                      disabled={idx === 0}
                      onClick={() =>
                        setForm((f) => {
                          if (idx <= 0) return f;
                          const next = [...f.subtasks];
                          [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
                          return { ...f, subtasks: next };
                        })
                      }
                      className="rounded border border-zinc-300 px-1 py-0 text-[10px] font-medium leading-tight text-zinc-600 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-900"
                      aria-label="Move subtask up"
                      title="Move up"
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      disabled={idx >= form.subtasks.length - 1}
                      onClick={() =>
                        setForm((f) => {
                          if (idx >= f.subtasks.length - 1) return f;
                          const next = [...f.subtasks];
                          [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
                          return { ...f, subtasks: next };
                        })
                      }
                      className="rounded border border-zinc-300 px-1 py-0 text-[10px] font-medium leading-tight text-zinc-600 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-900"
                      aria-label="Move subtask down"
                      title="Move down"
                    >
                      ↓
                    </button>
                  </div>
                  <input
                    type="checkbox"
                    checked={s.done}
                    onChange={() =>
                      setForm((f) => ({
                        ...f,
                        subtasks: f.subtasks.map((x, i) =>
                          i === idx ? { ...x, done: !x.done } : x,
                        ),
                      }))
                    }
                    className="rounded border-zinc-300 dark:border-zinc-600"
                    aria-label={`Done: ${s.title || "subtask"}`}
                  />
                  <input
                    value={s.title}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        subtasks: f.subtasks.map((x, i) =>
                          i === idx ? { ...x, title: e.target.value } : x,
                        ),
                      }))
                    }
                    placeholder="Subtask title"
                    className="min-w-[12rem] flex-1 rounded-lg border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-600 dark:bg-zinc-900"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setForm((f) => ({
                        ...f,
                        subtasks: f.subtasks.filter((_, i) => i !== idx),
                      }))
                    }
                    className="rounded-lg border border-zinc-300 px-2 py-1 text-xs dark:border-zinc-600"
                  >
                    Remove
                  </button>
                </div>
              ))
            ) : (
              <p className="text-sm text-zinc-500">No rows yet — add one below.</p>
            )}
            <button
              type="button"
              onClick={() =>
                setForm((f) => ({
                  ...f,
                  subtasks: [
                    ...f.subtasks,
                    { id: crypto.randomUUID(), title: "", done: false },
                  ],
                }))
              }
              className="self-start rounded-lg border border-zinc-300 px-3 py-1.5 text-sm dark:border-zinc-600"
            >
              Add subtask
            </button>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={savingSubtasks}
                onClick={() => void saveSubtasks()}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {savingSubtasks ? "Saving…" : "Save subtasks"}
              </button>
              <button
                type="button"
                onClick={cancelSubtasksEdit}
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
          href={`/tasks/${taskId}`}
          className="text-blue-600 hover:underline dark:text-blue-400"
        >
          Done — view task
        </Link>
      </p>
    </div>
  );
}
