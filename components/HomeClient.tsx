"use client";

import Link from "next/link";
import { useDashboardConfig } from "@/components/DashboardSettingsProvider";
import { TaskDetailsMarkdown } from "@/components/TaskDetailsMarkdown";
import {
  buildPriorityRankMap,
  normalizePriorityKey,
  TASK_FORM_PRIORITIES,
  TASK_FORM_TYPES,
} from "@/lib/taskFormOptions";
import { DEFAULT_DASHBOARD_SETTINGS } from "@/lib/defaultDashboardSettings";
import { useSearchParams } from "next/navigation";
import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import type { Owner, Project, Task, TaskGroup } from "@/lib/schemas";
import { isArchived } from "@/lib/archive";
import { markdownExcerpt } from "@/lib/markdownExcerpt";
import {
  isTerminalStatus,
  isKnownTaskStatus,
  normalizeStatusKey,
  statusDef,
  taskStatusSelectValue,
  type StatusDef,
} from "@/lib/statusConfig";
import { entryMatchesTagKeys, tagOptionsFromEntries } from "@/lib/noteTags";
import { EntityKeyTagInput } from "@/components/EntityKeyTagInput";
import { FilterMultiDropdown } from "./FilterMultiDropdown";
import { MarkdownView } from "./MarkdownView";
import { ProgressBar } from "./ProgressBar";
import { SubtaskProgressBar } from "./SubtaskProgressBar";
import { TaskStatusSelect } from "./TaskStatusSelect";
import { TaskTypeBadge } from "./TaskMetaBadges";
import { OwnerSwatch } from "./OwnerSwatch";
import { NoteTagsEditor } from "./NoteTagsEditor";
import { EntityArchivedBadge } from "./EntityArchivedMark";
import { TableCellSlot, TableClampCell } from "./TableClampCell";
import { TrashIcon } from "./icons";

type SortKey =
  | "name"
  | "owner"
  | "project"
  | "epic"
  | "type"
  | "status"
  | "date"
  | "priority";

type TableColumnId =
  | "name"
  | "owner"
  | "project"
  | "epic"
  | "type"
  | "status"
  | "date"
  | "priority"
  | "tags"
  | "summary";

const TABLE_COLUMN_STORAGE_KEY = "pd-home-table-columns";

const DEFAULT_TABLE_COLUMNS: Record<TableColumnId, boolean> = {
  name: true,
  owner: true,
  project: false,
  epic: true,
  type: true,
  status: true,
  date: true,
  priority: true,
  tags: false,
  summary: true,
};

const TABLE_COLUMNS: {
  id: TableColumnId;
  label: string;
  sortKey?: SortKey;
}[] = [
  { id: "name", label: "Name", sortKey: "name" },
  { id: "owner", label: "Owner", sortKey: "owner" },
  { id: "project", label: "Project", sortKey: "project" },
  { id: "epic", label: "Epic", sortKey: "epic" },
  { id: "type", label: "Type", sortKey: "type" },
  { id: "status", label: "Status", sortKey: "status" },
  { id: "date", label: "Date", sortKey: "date" },
  { id: "priority", label: "Priority", sortKey: "priority" },
  { id: "tags", label: "Tags" },
  { id: "summary", label: "Summary" },
];

function parseTableColumnPrefs(raw: string | null): Record<TableColumnId, boolean> {
  if (!raw) return { ...DEFAULT_TABLE_COLUMNS };
  try {
    const o = JSON.parse(raw) as Record<string, unknown>;
    const next = { ...DEFAULT_TABLE_COLUMNS };
    for (const id of Object.keys(DEFAULT_TABLE_COLUMNS) as TableColumnId[]) {
      if (typeof o[id] === "boolean") next[id] = o[id];
    }
    return next;
  } catch {
    return { ...DEFAULT_TABLE_COLUMNS };
  }
}

function ownerName(owners: Owner[], id: string) {
  return owners.find((p) => p.id === id)?.name ?? id;
}

function groupName(groups: TaskGroup[], id: string | null) {
  if (!id) return "—";
  return groups.find((g) => g.id === id)?.name ?? id;
}

export function HomeClient() {
  const { settings, statusMap, statusKeys } = useDashboardConfig();
  const types = settings?.taskTypes ? settings.taskTypes.map((r) => r.label) : [...TASK_FORM_TYPES];
  const priorities = settings?.taskPriorities
    ? settings.taskPriorities.map((r) => r.label)
    : [...TASK_FORM_PRIORITIES];
  const priorityRows = settings?.taskPriorities ?? DEFAULT_DASHBOARD_SETTINGS.taskPriorities;

  const searchParams = useSearchParams();
  const urlFiltersApplied = useRef(false);

  const [owners, setOwners] = useState<Owner[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [groups, setGroups] = useState<TaskGroup[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [q, setQ] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [ownerIds, setOwnerIds] = useState<string[]>([]);
  const [projectIds, setProjectIds] = useState<string[]>([]);
  const [groupIds, setGroupIds] = useState<string[]>([]);
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
  const [selectedPriorities, setSelectedPriorities] = useState<string[]>([]);
  const [selectedTagKeys, setSelectedTagKeys] = useState<string[]>([]);
  const [view, setView] = useState<"flat" | "epic">("flat");
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [tableColumns, setTableColumns] = useState<Record<TableColumnId, boolean>>({
    ...DEFAULT_TABLE_COLUMNS,
  });
  const skipTableColPersist = useRef(true);
  const [savingTaskEdits, setSavingTaskEdits] = useState<Record<string, boolean>>({});

  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [form, setForm] = useState({
    ownerId: "",
    groupId: "" as string,
    name: "",
    description: "",
    type: "Task",
    status: "open",
    date: "",
    priority: "Medium",
    tags: [] as string[],
    keyTag: "",
  });

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const [pr, pj, gr, tk] = await Promise.all([
        fetch("/api/owners").then((r) => r.json()),
        fetch("/api/projects").then((r) => r.json()),
        fetch("/api/groups").then((r) => r.json()),
        fetch("/api/tasks").then((r) => r.json()),
      ]);
      if (!Array.isArray(pr) || !Array.isArray(pj) || !Array.isArray(gr) || !Array.isArray(tk)) {
        throw new Error("Bad response");
      }
      setOwners(pr);
      setProjects(pj);
      setGroups(gr);
      setTasks(tk);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    queueMicrotask(() => {
      void load();
    });
  }, [load]);

  useEffect(() => {
    if (urlFiltersApplied.current) return;
    const gid = searchParams.get("groupId");
    if (!gid) return;
    urlFiltersApplied.current = true;
    queueMicrotask(() => setGroupIds([gid]));
  }, [searchParams]);

  useEffect(() => {
    if (groups.length === 0) return;
    queueMicrotask(() => {
      setGroupIds((ids) => {
        const next = ids.filter((id) => {
          if (id === "__ungrouped__") return true;
          const g = groups.find((x) => x.id === id);
          if (!g) return false;
          if (ownerIds.length === 0) return true;
          return ownerIds.includes(g.ownerId);
        });
        if (next.length === ids.length && next.every((v, i) => v === ids[i])) return ids;
        return next;
      });
    });
  }, [ownerIds, groups]);

  useEffect(() => {
    queueMicrotask(() => {
      try {
        const raw = localStorage.getItem(TABLE_COLUMN_STORAGE_KEY);
        setTableColumns(parseTableColumnPrefs(raw));
      } catch {
        /* ignore */
      }
    });
  }, []);

  useEffect(() => {
    if (skipTableColPersist.current) {
      skipTableColPersist.current = false;
      return;
    }
    try {
      localStorage.setItem(TABLE_COLUMN_STORAGE_KEY, JSON.stringify(tableColumns));
    } catch {
      /* ignore */
    }
  }, [tableColumns]);

  const filtered = useMemo(() => {
    let t = tasks;
    if (!showArchived) t = t.filter((x) => !isArchived(x));
    const ql = q.trim().toLowerCase();
    if (ownerIds.length) t = t.filter((x) => ownerIds.includes(x.ownerId));
    if (projectIds.length) {
      const projectIdSet = new Set(projectIds);
      const groupById = new Map(groups.map((g) => [g.id, g] as const));
      t = t.filter((x) => {
        const gid = x.groupId;
        const pid = gid ? groupById.get(gid)?.projectId ?? null : null;
        if (pid === null) return projectIdSet.has("__no_project__");
        return projectIdSet.has(pid);
      });
    }
    if (groupIds.length) {
      t = t.filter((x) =>
        groupIds.some((gid) =>
          gid === "__ungrouped__" ? x.groupId === null : x.groupId === gid,
        ),
      );
    }
    if (selectedTypes.length) t = t.filter((x) => selectedTypes.includes(x.type));
    if (selectedStatuses.length) {
      t = t.filter((x) => selectedStatuses.includes(normalizeStatusKey(x.status)));
    }
    if (selectedPriorities.length) {
      const pls = new Set(selectedPriorities.map((p) => p.trim().toLowerCase()));
      t = t.filter((x) => pls.has(x.priority.trim().toLowerCase()));
    }
    if (selectedTagKeys.length) {
      t = t.filter((x) => entryMatchesTagKeys(x.tags, selectedTagKeys));
    }
    if (ql) {
      const projectById = new Map(projects.map((p) => [p.id, p] as const));
      const groupById = new Map(groups.map((g) => [g.id, g] as const));
      t = t.filter(
        (x) => {
          const inTask =
            x.name.toLowerCase().includes(ql) ||
            x.description.toLowerCase().includes(ql) ||
            (x.tags ?? []).some((tag) => tag.toLowerCase().includes(ql));
          if (inTask) return true;
          const gid = x.groupId;
          const pid = gid ? groupById.get(gid)?.projectId ?? null : null;
          const projectName = pid ? projectById.get(pid)?.name ?? "" : "";
          return projectName.toLowerCase().includes(ql);
        },
      );
    }
    return t;
  }, [
    tasks,
    showArchived,
    q,
    ownerIds,
    projectIds,
    groupIds,
    selectedTypes,
    selectedStatuses,
    selectedPriorities,
    selectedTagKeys,
    groups,
    projects,
  ]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    const dir = sortDir === "asc" ? 1 : -1;
    const priorityRank = buildPriorityRankMap(priorityRows.map((r) => r.label));
    arr.sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case "name":
          cmp = a.name.localeCompare(b.name);
          break;
        case "owner":
          cmp = ownerName(owners, a.ownerId).localeCompare(
            ownerName(owners, b.ownerId),
          );
          break;
        case "project": {
          const groupById = new Map(groups.map((g) => [g.id, g] as const));
          const projectById = new Map(projects.map((p) => [p.id, p] as const));
          const ap =
            a.groupId && groupById.get(a.groupId)?.projectId
              ? projectById.get(groupById.get(a.groupId)!.projectId!)?.name ?? ""
              : "";
          const bp =
            b.groupId && groupById.get(b.groupId)?.projectId
              ? projectById.get(groupById.get(b.groupId)!.projectId!)?.name ?? ""
              : "";
          cmp = ap.localeCompare(bp);
          if (cmp !== 0) break;
          cmp = a.name.localeCompare(b.name);
          break;
        }
        case "epic":
          cmp = groupName(groups, a.groupId).localeCompare(groupName(groups, b.groupId));
          break;
        case "type":
          cmp = a.type.localeCompare(b.type);
          break;
        case "status":
          cmp = a.status.localeCompare(b.status);
          break;
        case "date":
          cmp = a.date.localeCompare(b.date);
          break;
        case "priority": {
          const aKey = normalizePriorityKey(a.priority);
          const bKey = normalizePriorityKey(b.priority);
          const aRank = priorityRank.get(aKey);
          const bRank = priorityRank.get(bKey);
          const aKnown = aRank !== undefined;
          const bKnown = bRank !== undefined;
          if (aKnown && bKnown) cmp = aRank - bRank;
          else if (aKnown && !bKnown) cmp = -dir; // known always sorts before unknown
          else if (!aKnown && bKnown) cmp = dir; // known always sorts before unknown
          else cmp = aKey.localeCompare(bKey);
          if (cmp === 0) cmp = a.priority.localeCompare(b.priority);
          break;
        }
        default:
          cmp = 0;
      }
      return cmp * dir;
    });
    return arr;
  }, [filtered, sortKey, sortDir, owners, groups, priorityRows]);

  const progress = useMemo(() => {
    const total = filtered.length;
    const done = filtered.filter((t) => isTerminalStatus(t.status, statusMap)).length;
    return { total, done };
  }, [filtered, statusMap]);

  const groupsForEpicView = useMemo(() => {
    let g = groups;
    if (!showArchived) g = g.filter((x) => !isArchived(x));
    if (ownerIds.length) g = g.filter((x) => ownerIds.includes(x.ownerId));
    const epicPick = groupIds.filter((id) => id !== "__ungrouped__");
    if (epicPick.length) g = g.filter((x) => epicPick.includes(x.id));
    return [...g].sort((a, b) => a.name.localeCompare(b.name));
  }, [groups, ownerIds, groupIds, showArchived]);

  const groupFilterOptions = useMemo(() => {
    const base = groups.filter((g) => {
      if (!showArchived && isArchived(g)) return false;
      return ownerIds.length === 0 || ownerIds.includes(g.ownerId);
    });
    return [
      { value: "__ungrouped__", label: "Ungrouped" },
      ...[...base]
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((g) => ({ value: g.id, label: g.name })),
    ];
  }, [groups, ownerIds, showArchived]);

  const ownerFilterOptions = useMemo(
    () =>
      owners
        .filter((p) => showArchived || !isArchived(p))
        .map((p) => ({ value: p.id, label: p.name })),
    [owners, showArchived],
  );

  const projectFilterOptions = useMemo(() => {
    return [
      { value: "__no_project__", label: "No project" },
      ...[...projects]
        .filter((p) => showArchived || !isArchived(p))
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((p) => ({ value: p.id, label: p.name })),
    ];
  }, [projects, showArchived]);

  const typeFilterOptions = useMemo(
    () => types.map((t) => ({ value: t, label: t })),
    [types],
  );

  const statusFilterOptions = useMemo(
    () => statusKeys.map((k) => ({ value: k, label: statusMap[k]?.label ?? k })),
    [statusKeys, statusMap],
  );

  const priorityFilterOptions = useMemo(
    () => priorities.map((p) => ({ value: p, label: p })),
    [priorities],
  );

  const tagFilterOptions = useMemo(
    () =>
      tagOptionsFromEntries(
        showArchived ? tasks : tasks.filter((t) => !isArchived(t)),
      ),
    [tasks, showArchived],
  );

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir(key === "date" || key === "priority" ? "desc" : "asc");
    }
  }

  function openCreate() {
    setCreateModalOpen(true);
    const defaultStatus = statusKeys[0] ?? "open";
    setForm({
      ownerId: owners[0]?.id ?? "",
      groupId: "",
      name: "",
      description: "",
      type: "Task",
      status: defaultStatus,
      date: new Date().toISOString().slice(0, 10),
      priority: "Medium",
      tags: [],
      keyTag: "",
    });
  }

  async function saveTask() {
    if (!form.ownerId || !form.name.trim()) return;
    const payload = {
      ownerId: form.ownerId,
      groupId: form.groupId ? form.groupId : null,
      name: form.name.trim(),
      description: form.description,
      type: form.type,
      status: form.status,
      date: form.date,
      priority: form.priority,
      tags: form.tags,
      keyTag: form.keyTag,
    };
    try {
      const r = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!r.ok) throw new Error(await r.text());
      setCreateModalOpen(false);
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Save failed");
    }
  }

  async function deleteTask(id: string) {
    if (!confirm("Delete this task?")) return;
    const r = await fetch(`/api/tasks/${id}`, { method: "DELETE" });
    if (!r.ok) setErr("Delete failed");
    await load();
  }

  async function patchTask(
    id: string,
    patch: Partial<Pick<Task, "status" | "priority" | "subtasks">>,
  ) {
    setSavingTaskEdits((m) => ({ ...m, [id]: true }));
    setErr(null);
    // optimistic UI so controlled <select> doesn't snap back
    setTasks((ts) => ts.map((t) => (t.id === id ? { ...t, ...patch } : t)));
    try {
      const r = await fetch(`/api/tasks/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!r.ok) {
        throw new Error("Could not update task");
      }
      const next: Task = await r.json();
      setTasks((ts) => ts.map((t) => (t.id === id ? next : t)));
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Could not update task";
      await load();
      setErr(msg);
    } finally {
      setSavingTaskEdits((m) => ({ ...m, [id]: false }));
    }
  }

  const ownerGroups = useMemo(() => {
    if (!form.ownerId) return [];
    return groups.filter((g) => g.ownerId === form.ownerId);
  }, [groups, form.ownerId]);

  if (loading) {
    return <p className="text-zinc-500">Loading…</p>;
  }

  return (
    <div className="flex flex-col gap-6">
      {err ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
          {err}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            Tasks
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            {progress.done} / {progress.total} done in current filters
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setView("flat")}
            className={`rounded-lg px-3 py-2 text-sm font-medium ${
              view === "flat"
                ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                : "border border-zinc-300 bg-white dark:border-zinc-600 dark:bg-zinc-900"
            }`}
          >
            Table
          </button>
          <button
            type="button"
            onClick={() => setView("epic")}
            className={`rounded-lg px-3 py-2 text-sm font-medium ${
              view === "epic"
                ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                : "border border-zinc-300 bg-white dark:border-zinc-600 dark:bg-zinc-900"
            }`}
          >
            By epic
          </button>
          <button
            type="button"
            onClick={openCreate}
            disabled={owners.length === 0}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            New task
          </button>
        </div>
      </div>

      <div className="grid gap-3 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950 sm:grid-cols-2 lg:grid-cols-4">
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-zinc-500">Search</span>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Name or description"
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
          label="Project"
          options={projectFilterOptions}
          selected={projectIds}
          onChange={setProjectIds}
        />
        <FilterMultiDropdown
          label="Epic / group"
          options={groupFilterOptions}
          selected={groupIds}
          onChange={setGroupIds}
        />
        <FilterMultiDropdown
          label="Type"
          options={typeFilterOptions}
          selected={selectedTypes}
          onChange={setSelectedTypes}
        />
        <FilterMultiDropdown
          label="Status"
          options={statusFilterOptions}
          selected={selectedStatuses}
          onChange={setSelectedStatuses}
        />
        <FilterMultiDropdown
          label="Priority"
          options={priorityFilterOptions}
          selected={selectedPriorities}
          onChange={setSelectedPriorities}
        />
        <FilterMultiDropdown
          label="Tags (any match)"
          options={tagFilterOptions}
          selected={selectedTagKeys}
          onChange={setSelectedTagKeys}
        />
        <label className="flex items-center gap-2 text-sm text-zinc-700 sm:col-span-2 lg:col-span-4 dark:text-zinc-200">
          <input
            type="checkbox"
            checked={showArchived}
            onChange={(e) => setShowArchived(e.target.checked)}
            className="rounded border-zinc-300 dark:border-zinc-600"
          />
          Show archived tasks and epics
        </label>
      </div>

      {owners.length === 0 ? (
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Add an owner first under{" "}
          <Link href="/owners" className="text-blue-600 underline">
            Owners
          </Link>
          .
        </p>
      ) : view === "epic" ? (
        <EpicSections
          owners={owners}
          groups={groupsForEpicView}
          tasks={filtered}
          statusMap={statusMap}
          onDelete={deleteTask}
          onPatch={patchTask}
          savingTaskEdits={savingTaskEdits}
          expanded={expanded}
          setExpanded={setExpanded}
        />
      ) : (
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center justify-end gap-2">
            <details className="relative rounded-lg border border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-900">
              <summary className="cursor-pointer list-none px-3 py-2 text-sm font-medium text-zinc-700 marker:hidden dark:text-zinc-200 [&::-webkit-details-marker]:hidden">
                Columns
              </summary>
              <div className="absolute right-0 z-10 mt-1 min-w-[12rem] rounded-lg border border-zinc-200 bg-white p-2 shadow-lg dark:border-zinc-600 dark:bg-zinc-950">
                {TABLE_COLUMNS.map((col) => (
                  <label
                    key={col.id}
                    className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-900"
                  >
                    <input
                      type="checkbox"
                      checked={tableColumns[col.id]}
                      onChange={() =>
                        setTableColumns((c) => ({ ...c, [col.id]: !c[col.id] }))
                      }
                      className="rounded border-zinc-300 dark:border-zinc-600"
                    />
                    {col.label}
                  </label>
                ))}
              </div>
            </details>
          </div>
          <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
            <table className="w-full min-w-[88rem] table-auto text-left text-sm">
              <thead className="bg-zinc-50 text-xs uppercase text-zinc-500 dark:bg-zinc-900/80 dark:text-zinc-400">
                <tr>
                  <th className="w-px min-w-0 p-0" aria-hidden />
                  {TABLE_COLUMNS.filter((c) => tableColumns[c.id]).map((col) => {
                    const colSort = col.sortKey;
                    return (
                      <th key={col.id} className="px-3 py-2">
                        {colSort ? (
                          <button
                            type="button"
                            className="font-semibold hover:text-zinc-800 dark:hover:text-zinc-200"
                            onClick={() => toggleSort(colSort)}
                          >
                            {col.label}
                            {sortKey === colSort
                              ? sortDir === "asc"
                                ? " ↑"
                                : " ↓"
                              : ""}
                          </button>
                        ) : (
                          <span className="font-semibold">{col.label}</span>
                        )}
                      </th>
                    );
                  })}
                  <th className="px-3 py-2"> </th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((t) => {
                  const p = owners.find((x) => x.id === t.ownerId);
                  const color = p?.color ?? "#64748b";
                  const statusRow = statusDef(t.status, statusMap);
                  const statusColor = statusRow.color;
                  const statusKnown = isKnownTaskStatus(t.status, statusMap);
                  const statusSelectValue = taskStatusSelectValue(t.status, statusMap);
                  const ex = markdownExcerpt(t.description, 100);
                  const tags = t.tags ?? [];
                  const tagsTitle = tags.join(", ");
                  const tagsLabel = tags.join(" · ");
                  const prHit = priorityRows.find(
                    (r) => r.label.trim().toLowerCase() === t.priority.trim().toLowerCase(),
                  );
                  const prLabel = prHit?.label ?? t.priority;
                  const prColor = prHit?.color ?? "#64748b";
                  const prBg = prHit?.bg ?? "rgba(100,116,139,0.15)";
                  const isOpen = expanded[t.id];
                  const saving = Boolean(savingTaskEdits[t.id]);
                  const detailColSpan =
                    1 +
                    TABLE_COLUMNS.filter((c) => tableColumns[c.id]).length +
                    1;
                  return (
                    <Fragment key={t.id}>
                      <tr
                        className="border-t border-zinc-100 dark:border-zinc-800"
                        {...(isArchived(t) ? { "data-pd-archived": "true" } : {})}
                      >
                        <td className="w-0 p-0 align-middle" aria-hidden>
                          <div className="flex h-14 items-center">
                            <div className="flex h-11 w-max items-stretch gap-px overflow-hidden rounded-md ring-1 ring-zinc-900/10 dark:ring-white/10">
                            <span
                              className="h-full w-2.5 min-w-2.5 shrink-0"
                              style={{ backgroundColor: statusColor }}
                              title={statusRow.label}
                            />
                            <OwnerSwatch
                              owner={p}
                              color={color}
                              className="h-11 w-11 shrink-0 rounded-none border-0 shadow-none"
                              title={p?.name ?? "Owner"}
                            />
                          </div>
                          </div>
                        </td>
                        {tableColumns.name ? (
                          <td className="align-middle px-3 py-2 font-medium text-zinc-900 dark:text-zinc-100">
                            <div className="flex min-w-0 flex-col gap-1">
                              <span className="flex flex-wrap items-center gap-2">
                                <TableClampCell
                                  className="min-w-0 flex-1 text-sm"
                                  fullTitle={t.name}
                                >
                                  <Link
                                    href={`/tasks/${t.id}`}
                                    className="block min-w-0 text-blue-600 hover:underline dark:text-blue-400"
                                  >
                                    {t.name}
                                  </Link>
                                </TableClampCell>
                                <EntityArchivedBadge entity={t} />
                              </span>
                              {(() => {
                                const st = t.subtasks ?? [];
                                const done = st.filter((s) => s.done).length;
                                return st.length > 0 ? (
                                  <SubtaskProgressBar done={done} total={st.length} />
                                ) : null;
                              })()}
                            </div>
                          </td>
                        ) : null}
                        {tableColumns.owner ? (
                          <td className="max-w-[11rem] align-middle px-3 py-2 text-zinc-600 dark:text-zinc-300">
                            <span className="flex min-w-0 items-center gap-1.5 text-sm">
                              <span
                                className="h-2 w-2 shrink-0 rounded-sm"
                                style={{ backgroundColor: color }}
                                aria-hidden
                              />
                              <TableClampCell
                                className="min-w-0 flex-1 font-medium text-zinc-800 dark:text-zinc-200"
                                fullTitle={p?.name ?? "—"}
                              >
                                <span>{p?.name ?? "—"}</span>
                              </TableClampCell>
                            </span>
                          </td>
                        ) : null}
                        {tableColumns.project ? (
                          <td className="max-w-[12rem] align-middle px-3 py-2 text-zinc-600 dark:text-zinc-300">
                            {(() => {
                              const g = t.groupId ? groups.find((x) => x.id === t.groupId) : null;
                              const pid = g?.projectId ?? null;
                              const proj = pid ? projects.find((x) => x.id === pid) : null;
                              return proj ? (
                                <Link
                                  href={`/projects/${proj.id}`}
                                  className="flex min-w-0 items-center gap-2 text-sm text-blue-600 hover:underline dark:text-blue-400"
                                >
                                  <OwnerSwatch
                                    color={proj.color}
                                    iconDataUrl={proj.iconDataUrl}
                                    className="h-6 w-6 shrink-0 rounded-md"
                                    title={proj.name}
                                  />
                                  <TableClampCell
                                    className="min-w-0 flex-1"
                                    fullTitle={proj.name}
                                  >
                                    <span>{proj.name}</span>
                                  </TableClampCell>
                                </Link>
                              ) : (
                                <TableCellSlot className="text-zinc-500">
                                  <span>—</span>
                                </TableCellSlot>
                              );
                            })()}
                          </td>
                        ) : null}
                        {tableColumns.epic ? (
                          <td className="max-w-[12rem] align-middle px-3 py-2 text-zinc-600 dark:text-zinc-300">
                            {t.groupId ? (
                              <TableClampCell
                                className="text-sm"
                                fullTitle={groupName(groups, t.groupId)}
                              >
                                <Link
                                  href={`/owners/${t.ownerId}#epic-${t.groupId}`}
                                  className="block min-w-0 text-blue-600 hover:underline dark:text-blue-400"
                                >
                                  {groupName(groups, t.groupId)}
                                </Link>
                              </TableClampCell>
                            ) : (
                              <TableClampCell
                                className="text-sm"
                                fullTitle={groupName(groups, t.groupId)}
                              >
                                <span>{groupName(groups, t.groupId)}</span>
                              </TableClampCell>
                            )}
                          </td>
                        ) : null}
                        {tableColumns.type ? (
                          <td className="align-middle px-3 py-2">
                            <TableCellSlot>
                              <TaskTypeBadge type={t.type} />
                            </TableCellSlot>
                          </td>
                        ) : null}
                        {tableColumns.status ? (
                          <td className="align-middle px-3 py-2">
                            <TableCellSlot className="min-w-0">
                              <select
                              value={statusSelectValue}
                              onChange={(e) => void patchTask(t.id, { status: e.target.value })}
                              disabled={saving}
                              className="max-w-[10rem] truncate rounded-full border border-zinc-200 px-2 py-0.5 pr-6 text-xs font-medium dark:border-zinc-600"
                              style={{
                                color: statusRow.color,
                                backgroundColor: statusRow.bg,
                              }}
                              title={t.status}
                            >
                              {!statusKnown ? (
                                <option value={statusSelectValue}>
                                  {String(t.status)} (unknown)
                                </option>
                              ) : null}
                              {statusKeys.map((k) => (
                                <option key={k} value={k}>
                                  {statusMap[k]?.label ?? k}
                                </option>
                              ))}
                            </select>
                            </TableCellSlot>
                          </td>
                        ) : null}
                        {tableColumns.date ? (
                          <td className="align-middle px-3 py-2 tabular-nums text-zinc-600 dark:text-zinc-400">
                            <TableClampCell className="text-sm" fullTitle={t.date}>
                              <span>{t.date}</span>
                            </TableClampCell>
                          </td>
                        ) : null}
                        {tableColumns.priority ? (
                          <td className="align-middle px-3 py-2">
                            <TableCellSlot className="min-w-0">
                              <select
                              value={prLabel}
                              onChange={(e) => void patchTask(t.id, { priority: e.target.value })}
                              disabled={saving}
                              className="max-w-[10rem] truncate rounded-full border border-zinc-200 px-2 py-0.5 pr-6 text-xs font-medium dark:border-zinc-600"
                              style={{ color: prColor, backgroundColor: prBg }}
                              title={t.priority}
                            >
                              {!prHit ? (
                                <option value={prLabel}>{String(t.priority)} (unknown)</option>
                              ) : null}
                              {priorityRows.map((r) => (
                                <option key={r.label} value={r.label}>
                                  {r.icon ? `${r.icon} ` : ""}
                                  {r.label}
                                </option>
                              ))}
                            </select>
                            </TableCellSlot>
                          </td>
                        ) : null}
                        {tableColumns.tags ? (
                          <td className="max-w-[16rem] align-middle px-3 py-2 text-zinc-600 dark:text-zinc-300">
                            {tags.length ? (
                              <TableClampCell className="text-xs" fullTitle={tagsTitle}>
                                <span>{tagsLabel}</span>
                              </TableClampCell>
                            ) : (
                              <TableCellSlot className="text-zinc-400">
                                <span>—</span>
                              </TableCellSlot>
                            )}
                          </td>
                        ) : null}
                        {tableColumns.summary ? (
                          <td className="max-w-xs align-middle px-3 py-2 text-zinc-500 dark:text-zinc-400">
                            <TableClampCell suppressTitle className="text-sm">
                              <span>{ex || "—"}</span>
                            </TableClampCell>
                          </td>
                        ) : null}
                        <td className="px-3 py-2 align-middle whitespace-nowrap">
                          <TableCellSlot className="flex-nowrap gap-x-3">
                          <button
                            type="button"
                            className="text-blue-600 text-xs hover:underline"
                            onClick={() =>
                              setExpanded((e) => ({ ...e, [t.id]: !e[t.id] }))
                            }
                          >
                            {isOpen ? "Hide" : "Details"}
                          </button>
                          <Link
                            href={`/tasks/${t.id}/edit`}
                            className="text-blue-600 text-xs hover:underline"
                          >
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
                          </TableCellSlot>
                        </td>
                      </tr>
                      {isOpen ? (
                        <tr className="bg-zinc-50/80 dark:bg-zinc-900/50">
                          <td
                            colSpan={detailColSpan}
                            className="w-full max-w-0 px-4 py-3 align-top"
                          >
                            <div className="mb-2 text-xs text-zinc-500">
                              Epic:{" "}
                              {t.groupId ? (
                                <Link
                                  href={`/owners/${t.ownerId}#epic-${t.groupId}`}
                                  className="text-blue-600 hover:underline dark:text-blue-400"
                                >
                                  {groupName(groups, t.groupId)}
                                </Link>
                              ) : (
                                groupName(groups, t.groupId)
                              )}{" "}
                              · Wiki:{" "}
                              <code className="rounded bg-zinc-200 px-1 dark:bg-zinc-800">
                                {`[[task:${t.id}]]`}
                              </code>
                            </div>
                            {(() => {
                              const st = t.subtasks ?? [];
                              const done = st.filter((s) => s.done).length;
                              return st.length > 0 ? (
                                <div className="mb-4 border-b border-zinc-200 pb-4 dark:border-zinc-700">
                                  <SubtaskProgressBar done={done} total={st.length} />
                                  <ul className="mt-3 list-none space-y-2 p-0">
                                    {st.map((s) => (
                                      <li key={s.id} className="flex items-start gap-3 text-sm">
                                        <input
                                          type="checkbox"
                                          checked={s.done}
                                          disabled={isArchived(t) || saving}
                                          onChange={() =>
                                            void patchTask(t.id, {
                                              subtasks: st.map((x) =>
                                                x.id === s.id ? { ...x, done: !x.done } : x,
                                              ),
                                            })
                                          }
                                          className="mt-0.5 rounded border-zinc-300 dark:border-zinc-600"
                                          aria-label={
                                            s.done ? `Mark not done: ${s.title}` : `Mark done: ${s.title}`
                                          }
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
                                </div>
                              ) : null;
                            })()}
                            <TaskDetailsMarkdown
                              markdown={t.description || "_No description_"}
                            />
                          </td>
                        </tr>
                      ) : null}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
            {sorted.length === 0 ? (
              <p className="p-6 text-center text-sm text-zinc-500">No tasks match.</p>
            ) : null}
          </div>
        </div>
      )}

      {createModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white p-6 shadow-xl dark:bg-zinc-950">
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">New task</h2>
            <div className="mt-4 flex flex-col gap-3">
              <label className="text-sm">
                <span className="text-zinc-500">Owner</span>
                <select
                  value={form.ownerId}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      ownerId: e.target.value,
                      groupId: "",
                    }))
                  }
                  className="mt-1 w-full rounded-lg border border-zinc-300 px-2 py-2 dark:border-zinc-600 dark:bg-zinc-900"
                >
                  {owners.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm">
                <span className="text-zinc-500">Epic (optional)</span>
                <select
                  value={form.groupId}
                  onChange={(e) => setForm((f) => ({ ...f, groupId: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-zinc-300 px-2 py-2 dark:border-zinc-600 dark:bg-zinc-900"
                >
                  <option value="">None</option>
                  {ownerGroups.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm">
                <span className="text-zinc-500">Name</span>
                <input
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-zinc-300 px-2 py-2 dark:border-zinc-600 dark:bg-zinc-900"
                />
              </label>
              <EntityKeyTagInput
                value={form.keyTag}
                onChange={(keyTag) => setForm((f) => ({ ...f, keyTag }))}
                defaultTag="TSK"
              />
              <label className="text-sm">
                <span className="text-zinc-500">Type</span>
                <select
                  value={form.type}
                  onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-zinc-300 px-2 py-2 dark:border-zinc-600 dark:bg-zinc-900"
                >
                  {types.map((t) => (
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
                  onChange={(e) =>
                    setForm((f) => ({ ...f, priority: e.target.value }))
                  }
                  className="mt-1 w-full rounded-lg border border-zinc-300 px-2 py-2 dark:border-zinc-600 dark:bg-zinc-900"
                >
                  {priorities.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm">
                <span className="text-zinc-500">Description (Markdown)</span>
                <textarea
                  value={form.description}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, description: e.target.value }))
                  }
                  rows={6}
                  className="mt-1 w-full rounded-lg border border-zinc-300 px-2 py-2 font-mono text-xs dark:border-zinc-600 dark:bg-zinc-900"
                />
              </label>
              <NoteTagsEditor
                tags={form.tags}
                onChange={(tags) => setForm((f) => ({ ...f, tags }))}
              />
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                className="rounded-lg border border-zinc-300 px-4 py-2 text-sm dark:border-zinc-600"
                onClick={() => setCreateModalOpen(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
                onClick={() => void saveTask()}
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

function EpicSections({
  owners,
  groups,
  tasks,
  statusMap,
  onDelete,
  onPatch,
  savingTaskEdits,
  expanded,
  setExpanded,
}: {
  owners: Owner[];
  groups: TaskGroup[];
  tasks: Task[];
  statusMap: Record<string, StatusDef>;
  onDelete: (id: string) => void;
  onPatch: (id: string, patch: Partial<Pick<Task, "status" | "priority" | "subtasks">>) => void;
  savingTaskEdits: Record<string, boolean>;
  expanded: Record<string, boolean>;
  setExpanded: Dispatch<SetStateAction<Record<string, boolean>>>;
}) {
  const [epicDescOpen, setEpicDescOpen] = useState<Record<string, boolean>>({});

  return (
    <div className="flex flex-col gap-8">
      {groups.map((g) => {
        const p = owners.find((x) => x.id === g.ownerId);
        const color = p?.color ?? "#6366f1";
        const inGroup = tasks.filter((t) => t.groupId === g.id);
        return (
          <section
            key={g.id}
            className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950"
          >
            <div className="flex flex-wrap items-start justify-between gap-4 border-b border-zinc-100 pb-3 dark:border-zinc-800">
              <div className="flex min-w-0 items-start gap-3">
                <OwnerSwatch
                  owner={p}
                  color={color}
                  className="mt-0.5 h-9 w-9 shrink-0 rounded-lg"
                  title={p?.name ?? "Owner"}
                />
                <div className="min-w-0">
                  <h3 className="truncate text-lg font-semibold text-zinc-900 dark:text-zinc-50">
                    {g.name}
                  </h3>
                <p className="text-xs text-zinc-500">
                  Owner:{" "}
                  <span style={{ color }} className="font-medium">
                    {p?.name}
                  </span>
                </p>
                </div>
              </div>
              <ProgressBar tasks={inGroup} statusMap={statusMap} />
            </div>
            {g.description ? (
              <div className="mt-3">
                <button
                  type="button"
                  className="text-sm font-medium text-blue-600 hover:underline dark:text-blue-400"
                  onClick={() =>
                    setEpicDescOpen((prev) => ({ ...prev, [g.id]: !prev[g.id] }))
                  }
                >
                  {epicDescOpen[g.id] ? "Hide epic description" : "Show epic description"}
                </button>
                {epicDescOpen[g.id] ? (
                  <div className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
                    <MarkdownView markdown={g.description} />
                  </div>
                ) : null}
              </div>
            ) : null}
            <ul className="mt-4 flex flex-col gap-2">
              {inGroup.length === 0 ? (
                <li className="text-sm text-zinc-500">No tasks in this epic.</li>
              ) : (
                inGroup.map((t) => (
                  <EpicTaskRow
                    key={t.id}
                    task={t}
                    owner={p}
                    groups={groups}
                    statusMap={statusMap}
                    onPatch={onPatch}
                    saving={Boolean(savingTaskEdits[t.id])}
                    expanded={!!expanded[t.id]}
                    onToggle={() =>
                      setExpanded((e) => ({ ...e, [t.id]: !e[t.id] }))
                    }
                    onDelete={() => void onDelete(t.id)}
                  />
                ))
              )}
            </ul>
          </section>
        );
      })}
      <section className="rounded-xl border border-dashed border-zinc-300 bg-zinc-50/50 p-4 dark:border-zinc-600 dark:bg-zinc-900/30">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-zinc-800 dark:text-zinc-100">
            Ungrouped
          </h3>
        </div>
        <ul className="flex flex-col gap-2">
          {tasks
            .filter((t) => t.groupId === null)
            .map((t) => {
              const p = owners.find((x) => x.id === t.ownerId);
              return (
                <EpicTaskRow
                  key={t.id}
                  task={t}
                  owner={p}
                  groups={groups}
                  statusMap={statusMap}
                  onPatch={onPatch}
                  saving={Boolean(savingTaskEdits[t.id])}
                  expanded={!!expanded[t.id]}
                  onToggle={() =>
                    setExpanded((e) => ({ ...e, [t.id]: !e[t.id] }))
                  }
                  onDelete={() => void onDelete(t.id)}
                />
              );
            })}
        </ul>
        {tasks.filter((t) => t.groupId === null).length === 0 ? (
          <p className="text-sm text-zinc-500">No ungrouped tasks.</p>
        ) : null}
      </section>
    </div>
  );
}

function EpicTaskRow({
  task,
  owner,
  groups,
  statusMap,
  onPatch,
  saving,
  expanded,
  onToggle,
  onDelete,
}: {
  task: Task;
  owner?: Owner;
  groups: TaskGroup[];
  statusMap: Record<string, StatusDef>;
  onPatch: (id: string, patch: Partial<Pick<Task, "status" | "priority" | "subtasks">>) => void;
  saving: boolean;
  expanded: boolean;
  onToggle: () => void;
  onDelete: () => void;
}) {
  const color = owner?.color ?? "#64748b";
  const epicLabel = groupName(groups, task.groupId);
  const statusRow = statusDef(task.status, statusMap);
  const statusKnown = isKnownTaskStatus(task.status, statusMap);
  const statusSelectValue = taskStatusSelectValue(task.status, statusMap);
  const { settings, statusKeys } = useDashboardConfig();
  const priorityRows = settings?.taskPriorities ?? DEFAULT_DASHBOARD_SETTINGS.taskPriorities;
  const prHit = priorityRows.find(
    (r) => r.label.trim().toLowerCase() === task.priority.trim().toLowerCase(),
  );
  const prLabel = prHit?.label ?? task.priority;
  const prColor = prHit?.color ?? "#64748b";
  const prBg = prHit?.bg ?? "rgba(100,116,139,0.15)";
  const subs = task.subtasks ?? [];
  const stDone = subs.filter((s) => s.done).length;
  const archived = isArchived(task);
  return (
    <li
      className="rounded-lg border border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-950"
      style={{ borderLeftWidth: 4, borderLeftColor: color }}
    >
      <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
        <div className="min-w-0 flex-1">
          <Link
            href={`/tasks/${task.id}`}
            className="font-medium text-blue-600 hover:underline dark:text-blue-400"
          >
            {task.name}
          </Link>
          {subs.length > 0 ? (
            <div className="mt-1.5 max-w-md">
              <SubtaskProgressBar done={stDone} total={subs.length} />
            </div>
          ) : null}
          <div className="mt-1 flex flex-wrap gap-2">
            <select
              value={statusSelectValue}
              onChange={(e) => onPatch(task.id, { status: e.target.value })}
              disabled={saving}
              className="max-w-[10rem] truncate rounded-full border border-zinc-200 px-2 py-0.5 pr-6 text-xs font-medium dark:border-zinc-600"
              style={{ color: statusRow.color, backgroundColor: statusRow.bg }}
              title={task.status}
            >
              {!statusKnown ? (
                <option value={statusSelectValue}>{String(task.status)} (unknown)</option>
              ) : null}
              {statusKeys.map((k) => (
                <option key={k} value={k}>
                  {statusMap[k]?.label ?? k}
                </option>
              ))}
            </select>
            <span className="text-xs text-zinc-500">
              Epic:{" "}
              {task.groupId ? (
                <Link
                  href={`/owners/${task.ownerId}#epic-${task.groupId}`}
                  className="text-blue-600 hover:underline dark:text-blue-400"
                >
                  {epicLabel}
                </Link>
              ) : (
                epicLabel
              )}
            </span>
            <TaskTypeBadge type={task.type} />
            <span className="text-xs text-zinc-500">{task.date}</span>
            <select
              value={prLabel}
              onChange={(e) => onPatch(task.id, { priority: e.target.value })}
              disabled={saving}
              className="max-w-[10rem] truncate rounded-full border border-zinc-200 px-2 py-0.5 pr-6 text-xs font-medium dark:border-zinc-600"
              style={{ color: prColor, backgroundColor: prBg }}
              title={task.priority}
            >
              {!prHit ? (
                <option value={prLabel}>{String(task.priority)} (unknown)</option>
              ) : null}
              {priorityRows.map((r) => (
                <option key={r.label} value={r.label}>
                  {r.icon ? `${r.icon} ` : ""}
                  {r.label}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs leading-none">
          <button
            type="button"
            className="inline-flex items-center text-blue-600 hover:underline"
            onClick={onToggle}
          >
            {expanded ? "Hide" : "Details"}
          </button>
          <Link
            href={`/tasks/${task.id}`}
            className="inline-flex items-center text-zinc-600 hover:underline dark:text-zinc-400"
          >
            View
          </Link>
          <Link
            href={`/tasks/${task.id}/edit`}
            className="inline-flex items-center text-blue-600 hover:underline"
          >
            Edit
          </Link>
          <button
            type="button"
            className="inline-flex items-center justify-center rounded p-1 text-red-600 hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-950/40 dark:hover:text-red-300"
            onClick={onDelete}
            aria-label="Delete task"
            title="Delete task"
          >
            <TrashIcon />
          </button>
        </div>
      </div>
      {expanded ? (
        <div className="min-w-0 border-t border-zinc-100 px-3 py-3 dark:border-zinc-800">
          {subs.length > 0 ? (
            <div className="mb-4 border-b border-zinc-200 pb-4 dark:border-zinc-700">
              <SubtaskProgressBar done={stDone} total={subs.length} />
              <ul className="mt-3 list-none space-y-2 p-0">
                {subs.map((s) => (
                  <li key={s.id} className="flex items-start gap-3 text-sm">
                    <input
                      type="checkbox"
                      checked={s.done}
                      disabled={archived || saving}
                      onChange={() =>
                        void onPatch(task.id, {
                          subtasks: subs.map((x) =>
                            x.id === s.id ? { ...x, done: !x.done } : x,
                          ),
                        })
                      }
                      className="mt-0.5 rounded border-zinc-300 dark:border-zinc-600"
                      aria-label={
                        s.done ? `Mark not done: ${s.title}` : `Mark done: ${s.title}`
                      }
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
            </div>
          ) : null}
          <TaskDetailsMarkdown markdown={task.description || "_No description_"} />
        </div>
      ) : null}
    </li>
  );
}
