"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import type { Project, Task, TaskGroup } from "@/lib/schemas";
import { markdownExcerpt } from "@/lib/markdownExcerpt";
import { dashboardIconBtnPrimaryClass } from "@/lib/dashboardTableActionClasses";
import { EyeIcon, PencilIcon, TrashIcon } from "@/components/icons";
import { HexColorPickerRow } from "@/components/OwnerStyleColorPicker";
import { OwnerSwatch } from "@/components/OwnerSwatch";
import { fileToOwnerIconDataUrl } from "@/lib/ownerIconDataUrl";
import { useDashboardConfig } from "@/components/DashboardSettingsProvider";
import { NAMED_OWNER_COLOR_PRESETS } from "@/lib/presetColors";
import { isArchived } from "@/lib/archive";
import { useDashboardLocalPager } from "@/lib/useDashboardLocalPager";
import { DashboardFilterDisclosure } from "@/components/DashboardFilterDisclosure";
import { DashboardPager } from "@/components/DashboardPager";
import { EntityArchivedBadge } from "@/components/EntityArchivedMark";
import { EntityKeyTagInput } from "@/components/EntityKeyTagInput";
import { LogWorkButton } from "@/components/LogWorkButton";

export function ProjectsListClient() {
  const { settings } = useDashboardConfig();
  const colorPresets =
    settings?.ownerColorPresets ??
    NAMED_OWNER_COLOR_PRESETS.map(({ name, color }) => ({ name, color }));

  const [projects, setProjects] = useState<Project[]>([]);
  const [groups, setGroups] = useState<TaskGroup[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [q, setQ] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [name, setName] = useState("");
  const [keyTag, setKeyTag] = useState("");
  const [color, setColor] = useState<string>(NAMED_OWNER_COLOR_PRESETS[0]!.color);
  const [iconDataUrl, setIconDataUrl] = useState<string | null>(null);
  const [iconErr, setIconErr] = useState<string | null>(null);
  const [description, setDescription] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const [p, g, t] = await Promise.all([
        fetch("/api/projects").then((r) => r.json()),
        fetch("/api/groups").then((r) => r.json()),
        fetch("/api/tasks").then((r) => r.json()),
      ]);
      setProjects(Array.isArray(p) ? p : []);
      setGroups(Array.isArray(g) ? g : []);
      setTasks(Array.isArray(t) ? t : []);
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

  async function createProject(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setErr(null);
    try {
      const r = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), color, iconDataUrl, description, keyTag }),
      });
      if (!r.ok) throw new Error("Could not create project");
      setName("");
      setKeyTag("");
      setColor(NAMED_OWNER_COLOR_PRESETS[0]!.color);
      setIconDataUrl(null);
      setIconErr(null);
      setDescription("");
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not create project");
    }
  }

  async function deleteProject(id: string) {
    if (!confirm("Delete this project? Epics will be unassigned.")) return;
    setErr(null);
    try {
      const r = await fetch(`/api/projects/${id}`, { method: "DELETE" });
      if (!r.ok) throw new Error("Delete failed");
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Delete failed");
    }
  }

  const projectMeta = useMemo(() => {
    const ql = q.trim().toLowerCase();
    const filtered = projects.filter((p) => {
      if (!isArchived(p)) return true;
      return showArchived;
    });
    return filtered
      .map((p) => {
        const epics = groups.filter((g) => g.projectId === p.id);
        const epicIds = new Set(epics.map((g) => g.id));
        const projectTasks = tasks.filter((t) => t.groupId && epicIds.has(t.groupId));
        return {
          p,
          epicCount: epics.length,
          taskCount: projectTasks.length,
          summary: markdownExcerpt(p.description ?? "", 140),
        };
      })
      .filter(
        ({ p, summary }) =>
          !ql ||
          p.name.toLowerCase().includes(ql) ||
          (p.description ?? "").toLowerCase().includes(ql) ||
          summary.toLowerCase().includes(ql),
      )
      .sort((a, b) => a.p.name.localeCompare(b.p.name));
  }, [groups, projects, q, showArchived, tasks]);

  const projectPagerResetKey = useMemo(
    () => JSON.stringify({ q, showArchived }),
    [q, showArchived],
  );

  const projectPager = useDashboardLocalPager(projectMeta.length, projectPagerResetKey);

  const pagedProjectMeta = useMemo(
    () => projectPager.slice(projectMeta),
    [projectPager, projectMeta],
  );

  if (loading) return <p className="text-zinc-500">Loading…</p>;

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          Projects
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          Projects group epics (and their tasks) across the dashboard.
        </p>
      </div>

      {err ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
          {err}
        </div>
      ) : null}

      <DashboardFilterDisclosure>
        <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-zinc-500">Search</span>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Project name"
            className="rounded-lg border border-zinc-300 px-2 py-2 dark:border-zinc-600 dark:bg-zinc-900"
          />
          <span className="mt-1 text-xs text-zinc-500">
            Archived projects are hidden unless you enable below.
          </span>
        </label>
        <label className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-200">
          <input
            type="checkbox"
            checked={showArchived}
            onChange={(e) => setShowArchived(e.target.checked)}
            className="rounded border-zinc-300 dark:border-zinc-600"
          />
          Show archived
        </label>
        </div>
      </DashboardFilterDisclosure>

      <form
        onSubmit={(e) => void createProject(e)}
        className="flex flex-col gap-4 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950"
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-zinc-500">Name</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="rounded-lg border border-zinc-300 px-2 py-2 dark:border-zinc-600 dark:bg-zinc-900"
              placeholder="Personal growth"
            />
          </label>
          <EntityKeyTagInput value={keyTag} onChange={setKeyTag} defaultTag="PRJ" />
          <div className="text-sm">
            <span className="text-zinc-500">Color</span>
            <div className="mt-2">
              <HexColorPickerRow
                value={color}
                onChange={setColor}
                swatches={colorPresets.map((p) => p.color)}
                swatchTitles={colorPresets.map((p) => p.name)}
              />
            </div>
          </div>
          <div className="text-sm sm:col-span-2 sm:min-w-[16rem]">
            <span className="text-zinc-500">Icon (optional)</span>
            <div className="mt-2 flex items-center gap-3">
              <OwnerSwatch
                color={color}
                iconDataUrl={iconDataUrl}
                className="h-10 w-10 rounded-md"
                title={name || "Project icon"}
              />
              <div className="min-w-0 flex-1">
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (!f) return;
                    setIconErr(null);
                    queueMicrotask(() => {
                      void fileToOwnerIconDataUrl(f)
                        .then((url) => setIconDataUrl(url))
                        .catch((err) =>
                          setIconErr(err instanceof Error ? err.message : "Could not load icon"),
                        );
                    });
                  }}
                  className="block w-full text-xs file:mr-2 file:rounded-lg file:border-0 file:bg-zinc-100 file:px-2.5 file:py-1.5 file:text-xs file:font-medium file:text-zinc-900 hover:file:bg-zinc-200 dark:file:bg-zinc-800 dark:file:text-zinc-100 dark:hover:file:bg-zinc-700"
                />
                {iconErr ? <p className="mt-1 text-xs text-red-600">{iconErr}</p> : null}
              </div>
            </div>
          </div>
          <label className="flex flex-col gap-1 text-sm sm:col-span-2">
            <span className="text-zinc-500">Description (optional, Markdown)</span>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="rounded-lg border border-zinc-300 px-2 py-2 dark:border-zinc-600 dark:bg-zinc-900"
              placeholder="What is this project about?"
            />
          </label>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="submit"
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Add project
          </button>
        </div>
      </form>

      <DashboardPager
        page={projectPager.page}
        pageCount={projectPager.pageCount}
        total={projectPager.total}
        pageSize={projectPager.pageSize}
        onPageChange={projectPager.setPage}
      />

      <ul className="grid gap-4 sm:grid-cols-2">
        {pagedProjectMeta.map(({ p, epicCount, taskCount, summary }) => (
          <li
            key={p.id}
            className="flex flex-col rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950"
            style={{ borderLeftWidth: 4, borderLeftColor: p.color ?? "#6366f1" }}
            {...(isArchived(p) ? { "data-pd-archived": "true" } : {})}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex min-w-0 items-start gap-3">
                <Link
                  href={`/projects/${p.id}`}
                  className="rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-zinc-950"
                  aria-label={`Open ${p.name}`}
                  title={`Open ${p.name}`}
                >
                  <OwnerSwatch
                    color={p.color}
                    iconDataUrl={p.iconDataUrl}
                    className="h-12 w-12 rounded-xl"
                    title={p.name}
                  />
                </Link>
                <div className="min-w-0">
                  <div className="flex min-w-0 flex-wrap items-center gap-2">
                    <Link
                      href={`/projects/${p.id}`}
                      className="block min-w-0 flex-1 truncate text-lg font-semibold text-zinc-900 hover:underline dark:text-zinc-50"
                    >
                      {p.name}
                    </Link>
                    <EntityArchivedBadge entity={p} />
                  </div>
                  <p className="mt-1 text-sm text-zinc-500">
                    {epicCount} epic{epicCount === 1 ? "" : "s"} · {taskCount} task
                    {taskCount === 1 ? "" : "s"}
                  </p>
                </div>
              </div>
              <button
                type="button"
                className="inline-flex items-center justify-center rounded p-1 text-red-600 hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-950/40 dark:hover:text-red-300"
                onClick={() => void deleteProject(p.id)}
                aria-label="Delete project"
                title="Delete project"
              >
                <TrashIcon />
              </button>
            </div>
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
              {summary ? <span className="block pd-clamp-2">{summary}</span> : <span>—</span>}
            </p>
            <div className="mt-4 flex flex-wrap gap-1 text-sm">
              <Link
                href={`/projects/${p.id}`}
                className={dashboardIconBtnPrimaryClass}
                aria-label="Open project"
                title="Open project"
              >
                <EyeIcon />
              </Link>
              <Link
                href={`/projects/${p.id}/edit`}
                className={dashboardIconBtnPrimaryClass}
                aria-label="Edit project"
                title="Edit project"
              >
                <PencilIcon />
              </Link>
              <LogWorkButton
                target={{ kind: "project", projectId: p.id }}
                disabled={isArchived(p)}
                variant="link"
                className="font-medium"
              />
            </div>
          </li>
        ))}
      </ul>

      {projects.length === 0 ? (
        <p className="text-sm text-zinc-500">No projects yet. Create one above.</p>
      ) : null}
    </div>
  );
}

