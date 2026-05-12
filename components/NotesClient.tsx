"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FilterMultiDropdown } from "@/components/FilterMultiDropdown";
import { useDashboardConfig } from "@/components/DashboardSettingsProvider";
import { StatusBadge } from "@/components/StatusBadge";
import { markdownExcerpt } from "@/lib/markdownExcerpt";
import { NOTE_ENTRY_TYPES } from "@/lib/noteEntryFormOptions";
import {
  entryMatchesTagKeys,
  tagOptionsFromEntries,
} from "@/lib/noteTags";
import { normalizeStatusKey, statusDef } from "@/lib/statusConfig";
import {
  TASK_FORM_PRIORITIES,
  buildPriorityRankMap,
  canonicalPriorityLabel,
  normalizePriorityKey,
} from "@/lib/taskFormOptions";
import { isArchived } from "@/lib/archive";
import { noteEntryAttributionForSwatch } from "@/lib/noteEntryAttributionDisplay";
import { noteEntryEditHref, noteEntryViewHref } from "@/lib/noteEntryPaths";
import type { Owner, OwnerEntry, Project } from "@/lib/schemas";
import { OwnerSwatch } from "@/components/OwnerSwatch";
import { EntityArchivedBadge } from "./EntityArchivedMark";
import { TrashIcon } from "@/components/icons";
import { MarkdownField } from "@/components/MarkdownField";
import { NoteStatusSelect } from "@/components/NoteStatusSelect";
import { NoteTagsEditor } from "@/components/NoteTagsEditor";
import { SearchableSingleSelect } from "@/components/SearchableSingleSelect";
import { TableCellSlot, TableClampCell } from "@/components/TableClampCell";

function ownerName(owners: Owner[], id: string | null) {
  if (id == null) return "—";
  return owners.find((p) => p.id === id)?.name ?? id;
}

function projectName(projects: Project[], id: string | null) {
  if (id == null) return "—";
  return projects.find((p) => p.id === id)?.name ?? id;
}

type NotesTableColumnId =
  | "owner"
  | "project"
  | "title"
  | "tags"
  | "type"
  | "status"
  | "priority"
  | "created"
  | "summary";

type SortKey = "owner" | "project" | "title" | "type" | "status" | "priority" | "created";

const NOTES_TABLE_COLUMN_STORAGE_KEY = "pd-notes-table-columns";

const DEFAULT_NOTES_TABLE_COLUMNS: Record<NotesTableColumnId, boolean> = {
  owner: true,
  project: true,
  title: true,
  tags: true,
  type: true,
  status: true,
  priority: true,
  created: true,
  summary: true,
};

const NOTES_TABLE_COLUMNS: {
  id: NotesTableColumnId;
  label: string;
  sortKey?: SortKey;
}[] = [
  { id: "title", label: "Title", sortKey: "title" },
  { id: "owner", label: "Owner", sortKey: "owner" },
  { id: "project", label: "Project", sortKey: "project" },
  { id: "tags", label: "Tags" },
  { id: "type", label: "Type", sortKey: "type" },
  { id: "status", label: "Status", sortKey: "status" },
  { id: "priority", label: "Priority", sortKey: "priority" },
  { id: "created", label: "Created", sortKey: "created" },
  { id: "summary", label: "Summary" },
];

function parseNotesTableColumnPrefs(raw: string | null): Record<NotesTableColumnId, boolean> {
  if (!raw) return { ...DEFAULT_NOTES_TABLE_COLUMNS };
  try {
    const o = JSON.parse(raw) as Record<string, unknown>;
    const next = { ...DEFAULT_NOTES_TABLE_COLUMNS };
    for (const id of Object.keys(DEFAULT_NOTES_TABLE_COLUMNS) as NotesTableColumnId[]) {
      if (typeof o[id] === "boolean") next[id] = o[id];
    }
    return next;
  } catch {
    return { ...DEFAULT_NOTES_TABLE_COLUMNS };
  }
}

export function NotesClient() {
  const { settings, noteStatusMap, noteStatusKeys } = useDashboardConfig();
  const defaultNoteStatus = noteStatusKeys[0] ?? "open";
  const noteTypes = settings?.noteTypes ?? [...NOTE_ENTRY_TYPES];
  const priorities = settings?.taskPriorities
    ? settings.taskPriorities.map((r) => r.label)
    : [...TASK_FORM_PRIORITIES];

  const [owners, setOwners] = useState<Owner[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [entries, setEntries] = useState<OwnerEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [q, setQ] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [ownerIds, setOwnerIds] = useState<string[]>([]);
  const [projectIds, setProjectIds] = useState<string[]>([]);
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
  const [selectedPriorities, setSelectedPriorities] = useState<string[]>([]);
  const [selectedTagKeys, setSelectedTagKeys] = useState<string[]>([]);
  const [sortKey, setSortKey] = useState<SortKey>("created");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [tableColumns, setTableColumns] = useState<Record<NotesTableColumnId, boolean>>({
    ...DEFAULT_NOTES_TABLE_COLUMNS,
  });
  const skipTableColPersist = useRef(true);

  const router = useRouter();
  const [noteCreateOpen, setNoteCreateOpen] = useState(false);
  const [noteCreateErr, setNoteCreateErr] = useState<string | null>(null);
  const [noteCreating, setNoteCreating] = useState(false);
  const [noteCreateForm, setNoteCreateForm] = useState({
    title: "",
    body: "",
    status: "open",
    type: "Note",
    priority: "Medium",
    tags: [] as string[],
    ownerId: "",
    projectId: "",
  });

  const load = useCallback(async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) setLoading(true);
    setErr(null);
    try {
      const [pr, pj, en] = await Promise.all([
        fetch("/api/owners").then((r) => r.json()),
        fetch("/api/projects").then((r) => r.json()),
        fetch("/api/entries").then((r) => r.json()),
      ]);
      if (!Array.isArray(pr) || !Array.isArray(en)) throw new Error("Bad response");
      setOwners(pr);
      setProjects(Array.isArray(pj) ? pj : []);
      setEntries(en);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to load");
    } finally {
      if (!opts?.silent) setLoading(false);
    }
  }, []);

  async function deleteEntry(id: string) {
    if (!confirm("Delete this note permanently?")) return;
    const r = await fetch(`/api/entries/${id}`, { method: "DELETE" });
    if (!r.ok) {
      setErr("Delete failed");
      return;
    }
    await load({ silent: true });
  }

  function openNoteCreate() {
    setNoteCreateErr(null);
    setNoteCreateForm({
      title: "",
      body: "",
      status: defaultNoteStatus,
      type: noteTypes[0] ?? "Note",
      priority: priorities[0] ?? "Medium",
      tags: [],
      ownerId: "",
      projectId: "",
    });
    setNoteCreateOpen(true);
  }

  async function submitNewNote() {
    if (!noteCreateForm.title.trim()) {
      setNoteCreateErr("Title is required.");
      return;
    }
    if (!noteCreateForm.ownerId.trim() && !noteCreateForm.projectId.trim()) {
      setNoteCreateErr("Choose at least one owner or one project.");
      return;
    }
    setNoteCreateErr(null);
    setNoteCreating(true);
    try {
      const r = await fetch("/api/entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: noteCreateForm.title.trim(),
          body: noteCreateForm.body,
          status: noteCreateForm.status,
          type: noteCreateForm.type,
          priority: noteCreateForm.priority,
          tags: noteCreateForm.tags,
          ownerId: noteCreateForm.ownerId.trim() ? noteCreateForm.ownerId : null,
          projectId: noteCreateForm.projectId.trim() ? noteCreateForm.projectId : null,
        }),
      });
      const payload = (await r.json().catch(() => null)) as
        | OwnerEntry
        | { error?: unknown }
        | null;
      if (!r.ok) {
        let msg = "Could not create note.";
        if (payload != null && typeof payload === "object" && "error" in payload) {
          const er = (payload as { error: unknown }).error;
          if (typeof er === "string") msg = er;
          else if (er && typeof er === "object" && "formErrors" in er) {
            const fe = (er as { formErrors?: string[] }).formErrors;
            if (Array.isArray(fe) && fe[0]) msg = fe[0];
          }
        }
        setNoteCreateErr(msg);
        return;
      }
      if (!payload || typeof payload !== "object" || !("id" in payload)) {
        setNoteCreateErr("Invalid response from server.");
        return;
      }
      const entry = payload as OwnerEntry;
      setNoteCreateOpen(false);
      await load({ silent: true });
      router.push(noteEntryEditHref(entry));
    } finally {
      setNoteCreating(false);
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
        const raw = localStorage.getItem(NOTES_TABLE_COLUMN_STORAGE_KEY);
        setTableColumns(parseNotesTableColumnPrefs(raw));
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
      localStorage.setItem(NOTES_TABLE_COLUMN_STORAGE_KEY, JSON.stringify(tableColumns));
    } catch {
      /* ignore */
    }
  }, [tableColumns]);

  const ownerFilterOptions = useMemo(
    () => [
      { value: "__no_owner__", label: "No owner" },
      ...owners
        .filter((p) => showArchived || !isArchived(p))
        .map((p) => ({ value: p.id, label: p.name })),
    ],
    [owners, showArchived],
  );
  const projectFilterOptions = useMemo(
    () => [
      { value: "__no_project__", label: "No project" },
      ...projects
        .filter((p) => showArchived || !isArchived(p))
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((p) => ({ value: p.id, label: p.name })),
    ],
    [projects, showArchived],
  );
  const typeFilterOptions = useMemo(
    () => noteTypes.map((t) => ({ value: t, label: t })),
    [noteTypes],
  );
  const statusFilterOptions = useMemo(
    () => noteStatusKeys.map((k) => ({ value: k, label: noteStatusMap[k]?.label ?? k })),
    [noteStatusKeys, noteStatusMap],
  );
  const priorityFilterOptions = useMemo(
    () => priorities.map((p) => ({ value: p, label: p })),
    [priorities],
  );
  const tagFilterOptions = useMemo(
    () =>
      tagOptionsFromEntries(
        showArchived ? entries : entries.filter((e) => !isArchived(e)),
      ),
    [entries, showArchived],
  );

  const filtered = useMemo(() => {
    let list = entries;
    if (!showArchived) list = list.filter((e) => !isArchived(e));
    const ql = q.trim().toLowerCase();
    if (ownerIds.length) {
      list = list.filter((x) =>
        ownerIds.some((id) => {
          if (id === "__no_owner__") return x.ownerId == null;
          return x.ownerId === id;
        }),
      );
    }
    if (projectIds.length) {
      list = list.filter((x) =>
        projectIds.some((id) => {
          if (id === "__no_project__") return x.projectId == null;
          return x.projectId === id;
        }),
      );
    }
    if (selectedTypes.length) {
      list = list.filter((x) => selectedTypes.includes(x.type ?? "Note"));
    }
    if (selectedStatuses.length) {
      list = list.filter((x) =>
        selectedStatuses.includes(normalizeStatusKey(x.status ?? defaultNoteStatus)),
      );
    }
    if (selectedPriorities.length) {
      const set = new Set(selectedPriorities.map((p) => p.trim().toLowerCase()));
      list = list.filter((x) => set.has((x.priority ?? "Medium").trim().toLowerCase()));
    }
    if (selectedTagKeys.length) {
      list = list.filter((x) => entryMatchesTagKeys(x.tags, selectedTagKeys));
    }
    if (ql) {
      list = list.filter((x) => {
        const inTitle = x.title.toLowerCase().includes(ql);
        const inBody = x.body.toLowerCase().includes(ql);
        const inTags = (x.tags ?? []).some((t) => t.toLowerCase().includes(ql));
        const inOwner =
          x.ownerId != null &&
          ownerName(owners, x.ownerId).toLowerCase().includes(ql);
        const inProject =
          x.projectId != null &&
          projectName(projects, x.projectId).toLowerCase().includes(ql);
        const uuidish = /^[0-9a-f-]{8,}$/i.test(ql);
        const inOwnerId = uuidish && x.ownerId != null && x.ownerId.toLowerCase().includes(ql);
        const inProjectId = uuidish && x.projectId != null && x.projectId.toLowerCase().includes(ql);
        return inTitle || inBody || inTags || inOwner || inProject || inOwnerId || inProjectId;
      });
    }
    return list;
  }, [
    entries,
    showArchived,
    q,
    ownerIds,
    selectedTypes,
    selectedStatuses,
    selectedPriorities,
    selectedTagKeys,
    defaultNoteStatus,
    projectIds,
    owners,
    projects,
  ]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir(key === "created" || key === "priority" ? "desc" : "asc");
    }
  }

  const sorted = useMemo(() => {
    const dir = sortDir === "asc" ? 1 : -1;
    const priorityRank = buildPriorityRankMap(priorities);
    const arr = [...filtered];
    arr.sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case "owner":
          cmp = ownerName(owners, a.ownerId).localeCompare(ownerName(owners, b.ownerId));
          break;
        case "project":
          cmp = projectName(projects, a.projectId).localeCompare(projectName(projects, b.projectId));
          break;
        case "title":
          cmp = a.title.localeCompare(b.title);
          break;
        case "type":
          cmp = (a.type ?? "Note").localeCompare(b.type ?? "Note");
          break;
        case "status":
          cmp = statusDef(a.status ?? defaultNoteStatus, noteStatusMap).label.localeCompare(
            statusDef(b.status ?? defaultNoteStatus, noteStatusMap).label,
          );
          break;
        case "priority": {
          const aVal = a.priority ?? "Medium";
          const bVal = b.priority ?? "Medium";
          const aKey = normalizePriorityKey(aVal);
          const bKey = normalizePriorityKey(bVal);
          const aRank = priorityRank.get(aKey);
          const bRank = priorityRank.get(bKey);
          const aKnown = aRank !== undefined;
          const bKnown = bRank !== undefined;
          if (aKnown && bKnown) cmp = aRank - bRank;
          else if (aKnown && !bKnown) cmp = -dir; // known always sorts before unknown
          else if (!aKnown && bKnown) cmp = dir; // known always sorts before unknown
          else cmp = aKey.localeCompare(bKey);
          if (cmp === 0) {
            cmp = canonicalPriorityLabel(aVal, priorities).localeCompare(
              canonicalPriorityLabel(bVal, priorities),
            );
          }
          break;
        }
        case "created":
          cmp = a.createdAt.localeCompare(b.createdAt);
          break;
        default:
          cmp = 0;
      }
      if (cmp !== 0) return cmp * dir;
      return b.createdAt.localeCompare(a.createdAt);
    });
    return arr;
  }, [
    filtered,
    sortDir,
    sortKey,
    owners,
    projects,
    priorities,
    defaultNoteStatus,
    noteStatusMap,
  ]);

  if (loading) return <p className="text-zinc-500">Loading…</p>;

  return (
    <div className="flex flex-col gap-6">
      {err ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
          {err}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0 flex-1 basis-0">
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            Notes
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            All notes in one place. Use the Project column (and Columns menu) to show or hide it.
            Filter by owner, project—including <strong>No owner</strong> /{" "}
            <strong>No project</strong>—and tags; search matches title, body, tags, owner or project
            names, and partial owner/project IDs. For note body formatting, see{" "}
            <Link href="/docs/markdown" className="text-blue-600 underline dark:text-blue-400">
              Markdown
            </Link>
            .
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={openNoteCreate}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            New note
          </button>
        </div>
      </div>

      <div className="grid gap-3 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950 sm:grid-cols-2 lg:grid-cols-3">
        <label className="flex flex-col gap-1 text-sm sm:col-span-2 lg:col-span-3">
          <span className="text-zinc-500">Search (all notes)</span>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Title, body, tags, owner or project name, or ID fragment"
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
          label="Tags (any match)"
          options={tagFilterOptions}
          selected={selectedTagKeys}
          onChange={setSelectedTagKeys}
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
        <label className="flex items-center gap-2 text-sm text-zinc-700 sm:col-span-2 lg:col-span-3 dark:text-zinc-200">
          <input
            type="checkbox"
            checked={showArchived}
            onChange={(e) => setShowArchived(e.target.checked)}
            className="rounded border-zinc-300 dark:border-zinc-600"
          />
          Show archived notes
        </label>
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center justify-end gap-2">
          <details className="relative rounded-lg border border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-900">
            <summary className="cursor-pointer list-none px-3 py-2 text-sm font-medium text-zinc-700 marker:hidden dark:text-zinc-200 [&::-webkit-details-marker]:hidden">
              Columns
            </summary>
            <div className="absolute right-0 z-10 mt-1 min-w-[12rem] rounded-lg border border-zinc-200 bg-white p-2 shadow-lg dark:border-zinc-600 dark:bg-zinc-950">
              {NOTES_TABLE_COLUMNS.map((col) => (
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
          <table className="w-full min-w-[80rem] text-left text-sm">
            <thead className="bg-zinc-50 text-xs uppercase text-zinc-500 dark:bg-zinc-900/80 dark:text-zinc-400">
              <tr>
                <th className="w-px min-w-0 p-0" aria-hidden />
                {NOTES_TABLE_COLUMNS.filter((c) => tableColumns[c.id]).map((col) => {
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
                          {sortKey === colSort ? (sortDir === "asc" ? " ↑" : " ↓") : ""}
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
              {sorted.map((e) => {
                const p = e.ownerId ? owners.find((x) => x.id === e.ownerId) : null;
                const proj = e.projectId ? projects.find((x) => x.id === e.projectId) : null;
                const sw = noteEntryAttributionForSwatch(e, owners, projects);
                const statusRow = statusDef(e.status ?? defaultNoteStatus, noteStatusMap);
                const statusColor = statusRow.color;
                const ex = markdownExcerpt(e.body, 120);
                const tags = e.tags ?? [];
                const tagsTitle = tags.join(", ");
                const tagsLabel = tags.join(" · ");
                const typeLabel = e.type ?? "Note";
                const priorityLabel = canonicalPriorityLabel(e.priority ?? "Medium", priorities);
                return (
                  <tr
                    key={e.id}
                    className="border-t border-zinc-100 dark:border-zinc-800"
                    {...(isArchived(e) ? { "data-pd-archived": "true" } : {})}
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
                          owner={sw.owner}
                          color={sw.color}
                          iconDataUrl={sw.iconDataUrl}
                          className="h-11 w-11 shrink-0 rounded-none border-0 shadow-none"
                          title={sw.title}
                        />
                      </div>
                      </div>
                    </td>
                    {tableColumns.title ? (
                      <td className="align-middle px-3 py-2 font-medium text-zinc-900 dark:text-zinc-100">
                        <span className="flex flex-wrap items-center gap-2">
                          <TableClampCell className="min-w-0 flex-1 text-sm" fullTitle={e.title}>
                            <Link
                              href={noteEntryViewHref(e)}
                              className="block min-w-0 text-blue-600 hover:underline dark:text-blue-400"
                            >
                              {e.title}
                            </Link>
                          </TableClampCell>
                          <EntityArchivedBadge entity={e} />
                        </span>
                      </td>
                    ) : null}
                    {tableColumns.owner ? (
                      <td className="max-w-[10rem] align-middle px-3 py-2">
                        {e.ownerId ? (
                          <span className="flex min-w-0 items-center gap-1.5 text-sm">
                            <span
                              className="h-2 w-2 shrink-0 rounded-sm"
                              style={{ backgroundColor: p?.color ?? "#64748b" }}
                              aria-hidden
                            />
                            <TableClampCell
                              className="min-w-0 flex-1 font-medium"
                              fullTitle={ownerName(owners, e.ownerId)}
                            >
                              <Link
                                href={`/owners/${e.ownerId}`}
                                className="block min-w-0 text-blue-600 hover:underline dark:text-blue-400"
                              >
                                {ownerName(owners, e.ownerId)}
                              </Link>
                            </TableClampCell>
                          </span>
                        ) : (
                          <TableCellSlot className="text-zinc-400">
                            <span>—</span>
                          </TableCellSlot>
                        )}
                      </td>
                    ) : null}
                    {tableColumns.project ? (
                      <td className="max-w-[10rem] align-middle px-3 py-2">
                        {e.projectId ? (
                          <span className="flex min-w-0 items-center gap-1.5 text-sm">
                            <span
                              className="h-2 w-2 shrink-0 rounded-sm"
                              style={{ backgroundColor: proj?.color ?? "#64748b" }}
                              aria-hidden
                            />
                            <TableClampCell
                              className="min-w-0 flex-1 font-medium"
                              fullTitle={projectName(projects, e.projectId)}
                            >
                              <Link
                                href={`/projects/${e.projectId}`}
                                className="block min-w-0 text-blue-600 hover:underline dark:text-blue-400"
                              >
                                {projectName(projects, e.projectId)}
                              </Link>
                            </TableClampCell>
                          </span>
                        ) : (
                          <TableCellSlot className="text-zinc-400">
                            <span>—</span>
                          </TableCellSlot>
                        )}
                      </td>
                    ) : null}
                    {tableColumns.tags ? (
                      <td className="max-w-[14rem] align-middle px-3 py-2 text-zinc-600 dark:text-zinc-300">
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
                    {tableColumns.type ? (
                      <td className="align-middle px-3 py-2 capitalize text-zinc-700 dark:text-zinc-300">
                        <TableClampCell className="text-sm" fullTitle={typeLabel}>
                          <span>{typeLabel}</span>
                        </TableClampCell>
                      </td>
                    ) : null}
                    {tableColumns.status ? (
                      <td className="align-middle px-3 py-2">
                        <TableCellSlot>
                          <StatusBadge variant="note" status={e.status ?? defaultNoteStatus} />
                        </TableCellSlot>
                      </td>
                    ) : null}
                    {tableColumns.priority ? (
                      <td className="align-middle px-3 py-2 text-zinc-700 dark:text-zinc-300">
                        <TableClampCell className="text-sm" fullTitle={priorityLabel}>
                          <span>{priorityLabel}</span>
                        </TableClampCell>
                      </td>
                    ) : null}
                    {tableColumns.created ? (
                      <td className="align-middle px-3 py-2 tabular-nums text-zinc-600 dark:text-zinc-400">
                        <TableClampCell
                          className="text-sm"
                          fullTitle={new Date(e.createdAt).toLocaleString()}
                        >
                          <span>{new Date(e.createdAt).toLocaleString()}</span>
                        </TableClampCell>
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
                      <Link
                        href={noteEntryViewHref(e)}
                        className="text-blue-600 text-xs hover:underline"
                      >
                        View
                      </Link>
                      <Link
                        href={noteEntryEditHref(e)}
                        className="text-blue-600 text-xs hover:underline"
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
                      </TableCellSlot>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {sorted.length === 0 ? (
            <p className="p-6 text-center text-sm text-zinc-500">No notes match.</p>
          ) : null}
        </div>
      </div>

      {noteCreateOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white p-6 dark:bg-zinc-950">
            <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">New note</h3>
            <p className="mt-1 text-sm text-zinc-500">
              Set at least one owner or one project. You can change attribution later when editing.
            </p>
            {noteCreateErr ? (
              <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
                {noteCreateErr}
              </div>
            ) : null}
            <div className="mt-4 flex flex-col gap-3">
              <label className="text-sm text-zinc-700 dark:text-zinc-200">
                Title
                <input
                  value={noteCreateForm.title}
                  onChange={(e) =>
                    setNoteCreateForm((f) => ({ ...f, title: e.target.value }))
                  }
                  className="mt-1 w-full rounded-lg border border-zinc-300 px-2 py-2 dark:border-zinc-600 dark:bg-zinc-900"
                />
              </label>
              <label className="text-sm text-zinc-700 dark:text-zinc-200">
                Status
                <NoteStatusSelect
                  value={noteCreateForm.status}
                  onChange={(v) => setNoteCreateForm((f) => ({ ...f, status: v }))}
                  className="mt-1 w-full rounded-lg border border-zinc-300 px-2 py-2 dark:border-zinc-600 dark:bg-zinc-900"
                />
              </label>
              <label className="text-sm text-zinc-700 dark:text-zinc-200">
                Type
                <select
                  value={noteCreateForm.type}
                  onChange={(e) =>
                    setNoteCreateForm((f) => ({ ...f, type: e.target.value }))
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
              <label className="text-sm text-zinc-700 dark:text-zinc-200">
                Priority
                <select
                  value={noteCreateForm.priority}
                  onChange={(e) =>
                    setNoteCreateForm((f) => ({ ...f, priority: e.target.value }))
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
              <NoteTagsEditor
                tags={noteCreateForm.tags}
                onChange={(tags) => setNoteCreateForm((f) => ({ ...f, tags }))}
              />
              <SearchableSingleSelect
                label="Owner (optional if project set)"
                value={noteCreateForm.ownerId}
                onChange={(v) => setNoteCreateForm((f) => ({ ...f, ownerId: v }))}
                placeholder="None"
                options={[
                  { value: "", label: "None" },
                  ...owners.map((p) => ({ value: p.id, label: p.name })),
                ]}
              />
              <SearchableSingleSelect
                label="Project (optional if owner set)"
                value={noteCreateForm.projectId}
                onChange={(v) => setNoteCreateForm((f) => ({ ...f, projectId: v }))}
                placeholder="None"
                options={[
                  { value: "", label: "None" },
                  ...projects
                    .slice()
                    .sort((a, b) => a.name.localeCompare(b.name))
                    .map((p) => ({ value: p.id, label: p.name })),
                ]}
              />
              <MarkdownField
                label="Body"
                value={noteCreateForm.body}
                onChange={(v) => setNoteCreateForm((f) => ({ ...f, body: v }))}
                rows={8}
              />
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                className="rounded-lg border border-zinc-300 px-4 py-2 text-sm dark:border-zinc-600"
                disabled={noteCreating}
                onClick={() => setNoteCreateOpen(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white disabled:opacity-50"
                disabled={noteCreating}
                onClick={() => void submitNewNote()}
              >
                {noteCreating ? "Creating…" : "Create"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
