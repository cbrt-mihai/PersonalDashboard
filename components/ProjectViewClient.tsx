"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { isArchived } from "@/lib/archive";
import { NOTE_ENTRY_TYPES } from "@/lib/noteEntryFormOptions";
import { noteEntryAttributionForSwatch } from "@/lib/noteEntryAttributionDisplay";
import { noteEntryEditHref, noteEntryViewHref } from "@/lib/noteEntryPaths";
import type { Owner, OwnerEntry, Project, Task, TaskGroup } from "@/lib/schemas";
import {
  TASK_FORM_PRIORITIES,
  TASK_FORM_TYPES,
} from "@/lib/taskFormOptions";
import { CollapsibleMarkdown } from "./CollapsibleMarkdown";
import { MarkdownField } from "./MarkdownField";
import { NoteStatusSelect } from "./NoteStatusSelect";
import { NoteTagsEditor } from "./NoteTagsEditor";
import {
  entryMatchesTagKeys,
  normalizeTagKey,
  tagOptionsFromEntries,
} from "@/lib/noteTags";
import { normalizeStatusKey, statusDef } from "@/lib/statusConfig";
import { DetailCollapsibleSection } from "./DetailCollapsibleSection";
import { DashboardFilterDisclosure } from "./DashboardFilterDisclosure";
import { WorklogSection } from "./WorklogSection";
import { EntityArchivedBadge, EntityArchivedBanner } from "./EntityArchivedMark";
import { FilterMultiDropdown } from "./FilterMultiDropdown";
import { SearchableSingleSelect } from "./SearchableSingleSelect";
import { TaskPriorityBadge, TaskTypeBadge } from "./TaskMetaBadges";
import { MarkdownView } from "@/components/MarkdownView";
import { OwnerSwatch } from "@/components/OwnerSwatch";
import { ProgressBar } from "@/components/ProgressBar";
import { StatusBadge } from "@/components/StatusBadge";
import { TrashIcon } from "@/components/icons";
import { useDashboardConfig } from "@/components/DashboardSettingsProvider";
import {
  epicRollupStateFromTasks,
  type EpicRollupState,
} from "@/lib/epicRollupState";

export function ProjectViewClient({ projectId }: { projectId: string }) {
  const router = useRouter();
  const { statusMap, statusKeys, settings, noteStatusKeys } = useDashboardConfig();
  const defaultNoteStatus = noteStatusKeys[0] ?? "open";
  const noteTypes = settings?.noteTypes ?? [...NOTE_ENTRY_TYPES];
  const notePriorities = settings?.taskPriorities
    ? settings.taskPriorities.map((r) => r.label)
    : [...TASK_FORM_PRIORITIES];
  const [project, setProject] = useState<Project | null>(null);
  const [groups, setGroups] = useState<TaskGroup[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [owners, setOwners] = useState<Owner[]>([]);
  const [entries, setEntries] = useState<OwnerEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [noteQ, setNoteQ] = useState("");
  const [noteTagKeys, setNoteTagKeys] = useState<string[]>([]);
  const [noteShowArchived, setNoteShowArchived] = useState(false);
  const [entryCreateOpen, setEntryCreateOpen] = useState(false);
  const [entryForm, setEntryForm] = useState({
    title: "",
    body: "",
    status: "open",
    type: "Note",
    priority: "Medium",
    tags: [] as string[],
    ownerId: "",
  });

  const [q, setQ] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [ownerIds, setOwnerIds] = useState<string[]>([]);
  const [tagKeys, setTagKeys] = useState<string[]>([]);

  const [taskQ, setTaskQ] = useState("");
  const [taskOwnerIds, setTaskOwnerIds] = useState<string[]>([]);
  const [taskStatusKeys, setTaskStatusKeys] = useState<string[]>([]);
  const [taskTypes, setTaskTypes] = useState<string[]>([]);
  const [taskPriorities, setTaskPriorities] = useState<string[]>([]);
  const [taskTagKeys, setTaskTagKeys] = useState<string[]>([]);
  const [showArchivedTasks, setShowArchivedTasks] = useState(false);

  const projectsForNoteSwatch = project ? [project] : [];

  function pct(n: number, d: number): string {
    if (!d) return "0%";
    const p = Math.round((n * 1000) / d) / 10; // 1 decimal
    return `${p}%`;
  }

  function isLikeStatus(s: string, key: "done" | "closed") {
    const nk = normalizeStatusKey(s);
    if (nk === key) return true;
    const def = statusDef(s, statusMap);
    return normalizeStatusKey(def.label) === key;
  }

  function terminalBreakdown(list: Task[]) {
    const done = list.filter((t) => isLikeStatus(t.status, "done")).length;
    const closed = list.filter((t) => isLikeStatus(t.status, "closed")).length;
    return { done, closed, total: done + closed };
  }

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const pr = await fetch(`/api/projects/${projectId}`);
      if (!pr.ok) throw new Error("Project not found");
      const p: Project = await pr.json();
      setProject(p);
      const [ep, tk, pa, nt] = await Promise.all([
        fetch(`/api/projects/${projectId}/epics`).then((r) => (r.ok ? r.json() : [])),
        fetch("/api/tasks").then((r) => (r.ok ? r.json() : [])),
        fetch("/api/owners").then((r) => (r.ok ? r.json() : [])),
        fetch(`/api/projects/${projectId}/entries`).then((r) => (r.ok ? r.json() : [])),
      ]);
      setGroups(Array.isArray(ep) ? ep : []);
      setTasks(Array.isArray(tk) ? tk : []);
      setOwners(Array.isArray(pa) ? pa : []);
      setEntries(Array.isArray(nt) ? nt : []);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to load");
      setProject(null);
      setGroups([]);
      setTasks([]);
      setOwners([]);
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    queueMicrotask(() => {
      void load();
    });
  }, [load]);

  async function onDelete() {
    if (!project || !confirm("Delete this project? Epics will be unassigned.")) return;
    const r = await fetch(`/api/projects/${project.id}`, { method: "DELETE" });
    if (!r.ok) return;
    router.push("/projects");
    router.refresh();
  }

  const ownerFilterOptions = useMemo(
    () =>
      owners
        .filter((p) => showArchived || !isArchived(p))
        .map((p) => ({ value: p.id, label: p.name })),
    [owners, showArchived],
  );

  const visibleGroups = useMemo(
    () => (showArchived ? groups : groups.filter((g) => !isArchived(g))),
    [groups, showArchived],
  );

  const tagFilterOptions = useMemo(
    () => tagOptionsFromEntries(visibleGroups),
    [visibleGroups],
  );

  const epicRows = useMemo(() => {
    return visibleGroups
      .map((g) => {
        const owner = owners.find((p) => p.id === g.ownerId) ?? null;
        const accent = owner?.color ?? "#6366f1";
        const inGroup = tasks.filter((t) => t.groupId === g.id && !isArchived(t));
        const rollup = epicRollupStateFromTasks(inGroup, statusMap);
        const terminal = terminalBreakdown(inGroup);
        const total = inGroup.length;
        return { g, owner, accent, inGroup, rollup, terminal, total };
      })
      .sort((a, b) => {
        const pc = (a.owner?.name ?? "").localeCompare(b.owner?.name ?? "");
        if (pc !== 0) return pc;
        return a.g.name.localeCompare(b.g.name);
      });
  }, [visibleGroups, owners, statusMap, tasks]);

  const overviewStats = useMemo(() => {
    const epicIds = new Set(visibleGroups.map((g) => g.id));
    const projectTasks = tasks.filter((t) => t.groupId && epicIds.has(t.groupId));
    const terminal = terminalBreakdown(projectTasks);
    const byRollup: Record<EpicRollupState, number> = {
      open: 0,
      in_progress: 0,
      blocked: 0,
      done: 0,
      closed: 0,
    };
    for (const g of visibleGroups) {
      const inG = tasks.filter((t) => t.groupId === g.id);
      const st = epicRollupStateFromTasks(inG, statusMap);
      byRollup[st] += 1;
    }
    const ownerIdSet = new Set(visibleGroups.map((g) => g.ownerId));
    return {
      epicCount: visibleGroups.length,
      taskCount: projectTasks.length,
      terminal,
      uniqueOwners: ownerIdSet.size,
      byRollup: { ...byRollup },
    };
  }, [visibleGroups, tasks, statusMap]);

  const filteredRows = useMemo(() => {
    let rows = epicRows;
    const ql = q.trim().toLowerCase();
    if (ql) {
      rows = rows.filter(
        (r) =>
          r.g.name.toLowerCase().includes(ql) ||
          (r.g.description ?? "").toLowerCase().includes(ql),
      );
    }
    if (ownerIds.length) {
      rows = rows.filter((r) => ownerIds.includes(r.g.ownerId));
    }
    if (tagKeys.length) {
      rows = rows.filter((r) => entryMatchesTagKeys(r.g.tags, tagKeys));
    }
    return rows;
  }, [epicRows, ownerIds, q, tagKeys]);

  const projectEpicIdSet = useMemo(() => new Set(groups.map((g) => g.id)), [groups]);

  const groupById = useMemo(() => new Map(groups.map((g) => [g.id, g] as const)), [groups]);

  const tasksInProject = useMemo(
    () => tasks.filter((t) => t.groupId != null && projectEpicIdSet.has(t.groupId)),
    [tasks, projectEpicIdSet],
  );

  const taskTypeOptions = useMemo(
    () =>
      (settings?.taskTypes ? settings.taskTypes.map((r) => r.label) : [...TASK_FORM_TYPES]).map(
        (label) => ({ value: label, label }),
      ),
    [settings],
  );

  const taskPriorityOptions = useMemo(
    () =>
      (settings?.taskPriorities
        ? settings.taskPriorities.map((r) => r.label)
        : [...TASK_FORM_PRIORITIES]
      ).map((label) => ({ value: label, label })),
    [settings],
  );

  const taskOwnerFilterOptions = useMemo(() => {
    const ids = new Set(tasksInProject.map((t) => t.ownerId));
    return owners
      .filter((p) => ids.has(p.id))
      .map((p) => ({ value: p.id, label: p.name }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [tasksInProject, owners]);

  const taskStatusFilterOptions = useMemo(
    () =>
      statusKeys.map((k) => ({
        value: k,
        label: statusDef(k, statusMap).label,
      })),
    [statusKeys, statusMap],
  );

  const taskTagFilterOptions = useMemo(
    () =>
      tagOptionsFromEntries(
        showArchivedTasks ? tasksInProject : tasksInProject.filter((t) => !isArchived(t)),
      ),
    [tasksInProject, showArchivedTasks],
  );

  const filteredProjectTasks = useMemo(() => {
    let list = tasksInProject;
    if (!showArchivedTasks) list = list.filter((t) => !isArchived(t));
    const ql = taskQ.trim().toLowerCase();
    if (ql) {
      list = list.filter(
        (t) =>
          t.name.toLowerCase().includes(ql) ||
          (t.description ?? "").toLowerCase().includes(ql) ||
          (t.tags ?? []).some((tag) => tag.toLowerCase().includes(ql)),
      );
    }
    if (taskOwnerIds.length) {
      list = list.filter((t) => taskOwnerIds.includes(t.ownerId));
    }
    if (taskStatusKeys.length) {
      list = list.filter((t) =>
        taskStatusKeys.some((k) => normalizeStatusKey(k) === normalizeStatusKey(t.status)),
      );
    }
    if (taskTypes.length) {
      list = list.filter((t) => taskTypes.includes(t.type));
    }
    if (taskPriorities.length) {
      list = list.filter((t) => taskPriorities.includes(t.priority));
    }
    if (taskTagKeys.length) {
      list = list.filter((t) => entryMatchesTagKeys(t.tags, taskTagKeys));
    }
    return [...list].sort((a, b) => {
      const dc = b.date.localeCompare(a.date);
      if (dc !== 0) return dc;
      return a.name.localeCompare(b.name);
    });
  }, [
    tasksInProject,
    showArchivedTasks,
    taskQ,
    taskOwnerIds,
    taskStatusKeys,
    taskTypes,
    taskPriorities,
    taskTagKeys,
  ]);

  const noteTagFilterOptions = useMemo(
    () =>
      tagOptionsFromEntries(
        noteShowArchived ? entries : entries.filter((e) => !isArchived(e)),
      ),
    [entries, noteShowArchived],
  );

  const filteredProjectNotes = useMemo(() => {
    let list = entries;
    if (!noteShowArchived) list = list.filter((e) => !isArchived(e));
    const ql = noteQ.trim().toLowerCase();
    if (noteTagKeys.length) {
      list = list.filter((e) => entryMatchesTagKeys(e.tags, noteTagKeys));
    }
    if (ql) {
      list = list.filter(
        (e) =>
          e.title.toLowerCase().includes(ql) || (e.body ?? "").toLowerCase().includes(ql),
      );
    }
    return list;
  }, [entries, noteQ, noteTagKeys, noteShowArchived]);

  function openEntryCreate() {
    setEntryCreateOpen(true);
    setEntryForm({
      title: "",
      body: "",
      status: defaultNoteStatus,
      type: "Note",
      priority: "Medium",
      tags: [],
      ownerId: "",
    });
  }

  async function saveProjectEntry() {
    if (!entryForm.title.trim()) return;
    await fetch(`/api/projects/${projectId}/entries`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: entryForm.title.trim(),
        body: entryForm.body,
        status: entryForm.status,
        type: entryForm.type,
        priority: entryForm.priority,
        tags: entryForm.tags,
        ownerId: entryForm.ownerId ? entryForm.ownerId : null,
      }),
    });
    setEntryCreateOpen(false);
    await load();
  }

  async function deleteProjectEntry(id: string) {
    if (!confirm("Delete this note?")) return;
    await fetch(`/api/entries/${id}`, { method: "DELETE" });
    await load();
  }

  if (loading) return <p className="text-zinc-500">Loading…</p>;
  if (err || !project) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
        {err ?? "Not found"}{" "}
        <Link href="/projects" className="underline">
          Projects
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <EntityArchivedBanner entity={project} kind="project" />
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap gap-2 text-sm text-zinc-500">
            <Link href="/projects" className="text-blue-600 hover:underline dark:text-blue-400">
              Projects
            </Link>
          </div>
          <div className="mt-2 flex items-start gap-3">
            <OwnerSwatch
              color={project.color}
              iconDataUrl={project.iconDataUrl}
              className="h-12 w-12 rounded-xl"
              title={project.name}
            />
            <h1 className="text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
              {project.name}
            </h1>
          </div>
          <p className="mt-2 text-xs text-zinc-500">
            Wiki link:{" "}
            <code className="rounded bg-zinc-200 px-1 dark:bg-zinc-800">
              {`[[project:${project.id}]]`}
            </code>
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href={`/projects/${project.id}/edit`}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Edit
          </Link>
          <button
            type="button"
            onClick={() => void onDelete()}
            className="inline-flex items-center justify-center rounded-lg border border-red-300 p-2 text-red-700 hover:bg-red-50 dark:border-red-800 dark:text-red-300 dark:hover:bg-red-950/40"
            aria-label="Delete project"
            title="Delete project"
          >
            <TrashIcon />
          </button>
        </div>
      </div>

      <section className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Overview</h2>
        <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <dt className="text-zinc-500">Epics</dt>
            <dd className="mt-1 font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">
              {overviewStats.epicCount}
            </dd>
          </div>
          <div>
            <dt className="text-zinc-500">Tasks (in epics)</dt>
            <dd className="mt-1 font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">
              {overviewStats.taskCount}
            </dd>
          </div>
          <div>
            <dt className="text-zinc-500">Terminal done</dt>
            <dd className="mt-1 font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">
              {overviewStats.taskCount === 0
                ? "—"
                : `${overviewStats.terminal.done} / ${overviewStats.taskCount} (${pct(
                    overviewStats.terminal.done,
                    overviewStats.taskCount,
                  )})`}
            </dd>
          </div>
          <div>
            <dt className="text-zinc-500">Terminal closed</dt>
            <dd className="mt-1 font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">
              {overviewStats.taskCount === 0
                ? "—"
                : `${overviewStats.terminal.closed} / ${overviewStats.taskCount} (${pct(
                    overviewStats.terminal.closed,
                    overviewStats.taskCount,
                  )})`}
            </dd>
          </div>
          <div>
            <dt className="text-zinc-500">Terminal total</dt>
            <dd className="mt-1 font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">
              {overviewStats.taskCount === 0
                ? "—"
                : `${overviewStats.terminal.total} / ${overviewStats.taskCount} (${pct(
                    overviewStats.terminal.total,
                    overviewStats.taskCount,
                  )})`}
            </dd>
          </div>
          <div>
            <dt className="text-zinc-500">Owners (in epics)</dt>
            <dd className="mt-1 font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">
              {overviewStats.uniqueOwners}
            </dd>
          </div>
          <div className="sm:col-span-2 lg:col-span-4">
            <dt className="text-zinc-500">Epics by rollup state</dt>
            <dd className="mt-2 flex flex-wrap gap-2">
              {(
                [
                  ["open", overviewStats.byRollup.open],
                  ["in_progress", overviewStats.byRollup.in_progress],
                  ["blocked", overviewStats.byRollup.blocked],
                  ["done", overviewStats.byRollup.done],
                  ["closed", overviewStats.byRollup.closed],
                ] as const
              ).map(([key, count]) => (
                <span
                  key={key}
                  className="inline-flex items-center gap-1.5 rounded-full border border-zinc-200 bg-zinc-50 px-2 py-1 text-xs dark:border-zinc-700 dark:bg-zinc-900"
                >
                  <StatusBadge status={key} />
                  <span className="tabular-nums font-medium text-zinc-800 dark:text-zinc-200">
                    {count}
                    {overviewStats.epicCount > 0 ? (
                      <span className="font-normal text-zinc-500 dark:text-zinc-400">
                        {" "}
                        ({pct(count, overviewStats.epicCount)})
                      </span>
                    ) : null}
                  </span>
                </span>
              ))}
            </dd>
          </div>
          <div className="sm:col-span-2 lg:col-span-4">
            <dt className="text-zinc-500">Project tags</dt>
            <dd className="mt-1">
              {(project.tags ?? []).length ? (
                <div className="flex flex-wrap gap-1">
                  {(project.tags ?? []).map((t) => (
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
      </section>

      <section>
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Description</h2>
        <div className="mt-3 text-sm text-zinc-700 dark:text-zinc-300">
          {project.description?.trim() ? (
            <MarkdownView markdown={project.description} />
          ) : (
            <p className="italic text-zinc-500">No description.</p>
          )}
        </div>
      </section>

      <DetailCollapsibleSection title="Project notes">
        <div className="flex flex-wrap justify-end gap-2">
            <Link
              href="/notes"
              className="rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-600"
            >
              All notes
            </Link>
            <button
              type="button"
              onClick={openEntryCreate}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              Add note
            </button>
        </div>
        <p className="mt-2 text-sm text-zinc-500">
          Notes linked to this project, optionally also to an owner. Open or edit uses the best URL
          (owner page when an owner is set, otherwise the global note URL).
        </p>
        <DashboardFilterDisclosure className="mt-4" title="Note search & filters">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-sm sm:col-span-2">
              <span className="text-zinc-500">Search notes (this project)</span>
              <input
                value={noteQ}
                onChange={(e) => setNoteQ(e.target.value)}
                placeholder="Title or body"
                className="rounded-lg border border-zinc-300 px-2 py-1.5 dark:border-zinc-600 dark:bg-zinc-900"
              />
            </label>
            <FilterMultiDropdown
              label="Tags (any match)"
              options={noteTagFilterOptions}
              selected={noteTagKeys}
              onChange={setNoteTagKeys}
            />
            <label className="flex items-center gap-2 text-sm text-zinc-700 sm:col-span-2 dark:text-zinc-200">
              <input
                type="checkbox"
                checked={noteShowArchived}
                onChange={(e) => setNoteShowArchived(e.target.checked)}
                className="rounded border-zinc-300 dark:border-zinc-600"
              />
              Show archived notes
            </label>
          </div>
        </DashboardFilterDisclosure>
        <ul className="mt-4 flex flex-col gap-4">
          {filteredProjectNotes.map((e) => {
            const sw = noteEntryAttributionForSwatch(e, owners, projectsForNoteSwatch);
            return (
              <li
                key={e.id}
                className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950"
                {...(isArchived(e) ? { "data-pd-archived": "true" } : {})}
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <h3 className="flex flex-wrap items-center gap-2 font-semibold text-zinc-900 dark:text-zinc-50">
                      <span>{e.title}</span>
                      <EntityArchivedBadge entity={e} />
                    </h3>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-zinc-500">
                      <time>{new Date(e.createdAt).toLocaleString()}</time>
                      {sw.owner ? (
                        <Link
                          href={`/owners/${sw.owner.id}`}
                          className="inline-flex items-center gap-1 text-blue-600 hover:underline dark:text-blue-400"
                        >
                          <OwnerSwatch
                            owner={sw.owner}
                            className="h-5 w-5 rounded"
                            title={sw.owner.name}
                          />
                          {sw.owner.name}
                        </Link>
                      ) : project && e.projectId === project.id ? (
                        <Link
                          href={`/projects/${project.id}`}
                          className="inline-flex items-center gap-1 text-blue-600 hover:underline dark:text-blue-400"
                        >
                          <OwnerSwatch
                            color={sw.color}
                            iconDataUrl={sw.iconDataUrl}
                            className="h-5 w-5 rounded"
                            title={sw.title}
                          />
                          {sw.title}
                        </Link>
                      ) : (
                        <span className="text-zinc-500">No owner or project</span>
                      )}
                    </div>
                    {(e.tags ?? []).length ? (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {(e.tags ?? []).map((t) => (
                          <span
                            key={normalizeTagKey(t)}
                            className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
                          >
                            {t}
                          </span>
                        ))}
                      </div>
                    ) : null}
                    <div className="mt-2 flex flex-wrap gap-2">
                      <StatusBadge variant="note" status={e.status ?? defaultNoteStatus} />
                      <span className="text-xs text-zinc-500">{e.type ?? "Note"}</span>
                      <span className="text-xs text-zinc-500">{e.priority ?? "Medium"}</span>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 text-sm">
                    <Link
                      href={noteEntryViewHref(e)}
                      className="font-medium text-blue-600 hover:underline dark:text-blue-400"
                    >
                      Open
                    </Link>
                    <Link
                      href={noteEntryEditHref(e)}
                      className="text-blue-600 hover:underline"
                    >
                      Edit
                    </Link>
                    <button
                      type="button"
                      className="inline-flex items-center justify-center rounded p-1 text-red-600 hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-950/40 dark:hover:text-red-300"
                      onClick={() => void deleteProjectEntry(e.id)}
                      aria-label="Delete note"
                      title="Delete note"
                    >
                      <TrashIcon />
                    </button>
                  </div>
                </div>
                <div className="mt-3 text-sm text-zinc-700 dark:text-zinc-300">
                  <CollapsibleMarkdown
                    markdown={e.body || "_Empty_"}
                    maxChars={220}
                    maxLines={10}
                    collapsedMaxClass="max-h-36"
                  />
                </div>
              </li>
            );
          })}
        </ul>
        {filteredProjectNotes.length === 0 ? (
          <p className="mt-2 text-sm text-zinc-500">
            {entries.length === 0
              ? "No notes for this project yet."
              : "No notes match search or tag filters."}
          </p>
        ) : null}
      </DetailCollapsibleSection>

      <DetailCollapsibleSection title="Epics">
        <DashboardFilterDisclosure className="mt-0" title="Epic search & filters">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <label className="flex flex-col gap-1 text-sm sm:col-span-2 lg:col-span-3">
              <span className="text-zinc-500">Search epics</span>
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Epic name or description"
                className="rounded-lg border border-zinc-300 px-2 py-1.5 dark:border-zinc-600 dark:bg-zinc-900"
              />
            </label>
            <FilterMultiDropdown
              label="Owner"
              options={ownerFilterOptions}
              selected={ownerIds}
              onChange={setOwnerIds}
            />
            <FilterMultiDropdown
              label="Tags (any match)"
              options={tagFilterOptions}
              selected={tagKeys}
              onChange={setTagKeys}
            />
            <label className="flex items-center gap-2 text-sm text-zinc-700 sm:col-span-2 lg:col-span-3 dark:text-zinc-200">
              <input
                type="checkbox"
                checked={showArchived}
                onChange={(e) => setShowArchived(e.target.checked)}
                className="rounded border-zinc-300 dark:border-zinc-600"
              />
              Show archived epics
            </label>
          </div>
        </DashboardFilterDisclosure>

        <p className="mt-3 text-sm text-zinc-500">
          {filteredRows.length} epic{filteredRows.length === 1 ? "" : "s"} in current filters
        </p>

        {groups.length === 0 ? (
          <p className="mt-3 rounded-xl border border-dashed border-zinc-300 bg-zinc-50/50 px-4 py-8 text-center text-sm text-zinc-500 dark:border-zinc-600 dark:bg-zinc-900/30">
            No epics in this project yet. Add epics from{" "}
            <Link href={`/projects/${project.id}/edit`} className="text-blue-600 underline dark:text-blue-400">
              Edit project
            </Link>
            .
          </p>
        ) : visibleGroups.length === 0 ? (
          <p className="mt-3 rounded-xl border border-dashed border-zinc-300 bg-zinc-50/50 px-4 py-8 text-center text-sm text-zinc-500 dark:border-zinc-600 dark:bg-zinc-900/30">
            All epics in this project are archived. Turn on <strong>Show archived epics</strong> above to
            list them.
          </p>
        ) : filteredRows.length === 0 ? (
          <p className="mt-3 text-sm text-zinc-500">No epics match.</p>
        ) : (
          <ul className="mt-3 flex flex-col gap-2">
            {filteredRows.map(({ g, owner, accent, inGroup, rollup, terminal, total }) => (
              <li
                key={g.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-2 dark:border-zinc-800 dark:bg-zinc-950"
                style={{ borderLeftWidth: 4, borderLeftColor: accent }}
                {...(isArchived(g) ? { "data-pd-archived": "true" } : {})}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    {owner ? (
                      <OwnerSwatch
                        owner={owner}
                        className="h-8 w-8 shrink-0 rounded-lg"
                        title={`${g.name} · ${owner.name}`}
                      />
                    ) : null}
                    <Link
                      href={`/epics/${g.id}`}
                      className="font-medium text-blue-600 hover:underline dark:text-blue-400"
                    >
                      {g.name}
                    </Link>
                    <EntityArchivedBadge entity={g} />
                    <StatusBadge status={rollup} />
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    {owner ? (
                      <Link
                        href={`/owners/${owner.id}`}
                        className="inline-flex items-center gap-1.5 text-xs text-zinc-600 hover:underline dark:text-zinc-400"
                        title={owner.name}
                      >
                        <span
                          className="h-2 w-2 rounded-sm"
                          style={{ backgroundColor: owner.color }}
                          aria-hidden
                        />
                        {owner.name}
                      </Link>
                    ) : (
                      <span className="text-xs text-zinc-500">{g.ownerId}</span>
                    )}
                    <span className="text-xs tabular-nums text-zinc-600 dark:text-zinc-400">
                      {total} task{total === 1 ? "" : "s"}
                      {total > 0 ? (
                        <>
                          {" "}
                          · done {terminal.done}/{total} ({pct(terminal.done, total)})
                          {" "}
                          · closed {terminal.closed}/{total} ({pct(terminal.closed, total)})
                        </>
                      ) : null}
                    </span>
                  </div>
                  <div className="mt-2 max-w-md">
                    <ProgressBar tasks={inGroup} statusMap={statusMap} />
                  </div>
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-3 text-sm">
                  <Link
                    href={`/epics/${g.id}`}
                    className="text-zinc-600 hover:underline dark:text-zinc-400"
                  >
                    Overview
                  </Link>
                  <Link
                    href={`/epics/${g.id}/edit`}
                    className="text-blue-600 hover:underline dark:text-blue-400"
                  >
                    Edit
                  </Link>
                  <Link
                    href={`/?groupId=${g.id}`}
                    className="text-zinc-600 hover:underline dark:text-zinc-400"
                  >
                    View tasks
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </DetailCollapsibleSection>

      <DetailCollapsibleSection title="Tasks">
        <p className="text-sm text-zinc-500">
          Tasks whose epic belongs to this project (any epic state). Use filters and{" "}
          <strong>Show archived tasks</strong> to include archived work items.
        </p>
        <DashboardFilterDisclosure className="mt-4" title="Task search & filters">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <label className="flex flex-col gap-1 text-sm sm:col-span-2 lg:col-span-3">
              <span className="text-zinc-500">Search tasks</span>
              <input
                value={taskQ}
                onChange={(e) => setTaskQ(e.target.value)}
                placeholder="Name, description, or tag"
                className="rounded-lg border border-zinc-300 px-2 py-1.5 dark:border-zinc-600 dark:bg-zinc-900"
              />
            </label>
            <FilterMultiDropdown
              label="Owner"
              options={taskOwnerFilterOptions}
              selected={taskOwnerIds}
              onChange={setTaskOwnerIds}
            />
            <FilterMultiDropdown
              label="Status"
              options={taskStatusFilterOptions}
              selected={taskStatusKeys}
              onChange={setTaskStatusKeys}
            />
            <FilterMultiDropdown
              label="Type"
              options={taskTypeOptions}
              selected={taskTypes}
              onChange={setTaskTypes}
            />
            <FilterMultiDropdown
              label="Priority"
              options={taskPriorityOptions}
              selected={taskPriorities}
              onChange={setTaskPriorities}
            />
            <FilterMultiDropdown
              label="Tags (any match)"
              options={taskTagFilterOptions}
              selected={taskTagKeys}
              onChange={setTaskTagKeys}
            />
            <label className="flex items-center gap-2 text-sm text-zinc-700 sm:col-span-2 lg:col-span-3 dark:text-zinc-200">
              <input
                type="checkbox"
                checked={showArchivedTasks}
                onChange={(e) => setShowArchivedTasks(e.target.checked)}
                className="rounded border-zinc-300 dark:border-zinc-600"
              />
              Show archived tasks
            </label>
          </div>
        </DashboardFilterDisclosure>
        <p className="mt-3 text-sm text-zinc-500">
          {filteredProjectTasks.length} task{filteredProjectTasks.length === 1 ? "" : "s"} in current
          filters ({tasksInProject.length} total in project)
        </p>
        {tasksInProject.length === 0 ? (
          <p className="mt-3 text-sm text-zinc-500">No tasks in this project&apos;s epics yet.</p>
        ) : filteredProjectTasks.length === 0 ? (
          <p className="mt-3 text-sm text-zinc-500">No tasks match the current filters.</p>
        ) : (
          <ul className="mt-3 flex flex-col gap-2">
            {filteredProjectTasks.map((t) => {
              const epic = t.groupId ? groupById.get(t.groupId) : undefined;
              const epicOwner = epic
                ? owners.find((p) => p.id === epic.ownerId) ?? null
                : null;
              const s = statusDef(t.status, statusMap);
              return (
                <li
                  key={t.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-2 dark:border-zinc-800 dark:bg-zinc-950"
                  style={{ borderLeftWidth: 4, borderLeftColor: s.color }}
                  {...(isArchived(t) ? { "data-pd-archived": "true" } : {})}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      {epicOwner ? (
                        <OwnerSwatch
                          owner={epicOwner}
                          className="h-8 w-8 shrink-0 rounded-lg"
                          title={epic ? `${epic.name} (${epicOwner.name})` : epicOwner.name}
                        />
                      ) : (
                        <span
                          className="h-8 w-8 shrink-0 rounded-lg bg-zinc-200 dark:bg-zinc-700"
                          title="Epic"
                          aria-hidden
                        />
                      )}
                      <Link
                        href={`/tasks/${t.id}`}
                        className="min-w-0 font-medium text-blue-600 hover:underline dark:text-blue-400"
                      >
                        {t.name}
                      </Link>
                      <EntityArchivedBadge entity={t} />
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-2 pl-10">
                      <StatusBadge status={t.status} />
                      <TaskTypeBadge type={t.type} />
                      <TaskPriorityBadge priority={t.priority} />
                      <span className="text-xs text-zinc-500">{t.date}</span>
                      {epic ? (
                        <Link
                          href={`/epics/${epic.id}`}
                          className="text-xs text-zinc-500 hover:text-blue-600 hover:underline dark:hover:text-blue-400"
                        >
                          Epic: {epic.name}
                        </Link>
                      ) : null}
                    </div>
                    {(t.tags ?? []).length ? (
                      <div className="mt-2 flex flex-wrap gap-1 pl-10">
                        {(t.tags ?? []).map((tag) => (
                          <span
                            key={normalizeTagKey(tag)}
                            className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-2 text-sm">
                    <Link
                      href={`/tasks/${t.id}`}
                      className="text-zinc-600 hover:underline dark:text-zinc-400"
                    >
                      View
                    </Link>
                    <Link
                      href={`/tasks/${t.id}/edit`}
                      className="text-blue-600 hover:underline dark:text-blue-400"
                    >
                      Edit
                    </Link>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </DetailCollapsibleSection>

      {project ? (
        <WorklogSection
          target={{ kind: "project", projectId: project.id }}
          disabled={isArchived(project)}
        />
      ) : null}

      {entryCreateOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white p-6 dark:bg-zinc-950">
            <h3 className="text-lg font-semibold">New note</h3>
            <p className="mt-1 text-sm text-zinc-500">
              This note is created for project <strong>{project.name}</strong>. Optionally link an
              owner. The public key is assigned automatically: if you pick an owner, it extends that
              owner’s key; otherwise it extends this project’s key (for example{" "}
              <code className="rounded bg-zinc-200 px-1 dark:bg-zinc-800">PRJ-1234-567</code>).
            </p>
            <div className="mt-4 flex flex-col gap-3">
              <label className="text-sm">
                Title
                <input
                  value={entryForm.title}
                  onChange={(e) =>
                    setEntryForm((f) => ({ ...f, title: e.target.value }))
                  }
                  className="mt-1 w-full rounded-lg border border-zinc-300 px-2 py-2 dark:border-zinc-600 dark:bg-zinc-900"
                />
              </label>
              <label className="text-sm">
                Status
                <NoteStatusSelect
                  value={entryForm.status}
                  onChange={(v) => setEntryForm((f) => ({ ...f, status: v }))}
                  className="mt-1 w-full rounded-lg border border-zinc-300 px-2 py-2 dark:border-zinc-600 dark:bg-zinc-900"
                />
              </label>
              <label className="text-sm">
                Type
                <select
                  value={entryForm.type}
                  onChange={(e) =>
                    setEntryForm((f) => ({ ...f, type: e.target.value }))
                  }
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
                Priority
                <select
                  value={entryForm.priority}
                  onChange={(e) =>
                    setEntryForm((f) => ({ ...f, priority: e.target.value }))
                  }
                  className="mt-1 w-full rounded-lg border border-zinc-300 px-2 py-2 dark:border-zinc-600 dark:bg-zinc-900"
                >
                  {notePriorities.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </label>
              <NoteTagsEditor
                tags={entryForm.tags}
                onChange={(tags) => setEntryForm((f) => ({ ...f, tags }))}
              />
              <SearchableSingleSelect
                label="Owner (optional)"
                value={entryForm.ownerId}
                onChange={(v) => setEntryForm((f) => ({ ...f, ownerId: v }))}
                placeholder="None"
                options={[
                  { value: "", label: "None" },
                  ...owners.map((p) => ({ value: p.id, label: p.name })),
                ]}
              />
              <MarkdownField
                label="Body"
                value={entryForm.body}
                onChange={(v) => setEntryForm((f) => ({ ...f, body: v }))}
                rows={8}
              />
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                className="rounded-lg border border-zinc-300 px-4 py-2 text-sm dark:border-zinc-600"
                onClick={() => setEntryCreateOpen(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white"
                onClick={() => void saveProjectEntry()}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

