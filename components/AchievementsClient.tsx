"use client";

import { useDashboardConfig } from "@/components/DashboardSettingsProvider";
import { DashboardFilterDisclosure } from "@/components/DashboardFilterDisclosure";
import { DashboardPager } from "@/components/DashboardPager";
import { FilterMultiDropdown } from "@/components/FilterMultiDropdown";
import { useI18n } from "@/components/LocaleProvider";
import { StatusBadge } from "@/components/StatusBadge";
import { TaskTypeBadge } from "@/components/TaskMetaBadges";
import {
  buildAchievementsHtmlDocument,
  defaultAchievementsDateRange,
  enrichBragRows,
  filterTasksForAchievements,
  groupBragRows,
  normalizeDateRange,
  type AchievementsFilters,
  type BragGroupBy,
  type BragTaskRow,
} from "@/lib/achievements";
import {
  aggregateWorklogAchievementEntityRollups,
  aggregateWorklogAchievementStats,
  aggregateWorklogByEntryTypeStats,
  attachWorklogEntryTypeSwatches,
  attachWorklogRollupSwatches,
  buildAchievementsWorklogSummaryHtml,
  filterWorklogsForAchievements,
  WORKLOG_KIND_LABEL,
} from "@/lib/achievementsWorklogs";
import { isArchived } from "@/lib/archive";
import { DEFAULT_DASHBOARD_SETTINGS } from "@/lib/defaultDashboardSettings";
import { formatJiraDuration } from "@/lib/jiraDuration";
import { markdownExcerpt } from "@/lib/markdownExcerpt";
import { tagOptionsFromEntries } from "@/lib/noteTags";
import type { Owner, OwnerEntry, Project, Task, TaskGroup, Worklog } from "@/lib/schemas";
import { TASK_FORM_PRIORITIES, TASK_FORM_TYPES } from "@/lib/taskFormOptions";
import { paginateGroupedSections } from "@/lib/paginateGroupedSections";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useDashboardLocalPager } from "@/lib/useDashboardLocalPager";
import { buildWorklogEntityMaps } from "@/lib/worklogTargetDisplay";

function BragTaskCard({ row }: { row: BragTaskRow }) {
  const { task, ownerName, projectName, epicName } = row;
  const excerpt = markdownExcerpt(task.description ?? "", 220);
  const meta = [ownerName, projectName, epicName, task.date].filter(Boolean).join(" · ");
  return (
    <article className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
      <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">{task.name}</h3>
      <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{meta}</p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <TaskTypeBadge type={task.type} />
        <StatusBadge status={task.status} variant="task" />
        <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">
          {task.priority}
        </span>
      </div>
      {excerpt ? (
        <p className="mt-2 text-sm leading-relaxed text-zinc-600 dark:text-zinc-300">{excerpt}</p>
      ) : null}
      {(task.tags ?? []).length > 0 ? (
        <div className="mt-2 flex flex-wrap gap-1">
          {(task.tags ?? []).map((tg) => (
            <span
              key={tg}
              className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300"
            >
              {tg}
            </span>
          ))}
        </div>
      ) : null}
    </article>
  );
}

export function AchievementsClient() {
  const { t } = useI18n();
  const { settings, statusMap, statusKeys } = useDashboardConfig();
  const types = useMemo(
    () =>
      settings?.taskTypes?.length
        ? settings.taskTypes.map((r) => r.label)
        : [...TASK_FORM_TYPES],
    [settings],
  );
  const priorities = useMemo(
    () =>
      settings?.taskPriorities?.length
        ? settings.taskPriorities.map((r) => r.label)
        : [...TASK_FORM_PRIORITIES],
    [settings],
  );

  const range0 = defaultAchievementsDateRange();
  const [from, setFrom] = useState(range0.from);
  const [to, setTo] = useState(range0.to);
  const [ownerIds, setOwnerIds] = useState<string[]>([]);
  const [projectIds, setProjectIds] = useState<string[]>([]);
  const [epicIds, setEpicIds] = useState<string[]>([]);
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
  const [selectedPriorities, setSelectedPriorities] = useState<string[]>([]);
  const [selectedTagKeys, setSelectedTagKeys] = useState<string[]>([]);
  const [showArchived, setShowArchived] = useState(false);
  const [groupBy, setGroupBy] = useState<BragGroupBy>("owner");

  const [owners, setOwners] = useState<Owner[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [groups, setGroups] = useState<TaskGroup[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [entries, setEntries] = useState<OwnerEntry[]>([]);
  const [worklogs, setWorklogs] = useState<Worklog[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const { from: rf, to: rt } = normalizeDateRange(from, to);
      const wlParams = new URLSearchParams({ from: rf, to: rt });
      const [pr, pj, gr, tk, en, wl] = await Promise.all([
        fetch("/api/owners").then((r) => r.json()),
        fetch("/api/projects").then((r) => r.json()),
        fetch("/api/groups").then((r) => r.json()),
        fetch("/api/tasks").then((r) => r.json()),
        fetch("/api/entries").then((r) => r.json()),
        fetch(`/api/worklogs?${wlParams}`).then((r) => r.json()),
      ]);
      if (
        !Array.isArray(pr) ||
        !Array.isArray(pj) ||
        !Array.isArray(gr) ||
        !Array.isArray(tk) ||
        !Array.isArray(en) ||
        !Array.isArray(wl)
      ) {
        throw new Error("Bad response");
      }
      setOwners(pr);
      setProjects(pj);
      setGroups(gr);
      setTasks(tk);
      setEntries(en);
      setWorklogs(wl);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [from, to]);

  useEffect(() => {
    queueMicrotask(() => {
      void load();
    });
  }, [load]);

  const filters: AchievementsFilters = useMemo(
    () => ({
      from,
      to,
      ownerIds,
      projectIds,
      epicIds,
      types: selectedTypes,
      priorities: selectedPriorities,
      statuses: selectedStatuses,
      tagKeys: selectedTagKeys,
      showArchived,
    }),
    [
      from,
      to,
      ownerIds,
      projectIds,
      epicIds,
      selectedTypes,
      selectedPriorities,
      selectedStatuses,
      selectedTagKeys,
      showArchived,
    ],
  );

  const filteredTasksAll = useMemo(
    () => filterTasksForAchievements(tasks, groups, projects, filters, statusMap, false),
    [tasks, groups, projects, filters, statusMap],
  );
  const filteredTasksTerminal = useMemo(
    () => filterTasksForAchievements(tasks, groups, projects, filters, statusMap, true),
    [tasks, groups, projects, filters, statusMap],
  );

  const bragRows = useMemo(
    () => enrichBragRows(filteredTasksAll, owners, groups, projects),
    [filteredTasksAll, owners, groups, projects],
  );
  const bragRowsTerminal = useMemo(
    () => enrichBragRows(filteredTasksTerminal, owners, groups, projects),
    [filteredTasksTerminal, owners, groups, projects],
  );

  const sections = useMemo(() => groupBragRows(bragRows, groupBy), [bragRows, groupBy]);
  const sectionsTerminal = useMemo(
    () => groupBragRows(bragRowsTerminal, groupBy),
    [bragRowsTerminal, groupBy],
  );

  const ownerFilterOptions = useMemo(
    () =>
      owners
        .filter((p) => showArchived || !isArchived(p))
        .map((p) => ({ value: p.id, label: p.name })),
    [owners, showArchived],
  );

  const projectFilterOptions = useMemo(() => {
    return [
      { value: "__no_project__", label: t("common.noProject") },
      ...[...projects]
        .filter((p) => showArchived || !isArchived(p))
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((p) => ({ value: p.id, label: p.name })),
    ];
  }, [projects, showArchived, t]);

  const groupFilterOptions = useMemo(() => {
    const base = groups.filter((g) => {
      if (!showArchived && isArchived(g)) return false;
      return ownerIds.length === 0 || ownerIds.includes(g.ownerId);
    });
    return [
      { value: "__ungrouped__", label: t("common.ungrouped") },
      ...[...base]
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((g) => ({ value: g.id, label: g.name })),
    ];
  }, [groups, ownerIds, showArchived, t]);

  const typeFilterOptions = useMemo(() => types.map((t) => ({ value: t, label: t })), [types]);

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

  const achievementWorklogs = useMemo(
    () =>
      filterWorklogsForAchievements(
        worklogs,
        tasks,
        groups,
        projects,
        owners,
        entries,
        filters,
        statusMap,
      ),
    [worklogs, tasks, groups, projects, owners, entries, filters, statusMap],
  );

  const worklogStats = useMemo(
    () => aggregateWorklogAchievementStats(achievementWorklogs),
    [achievementWorklogs],
  );

  const worklogEntityMaps = useMemo(
    () => buildWorklogEntityMaps(tasks, groups, entries, projects, owners),
    [tasks, groups, entries, projects, owners],
  );

  const worklogEntityRollups = useMemo(
    () => aggregateWorklogAchievementEntityRollups(achievementWorklogs, worklogEntityMaps),
    [achievementWorklogs, worklogEntityMaps],
  );

  const worklogEntryTypeStats = useMemo(
    () => aggregateWorklogByEntryTypeStats(achievementWorklogs, worklogEntityMaps),
    [achievementWorklogs, worklogEntityMaps],
  );

  const mpd = settings?.worklogMinutesPerDay ?? 1440;

  const { from: rf, to: rt } = normalizeDateRange(from, to);

  const downloadHtml = () => {
    const title = t("achievements.title");
    const subtitle =
      rf && rt
        ? t("achievements.taskDatesThrough", { from: rf, to: rt })
        : t("achievements.tasksMatchingFilters");
    const taskTypes = settings?.taskTypes ?? DEFAULT_DASHBOARD_SETTINGS.taskTypes;
    const worklogSummaryHtml = buildAchievementsWorklogSummaryHtml({
      from: rf,
      to: rt,
      totalMinutes: worklogStats.totalMinutes,
      entryCount: worklogStats.entryCount,
      byKind: worklogStats.byKind,
      byEpic: attachWorklogRollupSwatches("epic", worklogEntityRollups.byEpic, worklogEntityMaps),
      byProject: attachWorklogRollupSwatches(
        "project",
        worklogEntityRollups.byProject,
        worklogEntityMaps,
      ),
      byOwner: attachWorklogRollupSwatches("owner", worklogEntityRollups.byOwner, worklogEntityMaps),
      byEntryType: attachWorklogEntryTypeSwatches(worklogEntryTypeStats, taskTypes),
      minutesPerDay: mpd,
      taskTypes,
    });
    const html = buildAchievementsHtmlDocument({
      title,
      subtitle,
      generatedAtIso: new Date().toISOString(),
      sections: sectionsTerminal,
      statusMap,
      taskTypeLabels: types,
      taskPriorityLabels: priorities,
      sectionsAllStatuses: sections,
      worklogSummaryHtml,
    });
    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `achievements-${rf || "na"}-${rt || "na"}.html`;
    a.rel = "noopener";
    a.click();
    URL.revokeObjectURL(url);
  };

  const totalCount = bragRows.length;

  const achPagerResetKey = useMemo(
    () =>
      JSON.stringify({
        from,
        to,
        ownerIds,
        projectIds,
        epicIds,
        selectedTypes,
        selectedStatuses,
        selectedPriorities,
        selectedTagKeys,
        showArchived,
        groupBy,
      }),
    [
      from,
      to,
      ownerIds,
      projectIds,
      epicIds,
      selectedTypes,
      selectedStatuses,
      selectedPriorities,
      selectedTagKeys,
      showArchived,
      groupBy,
    ],
  );

  const achPager = useDashboardLocalPager(totalCount, achPagerResetKey);

  const pagedAchSections = useMemo(
    () => paginateGroupedSections(sections, achPager.page, achPager.pageSize),
    [sections, achPager.page, achPager.pageSize],
  );

  return (
    <div className="mx-auto max-w-4xl">
      <div className="print:hidden">
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
            {t("achievements.title")}
          </h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          {t("achievements.description")}
        </p>

        {err ? (
          <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
            {err}{" "}
            <button type="button" className="underline" onClick={() => void load()}>
              {t("common.retry")}
            </button>
          </p>
        ) : null}

        <div className="mt-6 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={downloadHtml}
            disabled={loading}
            className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            {t("achievements.downloadHtml")}
          </button>
        </div>

        <section className="mt-6 rounded-xl border border-zinc-200 bg-white/80 p-4 dark:border-zinc-800 dark:bg-zinc-950/60">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
            {t("nav.worklogs")}
          </h2>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            {t("worklog.startedBetween", { from: rf, to: rt })}
          </p>
          {loading ? (
            <p className="mt-3 text-sm text-zinc-500">{t("common.loading")}</p>
          ) : (
            <dl className="mt-3 grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg border border-zinc-200 bg-zinc-50/80 p-3 dark:border-zinc-700 dark:bg-zinc-900/40">
                <dt className="text-xs font-medium tracking-wide text-zinc-500 uppercase">
                  {t("worklog.entries")}
                </dt>
                <dd className="mt-1 text-2xl font-semibold tabular-nums text-zinc-900 dark:text-zinc-50">
                  {worklogStats.entryCount}
                </dd>
              </div>
              <div className="rounded-lg border border-zinc-200 bg-zinc-50/80 p-3 dark:border-zinc-700 dark:bg-zinc-900/40">
                <dt className="text-xs font-medium tracking-wide text-zinc-500 uppercase">
                  {t("worklog.totalTime")}
                </dt>
                <dd className="mt-1 text-2xl font-semibold tabular-nums text-zinc-900 dark:text-zinc-50">
                  {formatJiraDuration(worklogStats.totalMinutes, { minutesPerDay: mpd })}
                </dd>
              </div>
            </dl>
          )}
          {!loading && worklogStats.byKind.length > 0 ? (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[16rem] text-left text-sm">
                <thead>
                  <tr className="border-b border-zinc-200 text-xs text-zinc-500 uppercase dark:border-zinc-700">
                    <th className="py-2 pr-2 font-medium">{t("worklog.target")}</th>
                    <th className="py-2 pr-2 font-medium">{t("worklog.entries")}</th>
                    <th className="py-2 font-medium">{t("worklog.time")}</th>
                  </tr>
                </thead>
                <tbody>
                  {worklogStats.byKind.map((row) => (
                    <tr
                      key={row.kind}
                      className="border-b border-zinc-100 dark:border-zinc-800/80"
                    >
                      <td className="py-2 pr-2 text-zinc-800 dark:text-zinc-200">
                        {WORKLOG_KIND_LABEL[row.kind]}
                      </td>
                      <td className="py-2 pr-2 tabular-nums text-zinc-700 dark:text-zinc-300">
                        {row.entries}
                      </td>
                      <td className="py-2 tabular-nums text-zinc-700 dark:text-zinc-300">
                        {formatJiraDuration(row.minutes, { minutesPerDay: mpd })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </section>

        <section className="mt-8 space-y-4 rounded-xl border border-zinc-200 bg-white/80 p-4 dark:border-zinc-800 dark:bg-zinc-950/60">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
            {t("worklog.filters")}
          </h2>
          <DashboardFilterDisclosure title={t("achievements.dateRangeGroupingFilters")}>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-zinc-500">{t("achievements.fromTaskDate")}</span>
              <input
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                className="rounded-lg border border-zinc-300 bg-white px-2 py-1.5 dark:border-zinc-600 dark:bg-zinc-900"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-zinc-500">{t("achievements.toTaskDate")}</span>
              <input
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                className="rounded-lg border border-zinc-300 bg-white px-2 py-1.5 dark:border-zinc-600 dark:bg-zinc-900"
              />
            </label>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <FilterMultiDropdown
              label={t("common.owner")}
              options={ownerFilterOptions}
              selected={ownerIds}
              onChange={setOwnerIds}
            />
            <FilterMultiDropdown
              label={t("common.project")}
              options={projectFilterOptions}
              selected={projectIds}
              onChange={setProjectIds}
            />
            <FilterMultiDropdown
              label={t("common.epic")}
              options={groupFilterOptions}
              selected={epicIds}
              onChange={setEpicIds}
            />
            <FilterMultiDropdown
              label={t("common.taskType")}
              options={typeFilterOptions}
              selected={selectedTypes}
              onChange={setSelectedTypes}
            />
            <FilterMultiDropdown
              label={t("common.status")}
              options={statusFilterOptions}
              selected={selectedStatuses}
              onChange={setSelectedStatuses}
            />
            <FilterMultiDropdown
              label={t("common.priority")}
              options={priorityFilterOptions}
              selected={selectedPriorities}
              onChange={setSelectedPriorities}
            />
            <FilterMultiDropdown
              label={t("common.tags")}
              options={tagFilterOptions}
              selected={selectedTagKeys}
              onChange={setSelectedTagKeys}
            />
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-zinc-500">{t("achievements.groupPreviewExportBy")}</span>
              <select
                value={groupBy}
                onChange={(e) => setGroupBy(e.target.value as BragGroupBy)}
                className="rounded-lg border border-zinc-300 bg-white px-2 py-1.5 dark:border-zinc-600 dark:bg-zinc-900"
              >
                <option value="owner">{t("common.owner")}</option>
                <option value="project">{t("common.project")}</option>
                <option value="epic">{t("common.epic")}</option>
                <option value="none">{t("achievements.noneSingleList")}</option>
              </select>
            </label>
          </div>
          <label className="mt-4 flex cursor-pointer items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
            <input
              type="checkbox"
              checked={showArchived}
              onChange={(e) => setShowArchived(e.target.checked)}
              className="rounded border-zinc-300 dark:border-zinc-600"
            />
            {t("achievements.includeArchivedTasks")}
          </label>
          </DashboardFilterDisclosure>
        </section>
      </div>

      <section className="mt-10">
        <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2 print:hidden">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
            {t("common.preview")}
          </h2>
          <p className="text-sm text-zinc-500">
            {loading
              ? t("common.loading")
              : t("achievements.previewSummary", {
                  count: totalCount,
                  taskLabel:
                    totalCount === 1
                      ? t("achievements.taskSingular")
                      : t("achievements.taskPlural"),
                  from: rf,
                  to: rt,
                })}
          </p>
        </div>

        <div className="hidden print:block print:mb-4">
          <h1 className="text-2xl font-bold">{t("achievements.title")}</h1>
          <p className="text-sm text-zinc-600">
            {rf && rt ? t("achievements.taskDatesThrough", { from: rf, to: rt }) : ""}
          </p>
          <p className="text-xs text-zinc-500">
            {totalCount}{" "}
            {totalCount === 1 ? t("achievements.taskSingular") : t("achievements.taskPlural")}
          </p>
        </div>

        {loading ? (
          <p className="rounded-lg border border-zinc-200 px-4 py-8 text-center text-sm text-zinc-500 dark:border-zinc-700">
            {t("common.loading")}
          </p>
        ) : totalCount === 0 ? (
          <p className="rounded-lg border border-dashed border-zinc-300 px-4 py-8 text-center text-sm text-zinc-500 dark:border-zinc-700">
            {t("achievements.noTasksMatch")}
          </p>
        ) : (
          <>
            <div className="mb-4 print:hidden">
              <DashboardPager
                page={achPager.page}
                pageCount={achPager.pageCount}
                total={achPager.total}
                pageSize={achPager.pageSize}
                onPageChange={achPager.setPage}
              />
            </div>
            {pagedAchSections.sections.map((sec) =>
              sec.rows.length === 0 ? null : (
                <div key={sec.heading || "__all__"} className="mb-8">
                  {sec.heading ? (
                    <h3 className="mb-3 border-b border-zinc-200 pb-1 text-base font-semibold text-zinc-800 dark:border-zinc-700 dark:text-zinc-100">
                      {sec.heading}
                    </h3>
                  ) : null}
                  <ul className="flex flex-col gap-3">
                    {sec.rows.map((row) => (
                      <li key={row.task.id}>
                        <BragTaskCard row={row} />
                      </li>
                    ))}
                  </ul>
                </div>
              ),
            )}
          </>
        )}
      </section>
    </div>
  );
}
