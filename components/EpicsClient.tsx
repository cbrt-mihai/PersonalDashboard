"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { useDashboardConfig } from "@/components/DashboardSettingsProvider";
import type { Owner, Project, Task, TaskGroup } from "@/lib/schemas";
import { markdownExcerpt } from "@/lib/markdownExcerpt";
import { isArchived } from "@/lib/archive";
import { epicRollupStateFromTasks, type EpicRollupState } from "@/lib/epicRollupState";
import { isTerminalStatus, statusDef } from "@/lib/statusConfig";
import { entryMatchesTagKeys, tagOptionsFromEntries } from "@/lib/noteTags";
import { DashboardFilterDisclosure } from "@/components/DashboardFilterDisclosure";
import { DashboardPager } from "@/components/DashboardPager";
import { LogWorkButton } from "@/components/LogWorkButton";
import { FilterMultiDropdown } from "./FilterMultiDropdown";
import { MarkdownField } from "./MarkdownField";
import { MarkdownView } from "./MarkdownView";
import { NoteTagsEditor } from "./NoteTagsEditor";
import { SearchableSingleSelect } from "./SearchableSingleSelect";
import { ProgressBar } from "./ProgressBar";
import { OwnerSwatch } from "./OwnerSwatch";
import { StatusBadge } from "./StatusBadge";
import { EntityArchivedBadge } from "./EntityArchivedMark";
import { EntityKeyTagInput } from "./EntityKeyTagInput";
import { TableCellSlot, TableClampCell } from "./TableClampCell";
import { dashboardIconBtnPrimaryClass } from "@/lib/dashboardTableActionClasses";
import { EyeIcon, EyeSlashIcon, TrashIcon } from "./icons";
import { useDashboardLocalPager } from "@/lib/useDashboardLocalPager";
import { TableColumnResizeHandle, useTableColumnWidths } from "@/lib/useTableColumnWidths";

type EpicStateFilter = EpicRollupState;
type SortKey = "name" | "owner" | "project" | "progress" | "tasks" | "state";

type TableColumnId =
  | "name"
  | "owner"
  | "project"
  | "state"
  | "tasks"
  | "progress"
  | "summary";

const TABLE_COLUMN_STORAGE_KEY = "pd-epics-table-columns";

const DEFAULT_TABLE_COLUMNS: Record<TableColumnId, boolean> = {
  name: true,
  owner: true,
  project: false,
  state: true,
  tasks: true,
  progress: true,
  summary: true,
};

const TABLE_COLUMNS: { id: TableColumnId; label: string; sortKey?: SortKey }[] = [
  { id: "name", label: "Epic", sortKey: "name" },
  { id: "owner", label: "Owner", sortKey: "owner" },
  { id: "project", label: "Project", sortKey: "project" },
  { id: "state", label: "State", sortKey: "state" },
  { id: "tasks", label: "Tasks", sortKey: "tasks" },
  { id: "progress", label: "Progress", sortKey: "progress" },
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

export function EpicsClient() {
  const router = useRouter();
  const { statusMap } = useDashboardConfig();
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
  const [tagKeys, setTagKeys] = useState<string[]>([]);
  const [stateFilters, setStateFilters] = useState<EpicStateFilter[]>([]);
  const [sortKey, setSortKey] = useState<SortKey>("owner");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [tableColumns, setTableColumns] = useState<Record<TableColumnId, boolean>>({
    ...DEFAULT_TABLE_COLUMNS,
  });
  const [tableColumnsReady, setTableColumnsReady] = useState(false);

  const [createOpen, setCreateOpen] = useState(false);
  const [createOwnerId, setCreateOwnerId] = useState("");
  const [createName, setCreateName] = useState("");
  const [createDesc, setCreateDesc] = useState("");
  const [createTags, setCreateTags] = useState<string[]>([]);
  const [createProjectId, setCreateProjectId] = useState("");
  const [createKeyTag, setCreateKeyTag] = useState("");
  const [createSaving, setCreateSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    const [p, pj, g, t] = await Promise.all([
      fetch("/api/owners").then((r) => r.json()),
      fetch("/api/projects").then((r) => r.json()),
      fetch("/api/groups").then((r) => r.json()),
      fetch("/api/tasks").then((r) => r.json()),
    ]);
    setOwners(p);
    setProjects(pj);
    setGroups(g);
    setTasks(t);
    setLoading(false);
  }, []);

  async function deleteEpic(id: string) {
    if (!confirm("Delete this epic? Tasks will become ungrouped.")) return;
    setErr(null);
    try {
      const r = await fetch(`/api/groups/${id}`, { method: "DELETE" });
      if (!r.ok) throw new Error("Delete failed");
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Delete failed");
    }
  }

  useEffect(() => {
    queueMicrotask(() => {
      void load();
    });
  }, [load]);

  useEffect(() => {
    queueMicrotask(() => {
      try {
        const raw = localStorage.getItem(TABLE_COLUMN_STORAGE_KEY);
        setTableColumns(parseTableColumnPrefs(raw));
      } catch {
        /* ignore */
      } finally {
        setTableColumnsReady(true);
      }
    });
  }, []);

  useEffect(() => {
    if (!tableColumnsReady) return;
    try {
      localStorage.setItem(TABLE_COLUMN_STORAGE_KEY, JSON.stringify(tableColumns));
    } catch {
      /* ignore */
    }
  }, [tableColumnsReady, tableColumns]);

  const ownerFilterOptions = useMemo(
    () =>
      owners
        .filter((p) => showArchived || !isArchived(p))
        .map((p) => ({ value: p.id, label: p.name })),
    [owners, showArchived],
  );

  const createOwnerOptions = useMemo(
    () => owners.filter((p) => !isArchived(p)).map((p) => ({ value: p.id, label: p.name })),
    [owners],
  );

  const createProjectOptions = useMemo(
    () => [
      { value: "", label: "No project" },
      ...projects
        .filter((p) => !isArchived(p))
        .map((p) => ({ value: p.id, label: p.name })),
    ],
    [projects],
  );

  const projectFilterOptions = useMemo(
    () => [
      { value: "__no_project__", label: "No project" },
      ...projects
        .filter((p) => showArchived || !isArchived(p))
        .map((p) => ({ value: p.id, label: p.name })),
    ],
    [projects, showArchived],
  );

  const tagFilterOptions = useMemo(
    () =>
      tagOptionsFromEntries(
        showArchived ? groups : groups.filter((g) => !isArchived(g)),
      ),
    [groups, showArchived],
  );

  const epicStateOptions = useMemo(
    () => {
      const keys: EpicStateFilter[] = ["open", "in_progress", "blocked", "done", "closed"];
      return keys
        .sort((a, b) => statusDef(a, statusMap).order - statusDef(b, statusMap).order)
        .map((k) => ({ value: k, label: statusDef(k, statusMap).label }))
        .filter((opt) => opt.label.trim().length > 0) satisfies {
        value: EpicStateFilter;
        label: string;
      }[];
    },
    [statusMap],
  );

  const epicRows = useMemo(() => {
    return groups.map((g) => {
      const owner = owners.find((p) => p.id === g.ownerId);
      const accent = owner?.color ?? "#6366f1";
      const inGroup = tasks.filter((t) => t.groupId === g.id && !isArchived(t));
      const done = inGroup.filter((t) => isTerminalStatus(t.status, statusMap)).length;
      const total = inGroup.length;
      const state = epicRollupStateFromTasks(inGroup, statusMap);
      const proj = g.projectId ? projects.find((p) => p.id === g.projectId) ?? null : null;
      return { g, owner, proj, accent, done, total, state };
    });
  }, [groups, owners, projects, statusMap, tasks]);

  const filteredRows = useMemo(() => {
    let rows = epicRows;
    if (!showArchived) rows = rows.filter((r) => !isArchived(r.g));
    if (ownerIds.length) {
      rows = rows.filter((r) => ownerIds.includes(r.g.ownerId));
    }
    if (projectIds.length) {
      const set = new Set(projectIds);
      rows = rows.filter((r) => {
        const pid = r.g.projectId ?? null;
        if (pid === null) return set.has("__no_project__");
        return set.has(pid);
      });
    }
    if (tagKeys.length) {
      rows = rows.filter((r) => entryMatchesTagKeys(r.g.tags, tagKeys));
    }
    if (stateFilters.length) {
      rows = rows.filter((r) => stateFilters.includes(r.state));
    }
    const ql = q.trim().toLowerCase();
    if (ql) {
      rows = rows.filter((r) => {
        const ownerName = r.owner?.name ?? "";
        const projectName = r.proj?.name ?? "";
        return (
          r.g.name.toLowerCase().includes(ql) ||
          (r.g.description ?? "").toLowerCase().includes(ql) ||
          ownerName.toLowerCase().includes(ql) ||
          projectName.toLowerCase().includes(ql) ||
          (r.g.tags ?? []).some((t) => t.toLowerCase().includes(ql))
        );
      });
    }
    return rows;
  }, [epicRows, ownerIds, projectIds, q, showArchived, stateFilters, tagKeys]);

  const sortedRows = useMemo(() => {
    const dir = sortDir === "asc" ? 1 : -1;
    const arr = [...filteredRows];
    arr.sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case "name":
          cmp = a.g.name.localeCompare(b.g.name);
          break;
        case "owner":
          cmp = (a.owner?.name ?? "").localeCompare(b.owner?.name ?? "");
          if (cmp !== 0) break;
          cmp = a.g.name.localeCompare(b.g.name);
          break;
        case "project":
          cmp = (a.proj?.name ?? "").localeCompare(b.proj?.name ?? "");
          if (cmp !== 0) break;
          cmp = a.g.name.localeCompare(b.g.name);
          break;
        case "progress":
          cmp = a.total === 0 && b.total === 0 ? 0 : a.done / Math.max(1, a.total) - b.done / Math.max(1, b.total);
          break;
        case "tasks":
          cmp = a.total - b.total;
          break;
        case "state":
          cmp = statusDef(a.state, statusMap).order - statusDef(b.state, statusMap).order;
          break;
        default:
          cmp = 0;
      }
      return cmp * dir;
    });
    return arr;
  }, [filteredRows, sortDir, sortKey, statusMap]);

  const epicPagerResetKey = useMemo(
    () =>
      JSON.stringify({
        q,
        showArchived,
        ownerIds,
        projectIds,
        tagKeys,
        stateFilters,
        sortKey,
        sortDir,
      }),
    [q, showArchived, ownerIds, projectIds, tagKeys, stateFilters, sortKey, sortDir],
  );

  const epicPager = useDashboardLocalPager(sortedRows.length, epicPagerResetKey);

  const pagedEpicRows = useMemo(() => epicPager.slice(sortedRows), [epicPager, sortedRows]);

  const defaultEpicColWidth = useCallback((k: string) => {
    const d: Record<string, number> = {
      __lead: 56,
      name: 220,
      owner: 128,
      project: 172,
      state: 104,
      tasks: 80,
      progress: 128,
      summary: 220,
      __actions: 168,
    };
    return d[k] ?? 120;
  }, []);

  const resizableEpicColKeys = useMemo(
    () =>
      [
        "__lead",
        ...TABLE_COLUMNS.filter((c) => tableColumns[c.id]).map((c) => c.id),
        "__actions",
      ] as string[],
    [tableColumns],
  );

  const { ColGroup, startResize } = useTableColumnWidths(
    "pd-epics-table-col-widths",
    resizableEpicColKeys,
    defaultEpicColWidth,
  );

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir(key === "tasks" || key === "progress" ? "desc" : "asc");
    }
  }

  function openCreateEpic() {
    setCreateName("");
    setCreateDesc("");
    setCreateTags([]);
    setCreateProjectId("");
    setCreateKeyTag("");
    setCreateOwnerId(ownerIds.length === 1 ? ownerIds[0]! : "");
    setCreateOpen(true);
  }

  function closeCreateEpic() {
    setCreateOpen(false);
    setCreateOwnerId("");
    setCreateName("");
    setCreateDesc("");
    setCreateTags([]);
    setCreateProjectId("");
    setCreateKeyTag("");
  }

  async function submitCreateEpic() {
    if (!createOwnerId || !createName.trim()) return;
    setCreateSaving(true);
    setErr(null);
    try {
      const r = await fetch(`/api/owners/${createOwnerId}/groups`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: createName.trim(),
          description: createDesc,
          tags: createTags,
          projectId: createProjectId ? createProjectId : null,
          keyTag: createKeyTag,
        }),
      });
      if (!r.ok) throw new Error("Could not create epic");
      const created = (await r.json()) as { id: string };
      closeCreateEpic();
      await load();
      router.push(`/epics/${created.id}/edit`);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not create epic");
    } finally {
      setCreateSaving(false);
    }
  }

  if (loading) {
    return <p className="text-zinc-500">Loading…</p>;
  }

  return (
    <div className="flex flex-col gap-8">
      {err ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
          {err}
        </div>
      ) : null}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            Epics
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            All epics across owners. You can also create or edit epics from an{" "}
            <Link href="/owners" className="text-blue-600 underline dark:text-blue-400">
              owner
            </Link>{" "}
            page.
          </p>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            {sortedRows.length} epic{sortedRows.length === 1 ? "" : "s"} in current filters
          </p>
        </div>
        <button
          type="button"
          onClick={() => openCreateEpic()}
          disabled={createOwnerOptions.length === 0}
          title={
            createOwnerOptions.length === 0
              ? "Add an owner first"
              : undefined
          }
          className="shrink-0 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          New epic
        </button>
      </div>

      <DashboardFilterDisclosure>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-zinc-500">Search</span>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Epic name, description, or owner"
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
          label="State"
          options={epicStateOptions}
          selected={stateFilters}
          onChange={(next) => setStateFilters(next as EpicStateFilter[])}
        />
        <FilterMultiDropdown
          label="Tags (any match)"
          options={tagFilterOptions}
          selected={tagKeys}
          onChange={setTagKeys}
        />
        <label className="flex items-center gap-2 text-sm text-zinc-700 sm:col-span-2 lg:col-span-4 dark:text-zinc-200">
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

      {groups.length === 0 ? (
        <p className="rounded-xl border border-dashed border-zinc-300 bg-zinc-50/50 px-4 py-8 text-center text-sm text-zinc-500 dark:border-zinc-600 dark:bg-zinc-900/30">
          No epics yet. Use{" "}
          <span className="font-medium text-zinc-700 dark:text-zinc-300">New epic</span> above, or
          open an owner and add one under &quot;Epics&quot;.
        </p>
      ) : sortedRows.length === 0 ? (
        <p className="rounded-xl border border-dashed border-zinc-300 bg-zinc-50/50 px-4 py-8 text-center text-sm text-zinc-500 dark:border-zinc-600 dark:bg-zinc-900/30">
          No epics match.
        </p>
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

          <DashboardPager
            page={epicPager.page}
            pageCount={epicPager.pageCount}
            total={epicPager.total}
            pageSize={epicPager.pageSize}
            onPageChange={epicPager.setPage}
          />

          <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
          <table className="w-full min-w-0 table-fixed text-left text-sm">
            <ColGroup />
            <thead className="bg-zinc-50 text-xs uppercase text-zinc-500 dark:bg-zinc-900/80 dark:text-zinc-400">
              <tr>
                <th className="relative w-px min-w-0 p-0" aria-hidden />
                {TABLE_COLUMNS.filter((c) => tableColumns[c.id]).map((col) => {
                  const colSort = col.sortKey;
                  return (
                    <th key={col.id} className="relative px-3 py-2">
                      {colSort ? (
                        <button
                          type="button"
                          className="font-semibold hover:text-zinc-800 dark:hover:text-zinc-200"
                          onClick={() => toggleSort(colSort)}
                        >
                          {col.label}
                          {sortKey === colSort ? (sortDir === "asc" ? " ↑" : " ↓") : ""}
                        </button>
                      ) : (
                        <span className="font-semibold">{col.label}</span>
                      )}
                      <TableColumnResizeHandle columnKey={col.id} onStart={startResize} />
                    </th>
                  );
                })}
                <th className="relative px-3 py-2"> </th>
              </tr>
            </thead>
            <tbody>
              {pagedEpicRows.map(({ g, owner, proj, accent, total, state }) => {
                const isOpen = !!expanded[g.id];
                const summary = markdownExcerpt(g.description ?? "", 140);
                const detailColSpan = 1 + TABLE_COLUMNS.filter((c) => tableColumns[c.id]).length + 1;
                return (
                  <Fragment key={g.id}>
                    <tr
                      className="border-t border-zinc-100 dark:border-zinc-800"
                      {...(isArchived(g) ? { "data-pd-archived": "true" } : {})}
                    >
                      <td className="w-0 p-0 align-middle" aria-hidden>
                        <div className="flex h-14 items-center">
                          <div className="flex h-11 w-max items-stretch gap-px overflow-hidden rounded-md ring-1 ring-zinc-900/10 dark:ring-white/10">
                          <span
                            className="h-full w-2.5 min-w-2.5 shrink-0"
                            style={{ backgroundColor: accent }}
                            aria-hidden
                          />
                          <OwnerSwatch
                            owner={owner}
                            color={accent}
                            className="h-11 w-11 shrink-0 rounded-none border-0 shadow-none"
                            title={owner?.name ?? "Owner"}
                          />
                        </div>
                        </div>
                      </td>
                      {tableColumns.name ? (
                        <td className="align-middle px-3 py-2 font-medium text-zinc-900 dark:text-zinc-100">
                          <span className="flex flex-wrap items-center gap-2">
                            <TableClampCell className="min-w-0 flex-1 text-sm" fullTitle={g.name}>
                              <Link
                                href={`/epics/${g.id}`}
                                className="block min-w-0 text-blue-600 hover:underline dark:text-blue-400"
                              >
                                {g.name}
                              </Link>
                            </TableClampCell>
                            <EntityArchivedBadge entity={g} />
                          </span>
                        </td>
                      ) : null}
                      {tableColumns.owner ? (
                        <td className="max-w-[11rem] align-middle px-3 py-2 text-zinc-600 dark:text-zinc-300">
                          <Link
                            href={`/owners/${g.ownerId}`}
                            className="flex min-w-0 items-center gap-1.5 text-sm font-medium underline-offset-2 hover:underline"
                          >
                            <span
                              className="h-2 w-2 shrink-0 rounded-sm"
                              style={{ backgroundColor: accent }}
                              aria-hidden
                            />
                            <TableClampCell
                              className="min-w-0 flex-1 text-zinc-800 dark:text-zinc-200"
                              fullTitle={owner?.name ?? "Unknown"}
                            >
                              <span>{owner?.name ?? "Unknown"}</span>
                            </TableClampCell>
                          </Link>
                        </td>
                      ) : null}
                      {tableColumns.project ? (
                        <td className="max-w-[14rem] align-middle px-3 py-2 text-zinc-600 dark:text-zinc-300">
                          {proj ? (
                            <Link
                              href={`/projects/${proj.id}`}
                              className="flex min-w-0 items-center gap-2 text-sm font-medium underline-offset-2 hover:underline"
                            >
                              <OwnerSwatch
                                color={proj.color}
                                iconDataUrl={proj.iconDataUrl}
                                className="h-6 w-6 shrink-0 rounded-md"
                                title={proj.name}
                              />
                              <TableClampCell
                                className="min-w-0 flex-1 text-zinc-800 dark:text-zinc-200"
                                fullTitle={proj.name}
                              >
                                <span>{proj.name}</span>
                              </TableClampCell>
                            </Link>
                          ) : (
                            <TableCellSlot className="text-zinc-500">
                              <span>—</span>
                            </TableCellSlot>
                          )}
                        </td>
                      ) : null}
                      {tableColumns.state ? (
                        <td className="align-middle px-3 py-2">
                          <TableCellSlot>
                            <StatusBadge status={state} />
                          </TableCellSlot>
                        </td>
                      ) : null}
                      {tableColumns.tasks ? (
                        <td className="align-middle px-3 py-2 tabular-nums text-zinc-600 dark:text-zinc-300">
                          <TableCellSlot className="tabular-nums">
                            <span>{total}</span>
                          </TableCellSlot>
                        </td>
                      ) : null}
                      {tableColumns.progress ? (
                        <td className="align-middle px-3 py-2">
                          <TableCellSlot className="min-w-0">
                            <ProgressBar
                              tasks={tasks.filter((t) => t.groupId === g.id)}
                              statusMap={statusMap}
                            />
                          </TableCellSlot>
                        </td>
                      ) : null}
                      {tableColumns.summary ? (
                        <td className="max-w-md align-middle px-3 py-2 text-zinc-500 dark:text-zinc-400">
                          <TableClampCell suppressTitle className="text-sm">
                            <span>{summary || "—"}</span>
                          </TableClampCell>
                        </td>
                      ) : null}
                      <td className="px-3 py-2 align-middle whitespace-nowrap">
                        <TableCellSlot className="flex-nowrap gap-1.5">
                        <button
                          type="button"
                          className={dashboardIconBtnPrimaryClass}
                          onClick={() => setExpanded((e) => ({ ...e, [g.id]: !e[g.id] }))}
                          aria-label={isOpen ? "Hide details" : "Show details"}
                          title={isOpen ? "Hide details" : "Show details"}
                        >
                          {isOpen ? <EyeSlashIcon /> : <EyeIcon />}
                        </button>
                        <Link
                          href={`/owners/${g.ownerId}`}
                          className="inline-flex shrink-0 items-center rounded-md border border-zinc-300 bg-white px-2.5 py-1 text-xs font-medium text-zinc-700 shadow-sm hover:bg-zinc-100 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
                        >
                          Open owner
                        </Link>
                        <Link
                          href={`/?groupId=${g.id}`}
                          className="inline-flex shrink-0 items-center rounded-md border border-zinc-300 bg-white px-2.5 py-1 text-xs font-medium text-zinc-700 shadow-sm hover:bg-zinc-100 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
                        >
                          View tasks
                        </Link>
                        <LogWorkButton
                          target={{ kind: "epic", groupId: g.id }}
                          disabled={isArchived(g)}
                          variant="link"
                        />
                        <button
                          type="button"
                          className="inline-flex items-center justify-center rounded p-1 text-red-600 hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-950/40 dark:hover:text-red-300"
                          onClick={() => void deleteEpic(g.id)}
                          aria-label="Delete epic"
                          title="Delete epic"
                        >
                          <TrashIcon />
                        </button>
                        </TableCellSlot>
                      </td>
                    </tr>
                    {isOpen ? (
                      <tr className="bg-zinc-50/80 dark:bg-zinc-900/50">
                        <td colSpan={detailColSpan} className="w-full max-w-0 px-4 py-3 align-top">
                          <div className="mb-2 text-xs text-zinc-500">
                            Wiki:{" "}
                            <code className="rounded bg-zinc-200 px-1 dark:bg-zinc-800">
                              {`[[epic:${g.id}]]`}
                            </code>
                          </div>
                          {g.description?.trim() ? (
                            <div className="text-sm text-zinc-600 dark:text-zinc-400">
                              <MarkdownView markdown={g.description} />
                            </div>
                          ) : (
                            <p className="text-sm text-zinc-500 italic">No description.</p>
                          )}
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
        </div>
      )}

      {createOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white p-6 dark:bg-zinc-950">
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">New epic</h2>
            {createOwnerOptions.length === 0 ? (
              <p className="mt-4 text-sm text-zinc-600 dark:text-zinc-300">
                Add a{" "}
                <Link href="/owners" className="text-blue-600 underline dark:text-blue-400">
                  owner
                </Link>{" "}
                before creating an epic.
              </p>
            ) : (
              <div className="mt-4 flex flex-col gap-3">
                <SearchableSingleSelect
                  label="Owner"
                  value={createOwnerId}
                  onChange={setCreateOwnerId}
                  options={createOwnerOptions}
                  placeholder="Select owner…"
                  searchPlaceholder="Search owners…"
                />
                <label className="text-sm text-zinc-700 dark:text-zinc-200">
                  Name
                  <input
                    value={createName}
                    onChange={(e) => setCreateName(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-zinc-300 px-2 py-2 text-zinc-900 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
                    placeholder="Epic name"
                  />
                </label>
                <EntityKeyTagInput
                  value={createKeyTag}
                  onChange={setCreateKeyTag}
                  defaultTag="EPC"
                />
                <SearchableSingleSelect
                  label="Project (optional)"
                  value={createProjectId}
                  onChange={setCreateProjectId}
                  options={createProjectOptions}
                  placeholder="No project"
                  searchPlaceholder="Search projects…"
                />
                <MarkdownField
                  label="Description (optional)"
                  value={createDesc}
                  onChange={setCreateDesc}
                  rows={6}
                />
                <NoteTagsEditor tags={createTags} onChange={setCreateTags} />
              </div>
            )}
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                className="rounded-lg border border-zinc-300 px-4 py-2 text-sm dark:border-zinc-600"
                onClick={() => closeCreateEpic()}
              >
                Cancel
              </button>
              {createOwnerOptions.length > 0 ? (
                <button
                  type="button"
                  disabled={createSaving || !createOwnerId || !createName.trim()}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                  onClick={() => void submitCreateEpic()}
                >
                  {createSaving ? "Creating…" : "Create epic"}
                </button>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
