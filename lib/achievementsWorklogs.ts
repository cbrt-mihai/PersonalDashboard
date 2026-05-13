import type { AchievementsFilters } from "@/lib/achievements";
import { escapeHtml, filterTasksForAchievements, normalizeDateRange } from "@/lib/achievements";
import { isArchived } from "@/lib/archive";
import { formatJiraDuration } from "@/lib/jiraDuration";
import { entryMatchesTagKeys } from "@/lib/noteTags";
import type { Owner, OwnerEntry, Project, Task, TaskGroup, Worklog } from "@/lib/schemas";
import type { StatusDef } from "@/lib/statusConfig";

const YMD = /^\d{4}-\d{2}-\d{2}$/;

function startedYmd(w: Worklog): string {
  return w.startedAt.trim().slice(0, 10);
}

function filterGroupsForWorklogContext(
  groups: TaskGroup[],
  filters: AchievementsFilters,
): TaskGroup[] {
  let g = groups;
  if (!filters.showArchived) g = g.filter((x) => !isArchived(x));
  if (filters.ownerIds.length) {
    g = g.filter((x) => filters.ownerIds.includes(x.ownerId));
  }
  if (filters.projectIds.length) {
    const set = new Set(filters.projectIds);
    g = g.filter((x) => {
      const pid = x.projectId;
      if (pid === null) return set.has("__no_project__");
      return set.has(pid);
    });
  }
  if (filters.epicIds.length) {
    g = g.filter((x) =>
      filters.epicIds.some((gid) => (gid === "__ungrouped__" ? false : gid === x.id)),
    );
  }
  return g;
}

function filterProjectsForWorklogContext(
  projects: Project[],
  filters: AchievementsFilters,
): Project[] {
  let p = projects;
  if (!filters.showArchived) p = p.filter((x) => !isArchived(x));
  if (filters.projectIds.length) {
    const set = new Set(filters.projectIds);
    p = p.filter((x) => set.has(x.id));
  }
  return p;
}

function filterOwnersForWorklogContext(
  owners: Owner[],
  filters: AchievementsFilters,
): Owner[] {
  let o = owners;
  if (!filters.showArchived) o = o.filter((x) => !isArchived(x));
  if (filters.ownerIds.length) {
    o = o.filter((x) => filters.ownerIds.includes(x.id));
  }
  return o;
}

function entryMatchesWorklogContext(e: OwnerEntry, filters: AchievementsFilters): boolean {
  if (!filters.showArchived && isArchived(e)) return false;
  if (filters.ownerIds.length) {
    if (!e.ownerId || !filters.ownerIds.includes(e.ownerId)) return false;
  }
  if (filters.projectIds.length) {
    const set = new Set(filters.projectIds);
    const pid = e.projectId;
    if (pid === null) {
      if (!set.has("__no_project__")) return false;
    } else if (!set.has(pid)) {
      return false;
    }
  }
  if (filters.tagKeys.length && !entryMatchesTagKeys(e.tags, filters.tagKeys)) {
    return false;
  }
  return true;
}

/**
 * Worklogs whose `startedAt` date falls in the achievements date range, and whose target
 * matches the same owner / project / epic / type / status / priority / tag / archived
 * context as tasks (task targets ignore task `date`; epic/project/owner/note use structural filters only).
 */
export function filterWorklogsForAchievements(
  worklogs: Worklog[],
  tasks: Task[],
  groups: TaskGroup[],
  projects: Project[],
  owners: Owner[],
  entries: OwnerEntry[],
  filters: AchievementsFilters,
  statusMap: Record<string, StatusDef>,
): Worklog[] {
  const { from, to } = normalizeDateRange(filters.from, filters.to);
  const noDateFilters: AchievementsFilters = { ...filters, from: "", to: "" };
  const contextTasks = filterTasksForAchievements(
    tasks,
    groups,
    projects,
    noDateFilters,
    statusMap,
    false,
  );
  const taskIdSet = new Set(contextTasks.map((t) => t.id));

  const contextGroups = filterGroupsForWorklogContext(groups, noDateFilters);
  const groupIdSet = new Set(contextGroups.map((g) => g.id));

  const contextProjects = filterProjectsForWorklogContext(projects, noDateFilters);
  const projectIdSet = new Set(contextProjects.map((p) => p.id));

  const contextOwners = filterOwnersForWorklogContext(owners, noDateFilters);
  const ownerIdSet = new Set(contextOwners.map((o) => o.id));

  const entryIdSet = new Set(
    entries.filter((e) => entryMatchesWorklogContext(e, noDateFilters)).map((e) => e.id),
  );

  return worklogs.filter((w) => {
    const d = startedYmd(w);
    if (from && YMD.test(from) && d < from) return false;
    if (to && YMD.test(to) && d > to) return false;
    switch (w.target.kind) {
      case "task":
        return taskIdSet.has(w.target.taskId);
      case "epic":
        return groupIdSet.has(w.target.groupId);
      case "project":
        return projectIdSet.has(w.target.projectId);
      case "owner":
        return ownerIdSet.has(w.target.ownerId);
      case "note":
        return entryIdSet.has(w.target.entryId);
      default:
        return false;
    }
  });
}

export type WorklogAchievementKindStats = {
  kind: Worklog["target"]["kind"];
  entries: number;
  minutes: number;
};

export function aggregateWorklogAchievementStats(logs: Worklog[]): {
  totalMinutes: number;
  entryCount: number;
  byKind: WorklogAchievementKindStats[];
} {
  let totalMinutes = 0;
  const byKindMap = new Map<Worklog["target"]["kind"], { entries: number; minutes: number }>();
  for (const w of logs) {
    totalMinutes += w.durationMinutes;
    const k = w.target.kind;
    const cur = byKindMap.get(k) ?? { entries: 0, minutes: 0 };
    cur.entries += 1;
    cur.minutes += w.durationMinutes;
    byKindMap.set(k, cur);
  }
  const order: Worklog["target"]["kind"][] = ["task", "epic", "project", "owner", "note"];
  const byKind: WorklogAchievementKindStats[] = order
    .filter((k) => byKindMap.has(k))
    .map((kind) => {
      const v = byKindMap.get(kind)!;
      return { kind, entries: v.entries, minutes: v.minutes };
    });
  return { totalMinutes, entryCount: logs.length, byKind };
}

const KIND_LABEL: Record<Worklog["target"]["kind"], string> = {
  task: "Task",
  epic: "Epic",
  project: "Project",
  owner: "Owner",
  note: "Note",
};

export const WORKLOG_KIND_LABEL = KIND_LABEL;

/** Standalone HTML fragment for achievements export (reuses export-summary styles). */
export function buildAchievementsWorklogSummaryHtml(opts: {
  from: string;
  to: string;
  totalMinutes: number;
  entryCount: number;
  byKind: WorklogAchievementKindStats[];
  minutesPerDay: number;
}): string {
  const { from, to, totalMinutes, entryCount, byKind, minutesPerDay } = opts;
  const jiraOpts = { minutesPerDay };
  const totalJira = formatJiraDuration(totalMinutes, jiraOpts);

  if (entryCount === 0) {
    return `<section class="export-summary export-worklog-summary" aria-labelledby="export-worklog-heading">
  <h2 id="export-worklog-heading" class="export-summary__title">Worklogs</h2>
  <p class="export-summary__lead">No worklogs with a start date in <strong>${escapeHtml(from)}</strong>–<strong>${escapeHtml(to)}</strong> matched these filters (or none were logged).</p>
</section>`;
  }

  const rows = byKind
    .map(
      (r) =>
        `<tr><td>${escapeHtml(KIND_LABEL[r.kind])}</td><td class="export-summary__num">${r.entries}</td><td class="export-summary__num">${escapeHtml(formatJiraDuration(r.minutes, jiraOpts))}</td></tr>`,
    )
    .join("");

  return `<section class="export-summary export-worklog-summary" aria-labelledby="export-worklog-heading">
  <h2 id="export-worklog-heading" class="export-summary__title">Worklogs</h2>
  <p class="export-summary__lead">Time logged on targets that match your filters. Start dates fall within <strong>${escapeHtml(from)}</strong>–<strong>${escapeHtml(to)}</strong> (same range as task dates above). Task-type worklogs use tasks that match type, status, priority, and tags, ignoring each task’s own date field.</p>
  <div class="export-summary__grid" style="margin-top:0.75rem">
    <div class="export-summary__card">
      <span class="export-summary__value">${escapeHtml(String(entryCount))}</span>
      <span class="export-summary__label">Worklog entries</span>
    </div>
    <div class="export-summary__card">
      <span class="export-summary__value">${escapeHtml(totalJira)}</span>
      <span class="export-summary__label">Total time</span>
    </div>
  </div>
  <h3 class="export-summary__h3" style="margin-top:1rem">By target</h3>
  <table class="export-summary__table"><thead><tr><th>Target</th><th>Entries</th><th>Time</th></tr></thead><tbody>${rows}</tbody></table>
</section>`;
}
