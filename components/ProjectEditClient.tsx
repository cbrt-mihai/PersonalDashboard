"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState, type Dispatch, type SetStateAction } from "react";
import type { Owner, Project, TaskGroup } from "@/lib/schemas";
import { MarkdownField } from "@/components/MarkdownField";
import { MarkdownView } from "@/components/MarkdownView";
import { NoteTagsEditor } from "@/components/NoteTagsEditor";
import { TrashIcon } from "@/components/icons";
import { HexColorPickerRow } from "@/components/OwnerStyleColorPicker";
import { OwnerSwatch } from "@/components/OwnerSwatch";
import { fileToOwnerIconDataUrl } from "@/lib/ownerIconDataUrl";
import { useDashboardConfig } from "@/components/DashboardSettingsProvider";
import { NAMED_OWNER_COLOR_PRESETS } from "@/lib/presetColors";
import { archiveNowIso, isArchived, matchesQuery } from "@/lib/archive";
import { EditPageArchiveField } from "./EditPageArchiveField";
import { EntityArchivedBanner } from "./EntityArchivedMark";

function sectionCard(className = "") {
  return `min-w-0 rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950 ${className}`;
}

const EPIC_LIST_PAGE_SIZE = 20;

function EpicAssignPagination({
  page,
  totalItems,
  pageSize,
  onPageChange,
}: {
  page: number;
  totalItems: number;
  pageSize: number;
  onPageChange: Dispatch<SetStateAction<number>>;
}) {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  if (totalItems <= pageSize) return null;
  return (
    <div className="mt-2 flex flex-wrap items-center justify-between gap-2 border-t border-zinc-100 pt-2 text-sm text-zinc-600 dark:border-zinc-800 dark:text-zinc-400">
      <span className="tabular-nums">
        Page {page + 1} of {totalPages} ({totalItems} total)
      </span>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={page <= 0}
          onClick={() => onPageChange((p) => Math.max(0, p - 1))}
          className="rounded-lg border border-zinc-300 px-3 py-1 text-sm font-medium hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-zinc-600 dark:hover:bg-zinc-900"
        >
          Previous
        </button>
        <button
          type="button"
          disabled={page >= totalPages - 1}
          onClick={() => onPageChange((p) => Math.min(totalPages - 1, p + 1))}
          className="rounded-lg border border-zinc-300 px-3 py-1 text-sm font-medium hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-zinc-600 dark:hover:bg-zinc-900"
        >
          Next
        </button>
      </div>
    </div>
  );
}

export function ProjectEditClient({ projectId }: { projectId: string }) {
  const router = useRouter();
  const { settings } = useDashboardConfig();
  const colorPresets =
    settings?.ownerColorPresets ??
    NAMED_OWNER_COLOR_PRESETS.map(({ name, color }) => ({ name, color }));

  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [iconErr, setIconErr] = useState<string | null>(null);

  const [allGroups, setAllGroups] = useState<TaskGroup[]>([]);
  const [owners, setOwners] = useState<Owner[]>([]);
  const [allProjects, setAllProjects] = useState<Project[]>([]);
  const [assignSearch, setAssignSearch] = useState("");
  const [archivedEpicSearch, setArchivedEpicSearch] = useState("");
  const [assignEpicPage, setAssignEpicPage] = useState(0);
  const [archivedEpicPage, setArchivedEpicPage] = useState(0);
  const [epicMutErr, setEpicMutErr] = useState<string | null>(null);
  const [busyEpicId, setBusyEpicId] = useState<string | null>(null);

  const [detailsEdit, setDetailsEdit] = useState(false);
  const [descEdit, setDescEdit] = useState(false);
  const [savingDetails, setSavingDetails] = useState(false);
  const [savingDesc, setSavingDesc] = useState(false);

  const [form, setForm] = useState<{
    name: string;
    color: string;
    iconDataUrl: string | null;
    description: string;
    tags: string[];
  }>({
    name: "",
    color: NAMED_OWNER_COLOR_PRESETS[0]!.color,
    iconDataUrl: null as string | null,
    description: "",
    tags: [] as string[],
  });

  const refreshEpicLists = useCallback(async () => {
    const [allG, pa, allP] = await Promise.all([
      fetch("/api/groups").then((res) => (res.ok ? res.json() : [])),
      fetch("/api/owners").then((res) => (res.ok ? res.json() : [])),
      fetch("/api/projects").then((res) => (res.ok ? res.json() : [])),
    ]);
    setAllGroups(Array.isArray(allG) ? allG : []);
    setOwners(Array.isArray(pa) ? pa : []);
    setAllProjects(Array.isArray(allP) ? allP : []);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const r = await fetch(`/api/projects/${projectId}`);
      if (!r.ok) throw new Error("Project not found");
      const p: Project = await r.json();
      setProject(p);
      setForm({
        name: p.name,
        color: p.color ?? "#6366f1",
        iconDataUrl: p.iconDataUrl ?? null,
        description: p.description ?? "",
        tags: p.tags ?? [],
      });
      await refreshEpicLists();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to load");
      setProject(null);
    } finally {
      setLoading(false);
    }
  }, [projectId, refreshEpicLists]);

  useEffect(() => {
    queueMicrotask(() => {
      void load();
    });
  }, [load]);

  function cancelDetailsEdit() {
    if (!project) return;
    setForm((f) => ({
      ...f,
      name: project.name,
      color: project.color ?? "#6366f1",
      iconDataUrl: project.iconDataUrl ?? null,
      tags: project.tags ?? [],
    }));
    setIconErr(null);
    setDetailsEdit(false);
  }

  function cancelDescEdit() {
    if (!project) return;
    setForm((f) => ({ ...f, description: project.description ?? "" }));
    setDescEdit(false);
  }

  async function saveDetails() {
    if (!project || !form.name.trim()) return;
    setSavingDetails(true);
    setErr(null);
    try {
      const r = await fetch(`/api/projects/${projectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          color: form.color,
          iconDataUrl: form.iconDataUrl,
          tags: form.tags,
        }),
      });
      if (!r.ok) throw new Error("Could not save");
      const next: Project = await r.json();
      setProject(next);
      setForm((f) => ({
        ...f,
        name: next.name,
        color: next.color ?? "#6366f1",
        iconDataUrl: next.iconDataUrl ?? null,
        tags: next.tags ?? [],
      }));
      setDetailsEdit(false);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSavingDetails(false);
    }
  }

  async function saveDescription() {
    if (!project) return;
    setSavingDesc(true);
    setErr(null);
    try {
      const r = await fetch(`/api/projects/${projectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: form.description }),
      });
      if (!r.ok) throw new Error("Could not save");
      const next: Project = await r.json();
      setProject(next);
      setForm((f) => ({ ...f, description: next.description ?? "" }));
      setDescEdit(false);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSavingDesc(false);
    }
  }

  async function onDelete() {
    if (!project || !confirm("Delete this project? Epics will be unassigned.")) return;
    const r = await fetch(`/api/projects/${project.id}`, { method: "DELETE" });
    if (!r.ok) return;
    router.push("/projects");
    router.refresh();
  }

  const epicsInProject = useMemo(() => {
    return allGroups
      .filter((g) => g.projectId === projectId)
      .sort((a, b) => {
        const pa = owners.find((p) => p.id === a.ownerId)?.name ?? "";
        const pb = owners.find((p) => p.id === b.ownerId)?.name ?? "";
        const c = pa.localeCompare(pb);
        if (c !== 0) return c;
        return a.name.localeCompare(b.name);
      });
  }, [allGroups, owners, projectId]);

  const assignableEpics = useMemo(() => {
    const q = assignSearch.trim().toLowerCase();
    let list = allGroups.filter((g) => g.projectId !== projectId);
    // Default: hide archived epics from the main list unless the user searches.
    if (!q) {
      list = list.filter((g) => !isArchived(g));
    }
    if (q) {
      list = list.filter(
        (g) =>
          g.name.toLowerCase().includes(q) ||
          (g.description ?? "").toLowerCase().includes(q) ||
          (owners.find((p) => p.id === g.ownerId)?.name ?? "").toLowerCase().includes(q),
      );
    }
    return list.sort((a, b) => {
      const pa = owners.find((p) => p.id === a.ownerId)?.name ?? "";
      const pb = owners.find((p) => p.id === b.ownerId)?.name ?? "";
      const c = pa.localeCompare(pb);
      if (c !== 0) return c;
      return a.name.localeCompare(b.name);
    });
  }, [allGroups, assignSearch, owners, projectId]);

  const archivedEpics = useMemo(() => {
    const q = archivedEpicSearch.trim();
    let list = allGroups.filter((g) => isArchived(g));
    if (q) {
      list = list.filter((g) => {
        const ownerName = owners.find((p) => p.id === g.ownerId)?.name ?? "";
        return (
          matchesQuery(g.name, q) ||
          matchesQuery(g.description ?? "", q) ||
          matchesQuery(ownerName, q)
        );
      });
    }
    return list.sort((a, b) => a.name.localeCompare(b.name));
  }, [allGroups, archivedEpicSearch, owners]);

  useEffect(() => {
    queueMicrotask(() => setAssignEpicPage(0));
  }, [assignSearch]);

  useEffect(() => {
    queueMicrotask(() => setArchivedEpicPage(0));
  }, [archivedEpicSearch]);

  const assignMaxPage = Math.max(0, Math.ceil(assignableEpics.length / EPIC_LIST_PAGE_SIZE) - 1);
  useEffect(() => {
    queueMicrotask(() => setAssignEpicPage((p) => Math.min(p, assignMaxPage)));
  }, [assignMaxPage]);

  const archivedMaxPage = Math.max(0, Math.ceil(archivedEpics.length / EPIC_LIST_PAGE_SIZE) - 1);
  useEffect(() => {
    queueMicrotask(() => setArchivedEpicPage((p) => Math.min(p, archivedMaxPage)));
  }, [archivedMaxPage]);

  const assignPageSafe = Math.min(
    assignEpicPage,
    Math.max(0, Math.ceil(assignableEpics.length / EPIC_LIST_PAGE_SIZE) - 1),
  );
  const assignEpicsPageSlice = assignableEpics.slice(
    assignPageSafe * EPIC_LIST_PAGE_SIZE,
    assignPageSafe * EPIC_LIST_PAGE_SIZE + EPIC_LIST_PAGE_SIZE,
  );

  const archivedPageSafe = Math.min(
    archivedEpicPage,
    Math.max(0, Math.ceil(archivedEpics.length / EPIC_LIST_PAGE_SIZE) - 1),
  );
  const archivedEpicsPageSlice = archivedEpics.slice(
    archivedPageSafe * EPIC_LIST_PAGE_SIZE,
    archivedPageSafe * EPIC_LIST_PAGE_SIZE + EPIC_LIST_PAGE_SIZE,
  );

  function otherProjectName(projectUuid: string | null | undefined) {
    if (!projectUuid) return null;
    return allProjects.find((p) => p.id === projectUuid)?.name ?? projectUuid;
  }

  async function addEpicToProject(g: TaskGroup) {
    if (g.projectId && g.projectId !== projectId) {
      const pn = otherProjectName(g.projectId);
      if (
        !confirm(
          `This epic is currently assigned to ${pn ? `"${pn}"` : "another project"}. Each epic can only belong to one project. Move it to this project?`,
        )
      ) {
        return;
      }
    }
    setEpicMutErr(null);
    setBusyEpicId(g.id);
    try {
      const r = await fetch(`/api/groups/${g.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId }),
      });
      if (!r.ok) throw new Error("Could not assign epic");
      await refreshEpicLists();
    } catch (e) {
      setEpicMutErr(e instanceof Error ? e.message : "Could not assign epic");
    } finally {
      setBusyEpicId(null);
    }
  }

  async function removeEpicFromProject(g: TaskGroup) {
    if (
      !confirm(
        `Remove "${g.name}" from this project? The epic will not be deleted; it becomes unassigned from any project.`,
      )
    ) {
      return;
    }
    setEpicMutErr(null);
    setBusyEpicId(g.id);
    try {
      const r = await fetch(`/api/groups/${g.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: null }),
      });
      if (!r.ok) throw new Error("Could not remove epic");
      await refreshEpicLists();
    } catch (e) {
      setEpicMutErr(e instanceof Error ? e.message : "Could not remove epic");
    } finally {
      setBusyEpicId(null);
    }
  }

  if (loading) return <p className="text-zinc-500">Loading…</p>;
  if (err && !project) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
        {err}{" "}
        <Link href="/projects" className="underline">
          Projects
        </Link>
      </div>
    );
  }
  if (!project) return null;

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link
            href={`/projects/${projectId}`}
            className="text-sm text-blue-600 hover:underline dark:text-blue-400"
          >
            ← Back to project
          </Link>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            Edit project
          </h1>
          <p className="mt-2 text-sm text-zinc-500">
            <strong>Edit details</strong> for name and tags. <strong>Edit description</strong> for
            Markdown only.
          </p>
        </div>
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

      {err ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
          {err}
        </div>
      ) : null}

      <EntityArchivedBanner entity={project} kind="project" />

      <EditPageArchiveField
        archived={isArchived(project)}
        onCommit={async (next) => {
          const r = await fetch(`/api/projects/${projectId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ archivedAt: next ? archiveNowIso() : null }),
          });
          if (!r.ok) throw new Error("Could not update archive state");
          const nextProject: Project = await r.json();
          setProject(nextProject);
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
              <dd className="mt-1 text-zinc-900 dark:text-zinc-100">{project.name}</dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-xs font-medium text-zinc-500 uppercase">Style</dt>
              <dd className="mt-2 flex items-center gap-3">
                <OwnerSwatch
                  color={project.color}
                  iconDataUrl={project.iconDataUrl}
                  className="h-10 w-10 rounded-md"
                  title={project.name}
                />
                <div className="text-sm text-zinc-700 dark:text-zinc-300">
                  <div className="font-mono text-xs">{project.color}</div>
                  <div className="text-xs text-zinc-500">{project.iconDataUrl ? "Icon set" : "No icon"}</div>
                </div>
              </dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-xs font-medium text-zinc-500 uppercase">Tags</dt>
              <dd className="mt-1 text-zinc-800 dark:text-zinc-200">
                {(project.tags ?? []).length ? (project.tags ?? []).join(", ") : "—"}
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
            <div className="text-sm">
              <span className="text-zinc-500">Color</span>
              <div className="mt-2">
                <HexColorPickerRow
                  value={form.color}
                  onChange={(hex) => setForm((f) => ({ ...f, color: hex }))}
                  swatches={colorPresets.map((p) => p.color)}
                  swatchTitles={colorPresets.map((p) => p.name)}
                />
              </div>
            </div>
            <div className="text-sm">
              <span className="text-zinc-500">Icon (optional)</span>
              <div className="mt-2 flex flex-wrap items-center gap-4">
                <OwnerSwatch
                  color={form.color}
                  iconDataUrl={form.iconDataUrl}
                  className="h-12 w-12 rounded-lg"
                  title={form.name || "Project icon"}
                />
                <div className="flex min-w-[14rem] flex-1 flex-col gap-2">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (!f) return;
                      setIconErr(null);
                      queueMicrotask(() => {
                        void fileToOwnerIconDataUrl(f)
                          .then((url) => setForm((cur) => ({ ...cur, iconDataUrl: url })))
                          .catch((err) =>
                            setIconErr(err instanceof Error ? err.message : "Could not load icon"),
                          );
                      });
                    }}
                    className="block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-zinc-100 file:px-3 file:py-2 file:text-sm file:font-medium file:text-zinc-900 hover:file:bg-zinc-200 dark:file:bg-zinc-800 dark:file:text-zinc-100 dark:hover:file:bg-zinc-700"
                  />
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      className="rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-900"
                      onClick={() => setForm((cur) => ({ ...cur, iconDataUrl: null }))}
                      disabled={!form.iconDataUrl}
                    >
                      Remove icon
                    </button>
                  </div>
                  {iconErr ? <p className="text-xs text-red-600">{iconErr}</p> : null}
                  <p className="text-xs text-zinc-500">
                    PNG/WebP with transparency supported. Large images are resized automatically.
                  </p>
                </div>
              </div>
            </div>
            <NoteTagsEditor tags={form.tags} onChange={(tags) => setForm((f) => ({ ...f, tags }))} />
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
        <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">Epics in this project</h2>
        <p className="mt-2 text-sm text-zinc-500">
          Each epic can belong to <strong>at most one</strong> project (or none). Removing an epic here
          only clears the project link.
        </p>
        {epicMutErr ? (
          <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
            {epicMutErr}
          </div>
        ) : null}
        {epicsInProject.length === 0 ? (
          <p className="mt-4 text-sm text-zinc-500">No epics yet. Add some from the section below.</p>
        ) : (
          <ul className="mt-4 flex flex-col gap-2">
            {epicsInProject.map((g) => {
              const pr = owners.find((p) => p.id === g.ownerId);
              return (
                <li
                  key={g.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-zinc-200 px-3 py-2 dark:border-zinc-700"
                >
                  <div className="flex min-w-0 flex-1 items-start gap-3">
                    <OwnerSwatch
                      owner={pr}
                      className="h-9 w-9 shrink-0 rounded-lg"
                      title={pr?.name ?? "Owner"}
                    />
                    <div className="min-w-0">
                      <span className="font-medium text-zinc-900 dark:text-zinc-100">{g.name}</span>
                      <span className="mt-0.5 block text-xs text-zinc-500">
                        Owner: {pr?.name ?? g.ownerId}
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      href={`/epics/${g.id}/edit`}
                      className="text-sm text-blue-600 hover:underline dark:text-blue-400"
                    >
                      Open in epic editor
                    </Link>
                    <button
                      type="button"
                      disabled={busyEpicId === g.id}
                      onClick={() => void removeEpicFromProject(g)}
                      className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm text-zinc-800 hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-900"
                    >
                      {busyEpicId === g.id ? "…" : "Remove from project"}
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className={sectionCard()}>
        <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">Add epics</h2>
        <p className="mt-2 text-sm text-zinc-500">
          Epics not in this project (unassigned or on another project). Adding assigns this project; an epic
          cannot be on two projects at once.
        </p>
        <p className="mt-1 text-xs text-zinc-500">
          Archived epics are hidden here unless your search matches. See the Archived section below for the
          full list.
        </p>
        <label className="mt-4 flex flex-col gap-1 text-sm">
          <span className="text-zinc-500">Search</span>
          <input
            value={assignSearch}
            onChange={(e) => setAssignSearch(e.target.value)}
            placeholder="Epic name, description, or owner"
            className="rounded-lg border border-zinc-300 px-2 py-2 dark:border-zinc-600 dark:bg-zinc-900"
          />
        </label>
        <p className="mt-2 text-xs text-zinc-500">
          {assignableEpics.length} epic{assignableEpics.length === 1 ? "" : "s"} match
        </p>
        <ul className="mt-3 rounded-lg border border-zinc-200 dark:border-zinc-700">
          {assignableEpics.length === 0 ? (
            <li className="px-3 py-6 text-center text-sm text-zinc-500">No epics to add.</li>
          ) : (
            assignEpicsPageSlice.map((g) => {
              const pr = owners.find((p) => p.id === g.ownerId);
              const other = g.projectId ? otherProjectName(g.projectId) : null;
              return (
                <li
                  key={g.id}
                  className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-100 px-3 py-2 last:border-b-0 dark:border-zinc-800"
                >
                  <div className="flex min-w-0 flex-1 items-start gap-3">
                    <OwnerSwatch
                      owner={pr}
                      className="h-9 w-9 shrink-0 rounded-lg"
                      title={pr?.name ?? "Owner"}
                    />
                    <div className="min-w-0">
                      <div className="font-medium text-zinc-900 dark:text-zinc-100">{g.name}</div>
                      <div className="mt-0.5 text-xs text-zinc-500">
                        {pr?.name ?? g.ownerId}
                        {other ? (
                          <span className="text-zinc-600 dark:text-zinc-400">
                            {" "}
                            · Currently: <span className="font-medium">{other}</span>
                          </span>
                        ) : (
                          <span> · Unassigned</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={busyEpicId === g.id}
                    onClick={() => void addEpicToProject(g)}
                    className="shrink-0 rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                  >
                    {busyEpicId === g.id ? "…" : "Add to project"}
                  </button>
                </li>
              );
            })
          )}
        </ul>
        <EpicAssignPagination
          page={assignPageSafe}
          totalItems={assignableEpics.length}
          pageSize={EPIC_LIST_PAGE_SIZE}
          onPageChange={setAssignEpicPage}
        />
      </section>

      <section className={sectionCard()}>
        <details className="group">
          <summary className="cursor-pointer list-none text-base font-semibold text-zinc-900 marker:hidden dark:text-zinc-50 [&::-webkit-details-marker]:hidden">
            Archived epics <span className="text-sm font-normal text-zinc-500">({archivedEpics.length})</span>
          </summary>
          <div className="mt-3">
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-zinc-500">Search archived epics</span>
              <input
                value={archivedEpicSearch}
                onChange={(e) => setArchivedEpicSearch(e.target.value)}
                placeholder="Epic name, description, or owner"
                className="rounded-lg border border-zinc-300 px-2 py-2 dark:border-zinc-600 dark:bg-zinc-900"
              />
            </label>
            <ul className="mt-3 rounded-lg border border-zinc-200 dark:border-zinc-700">
              {archivedEpics.length === 0 ? (
                <li className="px-3 py-6 text-center text-sm text-zinc-500">No archived epics.</li>
              ) : (
                archivedEpicsPageSlice.map((g) => {
                  const pr = owners.find((p) => p.id === g.ownerId);
                  const other = g.projectId ? otherProjectName(g.projectId) : null;
                  return (
                    <li
                      key={g.id}
                      className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-100 px-3 py-2 last:border-b-0 dark:border-zinc-800"
                    >
                      <div className="flex min-w-0 flex-1 items-start gap-3">
                        <OwnerSwatch
                          owner={pr}
                          className="h-9 w-9 shrink-0 rounded-lg"
                          title={pr?.name ?? "Owner"}
                        />
                        <div className="min-w-0">
                          <div className="font-medium text-zinc-900 dark:text-zinc-100">
                            {g.name} <span className="text-xs font-normal text-zinc-500">(archived)</span>
                          </div>
                          <div className="mt-0.5 text-xs text-zinc-500">
                            {pr?.name ?? g.ownerId}
                            {other ? (
                              <span className="text-zinc-600 dark:text-zinc-400">
                                {" "}
                                · Currently: <span className="font-medium">{other}</span>
                              </span>
                            ) : (
                              <span> · Unassigned</span>
                            )}
                          </div>
                        </div>
                      </div>
                      <button
                        type="button"
                        disabled={busyEpicId === g.id}
                        onClick={() => void addEpicToProject(g)}
                        className="shrink-0 rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                      >
                        {busyEpicId === g.id ? "…" : "Add to project"}
                      </button>
                    </li>
                  );
                })
              )}
            </ul>
            <EpicAssignPagination
              page={archivedPageSafe}
              totalItems={archivedEpics.length}
              pageSize={EPIC_LIST_PAGE_SIZE}
              onPageChange={setArchivedEpicPage}
            />
          </div>
        </details>
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
            {project.description?.trim() ? (
              <MarkdownView markdown={project.description} />
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

