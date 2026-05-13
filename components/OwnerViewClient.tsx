"use client";

import Link from "next/link";
import { useDashboardConfig } from "@/components/DashboardSettingsProvider";
import { useCallback, useEffect, useMemo, useState } from "react";
import { noteEntryEditHref, noteEntryViewHref } from "@/lib/noteEntryPaths";
import type { Owner, OwnerEntry, Project, Task, TaskGroup } from "@/lib/schemas";
import { SearchableSingleSelect } from "./SearchableSingleSelect";
import { NOTE_ENTRY_TYPES } from "@/lib/noteEntryFormOptions";
import { TASK_FORM_PRIORITIES, TASK_FORM_TYPES } from "@/lib/taskFormOptions";
import {
  isTerminalStatus,
  normalizeStatusKey,
  statusDef,
} from "@/lib/statusConfig";
import { FilterMultiDropdown } from "@/components/FilterMultiDropdown";
import { DashboardFilterDisclosure } from "@/components/DashboardFilterDisclosure";
import { NoteTagsEditor } from "@/components/NoteTagsEditor";
import { isArchived } from "@/lib/archive";
import {
  entryMatchesTagKeys,
  normalizeTagKey,
  tagOptionsFromEntries,
} from "@/lib/noteTags";
import { DetailCollapsibleSection } from "./DetailCollapsibleSection";
import { EntityKeyTagInput } from "./EntityKeyTagInput";
import { WorklogSection } from "./WorklogSection";
import { EntityArchivedBadge, EntityArchivedBanner } from "./EntityArchivedMark";
import { CollapsibleMarkdown } from "./CollapsibleMarkdown";
import { MarkdownField } from "./MarkdownField";
import { MarkdownView } from "./MarkdownView";
import { ProgressBar } from "./ProgressBar";
import { NoteStatusSelect } from "./NoteStatusSelect";
import { StatusBadge } from "./StatusBadge";
import { TaskStatusSelect } from "./TaskStatusSelect";
import { TaskPriorityBadge, TaskTypeBadge } from "./TaskMetaBadges";
import { OwnerSwatch } from "./OwnerSwatch";
import { TrashIcon } from "./icons";

type EpicStateFilter = "__done__" | "__active__" | "__empty__";

export function OwnerViewClient({ ownerId }: { ownerId: string }) {
  const { settings, statusMap, statusKeys, noteStatusKeys } = useDashboardConfig();
  const defaultNoteStatus = noteStatusKeys[0] ?? "open";
  const defaultTaskStatus = statusKeys[0] ?? "open";
  const taskTypes = settings?.taskTypes ? settings.taskTypes.map((r) => r.label) : [...TASK_FORM_TYPES];
  const taskPriorities = settings?.taskPriorities
    ? settings.taskPriorities.map((r) => r.label)
    : [...TASK_FORM_PRIORITIES];
  const noteTypes = settings?.noteTypes ?? [...NOTE_ENTRY_TYPES];

  const [owner, setOwner] = useState<Owner | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [groups, setGroups] = useState<TaskGroup[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [entries, setEntries] = useState<OwnerEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [epicCreateOpen, setEpicCreateOpen] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [newGroupKeyTag, setNewGroupKeyTag] = useState("");
  const [newGroupDesc, setNewGroupDesc] = useState("");
  const [newGroupTags, setNewGroupTags] = useState<string[]>([]);

  const [groupModalId, setGroupModalId] = useState<string | null>(null);
  const [groupEditName, setGroupEditName] = useState("");
  const [groupEditDesc, setGroupEditDesc] = useState("");
  const [epicEditingName, setEpicEditingName] = useState(false);
  const [epicEditingDesc, setEpicEditingDesc] = useState(false);

  const [taskCreateOpen, setTaskCreateOpen] = useState(false);
  const [taskForm, setTaskForm] = useState({
    groupId: "" as string,
    name: "",
    description: "",
    type: "Task",
    status: defaultTaskStatus,
    date: "",
    priority: "Medium",
    tags: [] as string[],
    keyTag: "",
  });

  const [entryCreateOpen, setEntryCreateOpen] = useState(false);
  const [entryForm, setEntryForm] = useState({
    title: "",
    body: "",
    status: "open",
    type: "Note",
    priority: "Medium",
    tags: [] as string[],
    projectId: "",
  });

  const [noteQ, setNoteQ] = useState("");
  const [noteTagKeys, setNoteTagKeys] = useState<string[]>([]);
  const [showArchived, setShowArchived] = useState(false);

  const [epicQ, setEpicQ] = useState("");
  const [epicStateFilters, setEpicStateFilters] = useState<EpicStateFilter[]>([]);
  const [epicDetailsOpen, setEpicDetailsOpen] = useState<Record<string, boolean>>({});

  const [taskView, setTaskView] = useState<"flat" | "byEpic">("flat");
  const [taskQ, setTaskQ] = useState("");
  const [taskStatusFilters, setTaskStatusFilters] = useState<string[]>([]);
  const [taskTypeFilters, setTaskTypeFilters] = useState<string[]>([]);
  const [taskPriorityFilters, setTaskPriorityFilters] = useState<string[]>([]);
  const [taskEpicFilters, setTaskEpicFilters] = useState<string[]>([]);
  const [taskTagKeys, setTaskTagKeys] = useState<string[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const [pr, gr, tk, en, pj] = await Promise.all([
        fetch(`/api/owners/${ownerId}`).then((r) => {
          if (!r.ok) throw new Error("Owner not found");
          return r.json();
        }),
        fetch(`/api/owners/${ownerId}/groups`).then((r) => r.json()),
        fetch(`/api/tasks?ownerId=${ownerId}`).then((r) => r.json()),
        fetch(`/api/owners/${ownerId}/entries`).then((r) => r.json()),
        fetch("/api/projects").then((r) => (r.ok ? r.json() : [])),
      ]);
      setOwner(pr);
      setGroups(gr);
      setTasks(tk);
      setEntries(en);
      setProjects(Array.isArray(pj) ? pj : []);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to load");
      setOwner(null);
    } finally {
      setLoading(false);
    }
  }, [ownerId]);

  useEffect(() => {
    queueMicrotask(() => {
      void load();
    });
  }, [load]);

  function openTaskCreate() {
    setTaskCreateOpen(true);
    setTaskForm({
      groupId: "",
      name: "",
      description: "",
      type: "Task",
      status: defaultTaskStatus,
      date: new Date().toISOString().slice(0, 10),
      priority: "Medium",
      tags: [],
      keyTag: "",
    });
  }

  async function saveNewTask() {
    const safeStatus = statusKeys.includes(taskForm.status) ? taskForm.status : defaultTaskStatus;
    const payload = {
      ownerId,
      groupId: taskForm.groupId ? taskForm.groupId : null,
      name: taskForm.name.trim(),
      description: taskForm.description,
      type: taskForm.type,
      status: safeStatus,
      date: taskForm.date,
      priority: taskForm.priority,
      tags: taskForm.tags,
      keyTag: taskForm.keyTag,
    };
    if (!payload.name) return;
    const r = await fetch("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!r.ok) setErr("Could not create task");
    setTaskCreateOpen(false);
    await load();
  }

  async function addGroup() {
    if (!newGroupName.trim()) return;
    const r = await fetch(`/api/owners/${ownerId}/groups`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: newGroupName.trim(),
        description: newGroupDesc,
        tags: newGroupTags,
        keyTag: newGroupKeyTag,
      }),
    });
    if (!r.ok) setErr("Could not create epic");
    setNewGroupName("");
    setNewGroupKeyTag("");
    setNewGroupDesc("");
    setNewGroupTags([]);
    setEpicCreateOpen(false);
    await load();
  }

  async function deleteGroup(id: string) {
    if (!confirm("Delete this epic? Tasks will become ungrouped.")) return;
    await fetch(`/api/groups/${id}`, { method: "DELETE" });
    await load();
  }

  function openGroupEdit(g: TaskGroup) {
    setGroupModalId(g.id);
    setGroupEditName(g.name);
    setGroupEditDesc(g.description ?? "");
    setEpicEditingName(false);
    setEpicEditingDesc(false);
  }

  function closeGroupModal() {
    setGroupModalId(null);
    setEpicEditingName(false);
    setEpicEditingDesc(false);
  }

  function cancelEpicNameEdit() {
    const g = groups.find((x) => x.id === groupModalId);
    if (g) setGroupEditName(g.name);
    setEpicEditingName(false);
  }

  function cancelEpicDescEdit() {
    const g = groups.find((x) => x.id === groupModalId);
    if (g) setGroupEditDesc(g.description ?? "");
    setEpicEditingDesc(false);
  }

  async function saveEpicName() {
    if (!groupModalId || !groupEditName.trim()) return;
    await fetch(`/api/groups/${groupModalId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: groupEditName.trim() }),
    });
    setEpicEditingName(false);
    await load();
  }

  async function saveEpicDesc() {
    if (!groupModalId) return;
    await fetch(`/api/groups/${groupModalId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ description: groupEditDesc }),
    });
    setEpicEditingDesc(false);
    await load();
  }

  async function deleteTask(id: string) {
    if (!confirm("Delete task?")) return;
    await fetch(`/api/tasks/${id}`, { method: "DELETE" });
    await load();
  }

  function openEntryCreate() {
    setEntryCreateOpen(true);
    setEntryForm({
      title: "",
      body: "",
      status: defaultNoteStatus,
      type: "Note",
      priority: "Medium",
      tags: [],
      projectId: "",
    });
  }

  const noteTagFilterOptions = useMemo(
    () =>
      tagOptionsFromEntries(
        showArchived ? entries : entries.filter((e) => !isArchived(e)),
      ),
    [entries, showArchived],
  );

  const filteredEntries = useMemo(() => {
    let list = entries;
    if (!showArchived) list = list.filter((e) => !isArchived(e));
    const ql = noteQ.trim().toLowerCase();
    if (noteTagKeys.length) {
      list = list.filter((e) => entryMatchesTagKeys(e.tags, noteTagKeys));
    }
    if (ql) {
      list = list.filter(
        (e) =>
          e.title.toLowerCase().includes(ql) || e.body.toLowerCase().includes(ql),
      );
    }
    return list;
  }, [entries, noteQ, noteTagKeys, showArchived]);

  const epicStateFilterOptions = useMemo(
    () =>
      [
        { value: "__active__" as EpicStateFilter, label: "Active (not done)" },
        { value: "__done__" as EpicStateFilter, label: "Done" },
        { value: "__empty__" as EpicStateFilter, label: "Empty (no tasks)" },
      ] as const,
    [],
  );

  const epicRowMeta = useMemo(() => {
    return groups.map((g) => {
      const inG = tasks.filter((t) => t.groupId === g.id && !isArchived(t));
      const done = inG.filter((t) => isTerminalStatus(t.status, statusMap)).length;
      const total = inG.length;
      const state: EpicStateFilter =
        total === 0 ? "__empty__" : done === total ? "__done__" : "__active__";
      return { g, done, total, state };
    });
  }, [groups, tasks, statusMap]);

  const filteredEpicRows = useMemo(() => {
    let rows = epicRowMeta;
    if (!showArchived) rows = rows.filter((r) => !isArchived(r.g));
    if (epicStateFilters.length) {
      rows = rows.filter((r) =>
        epicStateFilters.some((f) => {
          if (f === "__empty__") return r.state === "__empty__";
          if (f === "__done__") return r.state === "__done__";
          return r.state === "__active__";
        }),
      );
    }
    const ql = epicQ.trim().toLowerCase();
    if (ql) {
      rows = rows.filter(
        (r) =>
          r.g.name.toLowerCase().includes(ql) ||
          (r.g.description ?? "").toLowerCase().includes(ql),
      );
    }
    return rows;
  }, [epicRowMeta, epicQ, epicStateFilters, showArchived]);

  const taskStatusFilterOptions = useMemo(
    () => statusKeys.map((k) => ({ value: k, label: statusDef(k, statusMap).label })),
    [statusKeys, statusMap],
  );

  const taskTypeFilterOptions = useMemo(
    () => taskTypes.map((x) => ({ value: x, label: x })),
    [taskTypes],
  );

  const taskPriorityFilterOptions = useMemo(
    () => taskPriorities.map((p) => ({ value: p, label: p })),
    [taskPriorities],
  );

  const taskEpicFilterOptions = useMemo(
    () => [
      ...groups
        .filter((g) => showArchived || !isArchived(g))
        .map((g) => ({ value: g.id, label: g.name })),
      { value: "__ungrouped__", label: "No epic" },
    ],
    [groups, showArchived],
  );

  const taskTagFilterOptions = useMemo(
    () =>
      tagOptionsFromEntries(
        showArchived ? tasks : tasks.filter((t) => !isArchived(t)),
      ),
    [tasks, showArchived],
  );

  const filteredTasks = useMemo(() => {
    let list = tasks;
    if (!showArchived) list = list.filter((t) => !isArchived(t));
    const ql = taskQ.trim().toLowerCase();
    if (ql) {
      list = list.filter(
        (t) =>
          t.name.toLowerCase().includes(ql) ||
          (t.description ?? "").toLowerCase().includes(ql) ||
          (t.tags ?? []).some((tag) => tag.toLowerCase().includes(ql)),
      );
    }
    if (taskTagKeys.length) {
      list = list.filter((t) => entryMatchesTagKeys(t.tags, taskTagKeys));
    }
    if (taskStatusFilters.length) {
      list = list.filter((t) => {
        const tk = normalizeStatusKey(t.status);
        return taskStatusFilters.some((f) => normalizeStatusKey(f) === tk);
      });
    }
    if (taskTypeFilters.length) {
      list = list.filter((t) => taskTypeFilters.includes(t.type));
    }
    if (taskPriorityFilters.length) {
      list = list.filter((t) => taskPriorityFilters.includes(t.priority));
    }
    if (taskEpicFilters.length) {
      list = list.filter((t) => {
        const gid = t.groupId;
        return taskEpicFilters.some((f) => {
          if (f === "__ungrouped__") return gid == null;
          return gid === f;
        });
      });
    }
    return [...list].sort((a, b) => {
      const dc = b.date.localeCompare(a.date);
      if (dc !== 0) return dc;
      return a.name.localeCompare(b.name);
    });
  }, [
    tasks,
    taskQ,
    taskTagKeys,
    taskStatusFilters,
    taskTypeFilters,
    taskPriorityFilters,
    taskEpicFilters,
    showArchived,
  ]);

  useEffect(() => {
    if (typeof window === "undefined" || loading) return;
    const m = /^#epic-([0-9a-f-]{36})$/i.exec(window.location.hash);
    if (m?.[1] && groups.some((g) => g.id === m[1])) {
      queueMicrotask(() => {
        setEpicDetailsOpen((prev) => ({ ...prev, [m[1]]: true }));
      });
    }
  }, [loading, groups]);

  async function saveEntry() {
    if (!entryForm.title.trim()) return;
    await fetch(`/api/owners/${ownerId}/entries`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
        title: entryForm.title.trim(),
        body: entryForm.body,
        status: entryForm.status,
        type: entryForm.type,
        priority: entryForm.priority,
        tags: entryForm.tags,
        projectId: entryForm.projectId ? entryForm.projectId : null,
      }),
    });
    setEntryCreateOpen(false);
    await load();
  }

  async function deleteEntry(id: string) {
    if (!confirm("Delete this entry?")) return;
    await fetch(`/api/entries/${id}`, { method: "DELETE" });
    await load();
  }

  if (loading) return <p className="text-zinc-500">Loading…</p>;
  if (err || !owner) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
        {err ?? "Not found"}{" "}
        <Link href="/owners" className="underline">
          Back
        </Link>
      </div>
    );
  }

  const accent = owner.color;

  const ownerTaskRowShell =
    "flex flex-wrap items-center justify-between gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-2 dark:border-zinc-800 dark:bg-zinc-950";

  function ownerTaskRow(t: Task, showEpicLine: boolean) {
    return (
      <li
        key={t.id}
        className={ownerTaskRowShell}
        style={{ borderLeftWidth: 4, borderLeftColor: accent }}
        {...(isArchived(t) ? { "data-pd-archived": "true" } : {})}
      >
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={`/tasks/${t.id}`}
              className="font-medium text-blue-600 hover:underline dark:text-blue-400"
            >
              {t.name}
            </Link>
            <EntityArchivedBadge entity={t} />
          </div>
          <div className="mt-1 flex flex-wrap gap-2">
            <StatusBadge status={t.status} />
            {showEpicLine ? (
              <span className="text-xs text-zinc-500">
                Epic:{" "}
                {t.groupId ? (
                  <Link
                    href={`#epic-${t.groupId}`}
                    className="text-blue-600 hover:underline dark:text-blue-400"
                  >
                    {groups.find((g) => g.id === t.groupId)?.name ?? "—"}
                  </Link>
                ) : (
                  "—"
                )}
              </span>
            ) : null}
            <TaskTypeBadge type={t.type} />
            <TaskPriorityBadge priority={t.priority} />
            <span className="text-xs text-zinc-500">{t.date}</span>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 text-sm">
          <Link
            href={`/tasks/${t.id}`}
            className="text-zinc-600 hover:underline dark:text-zinc-400"
          >
            View
          </Link>
          <Link href={`/tasks/${t.id}/edit`} className="text-blue-600 hover:underline">
            Edit
          </Link>
          <button
            type="button"
            className="inline-flex items-center justify-center rounded p-1 text-red-600 hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-950/40 dark:hover:text-red-300"
            onClick={() => void deleteTask(t.id)}
            aria-label="Delete task"
            title="Delete task"
          >
            <TrashIcon />
          </button>
        </div>
      </li>
    );
  }

  const ungroupedFilteredTasks = filteredTasks.filter((t) => !t.groupId);

  function ChevronIcon({ open }: { open: boolean }) {
    return (
      <svg
        viewBox="0 0 20 20"
        fill="currentColor"
        className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`}
        aria-hidden
      >
        <path
          fillRule="evenodd"
          d="M5.23 7.21a.75.75 0 0 1 1.06.02L10 11.168l3.71-3.937a.75.75 0 1 1 1.08 1.04l-4.25 4.51a.75.75 0 0 1-1.08 0l-4.25-4.51a.75.75 0 0 1 .02-1.06Z"
          clipRule="evenodd"
        />
      </svg>
    );
  }

  return (
    <div className="flex flex-col gap-10">
      <div
        className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950"
        style={{ borderTopWidth: 4, borderTopColor: accent }}
      >
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <Link
              href="/owners"
              className="text-sm text-blue-600 hover:underline dark:text-blue-400"
            >
              ← Owners
            </Link>
            <div className="mt-2 flex min-w-0 items-start gap-4">
              <OwnerSwatch owner={owner} className="h-14 w-14 shrink-0 rounded-xl" />
              <div className="min-w-0">
                <h1 className="text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
                  {owner.name}
                </h1>
                <p className="mt-1 text-sm text-zinc-500">Owner workspace (read-only)</p>
              </div>
            </div>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-3 sm:flex-row sm:items-center">
            <Link
              href={`/owners/${ownerId}/edit`}
              className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-800 shadow-sm hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
            >
              Edit owner
            </Link>
          </div>
        </div>
        <EntityArchivedBanner entity={owner} kind="owner" />
      </div>

      <label className="flex w-fit max-w-full flex-wrap items-center gap-2 rounded-lg border border-zinc-200 bg-zinc-50/80 px-3 py-2 text-sm text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900/40 dark:text-zinc-200">
        <input
          type="checkbox"
          checked={showArchived}
          onChange={(e) => setShowArchived(e.target.checked)}
          className="rounded border-zinc-300 dark:border-zinc-600"
        />
        Show archived (notes, epics, tasks)
      </label>

      <DetailCollapsibleSection
        title="Epics"
        titleClassName="text-xl font-semibold text-zinc-900 dark:text-zinc-50"
      >
        <div className="flex flex-wrap justify-end gap-2">
          <button
            type="button"
            onClick={() => {
              setNewGroupName("");
              setNewGroupKeyTag("");
              setNewGroupDesc("");
              setNewGroupTags([]);
              setEpicCreateOpen(true);
            }}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Add epic
          </button>
        </div>
        <DashboardFilterDisclosure className="mt-4" title="Epic search & filters">
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm sm:col-span-2">
            <span className="text-zinc-500">Search epics</span>
            <input
              value={epicQ}
              onChange={(e) => setEpicQ(e.target.value)}
              placeholder="Epic name or description"
              className="rounded-lg border border-zinc-300 px-2 py-1.5 dark:border-zinc-600 dark:bg-zinc-900"
            />
          </label>
          <FilterMultiDropdown
            label="Epic state"
            options={[...epicStateFilterOptions]}
            selected={epicStateFilters}
            onChange={(next) => setEpicStateFilters(next as EpicStateFilter[])}
          />
        </div>
        </DashboardFilterDisclosure>
        <p className="mt-3 text-sm text-zinc-500">
          {filteredEpicRows.length} epic{filteredEpicRows.length === 1 ? "" : "s"} in current filters
        </p>
        <ul className="mt-3 flex flex-col gap-2">
          {filteredEpicRows.map(({ g }) => {
            const open = Boolean(epicDetailsOpen[g.id]);
            const inG = tasks.filter((t) => t.groupId === g.id && !isArchived(t));
            return (
              <li
                key={g.id}
                id={`epic-${g.id}`}
                className="scroll-mt-4 rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950"
                {...(isArchived(g) ? { "data-pd-archived": "true" } : {})}
              >
                <div className="flex flex-wrap items-center justify-between gap-3 p-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex min-w-0 flex-wrap items-center gap-2">
                      <Link
                        href={`/epics/${g.id}`}
                        className="min-w-0 truncate font-semibold text-blue-600 hover:underline dark:text-blue-400"
                      >
                        {g.name}
                      </Link>
                      <EntityArchivedBadge entity={g} />
                      <button
                        type="button"
                        className="inline-flex items-center rounded-md p-1 font-medium text-blue-600 hover:bg-blue-50 hover:text-blue-700 dark:text-blue-400 dark:hover:bg-blue-950/40 dark:hover:text-blue-300"
                        onClick={() =>
                          setEpicDetailsOpen((prev) => ({ ...prev, [g.id]: !prev[g.id] }))
                        }
                        aria-label={open ? "Collapse epic details" : "Expand epic details"}
                        title={open ? "Collapse details" : "Expand details"}
                      >
                        <ChevronIcon open={open} />
                      </button>
                    </div>
                    <div className="mt-2 max-w-md">
                      <ProgressBar tasks={inG} statusMap={statusMap} />
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
                      href={`/?groupId=${g.id}`}
                      className="text-zinc-600 hover:underline dark:text-zinc-400"
                    >
                      View tasks
                    </Link>
                    <Link href={`/epics/${g.id}/edit`} className="text-blue-600 hover:underline">
                      Edit
                    </Link>
                    <button
                      type="button"
                      className="text-red-600 hover:text-red-700"
                      onClick={() => void deleteGroup(g.id)}
                      aria-label="Delete epic"
                      title="Delete epic"
                    >
                      <TrashIcon />
                    </button>
                  </div>
                </div>
                {open ? (
                  <div className="border-t border-zinc-200 px-4 pb-4 pt-3 dark:border-zinc-800">
                    {g.description ? (
                      <div className="text-sm text-zinc-700 dark:text-zinc-300">
                        <MarkdownView markdown={g.description} />
                      </div>
                    ) : (
                      <p className="text-sm italic text-zinc-500">No description.</p>
                    )}
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
        {groups.length === 0 ? (
          <p className="mt-2 text-sm text-zinc-500">No epics yet. Use Add epic.</p>
        ) : filteredEpicRows.length === 0 ? (
          <p className="mt-2 text-sm text-zinc-500">No epics match search or filters.</p>
        ) : null}
      </DetailCollapsibleSection>

      <DetailCollapsibleSection
        title="Tasks"
        titleClassName="text-xl font-semibold text-zinc-900 dark:text-zinc-50"
      >
        <div className="flex flex-wrap items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setTaskView("flat")}
              className={`rounded-lg px-3 py-2 text-sm font-medium ${
                taskView === "flat"
                  ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                  : "border border-zinc-300 bg-white dark:border-zinc-600 dark:bg-zinc-900"
              }`}
            >
              List
            </button>
            <button
              type="button"
              onClick={() => setTaskView("byEpic")}
              className={`rounded-lg px-3 py-2 text-sm font-medium ${
                taskView === "byEpic"
                  ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                  : "border border-zinc-300 bg-white dark:border-zinc-600 dark:bg-zinc-900"
              }`}
            >
              By epic
            </button>
            <button
              type="button"
              onClick={openTaskCreate}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              Add task
            </button>
        </div>
        <DashboardFilterDisclosure className="mt-4" title="Task search & filters">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <label className="flex flex-col gap-1 text-sm sm:col-span-2 lg:col-span-3">
            <span className="text-zinc-500">Search tasks</span>
            <input
              value={taskQ}
              onChange={(e) => setTaskQ(e.target.value)}
              placeholder="Name or description"
              className="rounded-lg border border-zinc-300 px-2 py-1.5 dark:border-zinc-600 dark:bg-zinc-900"
            />
          </label>
          <FilterMultiDropdown
            label="Status"
            options={taskStatusFilterOptions}
            selected={taskStatusFilters}
            onChange={setTaskStatusFilters}
          />
          <FilterMultiDropdown
            label="Type"
            options={taskTypeFilterOptions}
            selected={taskTypeFilters}
            onChange={setTaskTypeFilters}
          />
          <FilterMultiDropdown
            label="Priority"
            options={taskPriorityFilterOptions}
            selected={taskPriorityFilters}
            onChange={setTaskPriorityFilters}
          />
          <FilterMultiDropdown
            label="Epic"
            options={taskEpicFilterOptions}
            selected={taskEpicFilters}
            onChange={setTaskEpicFilters}
          />
          <FilterMultiDropdown
            label="Tags (any match)"
            options={taskTagFilterOptions}
            selected={taskTagKeys}
            onChange={setTaskTagKeys}
          />
        </div>
        </DashboardFilterDisclosure>
        <p className="mt-3 text-sm text-zinc-500">
          {filteredTasks.length} task{filteredTasks.length === 1 ? "" : "s"} in current filters
        </p>
        {taskView === "flat" ? (
          <ul className="mt-3 flex flex-col gap-2">
            {filteredTasks.map((t) => ownerTaskRow(t, true))}
          </ul>
        ) : (
          <div className="mt-3 flex flex-col gap-8">
            {groups.map((g) => {
              const inEpic = filteredTasks.filter((t) => t.groupId === g.id);
              if (!inEpic.length) return null;
              return (
                <div key={g.id} className="flex flex-col gap-2">
                  <div
                    className={ownerTaskRowShell}
                    style={{ borderLeftWidth: 4, borderLeftColor: accent }}
                  >
                    <div className="min-w-0 flex-1">
                      <Link
                        href={`#epic-${g.id}`}
                        className="font-medium text-blue-600 hover:underline dark:text-blue-400"
                      >
                        {g.name}
                      </Link>
                      <div className="mt-1 flex flex-wrap gap-2">
                        <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                          Epic
                        </span>
                        <span className="text-xs text-zinc-500">
                          {inEpic.length} task{inEpic.length === 1 ? "" : "s"}
                        </span>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2 text-sm">
                      <Link
                        href={`#epic-${g.id}`}
                        className="text-zinc-600 hover:underline dark:text-zinc-400"
                      >
                        View
                      </Link>
                      <button
                        type="button"
                        className="text-blue-600 hover:underline"
                        onClick={() => openGroupEdit(g)}
                      >
                        Edit
                      </button>
                    </div>
                  </div>
                  <ul className="ml-4 flex flex-col gap-2 border-l-2 border-zinc-200 pl-4 dark:border-zinc-700">
                    {inEpic.map((t) => ownerTaskRow(t, false))}
                  </ul>
                </div>
              );
            })}
            {ungroupedFilteredTasks.length ? (
              <div className="flex flex-col gap-2">
                <div
                  className={ownerTaskRowShell}
                  style={{ borderLeftWidth: 4, borderLeftColor: accent }}
                >
                  <div className="min-w-0 flex-1">
                    <span className="font-medium text-zinc-900 dark:text-zinc-50">No epic</span>
                    <div className="mt-1 flex flex-wrap gap-2">
                      <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                        Epic
                      </span>
                      <span className="text-xs text-zinc-500">
                        {ungroupedFilteredTasks.length} task
                        {ungroupedFilteredTasks.length === 1 ? "" : "s"}
                      </span>
                    </div>
                  </div>
                </div>
                <ul className="ml-4 flex flex-col gap-2 border-l-2 border-zinc-200 pl-4 dark:border-zinc-700">
                  {ungroupedFilteredTasks.map((t) => ownerTaskRow(t, false))}
                </ul>
              </div>
            ) : null}
          </div>
        )}
        {tasks.length === 0 ? (
          <p className="mt-2 text-sm text-zinc-500">No tasks yet.</p>
        ) : filteredTasks.length === 0 ? (
          <p className="mt-2 text-sm text-zinc-500">No tasks match search or filters.</p>
        ) : null}
      </DetailCollapsibleSection>

      <DetailCollapsibleSection
        title="Owner notes"
        titleClassName="text-xl font-semibold text-zinc-900 dark:text-zinc-50"
      >
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
        <DashboardFilterDisclosure className="mt-4" title="Note search & filters">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm sm:col-span-2">
            <span className="text-zinc-500">Search notes (this owner)</span>
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
        </div>
        </DashboardFilterDisclosure>
        <ul className="mt-4 flex flex-col gap-4">
          {filteredEntries.map((e) => (
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
                  <time className="text-xs text-zinc-500">
                    {new Date(e.createdAt).toLocaleString()}
                  </time>
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
                    onClick={() => void deleteEntry(e.id)}
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
          ))}
        </ul>
        {filteredEntries.length === 0 ? (
          <p className="mt-2 text-sm text-zinc-500">
            {entries.length === 0
              ? "No notes yet."
              : "No notes match search or tag filters."}
          </p>
        ) : null}
      </DetailCollapsibleSection>

      {owner ? (
        <WorklogSection target={{ kind: "owner", ownerId: owner.id }} disabled={isArchived(owner)} />
      ) : null}

      {taskCreateOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white p-6 dark:bg-zinc-950">
            <h3 className="text-lg font-semibold">New task</h3>
            <div className="mt-4 flex flex-col gap-3">
              <label className="text-sm">
                Epic
                <select
                  value={taskForm.groupId}
                  onChange={(e) =>
                    setTaskForm((f) => ({ ...f, groupId: e.target.value }))
                  }
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
                Name
                <input
                  value={taskForm.name}
                  onChange={(e) => setTaskForm((f) => ({ ...f, name: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-zinc-300 px-2 py-2 dark:border-zinc-600 dark:bg-zinc-900"
                />
              </label>
              <EntityKeyTagInput
                value={taskForm.keyTag}
                onChange={(keyTag) => setTaskForm((f) => ({ ...f, keyTag }))}
                defaultTag="TSK"
              />
              <label className="text-sm">
                Type
                <select
                  value={taskForm.type}
                  onChange={(e) => setTaskForm((f) => ({ ...f, type: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-zinc-300 px-2 py-2 dark:border-zinc-600 dark:bg-zinc-900"
                >
                  {taskTypes.map((x) => (
                    <option key={x} value={x}>
                      {x}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm">
                Status
                <TaskStatusSelect
                  value={taskForm.status}
                  onChange={(v) => setTaskForm((f) => ({ ...f, status: v }))}
                  className="mt-1 w-full rounded-lg border border-zinc-300 px-2 py-2 dark:border-zinc-600 dark:bg-zinc-900"
                />
              </label>
              <label className="text-sm">
                Date
                <input
                  type="date"
                  value={taskForm.date}
                  onChange={(e) => setTaskForm((f) => ({ ...f, date: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-zinc-300 px-2 py-2 dark:border-zinc-600 dark:bg-zinc-900"
                />
              </label>
              <label className="text-sm">
                Priority
                <select
                  value={taskForm.priority}
                  onChange={(e) =>
                    setTaskForm((f) => ({ ...f, priority: e.target.value }))
                  }
                  className="mt-1 w-full rounded-lg border border-zinc-300 px-2 py-2 dark:border-zinc-600 dark:bg-zinc-900"
                >
                  {taskPriorities.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </label>
              <MarkdownField
                label="Description"
                value={taskForm.description}
                onChange={(v) => setTaskForm((f) => ({ ...f, description: v }))}
                rows={6}
              />
              <NoteTagsEditor
                tags={taskForm.tags}
                onChange={(tags) => setTaskForm((f) => ({ ...f, tags }))}
              />
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                className="rounded-lg border border-zinc-300 px-4 py-2 text-sm dark:border-zinc-600"
                onClick={() => setTaskCreateOpen(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white"
                onClick={() => void saveNewTask()}
              >
                Create
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {epicCreateOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white p-6 dark:bg-zinc-950">
            <h3 className="text-lg font-semibold">New epic</h3>
            <div className="mt-4 flex flex-col gap-3">
              <label className="text-sm">
                Name
                <input
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-zinc-300 px-2 py-2 dark:border-zinc-600 dark:bg-zinc-900"
                  placeholder="Epic name"
                />
              </label>
              <EntityKeyTagInput
                value={newGroupKeyTag}
                onChange={setNewGroupKeyTag}
                defaultTag="EPC"
              />
              <MarkdownField
                label="Description (optional)"
                value={newGroupDesc}
                onChange={setNewGroupDesc}
                rows={6}
              />
              <NoteTagsEditor tags={newGroupTags} onChange={setNewGroupTags} />
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                className="rounded-lg border border-zinc-300 px-4 py-2 text-sm dark:border-zinc-600"
                onClick={() => {
                  setEpicCreateOpen(false);
                  setNewGroupName("");
                  setNewGroupKeyTag("");
                  setNewGroupDesc("");
                  setNewGroupTags([]);
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white"
                onClick={() => void addGroup()}
              >
                Create epic
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {groupModalId ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-xl bg-white p-6 dark:bg-zinc-950">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <h3 className="text-lg font-semibold">Edit epic</h3>
              <button
                type="button"
                className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm dark:border-zinc-600"
                onClick={closeGroupModal}
              >
                Close
              </button>
            </div>
            <div className="mt-6 flex flex-col gap-8">
              <div className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Name</span>
                  {!epicEditingName ? (
                    <button
                      type="button"
                      onClick={() => setEpicEditingName(true)}
                      className="rounded-md border border-zinc-300 px-2 py-1 text-xs font-medium dark:border-zinc-600"
                    >
                      Edit name
                    </button>
                  ) : null}
                </div>
                {!epicEditingName ? (
                  <p className="mt-2 text-zinc-900 dark:text-zinc-100">{groupEditName}</p>
                ) : (
                  <div className="mt-3 flex flex-col gap-3">
                    <input
                      value={groupEditName}
                      onChange={(e) => setGroupEditName(e.target.value)}
                      className="w-full rounded-lg border border-zinc-300 px-2 py-2 dark:border-zinc-600 dark:bg-zinc-900"
                    />
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm text-white"
                        onClick={() => void saveEpicName()}
                      >
                        Save name
                      </button>
                      <button
                        type="button"
                        className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm dark:border-zinc-600"
                        onClick={cancelEpicNameEdit}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
              <div className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                    Description
                  </span>
                  {!epicEditingDesc ? (
                    <button
                      type="button"
                      onClick={() => setEpicEditingDesc(true)}
                      className="rounded-md border border-zinc-300 px-2 py-1 text-xs font-medium dark:border-zinc-600"
                    >
                      Edit description
                    </button>
                  ) : null}
                </div>
                {!epicEditingDesc ? (
                  <div className="mt-2 text-sm text-zinc-700 dark:text-zinc-300">
                    {groupEditDesc.trim() ? (
                      <MarkdownView markdown={groupEditDesc} />
                    ) : (
                      <p className="text-zinc-500 italic">No description.</p>
                    )}
                  </div>
                ) : (
                  <div className="mt-3 flex flex-col gap-3">
                    <MarkdownField
                      label=""
                      value={groupEditDesc}
                      onChange={setGroupEditDesc}
                      rows={8}
                    />
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm text-white"
                        onClick={() => void saveEpicDesc()}
                      >
                        Save description
                      </button>
                      <button
                        type="button"
                        className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm dark:border-zinc-600"
                        onClick={cancelEpicDescEdit}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {entryCreateOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white p-6 dark:bg-zinc-950">
            <h3 className="text-lg font-semibold">New note</h3>
            <p className="mt-1 text-sm text-zinc-500">
              The public key extends this owner’s key (for example{" "}
              <code className="rounded bg-zinc-200 px-1 dark:bg-zinc-800">OWN-1203-456</code>
              ). If you also pick a project, the owner still determines the prefix.
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
                  {taskPriorities.map((p) => (
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
                label="Project (optional)"
                value={entryForm.projectId}
                onChange={(v) => setEntryForm((f) => ({ ...f, projectId: v }))}
                placeholder="None"
                options={[
                  { value: "", label: "None" },
                  ...projects.map((p) => ({ value: p.id, label: p.name })),
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
                onClick={() => void saveEntry()}
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
