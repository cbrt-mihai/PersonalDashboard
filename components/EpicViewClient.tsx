"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { isArchived } from "@/lib/archive";
import type { Owner, Project, Task, TaskGroup } from "@/lib/schemas";
import { DetailCollapsibleSection } from "./DetailCollapsibleSection";
import { WorklogSection } from "./WorklogSection";
import { EntityArchivedBadge, EntityArchivedBanner } from "./EntityArchivedMark";
import { useDashboardConfig } from "./DashboardSettingsProvider";
import { entryMatchesTagKeys, normalizeTagKey, tagOptionsFromEntries } from "@/lib/noteTags";
import { TASK_FORM_PRIORITIES, TASK_FORM_TYPES } from "@/lib/taskFormOptions";
import { FilterMultiDropdown } from "./FilterMultiDropdown";
import { StatusBadge } from "./StatusBadge";
import { TaskPriorityBadge, TaskTypeBadge } from "./TaskMetaBadges";
import { MarkdownView } from "./MarkdownView";
import { normalizeStatusKey, statusDef } from "@/lib/statusConfig";
import { OwnerSwatch } from "./OwnerSwatch";
import { TrashIcon } from "./icons";

export function EpicViewClient({ epicId }: { epicId: string }) {
  const { settings, statusMap, statusKeys } = useDashboardConfig();
  const router = useRouter();
  const [epic, setEpic] = useState<TaskGroup | null>(null);
  const [owner, setOwner] = useState<Owner | null>(null);
  const [project, setProject] = useState<Project | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [taskQ, setTaskQ] = useState("");
  const [showArchivedTasks, setShowArchivedTasks] = useState(false);
  const [taskStatusFilters, setTaskStatusFilters] = useState<string[]>([]);
  const [taskTypeFilters, setTaskTypeFilters] = useState<string[]>([]);
  const [taskPriorityFilters, setTaskPriorityFilters] = useState<string[]>([]);
  const [taskTagKeys, setTaskTagKeys] = useState<string[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const gr = await fetch(`/api/groups/${epicId}`);
      if (!gr.ok) throw new Error("Epic not found");
      const g: TaskGroup = await gr.json();
      setEpic(g);
      const [pr, tk] = await Promise.all([
        fetch(`/api/owners/${g.ownerId}`).then((r) => (r.ok ? r.json() : null)),
        fetch(`/api/tasks?groupId=${g.id}`).then((r) => (r.ok ? r.json() : [])),
      ]);
      setOwner(pr);
      setTasks(Array.isArray(tk) ? tk : []);
      if (g.projectId) {
        const pj = await fetch(`/api/projects/${g.projectId}`).then((r) =>
          r.ok ? r.json() : null,
        );
        setProject(pj);
      } else {
        setProject(null);
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to load");
      setEpic(null);
    } finally {
      setLoading(false);
    }
  }, [epicId]);

  useEffect(() => {
    queueMicrotask(() => {
      void load();
    });
  }, [load]);

  async function onDelete() {
    if (!epic || !confirm("Delete this epic? Tasks will become ungrouped.")) return;
    const r = await fetch(`/api/groups/${epic.id}`, { method: "DELETE" });
    if (!r.ok) return;
    router.push(owner ? `/owners/${owner.id}` : "/epics");
    router.refresh();
  }

  const accent = owner?.color ?? "#6366f1";

  const tasksForDisplay = useMemo(
    () => (showArchivedTasks ? tasks : tasks.filter((t) => !isArchived(t))),
    [tasks, showArchivedTasks],
  );

  const taskStatusBreakdown = useMemo(() => {
    const indexByKey = new Map<string, number>();
    statusKeys.forEach((k, i) => indexByKey.set(k, i));

    const byKey = new Map<
      string,
      { key: string; label: string; count: number; idx: number; order: number }
    >();

    for (const t of tasksForDisplay) {
      const key = normalizeStatusKey(t.status);
      const def = statusDef(t.status, statusMap);
      const label = def.label.trim() ? def.label : "Unknown";

      const existing = byKey.get(key);
      if (existing) {
        existing.count += 1;
        continue;
      }

      byKey.set(key, {
        key,
        label,
        count: 1,
        idx: indexByKey.get(key) ?? Number.POSITIVE_INFINITY,
        order: def.order,
      });
    }

    return [...byKey.values()]
      .filter((x) => x.count > 0)
      .sort((a, b) => {
        if (a.idx !== b.idx) return a.idx - b.idx;
        if (a.order !== b.order) return a.order - b.order;
        return a.label.localeCompare(b.label);
      });
  }, [tasksForDisplay, statusKeys, statusMap]);

  const taskStatusFilterOptions = useMemo(
    () => statusKeys.map((k) => ({ value: k, label: statusDef(k, statusMap).label })),
    [statusKeys, statusMap],
  );

  const taskTypeFilterOptions = useMemo(
    () =>
      settings?.taskTypes
        ? settings.taskTypes.map((x) => ({ value: x.label, label: x.label }))
        : TASK_FORM_TYPES.map((label) => ({ value: label, label })),
    [settings],
  );

  const taskPriorityFilterOptions = useMemo(
    () =>
      settings?.taskPriorities
        ? settings.taskPriorities.map((p) => ({ value: p.label, label: p.label }))
        : TASK_FORM_PRIORITIES.map((label) => ({ value: label, label })),
    [settings],
  );

  const taskTagFilterOptions = useMemo(
    () => tagOptionsFromEntries(tasksForDisplay),
    [tasksForDisplay],
  );

  const filteredTasks = useMemo(() => {
    let list = tasksForDisplay;
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
    return [...list].sort((a, b) => {
      const dc = b.date.localeCompare(a.date);
      if (dc !== 0) return dc;
      return a.name.localeCompare(b.name);
    });
  }, [
    tasksForDisplay,
    taskQ,
    taskTagKeys,
    taskStatusFilters,
    taskTypeFilters,
    taskPriorityFilters,
  ]);

  if (loading) return <p className="text-zinc-500">Loading…</p>;
  if (err || !epic) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
        {err ?? "Not found"}{" "}
        <Link href="/epics" className="underline">
          Epics
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <EntityArchivedBanner entity={epic} kind="epic" />
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap gap-2 text-sm text-zinc-500">
            <Link href="/epics" className="text-blue-600 hover:underline dark:text-blue-400">
              Epics
            </Link>
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
          </div>
          <h1
            className="mt-2 text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50"
            style={{ borderLeftWidth: 4, borderLeftColor: accent, paddingLeft: "0.75rem" }}
          >
            <span className="inline-flex items-center gap-3">
              <OwnerSwatch
                owner={owner}
                color={accent}
                className="h-10 w-10 rounded-xl"
                title={owner?.name ?? "Owner"}
              />
              <span>{epic.name}</span>
            </span>
          </h1>
          <p className="mt-2 text-xs text-zinc-500">
            Wiki link:{" "}
            <code className="rounded bg-zinc-200 px-1 dark:bg-zinc-800">{`[[epic:${epic.id}]]`}</code>
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href={`/epics/${epic.id}/edit`}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Edit
          </Link>
          <button
            type="button"
            onClick={() => void onDelete()}
            className="inline-flex items-center justify-center rounded-lg border border-red-300 p-2 text-red-700 hover:bg-red-50 dark:border-red-800 dark:text-red-300 dark:hover:bg-red-950/40"
            aria-label="Delete epic"
            title="Delete epic"
          >
            <TrashIcon />
          </button>
        </div>
      </div>

      <dl className="grid gap-4 rounded-xl border border-zinc-200 bg-white p-5 text-sm dark:border-zinc-800 dark:bg-zinc-950 sm:grid-cols-2">
        <div>
          <dt className="text-zinc-500">Project</dt>
          <dd className="mt-1">
            {project ? (
              <Link
                href={`/projects/${project.id}`}
                className="font-medium text-blue-600 hover:underline dark:text-blue-400"
              >
                {project.name}
              </Link>
            ) : (
              <span className="text-zinc-500">—</span>
            )}
          </dd>
        </div>
        <div>
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
              epic.ownerId
            )}
          </dd>
        </div>
        <div>
          <dt className="text-zinc-500">Tasks</dt>
          <dd className="mt-1 font-medium text-zinc-900 dark:text-zinc-100">
            {tasksForDisplay.length === 0 ? (
              <span className="text-zinc-500">—</span>
            ) : (
              <div className="flex flex-wrap gap-x-3 gap-y-1">
                {taskStatusBreakdown.map((x) => {
                  const pct = Math.round((x.count * 100) / tasksForDisplay.length);
                  return (
                    <span key={x.key} className="whitespace-nowrap tabular-nums">
                      {x.count}/{tasksForDisplay.length}{" "}
                      <span className="font-normal">{x.label}</span>{" "}
                      <span className="font-normal text-zinc-500 dark:text-zinc-400">
                        ({pct}%)
                      </span>
                    </span>
                  );
                })}
              </div>
            )}
          </dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="text-zinc-500">Tags</dt>
          <dd className="mt-1">
            {(epic.tags ?? []).length ? (
              <div className="flex flex-wrap gap-1">
                {(epic.tags ?? []).map((t) => (
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
        <div className="mt-3 text-sm text-zinc-700 dark:text-zinc-300">
          {epic.description?.trim() ? (
            <MarkdownView markdown={epic.description} />
          ) : (
            <p className="italic text-zinc-500">No description.</p>
          )}
        </div>
      </section>

      <DetailCollapsibleSection title="Tasks">
        <div className="flex flex-wrap justify-end gap-2">
          {owner ? (
            <Link
              href={`/owners/${owner.id}#epic-${epic.id}`}
              className="rounded-lg border border-zinc-300 px-3 py-2 text-sm text-blue-600 hover:underline dark:border-zinc-600 dark:text-blue-400"
            >
              Open in owner
            </Link>
          ) : null}
        </div>
        <div className="mt-4 grid gap-3 rounded-xl border border-zinc-200 bg-zinc-50/80 p-3 dark:border-zinc-800 dark:bg-zinc-900/40 sm:grid-cols-2 lg:grid-cols-4">
          <label className="flex flex-col gap-1 text-sm sm:col-span-2 lg:col-span-4">
            <span className="text-zinc-500">Search tasks</span>
            <input
              value={taskQ}
              onChange={(e) => setTaskQ(e.target.value)}
              placeholder="Name, description, or tag"
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
            label="Tags (any match)"
            options={taskTagFilterOptions}
            selected={taskTagKeys}
            onChange={setTaskTagKeys}
          />
          <label className="flex items-center gap-2 text-sm text-zinc-700 sm:col-span-2 lg:col-span-4 dark:text-zinc-200">
            <input
              type="checkbox"
              checked={showArchivedTasks}
              onChange={(e) => setShowArchivedTasks(e.target.checked)}
              className="rounded border-zinc-300 dark:border-zinc-600"
            />
            Show archived tasks
          </label>
        </div>

        <p className="mt-3 text-sm text-zinc-500">
          {filteredTasks.length} task{filteredTasks.length === 1 ? "" : "s"} in current filters
        </p>

        <ul className="mt-3 flex flex-col gap-2">
          {filteredTasks.map((t) => {
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
        {tasksForDisplay.length === 0 ? (
          <p className="mt-2 text-sm text-zinc-500">No tasks yet.</p>
        ) : filteredTasks.length === 0 ? (
          <p className="mt-2 text-sm text-zinc-500">No tasks match search or filters.</p>
        ) : null}
      </DetailCollapsibleSection>

      {epic ? (
        <WorklogSection target={{ kind: "epic", groupId: epic.id }} disabled={isArchived(epic)} />
      ) : null}
    </div>
  );
}

