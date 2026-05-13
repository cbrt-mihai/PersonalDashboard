import type { Owner, Project, Task, TaskGroup } from "@/lib/schemas";
import { isArchived } from "@/lib/archive";
import { entryMatchesTagKeys } from "@/lib/noteTags";
import { markdownExcerpt } from "@/lib/markdownExcerpt";
import {
  TASK_FORM_PRIORITIES,
  TASK_FORM_TYPES,
  canonicalPriorityLabel,
  canonicalTaskTypeLabel,
} from "@/lib/taskFormOptions";
import {
  isTerminalStatus,
  normalizeStatusKey,
  statusDef,
  type StatusDef,
} from "@/lib/statusConfig";

const YMD = /^\d{4}-\d{2}-\d{2}$/;

export type BragGroupBy = "none" | "owner" | "project" | "epic";

export type AchievementsFilters = {
  from: string;
  to: string;
  ownerIds: string[];
  projectIds: string[];
  epicIds: string[];
  types: string[];
  priorities: string[];
  statuses: string[];
  tagKeys: string[];
  showArchived: boolean;
};

export type BragTaskRow = {
  task: Task;
  ownerName: string;
  projectName: string | null;
  epicName: string | null;
};

export function defaultAchievementsDateRange(): { from: string; to: string } {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const pad = (n: number) => String(n).padStart(2, "0");
  const to = `${y}-${pad(m + 1)}-${pad(now.getDate())}`;
  const from = `${y}-${pad(m + 1)}-01`;
  return { from, to };
}

/** Inclusive YYYY-MM-DD range; swaps if reversed. */
export function normalizeDateRange(from: string, to: string): { from: string; to: string } {
  const a = from.trim().slice(0, 10);
  const b = to.trim().slice(0, 10);
  if (YMD.test(a) && YMD.test(b) && a > b) return { from: b, to: a };
  return { from: a, to: b };
}

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Safe embedding of JSON inside `<script type="application/json">`. */
function escapeJsonForHtmlScript(json: string): string {
  return json
    .replace(/</g, "\\u003c")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

export function enrichBragRows(
  tasks: Task[],
  owners: Owner[],
  groups: TaskGroup[],
  projects: Project[],
): BragTaskRow[] {
  const ownerById = new Map(owners.map((p) => [p.id, p] as const));
  const groupById = new Map(groups.map((g) => [g.id, g] as const));
  const projectById = new Map(projects.map((p) => [p.id, p] as const));

  return tasks.map((task) => {
    const ownerName = ownerById.get(task.ownerId)?.name ?? task.ownerId;
    const g = task.groupId ? groupById.get(task.groupId) : undefined;
    const pid = g?.projectId ?? null;
    const projectName = pid ? projectById.get(pid)?.name ?? null : null;
    const epicName = g?.name ?? null;
    return { task, ownerName, projectName, epicName };
  });
}

export function filterTasksForAchievements(
  tasks: Task[],
  groups: TaskGroup[],
  projects: Project[],
  filters: AchievementsFilters,
  statusMap: Record<string, StatusDef>,
  /** When true, keep only tasks whose status is terminal per `statusMap`. */
  terminalOnly = false,
): Task[] {
  const { from, to } = normalizeDateRange(filters.from, filters.to);
  let t = tasks;

  if (!filters.showArchived) t = t.filter((x) => !isArchived(x));

  if (filters.ownerIds.length) {
    t = t.filter((x) => filters.ownerIds.includes(x.ownerId));
  }

  if (filters.projectIds.length) {
    const projectIdSet = new Set(filters.projectIds);
    const groupById = new Map(groups.map((g) => [g.id, g] as const));
    t = t.filter((x) => {
      const gid = x.groupId;
      const pid = gid ? groupById.get(gid)?.projectId ?? null : null;
      if (pid === null) return projectIdSet.has("__no_project__");
      return projectIdSet.has(pid);
    });
  }

  if (filters.epicIds.length) {
    t = t.filter((x) =>
      filters.epicIds.some((gid) =>
        gid === "__ungrouped__" ? x.groupId === null : x.groupId === gid,
      ),
    );
  }

  if (filters.types.length) {
    t = t.filter((x) => filters.types.includes(x.type));
  }

  if (filters.statuses.length) {
    t = t.filter((x) => filters.statuses.includes(normalizeStatusKey(x.status)));
  }

  if (filters.priorities.length) {
    const pls = new Set(filters.priorities.map((p) => p.trim().toLowerCase()));
    t = t.filter((x) => pls.has(x.priority.trim().toLowerCase()));
  }

  if (filters.tagKeys.length) {
    t = t.filter((x) => entryMatchesTagKeys(x.tags, filters.tagKeys));
  }

  if (from || to) {
    t = t.filter((x) => {
      const d = x.date.trim().slice(0, 10);
      if (!YMD.test(d)) return false;
      if (from && d < from) return false;
      if (to && d > to) return false;
      return true;
    });
  }

  if (terminalOnly) {
    t = t.filter((x) => isTerminalStatus(x.status, statusMap));
  }

  return t;
}

export function sortBragRows(rows: BragTaskRow[]): BragTaskRow[] {
  return [...rows].sort((a, b) => {
    const da = b.task.date.localeCompare(a.task.date);
    if (da !== 0) return da;
    return a.task.name.localeCompare(b.task.name);
  });
}

function groupSortKey(row: BragTaskRow, groupBy: BragGroupBy): string {
  switch (groupBy) {
    case "owner":
      return row.ownerName;
    case "project":
      return row.projectName ?? "No project";
    case "epic":
      return row.epicName ?? "Ungrouped";
    default:
      return "";
  }
}

export function groupBragRows(
  rows: BragTaskRow[],
  groupBy: BragGroupBy,
): { heading: string; rows: BragTaskRow[] }[] {
  if (groupBy === "none") {
    return [{ heading: "", rows: sortBragRows(rows) }];
  }
  const m = new Map<string, BragTaskRow[]>();
  for (const row of rows) {
    const k = groupSortKey(row, groupBy);
    const list = m.get(k) ?? [];
    list.push(row);
    m.set(k, list);
  }
  return [...m.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([heading, r]) => ({ heading, rows: sortBragRows(r) }));
}

function formatIsoDateForExport(iso: string): string {
  if (!YMD.test(iso)) return iso;
  const [ys, ms, ds] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(ys, (ms ?? 1) - 1, ds ?? 1));
  return dt.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

function incrementMap(m: Map<string, number>, key: string, by = 1): void {
  m.set(key, (m.get(key) ?? 0) + by);
}

/** Compact row payload for client-side summary refresh (keep keys short for JSON size). */
export type AchievementsExportRowSlice = {
  s: string;
  ty: string;
  pr: string;
  sk: string;
  sl: string;
  term: boolean;
  pi: string;
  pm: string | null;
  el: string | null;
  gid: string | null;
  hd: boolean;
  tg: string[];
  stt: number;
  std: number;
  dt: string | null;
};

export function buildAchievementsExportRowSlices(
  rows: BragTaskRow[],
  statusMap: Record<string, StatusDef>,
  knownTaskTypes: readonly string[],
  knownPriorities: readonly string[],
): AchievementsExportRowSlice[] {
  return rows.map((row) => {
    const { task, projectName, epicName } = row;
    const st = statusDef(task.status, statusMap);
    const typeLabel = canonicalTaskTypeLabel(task.type, knownTaskTypes);
    const priorityLabel = canonicalPriorityLabel(task.priority, knownPriorities);
    const excerpt = markdownExcerpt(task.description ?? "", 280);
    const searchBlob = [
      task.name,
      row.ownerName,
      row.projectName ?? "",
      row.epicName ?? "",
      typeLabel,
      task.type,
      st.label,
      priorityLabel,
      task.priority,
      task.date,
      excerpt,
      ...(task.tags ?? []),
    ]
      .join(" ")
      .toLowerCase();
    const subs = task.subtasks ?? [];
    let std = 0;
    for (const x of subs) {
      if (x.done) std++;
    }
    const d = task.date.trim().slice(0, 10);
    return {
      s: searchBlob,
      ty: typeLabel,
      pr: priorityLabel,
      sk: normalizeStatusKey(task.status),
      sl: st.label,
      term: isTerminalStatus(task.status, statusMap),
      pi: task.ownerId,
      pm: projectName,
      el: task.groupId ? (epicName?.trim() ? epicName : "Epic") : null,
      gid: task.groupId,
      hd: (task.description ?? "").trim().length > 0,
      tg: task.tags ?? [],
      stt: subs.length,
      std,
      dt: YMD.test(d) ? d : null,
    };
  });
}

export type AchievementsSummaryComputation = {
  n: number;
  terminal: number;
  ownerCount: number;
  projectCount: number;
  epicCount: number;
  tasksLinkedToEpic: number;
  tasksWithProject: number;
  tasksWithDate: number;
  withDescription: number;
  tasksWithTags: number;
  uniqueTagCount: number;
  /** Total tag entries across tasks (lengths of tag arrays summed). */
  tagAssignmentCount: number;
  tasksWithChecklist: number;
  subtasksTotal: number;
  subtasksDone: number;
  avgPerOwner: string;
  dateMin: string | null;
  dateMax: string | null;
  monthDistinctCount: number;
  typeRows: [string, number][];
  priorityRows: [string, number][];
  statusRows: [string, number][];
};

export function computeAchievementsSummaryComputation(
  rows: BragTaskRow[],
  statusMap: Record<string, StatusDef>,
  knownTaskTypes: readonly string[],
  knownPriorities: readonly string[],
): AchievementsSummaryComputation {
  const ownerIds = new Set<string>();
  const projectNames = new Set<string>();
  const epicLabels = new Set<string>();
  let terminal = 0;
  let subtasksTotal = 0;
  let subtasksDone = 0;
  let withDescription = 0;
  let tasksWithTags = 0;
  const uniqueTags = new Set<string>();
  let tagAssignmentCount = 0;
  let tasksWithChecklist = 0;
  const typeCounts = new Map<string, number>();
  const priorityCounts = new Map<string, number>();
  const statusLabelCounts = new Map<string, number>();
  const validDates: string[] = [];
  const monthKeys = new Set<string>();
  let tasksLinkedToEpic = 0;
  let tasksWithProject = 0;
  let tasksWithDate = 0;

  for (const row of rows) {
    const { task, projectName, epicName } = row;
    ownerIds.add(task.ownerId);
    if (projectName) {
      tasksWithProject++;
      projectNames.add(projectName);
    }
    if (task.groupId) {
      tasksLinkedToEpic++;
      epicLabels.add(epicName?.trim() ? epicName : "Epic");
    }
    if (isTerminalStatus(task.status, statusMap)) terminal++;
    const st = statusDef(task.status, statusMap);
    incrementMap(statusLabelCounts, st.label);
    incrementMap(typeCounts, canonicalTaskTypeLabel(task.type, knownTaskTypes));
    incrementMap(priorityCounts, canonicalPriorityLabel(task.priority, knownPriorities));
    if ((task.description ?? "").trim().length > 0) withDescription++;
    const tags = task.tags ?? [];
    if (tags.length > 0) {
      tasksWithTags++;
      for (const tg of tags) {
        uniqueTags.add(tg);
        tagAssignmentCount++;
      }
    }
    const subs = task.subtasks ?? [];
    if (subs.length > 0) tasksWithChecklist++;
    for (const sub of subs) {
      subtasksTotal++;
      if (sub.done) subtasksDone++;
    }
    const d = task.date.trim().slice(0, 10);
    if (YMD.test(d)) {
      tasksWithDate++;
      validDates.push(d);
      monthKeys.add(d.slice(0, 7));
    }
  }

  validDates.sort();
  const dateMin = validDates[0] ?? null;
  const dateMax = validDates[validDates.length - 1] ?? null;
  const n = rows.length;
  const avgPerOwner =
    ownerIds.size > 0 ? (n / ownerIds.size).toFixed(1) : String(n);
  const typeRows = [...typeCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6);
  const priorityRows = [...priorityCounts.entries()].sort((a, b) => b[1] - a[1]);
  const statusRows = [...statusLabelCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12);

  return {
    n,
    terminal,
    ownerCount: ownerIds.size,
    projectCount: projectNames.size,
    epicCount: epicLabels.size,
    tasksLinkedToEpic,
    tasksWithProject,
    tasksWithDate,
    withDescription,
    tasksWithTags,
    uniqueTagCount: uniqueTags.size,
    tagAssignmentCount,
    tasksWithChecklist,
    subtasksTotal,
    subtasksDone,
    avgPerOwner,
    dateMin,
    dateMax,
    monthDistinctCount: monthKeys.size,
    typeRows,
    priorityRows,
    statusRows,
  };
}

function renderAchievementsSummaryHtml(comp: AchievementsSummaryComputation): string {
  const n = comp.n;
  const terminal = comp.terminal;
  const otherStatus = n - terminal;
  const terminalPct = n > 0 ? Math.round((terminal / n) * 100) : 0;
  const otherPct = n > 0 ? Math.round((otherStatus / n) * 100) : 0;
  const subtaskPct =
    comp.subtasksTotal > 0 ? Math.round((comp.subtasksDone / comp.subtasksTotal) * 100) : null;
  const pctOf = (count: number) => (n > 0 ? Math.round((count / n) * 100) : 0);
  const datedPct = pctOf(comp.tasksWithDate);
  const projectTasksPct = pctOf(comp.tasksWithProject);
  const descPct = pctOf(comp.withDescription);
  const epicLinkPct = pctOf(comp.tasksLinkedToEpic);
  const taggedPct = pctOf(comp.tasksWithTags);

  const datedPctNote =
    n > 0
      ? ` <span class="export-summary__pct">(<span id="exp-sum-dated-pct">${datedPct}</span>% of tasks have a date)</span>`
      : "";

  const timeSpanHtml =
    comp.dateMin && comp.dateMax
      ? comp.dateMin === comp.dateMax
        ? `<p id="exp-sum-dates" class="export-summary__span"><strong>Task dates in this view:</strong> ${escapeHtml(formatIsoDateForExport(comp.dateMin))}${datedPctNote}</p>`
        : `<p id="exp-sum-dates" class="export-summary__span"><strong>Task dates in this view:</strong> ${escapeHtml(formatIsoDateForExport(comp.dateMin))} — ${escapeHtml(formatIsoDateForExport(comp.dateMax))}${datedPctNote}</p>`
      : `<p id="exp-sum-dates" class="export-summary__span" hidden></p>`;

  const monthLine =
    comp.monthDistinctCount > 0
      ? `<p id="exp-sum-months" class="export-summary__muted">${escapeHtml(String(comp.monthDistinctCount))} distinct calendar months with dated work</p>`
      : `<p id="exp-sum-months" class="export-summary__muted" hidden></p>`;

  const checklistTasksPct = pctOf(comp.tasksWithChecklist);
  const subtaskLine =
    comp.subtasksTotal > 0
      ? `<div id="exp-sum-subtasks-card" class="export-summary__card">
  <span class="export-summary__value"><span id="exp-sum-st-done">${comp.subtasksDone}</span> / <span id="exp-sum-st-total">${comp.subtasksTotal}</span></span>
  <span class="export-summary__label">Checklist items done</span>
  <span class="export-summary__sub"><span id="exp-sum-st-pct">${escapeHtml(String(subtaskPct))}</span>% of checklist rows complete <span class="export-summary__pct">(<span id="exp-sum-st-of-tasks-pct">${checklistTasksPct}</span>% of tasks have a checklist)</span></span>
</div>`
      : `<div id="exp-sum-subtasks-card" class="export-summary__card" hidden></div>`;

  const typeRowsHtml = comp.typeRows
    .map(([label, count]) => {
      const pct = pctOf(count);
      return `<tr><td>${escapeHtml(label)}</td><td class="export-summary__num">${count} <span class="export-summary__pct">(${pct}%)</span></td></tr>`;
    })
    .join("");

  const priorityRowsHtml = comp.priorityRows
    .map(([label, count]) => {
      const pct = pctOf(count);
      return `<tr><td>${escapeHtml(label)}</td><td class="export-summary__num">${count} <span class="export-summary__pct">(${pct}%)</span></td></tr>`;
    })
    .join("");

  const distinctTagUsePct =
    comp.tagAssignmentCount > 0
      ? Math.round((comp.uniqueTagCount / comp.tagAssignmentCount) * 100)
      : 0;

  const statusRowsHtml = comp.statusRows
    .map(([label, count]) => {
      const pct = n > 0 ? Math.round((count / n) * 100) : 0;
      return `<tr><td>${escapeHtml(label)}</td><td class="export-summary__num">${count} <span class="export-summary__pct">(${pct}%)</span></td></tr>`;
    })
    .join("");

  const workflowBar = `<div class="export-summary__workflow" role="img" aria-label="Terminal vs other statuses in current view">
  <div class="export-summary__workflow-track">
    <span id="exp-sum-wf-done" class="export-summary__workflow-done" style="width:${terminalPct}%"></span>
    <span id="exp-sum-wf-rest" class="export-summary__workflow-rest" style="width:${100 - terminalPct}%"></span>
  </div>
  <div class="export-summary__workflow-legend">
    <span id="exp-sum-wf-leg-a"><i class="export-summary__dot export-summary__dot--done"></i>Terminal (<span id="exp-sum-wf-term-n">${terminal}</span>, <span id="exp-sum-wf-term-pct">${terminalPct}</span>%)</span>
    <span id="exp-sum-wf-leg-b"><i class="export-summary__dot export-summary__dot--rest"></i>Not terminal (<span id="exp-sum-wf-other-n">${otherStatus}</span>, <span id="exp-sum-wf-other-pct">${otherPct}</span>%)</span>
  </div>
</div>`;

  return `<section id="export-summary-root" class="export-summary" aria-labelledby="export-summary-heading">
  <h2 id="export-summary-heading" class="export-summary__title">Summary</h2>
  <p id="exp-sum-lead" class="export-summary__lead">Updates when you switch tabs or change search, type, priority, or status filters. Useful for retrospectives, capacity planning, and stakeholder updates.</p>
  <p id="exp-sum-hint" class="export-summary__scope-note" hidden></p>
  ${timeSpanHtml}
  ${monthLine}

  <div class="export-summary__grid">
    <div class="export-summary__card">
      <span id="exp-sum-n" class="export-summary__value">${n}</span>
      <span class="export-summary__label">Tasks in this view</span>
    </div>
    <div class="export-summary__card">
      <span id="exp-sum-owners" class="export-summary__value">${comp.ownerCount}</span>
      <span class="export-summary__label">Owners</span>
      <span class="export-summary__sub">~<span id="exp-sum-owner-avg">${escapeHtml(comp.avgPerOwner)}</span> tasks / owner</span>
    </div>
    <div class="export-summary__card">
      <span id="exp-sum-projects" class="export-summary__value">${comp.projectCount}</span>
      <span class="export-summary__label">Projects represented</span>
      <span class="export-summary__sub"><span id="exp-sum-project-tasks">${comp.tasksWithProject}</span> tasks name a project <span class="export-summary__pct">(<span id="exp-sum-project-pct">${projectTasksPct}</span>%)</span></span>
    </div>
    <div class="export-summary__card">
      <span id="exp-sum-epics" class="export-summary__value">${comp.epicCount}</span>
      <span class="export-summary__label">Epics or work packages</span>
      <span class="export-summary__sub"><span id="exp-sum-epic-tasks">${comp.tasksLinkedToEpic}</span> tasks linked to an epic <span class="export-summary__pct">(<span id="exp-sum-epic-pct">${epicLinkPct}</span>%)</span></span>
    </div>
    <div class="export-summary__card">
      <span id="exp-sum-desc" class="export-summary__value">${comp.withDescription}</span>
      <span class="export-summary__label">Tasks with written details</span>
      <span class="export-summary__sub"><span class="export-summary__pct">(<span id="exp-sum-desc-pct">${descPct}</span>% of tasks)</span></span>
    </div>
    <div class="export-summary__card">
      <span id="exp-sum-uniq-tags" class="export-summary__value">${comp.uniqueTagCount}</span>
      <span class="export-summary__label">Unique tags</span>
      <span class="export-summary__sub"><span id="exp-sum-tagged-tasks">${comp.tasksWithTags}</span> tasks with tags <span class="export-summary__pct">(<span id="exp-sum-tagged-pct">${taggedPct}</span>%)</span><span id="exp-sum-tags-distinct-wrap" class="export-summary__pct"${comp.tagAssignmentCount === 0 ? " hidden" : ""}> · <span id="exp-sum-tags-distinct-pct">${distinctTagUsePct}</span>% distinct vs total tag uses</span></span>
    </div>
    ${subtaskLine}
  </div>

  <div class="export-summary__split">
    <div>
      <h3 class="export-summary__h3">Workflow mix</h3>
      <div id="exp-sum-workflow-wrap">${workflowBar}</div>
    </div>
    <div>
      <h3 class="export-summary__h3">Status breakdown</h3>
      <table class="export-summary__table"><tbody id="exp-sum-status-tbody">${statusRowsHtml}</tbody></table>
    </div>
  </div>

  <div class="export-summary__split">
    <div>
      <h3 class="export-summary__h3">Work types (top)</h3>
      <table class="export-summary__table"><tbody id="exp-sum-type-tbody">${typeRowsHtml}</tbody></table>
    </div>
    <div>
      <h3 class="export-summary__h3">Priorities</h3>
      <table class="export-summary__table"><tbody id="exp-sum-priority-tbody">${priorityRowsHtml}</tbody></table>
    </div>
  </div>
</section>`;
}

/** Rich figures for the standalone HTML export (neutral copy for internal reviews). */
function buildAchievementsSummaryPanelHtml(
  rows: BragTaskRow[],
  statusMap: Record<string, StatusDef>,
  knownTaskTypes: readonly string[],
  knownPriorities: readonly string[],
): string {
  if (rows.length === 0) return "";
  return renderAchievementsSummaryHtml(
    computeAchievementsSummaryComputation(rows, statusMap, knownTaskTypes, knownPriorities),
  );
}

export function buildAchievementsHtmlDocument(opts: {
  title: string;
  subtitle: string;
  generatedAtIso: string;
  /** Terminal-only tasks (first tab), same grouping as second tab. */
  sections: { heading: string; rows: BragTaskRow[] }[];
  statusMap: Record<string, StatusDef>;
  /** Labels from Settings → Task types; used to merge casing variants (e.g. task / Task) in export stats. */
  taskTypeLabels?: string[];
  /** Labels from Settings → Task priorities; merges casing (e.g. low → Low). */
  taskPriorityLabels?: string[];
  /** All matching tasks (second tab), same `groupBy` as `sections`. */
  sectionsAllStatuses?: { heading: string; rows: BragTaskRow[] }[] | null;
  /** Optional HTML block (e.g. worklog stats) inserted after the task summary panel. */
  worklogSummaryHtml?: string | null;
}): string {
  const {
    title,
    subtitle,
    generatedAtIso,
    sections,
    statusMap,
    taskTypeLabels,
    taskPriorityLabels,
    sectionsAllStatuses = null,
    worklogSummaryHtml = null,
  } = opts;

  const knownTaskTypes =
    taskTypeLabels && taskTypeLabels.length > 0 ? taskTypeLabels : [...TASK_FORM_TYPES];
  const knownPriorities =
    taskPriorityLabels && taskPriorityLabels.length > 0
      ? taskPriorityLabels
      : [...TASK_FORM_PRIORITIES];

  const allRowsTerminal = sections.flatMap((s) => s.rows);
  const allRowsFull = sectionsAllStatuses?.flatMap((s) => s.rows) ?? [];
  const summaryRows =
    allRowsTerminal.length > 0 ? allRowsTerminal : allRowsFull.length > 0 ? allRowsFull : [];
  const summaryPanelHtml =
    summaryRows.length > 0
      ? buildAchievementsSummaryPanelHtml(
          summaryRows,
          statusMap,
          knownTaskTypes,
          knownPriorities,
        )
      : "";

  const terminalSlices = buildAchievementsExportRowSlices(
    allRowsTerminal,
    statusMap,
    knownTaskTypes,
    knownPriorities,
  );
  const allSlices = buildAchievementsExportRowSlices(
    allRowsFull,
    statusMap,
    knownTaskTypes,
    knownPriorities,
  );
  const slicesJson = escapeJsonForHtmlScript(
    JSON.stringify({ terminal: terminalSlices, all: allSlices }),
  );

  const totalTasks = sections.reduce((n, s) => n + s.rows.length, 0);
  const sectionCount =
    sections.filter((s) => s.rows.length > 0).length ||
    (sectionsAllStatuses?.filter((s) => s.rows.length > 0).length ?? 0);
  const sectionsHaveCollapsibleHeadings = (secs: { heading: string; rows: BragTaskRow[] }[]) =>
    secs.some((s) => s.heading && s.rows.length > 0);
  const hasCollapsibleSections =
    sectionsHaveCollapsibleHeadings(sections) ||
    Boolean(sectionsAllStatuses?.length && sectionsAllStatuses.some((s) => s.heading && s.rows.length > 0));

  const allTabRowCount =
    sectionsAllStatuses?.reduce((n, s) => n + s.rows.length, 0) ?? 0;
  const useDualTaskTabs = Boolean(sectionsAllStatuses && allTabRowCount > 0);

  const css = `
    @import url("https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;1,9..40,400&display=swap");

    :root {
      color-scheme: light;
      --font: "DM Sans", ui-sans-serif, system-ui, sans-serif;
      --bg0: #f4f4f8;
      --bg1: #e8e4f0;
      --surface: rgba(255, 255, 255, 0.82);
      --surface-solid: #ffffff;
      --border: rgba(24, 24, 27, 0.1);
      --text: #18181b;
      --muted: #52525b;
      --faint: #71717a;
      --accent: #6366f1;
      --accent-soft: rgba(99, 102, 241, 0.15);
      --shadow: 0 4px 24px -4px rgba(15, 23, 42, 0.12), 0 0 0 1px rgba(15, 23, 42, 0.04);
      --shadow-hover: 0 12px 40px -8px rgba(15, 23, 42, 0.18), 0 0 0 1px rgba(99, 102, 241, 0.12);
      --radius: 14px;
      --radius-sm: 10px;
    }

    [data-theme="dark"] {
      color-scheme: dark;
      --bg0: #0f0f12;
      --bg1: #1a1525;
      --surface: rgba(30, 30, 36, 0.75);
      --surface-solid: #1e1e24;
      --border: rgba(255, 255, 255, 0.08);
      --text: #f4f4f5;
      --muted: #a1a1aa;
      --faint: #71717a;
      --accent: #a5b4fc;
      --accent-soft: rgba(165, 180, 252, 0.12);
      --shadow: 0 4px 28px -6px rgba(0, 0, 0, 0.45), 0 0 0 1px rgba(255, 255, 255, 0.06);
      --shadow-hover: 0 14px 48px -10px rgba(0, 0, 0, 0.55), 0 0 0 1px rgba(165, 180, 252, 0.15);
    }

    *, *::before, *::after { box-sizing: border-box; }

    html {
      font-family: var(--font);
      color: var(--text);
      background: var(--bg0);
      scroll-behavior: smooth;
    }

    body {
      margin: 0;
      min-height: 100vh;
      background:
        radial-gradient(1200px 600px at 10% -10%, rgba(99, 102, 241, 0.18), transparent 55%),
        radial-gradient(900px 500px at 100% 0%, rgba(236, 72, 153, 0.12), transparent 50%),
        linear-gradient(165deg, var(--bg0), var(--bg1));
      background-attachment: fixed;
    }

    [data-theme="dark"] body {
      background:
        radial-gradient(1000px 500px at 15% -5%, rgba(99, 102, 241, 0.22), transparent 50%),
        radial-gradient(800px 400px at 95% 5%, rgba(192, 132, 252, 0.1), transparent 45%),
        linear-gradient(165deg, var(--bg0), var(--bg1));
    }

    .wrap {
      max-width: 52rem;
      margin: 0 auto;
      padding: 1.25rem 1.25rem 4rem;
    }

    @media (min-width: 640px) {
      .wrap { padding: 2rem 1.5rem 5rem; }
    }

    .sr-only {
      position: absolute;
      width: 1px;
      height: 1px;
      padding: 0;
      margin: -1px;
      overflow: hidden;
      clip: rect(0, 0, 0, 0);
      white-space: nowrap;
      border: 0;
    }

    .brag-hero {
      position: relative;
      border-radius: calc(var(--radius) + 4px);
      padding: 1px;
      margin-bottom: 1.25rem;
      background: linear-gradient(135deg, rgba(99, 102, 241, 0.55), rgba(236, 72, 153, 0.35), rgba(34, 211, 238, 0.35));
      box-shadow: var(--shadow);
    }

    .brag-hero__inner {
      border-radius: var(--radius);
      padding: 1.35rem 1.35rem 1.2rem;
      background: var(--surface);
      backdrop-filter: blur(14px);
      -webkit-backdrop-filter: blur(14px);
    }

    @media (min-width: 640px) {
      .brag-hero__inner { padding: 1.75rem 1.85rem 1.5rem; }
    }

    .brag-hero h1 {
      font-size: clamp(1.65rem, 4vw, 2.1rem);
      font-weight: 700;
      letter-spacing: -0.03em;
      margin: 0 0 0.4rem;
      line-height: 1.15;
    }

    .brag-hero .sub {
      color: var(--muted);
      font-size: 0.95rem;
      margin: 0 0 1rem;
      line-height: 1.45;
    }

    .brag-hero__stats {
      display: flex;
      flex-wrap: wrap;
      gap: 0.65rem 1.1rem;
      align-items: center;
    }

    .stat {
      display: inline-flex;
      align-items: baseline;
      gap: 0.35rem;
      font-size: 0.8rem;
      color: var(--muted);
    }

    .stat__num {
      font-weight: 700;
      font-size: 1.15rem;
      color: var(--accent);
      font-variant-numeric: tabular-nums;
    }

    .meta {
      font-size: 0.78rem;
      color: var(--faint);
      margin: 0.85rem 0 0;
      line-height: 1.5;
    }

    .export-summary {
      margin-bottom: 1.5rem;
      padding: 1.15rem 1.2rem 1.25rem;
      border-radius: var(--radius-sm);
      border: 1px solid var(--border);
      background: var(--surface);
      box-shadow: var(--shadow);
    }

    .export-summary__title {
      font-size: 1.05rem;
      font-weight: 700;
      margin: 0 0 0.4rem;
      letter-spacing: -0.02em;
    }

    .export-summary__lead {
      font-size: 0.82rem;
      color: var(--muted);
      margin: 0 0 0.65rem;
      line-height: 1.45;
    }

    .export-summary__span {
      font-size: 0.84rem;
      margin: 0 0 0.25rem;
      color: var(--text);
    }

    .export-summary__muted {
      font-size: 0.78rem;
      color: var(--faint);
      margin: 0 0 0.85rem;
    }

    .export-summary__grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 0.55rem;
      margin: 0.85rem 0 1rem;
    }

    @media (min-width: 640px) {
      .export-summary__grid {
        grid-template-columns: repeat(auto-fill, minmax(9.5rem, 1fr));
      }
    }

    .export-summary__card {
      border-radius: 10px;
      border: 1px solid var(--border);
      background: var(--surface-solid);
      padding: 0.65rem 0.75rem;
      display: flex;
      flex-direction: column;
      gap: 0.15rem;
      min-height: 4.5rem;
    }

    .export-summary__value {
      font-size: 1.35rem;
      font-weight: 700;
      color: var(--accent);
      font-variant-numeric: tabular-nums;
      line-height: 1.1;
    }

    .export-summary__label {
      font-size: 0.72rem;
      font-weight: 600;
      color: var(--muted);
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }

    .export-summary__sub {
      font-size: 0.72rem;
      color: var(--faint);
      margin-top: auto;
    }

    .export-summary__split {
      display: grid;
      gap: 1rem;
      margin-top: 1rem;
    }

    @media (min-width: 640px) {
      .export-summary__split {
        grid-template-columns: 1fr 1fr;
        align-items: start;
      }
    }

    .export-summary__h3 {
      font-size: 0.8rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--muted);
      margin: 0 0 0.5rem;
    }

    .export-summary__workflow-track {
      display: flex;
      height: 10px;
      border-radius: 999px;
      overflow: hidden;
      background: var(--border);
    }

    .export-summary__workflow-done {
      background: linear-gradient(90deg, #22c55e, #4ade80);
      min-width: 4px;
    }

    .export-summary__workflow-rest {
      background: var(--accent-soft);
      flex: 1;
      min-width: 4px;
    }

    .export-summary__workflow-legend {
      display: flex;
      flex-wrap: wrap;
      gap: 0.65rem 1rem;
      margin-top: 0.45rem;
      font-size: 0.75rem;
      color: var(--muted);
    }

    .export-summary__dot {
      display: inline-block;
      width: 0.45rem;
      height: 0.45rem;
      border-radius: 50%;
      margin-right: 0.25rem;
      vertical-align: middle;
    }

    .export-summary__dot--done { background: #22c55e; }
    .export-summary__dot--rest { background: var(--accent); opacity: 0.5; }

    .export-summary__table {
      width: 100%;
      font-size: 0.8rem;
      border-collapse: collapse;
    }

    .export-summary__table td {
      padding: 0.35rem 0.4rem 0.35rem 0;
      border-bottom: 1px solid var(--border);
      color: var(--text);
    }

    .export-summary__table tr:last-child td { border-bottom: none; }

    .export-summary__num {
      text-align: right;
      font-variant-numeric: tabular-nums;
      font-weight: 600;
      white-space: nowrap;
    }

    .export-summary__pct {
      font-weight: 400;
      color: var(--faint);
      font-size: 0.75rem;
    }

    .export-summary__scope-note {
      font-size: 0.8rem;
      line-height: 1.45;
      color: var(--muted);
      margin: 0 0 0.65rem;
      padding: 0.55rem 0.65rem;
      border-radius: 8px;
      background: var(--accent-soft);
      border: 1px solid var(--border);
    }

    /* Achievements export — worklog breakdown (swatches, aligned tables) */
    .export-worklog-summary {
      margin-top: 1.75rem;
      padding-top: 1.25rem;
      border-top: 1px solid var(--border);
    }
    .export-worklog-hero {
      position: relative;
      padding: 1rem 1.1rem 1.15rem;
      border-radius: 14px;
      background: linear-gradient(135deg, var(--accent-soft) 0%, var(--surface) 55%, var(--surface-solid) 100%);
      border: 1px solid var(--border);
      box-shadow: var(--shadow);
      overflow: hidden;
    }
    .export-worklog-hero::before {
      content: "";
      position: absolute;
      inset: 0 0 auto 0;
      height: 4px;
      background: linear-gradient(90deg, var(--accent), #a855f7, #22c55e);
      opacity: 0.85;
    }
    .export-worklog-hero__title {
      margin: 0.35rem 0 0.5rem;
      font-size: 1.15rem;
      font-weight: 700;
      letter-spacing: -0.02em;
      color: var(--text);
    }
    .export-worklog-hero__lead {
      margin: 0 0 0.85rem;
      font-size: 0.82rem;
      line-height: 1.5;
      color: var(--muted);
      max-width: 58rem;
    }
    .export-worklog-hero__stats {
      margin-top: 0 !important;
    }
    .export-worklog-stat-card--accent {
      border-color: color-mix(in srgb, var(--accent) 35%, var(--border));
      background: color-mix(in srgb, var(--accent-soft) 55%, var(--surface-solid));
    }
    .export-worklog-rollup-grid {
      display: grid;
      grid-template-columns: minmax(0, 1fr);
      gap: 1rem;
      margin-top: 1rem;
      align-items: stretch;
    }
    .export-worklog-split {
      display: grid;
      grid-template-columns: minmax(0, 1fr);
      gap: 1rem;
      margin-top: 1rem;
      align-items: start;
    }
    .export-wl-panel {
      border-radius: 12px;
      border: 1px solid var(--border);
      background: var(--surface-solid);
      box-shadow: 0 1px 2px rgba(0,0,0,0.04);
      padding: 0.75rem 0.85rem 0.85rem;
      min-width: 0;
    }
    .export-wl-panel__title {
      margin: 0 0 0.5rem;
      font-size: 0.8125rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--muted);
    }
    .export-wl-panel__sub {
      margin: -0.1rem 0 0.5rem;
      font-size: 0.78rem;
      line-height: 1.45;
      color: var(--faint);
    }
    .export-wl-tableWrap {
      width: 100%;
      max-width: 100%;
      overflow-x: auto;
      overflow-y: visible;
      border-radius: 8px;
      border: 1px solid var(--border);
      background: var(--surface);
      -webkit-overflow-scrolling: touch;
    }
    .export-wl-table {
      table-layout: auto;
      min-width: 100%;
      width: max-content;
      font-size: 0.875rem;
    }
    .export-wl-table thead th {
      padding: 0.5rem 0.6rem;
      font-size: 0.72rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      color: var(--muted);
      border-bottom: 1px solid var(--border);
      background: color-mix(in srgb, var(--surface-solid) 88%, var(--border));
    }
    .export-wl-th-lead {
      text-align: left;
    }
    .export-wl-th-metric {
      text-align: right;
      white-space: nowrap;
    }
    .export-wl-table tbody td {
      vertical-align: middle;
      padding: 0.5rem 0.6rem;
      border-bottom: 1px solid var(--border);
    }
    .export-wl-dataRow td {
      background: transparent;
    }
    .export-wl-table tbody tr:last-child td {
      border-bottom: none;
    }
    .export-wl-lead {
      padding-left: 0.35rem !important;
    }
    .export-wl-leadRow {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      min-width: 0;
    }
    .export-wl-swatch {
      flex-shrink: 0;
      width: 32px;
      height: 32px;
      border-radius: 10px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      overflow: hidden;
      box-shadow: 0 1px 3px rgba(0,0,0,0.12);
      border: 1px solid rgba(255,255,255,0.22);
    }
    .export-wl-swatch__img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
    }
    .export-wl-swatch--emoji {
      background: linear-gradient(145deg, rgba(255,255,255,0.95), rgba(248,250,252,0.92)) !important;
      border: 1px solid var(--border);
    }
    .export-wl-swatch__glyph--emoji {
      color: inherit;
      text-shadow: none;
      font-size: 1.15rem;
      line-height: 1;
    }
    .export-wl-name {
      font-size: 0.875rem;
      font-weight: 500;
      color: var(--text);
      min-width: 0;
      line-height: 1.4;
      word-break: break-word;
    }
    .export-wl-metric {
      font-size: 0.875rem;
    }

    .brag-toolbar {
      display: flex;
      flex-wrap: wrap;
      gap: 0.65rem;
      align-items: center;
      margin-bottom: 1.35rem;
      padding: 0.65rem 0.75rem;
      border-radius: var(--radius-sm);
      background: var(--surface);
      border: 1px solid var(--border);
      box-shadow: var(--shadow);
      position: sticky;
      top: 0.65rem;
      z-index: 40;
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
    }

    .brag-search-wrap { flex: 1 1 12rem; min-width: 0; }

    #brag-search {
      width: 100%;
      font: inherit;
      font-size: 0.9rem;
      padding: 0.55rem 0.75rem 0.55rem 2.25rem;
      border-radius: 10px;
      border: 1px solid var(--border);
      background: var(--surface-solid) url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' fill='none' viewBox='0 0 24 24'%3E%3Cpath stroke='%2371717a' stroke-width='2' stroke-linecap='round' d='M11 19a8 8 0 1 1 0-16 8 8 0 0 1 0 16Zm9 3-4-4'/%3E%3C/svg%3E") 0.65rem 50% no-repeat;
      color: var(--text);
      outline: none;
      transition: border-color 0.15s, box-shadow 0.15s;
    }

    #brag-search:focus {
      border-color: var(--accent);
      box-shadow: 0 0 0 3px var(--accent-soft);
    }

    .brag-toolbar-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 0.4rem;
      align-items: center;
    }

    .brag-toolbar-filters {
      position: static;
      flex-wrap: wrap;
      align-items: flex-end;
      gap: 0.65rem 1rem;
    }

    .brag-toolbar-filters-label {
      font-size: 0.72rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: var(--muted);
      width: 100%;
      margin-bottom: -0.35rem;
    }

    .brag-filter-field {
      display: flex;
      flex-direction: column;
      gap: 0.2rem;
      font-size: 0.72rem;
      font-weight: 600;
      color: var(--muted);
      min-width: 0;
    }

    .brag-filter-select {
      font: inherit;
      font-size: 0.85rem;
      font-weight: 500;
      padding: 0.45rem 0.55rem;
      border-radius: 8px;
      border: 1px solid var(--border);
      background: var(--surface-solid);
      color: var(--text);
      min-width: 8.5rem;
      max-width: 100%;
    }

    .btn {
      font: inherit;
      font-size: 0.78rem;
      font-weight: 600;
      padding: 0.45rem 0.7rem;
      border-radius: 8px;
      border: 1px solid var(--border);
      background: var(--surface-solid);
      color: var(--text);
      cursor: pointer;
      transition: transform 0.12s ease, border-color 0.15s, background 0.15s;
    }

    .btn:hover {
      border-color: rgba(99, 102, 241, 0.35);
      background: var(--accent-soft);
    }

    .btn:active { transform: scale(0.97); }

    .btn-icon { padding: 0.45rem 0.65rem; min-width: 2.35rem; }

    .brag-section {
      margin-bottom: 0.85rem;
      border-radius: var(--radius-sm);
      border: 1px solid var(--border);
      background: var(--surface);
      box-shadow: var(--shadow);
      overflow: hidden;
      transition: opacity 0.2s ease;
    }

    .brag-section.is-section-empty { display: none; }

    .brag-section__summary {
      list-style: none;
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.85rem 1rem;
      cursor: pointer;
      font-weight: 600;
      font-size: 0.95rem;
      user-select: none;
      transition: background 0.15s;
    }

    .brag-section__summary::-webkit-details-marker { display: none; }

    .brag-section__summary::before {
      content: "";
      width: 0.5rem;
      height: 0.5rem;
      border-right: 2px solid var(--accent);
      border-bottom: 2px solid var(--accent);
      transform: rotate(-45deg);
      transition: transform 0.2s ease;
      flex-shrink: 0;
      opacity: 0.85;
    }

    .brag-section[open] .brag-section__summary::before {
      transform: rotate(45deg) translateY(-1px);
    }

    .brag-section__summary:hover { background: var(--accent-soft); }

    .brag-section__title { flex: 1; min-width: 0; }

    .brag-section__count {
      font-size: 0.72rem;
      font-weight: 700;
      padding: 0.2rem 0.5rem;
      border-radius: 999px;
      background: var(--accent-soft);
      color: var(--accent);
      font-variant-numeric: tabular-nums;
    }

    .brag-section__body {
      padding: 0 0.65rem 0.85rem;
      display: grid;
      gap: 0.65rem;
    }

    .brag-cards-root {
      display: grid;
      gap: 0.65rem;
    }

    .brag-card {
      position: relative;
      border-radius: var(--radius-sm);
      padding: 1rem 1.05rem;
      background: var(--surface-solid);
      border: 1px solid var(--border);
      box-shadow: 0 1px 0 rgba(255, 255, 255, 0.04) inset;
      transition: transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease, opacity 0.2s ease;
    }

    @media (hover: hover) {
      .brag-card:hover {
        transform: translateY(-2px);
        box-shadow: var(--shadow-hover);
        border-color: rgba(99, 102, 241, 0.2);
      }
    }

    .brag-card.is-filtered-out {
      display: none;
    }

    .brag-card__top {
      display: flex;
      flex-wrap: wrap;
      align-items: flex-start;
      justify-content: space-between;
      gap: 0.5rem 0.75rem;
      margin-bottom: 0.35rem;
    }

    details.brag-task-collapsible {
      overflow: hidden;
    }

    .brag-task-collapsible__summary {
      list-style: none;
      cursor: pointer;
      user-select: none;
      display: flex;
      align-items: flex-start;
      gap: 0.4rem;
      padding: 0;
      margin: 0;
    }

    .brag-task-collapsible__summary::-webkit-details-marker {
      display: none;
    }

    .brag-task-collapsible__summary::before {
      content: "";
      width: 0.42rem;
      height: 0.42rem;
      margin-top: 0.42rem;
      border-right: 2px solid var(--accent);
      border-bottom: 2px solid var(--accent);
      transform: rotate(-45deg);
      flex-shrink: 0;
      opacity: 0.8;
    }

    .brag-task-collapsible[open] .brag-task-collapsible__summary::before {
      transform: rotate(45deg) translateY(-1px);
    }

    .brag-task-collapsible__summary .brag-card__top {
      flex: 1;
      min-width: 0;
      margin-bottom: 0;
    }

    .brag-task-collapsible__body {
      margin-top: 0.35rem;
      padding: 0 0 0.15rem 1rem;
      border-left: 2px solid var(--accent-soft);
      margin-left: 0.45rem;
    }

    .brag-checklist-bar {
      margin: 0.35rem 0 0.5rem;
    }

    .brag-checklist-bar__track {
      height: 0.35rem;
      border-radius: 999px;
      background: rgba(24, 24, 27, 0.08);
      overflow: hidden;
    }

    [data-theme="dark"] .brag-checklist-bar__track {
      background: rgba(255, 255, 255, 0.1);
    }

    .brag-checklist-bar__fill {
      height: 100%;
      border-radius: 999px;
      background: #10b981;
      max-width: 100%;
    }

    .brag-checklist-bar__cap {
      display: block;
      margin-top: 0.2rem;
      font-size: 0.7rem;
      font-weight: 600;
      font-variant-numeric: tabular-nums;
      color: var(--muted);
    }

    .brag-subtasks {
      margin-top: 0.65rem;
    }

    .brag-subtasks__label {
      margin: 0 0 0.25rem;
      font-size: 0.68rem;
      font-weight: 700;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      color: var(--muted);
    }

    .brag-subtasks__list {
      list-style: none;
      margin: 0.35rem 0 0;
      padding: 0;
      display: grid;
      gap: 0.35rem;
    }

    .brag-subtasks__item {
      display: flex;
      align-items: flex-start;
      gap: 0.45rem;
      font-size: 0.82rem;
      line-height: 1.4;
    }

    .brag-subtasks__item.is-done {
      opacity: 0.72;
      text-decoration: line-through;
    }

    .brag-subtasks__mark {
      flex-shrink: 0;
      width: 1rem;
      font-weight: 700;
      color: var(--accent);
      text-align: center;
    }

    .task-title {
      font-weight: 600;
      font-size: 1.02rem;
      margin: 0;
      letter-spacing: -0.02em;
      line-height: 1.3;
      flex: 1 1 12rem;
    }

    .task-title__chk {
      font-size: 0.78rem;
      font-weight: 600;
      font-variant-numeric: tabular-nums;
      color: var(--muted);
      white-space: nowrap;
    }

    .task-meta {
      font-size: 0.8rem;
      color: var(--muted);
      margin: 0 0 0.5rem;
      line-height: 1.45;
    }

    .task-meta .meta-sep { opacity: 0.45; padding: 0 0.15rem; }

    .task-desc {
      font-size: 0.875rem;
      color: var(--muted);
      margin: 0;
      line-height: 1.5;
    }

    .badge {
      display: inline-block;
      font-size: 0.7rem;
      font-weight: 600;
      padding: 0.18rem 0.5rem;
      border-radius: 999px;
      margin: 0.2rem 0.35rem 0 0;
      vertical-align: middle;
    }

    .badge-tag {
      background: var(--accent-soft);
      color: var(--accent);
      border: 1px solid transparent;
    }

    .badge-status { border: 1px solid rgba(0, 0, 0, 0.06); }

    [data-theme="dark"] .badge-status { border-color: rgba(255, 255, 255, 0.08); }

    .tag-row { margin-top: 0.5rem; font-size: 0.75rem; }

    .empty-state {
      text-align: center;
      padding: 2.5rem 1.25rem;
      border-radius: var(--radius-sm);
      border: 1px dashed var(--border);
      color: var(--muted);
      background: var(--surface);
    }

    .empty-state strong { color: var(--text); display: block; margin-bottom: 0.35rem; }

    #brag-filter-empty { margin-top: 0.75rem; }

    .export-task-tabs {
      display: flex;
      gap: 0.35rem;
      margin-bottom: 1rem;
      padding: 0.25rem;
      border-radius: var(--radius-sm);
      background: var(--surface);
      border: 1px solid var(--border);
      box-shadow: var(--shadow);
    }

    .export-task-tab {
      flex: 1;
      font: inherit;
      font-size: 0.82rem;
      font-weight: 600;
      padding: 0.55rem 0.75rem;
      border: none;
      border-radius: 8px;
      background: transparent;
      color: var(--muted);
      cursor: pointer;
      transition: background 0.15s, color 0.15s;
    }

    .export-task-tab:hover {
      color: var(--text);
      background: var(--accent-soft);
    }

    .export-task-tab.is-active {
      background: var(--surface-solid);
      color: var(--text);
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
    }

    [data-theme="dark"] .export-task-tab.is-active {
      box-shadow: 0 1px 4px rgba(0, 0, 0, 0.35);
    }

    .brag-tab-panel[hidden] {
      display: none !important;
    }

    .export-print-section-title {
      display: none;
    }

    #brag-to-top {
      position: fixed;
      right: 1rem;
      bottom: 1rem;
      width: 2.65rem;
      height: 2.65rem;
      border-radius: 50%;
      border: 1px solid var(--border);
      background: var(--surface-solid);
      color: var(--accent);
      font-size: 1.1rem;
      cursor: pointer;
      box-shadow: var(--shadow);
      opacity: 0;
      pointer-events: none;
      transform: translateY(8px);
      transition: opacity 0.2s, transform 0.2s;
      z-index: 50;
    }

    #brag-to-top.is-visible {
      opacity: 1;
      pointer-events: auto;
      transform: translateY(0);
    }

    #brag-to-top:hover { border-color: var(--accent); }

    @media (prefers-reduced-motion: reduce) {
      html { scroll-behavior: auto; }
      .brag-card, .btn, #brag-to-top, .brag-section { transition: none; }
      .brag-section__summary::before { transition: none; }
    }

    @media print {
      .print-hidden { display: none !important; }
      body {
        background: #fff;
        print-color-adjust: exact;
        -webkit-print-color-adjust: exact;
      }
      [data-theme="dark"] body { background: #fff; color: #18181b; }
      .brag-hero { box-shadow: none; border: 1px solid #e4e4e7; }
      .brag-hero__inner { background: #fff; backdrop-filter: none; }
      .brag-card {
        break-inside: avoid;
        box-shadow: none;
        border: 1px solid #e4e4e7;
      }
      .brag-section { break-inside: avoid; }
      .export-summary { break-inside: avoid; }
      .export-worklog-rollup-grid,
      .export-worklog-split,
      .export-wl-panel {
        break-inside: avoid;
      }
      .export-task-tabs { display: none !important; }
      .brag-tab-panel[hidden] {
        display: block !important;
      }
      .export-print-section-title {
        display: block;
        font-size: 1rem;
        font-weight: 700;
        margin: 1.25rem 0 0.65rem;
        padding-bottom: 0.35rem;
        border-bottom: 1px solid #e4e4e7;
        color: #18181b;
      }
      .export-print-section-title:first-of-type {
        margin-top: 0;
      }
    }
  `.trim();

  function rowHtml(row: BragTaskRow): string {
    const { task } = row;
    const st = statusDef(task.status, statusMap);
    const typeLabel = canonicalTaskTypeLabel(task.type, knownTaskTypes);
    const priorityLabel = canonicalPriorityLabel(task.priority, knownPriorities);
    const excerpt = markdownExcerpt(task.description ?? "", 280);
    const subs = task.subtasks ?? [];
    const subTitles = subs.map((s) => s.title).join(" ");
    const searchBlob = [
      task.name,
      row.ownerName,
      row.projectName ?? "",
      row.epicName ?? "",
      typeLabel,
      task.type,
      st.label,
      priorityLabel,
      task.priority,
      task.date,
      excerpt,
      subTitles,
      ...(task.tags ?? []),
    ]
      .join(" ")
      .toLowerCase();
    const tags =
      (task.tags ?? []).length > 0
        ? `<div class="tag-row">${(task.tags ?? [])
            .map((tg) => `<span class="badge badge-tag">${escapeHtml(tg)}</span>`)
            .join("")}</div>`
        : "";
    const metaBits = [
      escapeHtml(row.ownerName),
      row.projectName ? escapeHtml(row.projectName) : null,
      row.epicName ? escapeHtml(row.epicName) : null,
      escapeHtml(typeLabel),
      escapeHtml(priorityLabel),
      escapeHtml(task.date),
    ].filter(Boolean);
    const metaJoined = metaBits.join('<span class="meta-sep">·</span>');
    const statusStyle = `color:${escapeHtml(st.color)};background:${escapeHtml(st.bg)}`;
    const stTotal = subs.length;
    const stDone = subs.filter((s) => s.done).length;
    if (stTotal === 0) {
      return `
      <article class="brag-card" data-search="${escapeHtml(searchBlob)}" data-status-key="${escapeHtml(normalizeStatusKey(task.status))}" data-type-label="${escapeHtml(typeLabel)}" data-priority-label="${escapeHtml(priorityLabel)}">
        <div class="brag-card__top">
          <h3 class="task-title">${escapeHtml(task.name)}</h3>
          <span class="badge badge-status" style="${statusStyle}">${escapeHtml(st.label)}</span>
        </div>
        <p class="task-meta">${metaJoined}</p>
        ${excerpt ? `<p class="task-desc">${escapeHtml(excerpt)}</p>` : ""}
        ${tags}
      </article>
    `.trim();
    }
    const checklistPct = Math.round((stDone / stTotal) * 100);
    const checklistBar = `<div class="brag-checklist-bar" role="img" aria-label="Checklist ${stDone} of ${stTotal} complete">
  <div class="brag-checklist-bar__track"><div class="brag-checklist-bar__fill" style="width:${checklistPct}%"></div></div>
  <span class="brag-checklist-bar__cap">Checklist ${stDone} / ${stTotal} (${checklistPct}%)</span>
</div>`;
    const subtaskBlock = `<div class="brag-subtasks">
  <p class="brag-subtasks__label">Sub-tasks</p>
  ${checklistBar}
  <ul class="brag-subtasks__list">
    ${subs
      .map(
        (sub) =>
          `<li class="brag-subtasks__item${sub.done ? " is-done" : ""}">
      <span class="brag-subtasks__mark" aria-hidden="true">${sub.done ? "✓" : "○"}</span>
      <span>${escapeHtml(sub.title)}</span>
    </li>`,
      )
      .join("")}
  </ul>
</div>`;
    return `
<details class="brag-card brag-task-collapsible" open data-search="${escapeHtml(searchBlob)}" data-status-key="${escapeHtml(normalizeStatusKey(task.status))}" data-type-label="${escapeHtml(typeLabel)}" data-priority-label="${escapeHtml(priorityLabel)}">
  <summary class="brag-task-collapsible__summary">
    <div class="brag-card__top">
      <h3 class="task-title">${escapeHtml(task.name)}<span class="task-title__chk"> · ${stDone}/${stTotal}</span></h3>
      <span class="badge badge-status" style="${statusStyle}">${escapeHtml(st.label)}</span>
    </div>
  </summary>
  <div class="brag-task-collapsible__body">
    <p class="task-meta">${metaJoined}</p>
    ${excerpt ? `<p class="task-desc">${escapeHtml(excerpt)}</p>` : ""}
    ${tags}
    ${subtaskBlock}
  </div>
</details>`.trim();
  }

  function sectionBlocksFrom(secList: { heading: string; rows: BragTaskRow[] }[]): string {
    return secList
      .map((sec) => {
        if (!sec.rows.length) return "";
        const inner = sec.rows.map(rowHtml).join("\n");
        if (!sec.heading) {
          return `<div class="brag-cards-root">${inner}</div>`;
        }
        return `<details class="brag-section" open>
  <summary class="brag-section__summary">
    <span class="brag-section__title">${escapeHtml(sec.heading)}</span>
    <span class="brag-section__count">${sec.rows.length}</span>
  </summary>
  <div class="brag-section__body">${inner}</div>
</details>`;
      })
      .filter(Boolean)
      .join("\n");
  }

  const sectionBlocksTerminal = sectionBlocksFrom(sections);
  const sectionBlocksAll = sectionsAllStatuses ? sectionBlocksFrom(sectionsAllStatuses) : "";

  const emptyListHtml = (which: "terminal" | "all") =>
    which === "terminal"
      ? `<div class="empty-state print-hidden"><strong>No terminal tasks matched</strong>Try widening filters and export again.</div>`
      : `<div class="empty-state print-hidden"><strong>No tasks matched</strong>Try widening filters and export again.</div>`;

  const scopeNote = useDualTaskTabs
    ? "Two tabs: completed (terminal) work, and every task that matched the filters you used when exporting. Optional type, priority, and status filters apply to whichever tab is open."
    : "Tasks matching the filters you used when exporting.";

  const toolbarExtra = hasCollapsibleSections
    ? `<button type="button" class="btn" id="expand-all">Expand all</button>
    <button type="button" class="btn" id="collapse-all">Collapse all</button>`
    : "";

  const statusSelectOptions =
    `<option value="">All statuses</option>` +
    (Object.entries(statusMap) as [string, StatusDef][])
      .sort((a, b) => a[1].order - b[1].order)
      .map(([k, def]) => `<option value="${escapeHtml(k)}">${escapeHtml(def.label)}</option>`)
      .join("");
  const typeSelectOptions =
    `<option value="">All types</option>` +
    knownTaskTypes.map((t) => `<option value="${escapeHtml(t)}">${escapeHtml(t)}</option>`).join("");
  const prioritySelectOptions =
    `<option value="">All priorities</option>` +
    knownPriorities.map((p) => `<option value="${escapeHtml(p)}">${escapeHtml(p)}</option>`).join("");

  const filterToolbarHtml = useDualTaskTabs
    ? `<div class="brag-toolbar brag-toolbar-filters print-hidden" id="brag-toolbar-filters">
  <span class="brag-toolbar-filters-label">Narrow the open tab</span>
  <label class="brag-filter-field">Type
    <select id="brag-filter-by-type" class="brag-filter-select" aria-label="Filter by type">${typeSelectOptions}</select>
  </label>
  <label class="brag-filter-field">Priority
    <select id="brag-filter-by-priority" class="brag-filter-select" aria-label="Filter by priority">${prioritySelectOptions}</select>
  </label>
  <label class="brag-filter-field">Status
    <select id="brag-filter-by-status" class="brag-filter-select" aria-label="Filter by status">${statusSelectOptions}</select>
  </label>
</div>`
    : "";

  const script = `
(function () {
  function readSlices() {
    var el = document.getElementById("export-row-slices-json");
    if (!el) return { terminal: [], all: [] };
    try { return JSON.parse(el.textContent); } catch (e) { return { terminal: [], all: [] }; }
  }
  var EXP_SLICES = readSlices();
  function esc(t) {
    return String(t)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }
  function formatExportDate(iso) {
    if (!iso || iso.length < 10) return iso || "";
    var p = iso.split("-");
    var d = new Date(Date.UTC(Number(p[0]), Number(p[1]) - 1, Number(p[2])));
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      timeZone: "UTC",
    });
  }
  function filterSlices(rows, q, tf, pf, sf) {
    if (!rows || !rows.length) return [];
    return rows.filter(function (z) {
      if (tf && z.ty !== tf) return false;
      if (pf && z.pr !== pf) return false;
      if (sf && z.sk !== sf) return false;
      if (q && z.s.indexOf(q) === -1) return false;
      return true;
    });
  }
  function aggregateSlices(rows) {
    var owners = {};
    var projects = {};
    var epics = {};
    var terminal = 0;
    var stt = 0;
    var std = 0;
    var withDesc = 0;
    var tagTasks = 0;
    var tagSet = {};
    var tagAssignments = 0;
    var tasksWithChk = 0;
    var types = {};
    var pris = {};
    var statuses = {};
    var dates = [];
    var months = {};
    var epicLinks = 0;
    var tasksWithProject = 0;
    var tasksWithDate = 0;
    for (var i = 0; i < rows.length; i++) {
      var z = rows[i];
      owners[z.pi] = true;
      if (z.pm) {
        tasksWithProject++;
        projects[z.pm] = true;
      }
      if (z.gid) {
        epicLinks++;
        epics[z.el || "Epic"] = true;
      }
      if (z.term) terminal++;
      statuses[z.sl] = (statuses[z.sl] || 0) + 1;
      types[z.ty] = (types[z.ty] || 0) + 1;
      pris[z.pr] = (pris[z.pr] || 0) + 1;
      if (z.hd) withDesc++;
      if (z.tg && z.tg.length) {
        tagTasks++;
        for (var j = 0; j < z.tg.length; j++) {
          tagSet[z.tg[j]] = true;
          tagAssignments++;
        }
      }
      if (z.stt > 0) tasksWithChk++;
      stt += z.stt;
      std += z.std;
      if (z.dt) {
        tasksWithDate++;
        dates.push(z.dt);
        months[z.dt.slice(0, 7)] = true;
      }
    }
    dates.sort();
    var n = rows.length;
    var dateMin = dates.length ? dates[0] : null;
    var dateMax = dates.length ? dates[dates.length - 1] : null;
    var typeRows = Object.keys(types)
      .map(function (k) {
        return [k, types[k]];
      })
      .sort(function (a, b) {
        return b[1] - a[1];
      })
      .slice(0, 6);
    var priRows = Object.keys(pris)
      .map(function (k) {
        return [k, pris[k]];
      })
      .sort(function (a, b) {
        return b[1] - a[1];
      });
    var statusRows = Object.keys(statuses)
      .map(function (k) {
        return [k, statuses[k]];
      })
      .sort(function (a, b) {
        return b[1] - a[1];
      })
      .slice(0, 12);
    var pk = Object.keys(owners);
    return {
      n: n,
      terminal: terminal,
      ownerCount: pk.length,
      projectCount: Object.keys(projects).length,
      epicCount: Object.keys(epics).length,
      tasksLinkedToEpic: epicLinks,
      tasksWithProject: tasksWithProject,
      tasksWithDate: tasksWithDate,
      withDescription: withDesc,
      tasksWithTags: tagTasks,
      uniqueTagCount: Object.keys(tagSet).length,
      tagAssignmentCount: tagAssignments,
      tasksWithChecklist: tasksWithChk,
      subtasksTotal: stt,
      subtasksDone: std,
      avgPerOwner: pk.length ? (n / pk.length).toFixed(1) : String(n),
      dateMin: dateMin,
      dateMax: dateMax,
      monthDistinctCount: Object.keys(months).length,
      typeRows: typeRows,
      priorityRows: priRows,
      statusRows: statusRows,
    };
  }
  function applySummary(comp) {
    var n = comp.n;
    function po(c) {
      return n > 0 ? Math.round((c / n) * 100) : 0;
    }
    var terminalPct = po(comp.terminal);
    var otherPct = po(n - comp.terminal);
    var subPct =
      comp.subtasksTotal > 0 ? Math.round((comp.subtasksDone / comp.subtasksTotal) * 100) : null;
    var distinctTagPct =
      comp.tagAssignmentCount > 0
        ? Math.round((comp.uniqueTagCount / comp.tagAssignmentCount) * 100)
        : 0;
    function set(id, t) {
      var e = document.getElementById(id);
      if (e) e.textContent = t;
    }
    function el(id) {
      return document.getElementById(id);
    }
    set("exp-sum-n", comp.n);
    set("exp-sum-owners", comp.ownerCount);
    set("exp-sum-owner-avg", comp.avgPerOwner);
    set("exp-sum-projects", comp.projectCount);
    set("exp-sum-epics", comp.epicCount);
    set("exp-sum-epic-tasks", comp.tasksLinkedToEpic);
    set("exp-sum-epic-pct", po(comp.tasksLinkedToEpic));
    set("exp-sum-project-tasks", comp.tasksWithProject);
    set("exp-sum-project-pct", po(comp.tasksWithProject));
    set("exp-sum-desc", comp.withDescription);
    set("exp-sum-desc-pct", po(comp.withDescription));
    set("exp-sum-uniq-tags", comp.uniqueTagCount);
    set("exp-sum-tagged-tasks", comp.tasksWithTags);
    set("exp-sum-tagged-pct", po(comp.tasksWithTags));
    set("exp-sum-tags-distinct-pct", distinctTagPct);
    var tagDistWrap = el("exp-sum-tags-distinct-wrap");
    if (tagDistWrap) tagDistWrap.hidden = !comp.tagAssignmentCount;
    var wfDone = el("exp-sum-wf-done");
    if (wfDone) wfDone.style.width = terminalPct + "%";
    var wfRest = el("exp-sum-wf-rest");
    if (wfRest) wfRest.style.width = 100 - terminalPct + "%";
    set("exp-sum-wf-term-n", comp.terminal);
    set("exp-sum-wf-term-pct", terminalPct);
    set("exp-sum-wf-other-n", n - comp.terminal);
    set("exp-sum-wf-other-pct", otherPct);
    var datedNote =
      n > 0
        ? ' <span class="export-summary__pct">(<span id="exp-sum-dated-pct">' +
          po(comp.tasksWithDate) +
          '</span>% of tasks have a date)</span>'
        : "";
    var datesEl = el("exp-sum-dates");
    if (datesEl) {
      if (comp.dateMin && comp.dateMax) {
        datesEl.hidden = false;
        datesEl.innerHTML =
          comp.dateMin === comp.dateMax
            ? "<strong>Task dates in this view:</strong> " +
              esc(formatExportDate(comp.dateMin)) +
              datedNote
            : "<strong>Task dates in this view:</strong> " +
              esc(formatExportDate(comp.dateMin)) +
              " — " +
              esc(formatExportDate(comp.dateMax)) +
              datedNote;
      } else {
        datesEl.hidden = true;
        datesEl.textContent = "";
      }
    }
    var mo = el("exp-sum-months");
    if (mo) {
      if (comp.monthDistinctCount > 0) {
        mo.hidden = false;
        mo.textContent =
          String(comp.monthDistinctCount) + " distinct calendar months with dated work";
      } else {
        mo.hidden = true;
        mo.textContent = "";
      }
    }
    var stCard = el("exp-sum-subtasks-card");
    if (stCard) {
      if (comp.subtasksTotal > 0) {
        stCard.hidden = false;
        set("exp-sum-st-done", comp.subtasksDone);
        set("exp-sum-st-total", comp.subtasksTotal);
        set("exp-sum-st-pct", subPct != null ? String(subPct) : "");
        set("exp-sum-st-of-tasks-pct", po(comp.tasksWithChecklist));
      } else {
        stCard.hidden = true;
      }
    }
    var stBody = el("exp-sum-status-tbody");
    if (stBody) {
      stBody.innerHTML = comp.statusRows
        .map(function (row) {
          var pct = n > 0 ? Math.round((row[1] / n) * 100) : 0;
          return (
            "<tr><td>" +
            esc(row[0]) +
            '</td><td class="export-summary__num">' +
            row[1] +
            ' <span class="export-summary__pct">(' +
            pct +
            "%)</span></td></tr>"
          );
        })
        .join("");
    }
    var tyBody = el("exp-sum-type-tbody");
    if (tyBody) {
      tyBody.innerHTML = comp.typeRows
        .map(function (row) {
          var pct = po(row[1]);
          return (
            "<tr><td>" +
            esc(row[0]) +
            '</td><td class="export-summary__num">' +
            row[1] +
            ' <span class="export-summary__pct">(' +
            pct +
            "%)</span></td></tr>"
          );
        })
        .join("");
    }
    var prBody = el("exp-sum-priority-tbody");
    if (prBody) {
      prBody.innerHTML = comp.priorityRows
        .map(function (row) {
          var pct = po(row[1]);
          return (
            "<tr><td>" +
            esc(row[0]) +
            '</td><td class="export-summary__num">' +
            row[1] +
            ' <span class="export-summary__pct">(' +
            pct +
            "%)</span></td></tr>"
          );
        })
        .join("");
    }
  }
  function refreshExportSummary() {
    if (!document.getElementById("export-summary-root")) return;
    var dual = EXP_SLICES.all && EXP_SLICES.all.length > 0;
    var active = "terminal";
    var tab = document.querySelector(".export-task-tab.is-active");
    if (tab && dual) active = tab.getAttribute("data-export-task-tab") || "terminal";
    var pool = !dual || active === "terminal" ? EXP_SLICES.terminal : EXP_SLICES.all;
    var search = document.getElementById("brag-search");
    var raw = search ? (search.value || "").trim().toLowerCase() : "";
    var typeEl = document.getElementById("brag-filter-by-type");
    var priEl = document.getElementById("brag-filter-by-priority");
    var stEl = document.getElementById("brag-filter-by-status");
    var typeF = typeEl && typeEl.value ? typeEl.value : "";
    var priF = priEl && priEl.value ? priEl.value : "";
    var stF = stEl && stEl.value ? stEl.value : "";
    var filtered = filterSlices(pool, raw, typeF, priF, stF);
    var comp = aggregateSlices(filtered);
    applySummary(comp);
    var hint = document.getElementById("exp-sum-hint");
    if (hint) {
      var any = raw || typeF || priF || stF;
      hint.hidden = !any;
      hint.textContent = any ? "Counts follow the active tab and current filters." : "";
    }
  }
  var root = document.documentElement;
  var saved = null;
  try { saved = localStorage.getItem("achievements-export-theme"); } catch (e) {}
  if (saved === "dark" || saved === "light") root.setAttribute("data-theme", saved);
  else if (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches)
    root.setAttribute("data-theme", "dark");

  var themeBtn = document.getElementById("theme-toggle");
  if (themeBtn) {
    function label() {
      themeBtn.textContent = root.getAttribute("data-theme") === "dark" ? "Light" : "Dark";
      themeBtn.setAttribute("aria-label", root.getAttribute("data-theme") === "dark" ? "Switch to light theme" : "Switch to dark theme");
    }
    label();
    themeBtn.addEventListener("click", function () {
      var next = root.getAttribute("data-theme") === "dark" ? "light" : "dark";
      root.setAttribute("data-theme", next);
      try { localStorage.setItem("achievements-export-theme", next); } catch (e) {}
      label();
    });
  }

  var search = document.getElementById("brag-search");
  var emptyFilter = document.getElementById("brag-filter-empty");
  function activeTaskListRoot() {
    var vis = document.querySelector("[data-export-task-panel]:not([hidden])");
    return vis || document.getElementById("brag-main");
  }
  function applyTaskFilter() {
    var raw = search ? (search.value || "").trim() : "";
    var q = raw.toLowerCase();
    var typeEl = document.getElementById("brag-filter-by-type");
    var priEl = document.getElementById("brag-filter-by-priority");
    var stEl = document.getElementById("brag-filter-by-status");
    var typeF = typeEl && typeEl.value ? typeEl.value : "";
    var priF = priEl && priEl.value ? priEl.value : "";
    var stF = stEl && stEl.value ? stEl.value : "";
    var listRoot = activeTaskListRoot();
    document.querySelectorAll(".brag-card").forEach(function (card) {
      card.classList.remove("is-filtered-out");
    });
    document.querySelectorAll(".brag-section").forEach(function (sec) {
      sec.classList.remove("is-section-empty");
    });
    var anyVisible = false;
    if (listRoot) {
      listRoot.querySelectorAll(".brag-card").forEach(function (card) {
        var hay = (card.getAttribute("data-search") || "").toLowerCase();
        var hideSearch = q.length > 0 && hay.indexOf(q) === -1;
        var matchType = !typeF || (card.getAttribute("data-type-label") || "") === typeF;
        var matchPri = !priF || (card.getAttribute("data-priority-label") || "") === priF;
        var matchSt = !stF || (card.getAttribute("data-status-key") || "") === stF;
        var hide = hideSearch || !matchType || !matchPri || !matchSt;
        card.classList.toggle("is-filtered-out", hide);
        if (!hide) anyVisible = true;
      });
      listRoot.querySelectorAll(".brag-section").forEach(function (sec) {
        var n = sec.querySelectorAll(".brag-card:not(.is-filtered-out)").length;
        sec.classList.toggle("is-section-empty", n === 0);
      });
    }
    var anyFilter = raw.length > 0 || typeF || priF || stF;
    if (emptyFilter) emptyFilter.hidden = !anyFilter || anyVisible;
    refreshExportSummary();
  }
  if (search) search.addEventListener("input", applyTaskFilter);
  ["brag-filter-by-type", "brag-filter-by-priority", "brag-filter-by-status"].forEach(function (id) {
    var el = document.getElementById(id);
    if (el) el.addEventListener("change", applyTaskFilter);
  });

  var expandAll = document.getElementById("expand-all");
  var collapseAll = document.getElementById("collapse-all");
  if (expandAll) expandAll.addEventListener("click", function () {
    document.querySelectorAll("details.brag-section").forEach(function (d) { d.open = true; });
  });
  if (collapseAll) collapseAll.addEventListener("click", function () {
    document.querySelectorAll("details.brag-section").forEach(function (d) { d.open = false; });
  });

  var detailsState = [];
  window.addEventListener("beforeprint", function () {
    detailsState = [];
    document.querySelectorAll("details.brag-section").forEach(function (d, i) {
      detailsState[i] = d.open;
      d.open = true;
    });
  });
  window.addEventListener("afterprint", function () {
    document.querySelectorAll("details.brag-section").forEach(function (d, i) {
      if (detailsState[i] !== undefined) d.open = detailsState[i];
    });
    detailsState = [];
  });

  var topBtn = document.getElementById("brag-to-top");
  if (topBtn) {
    window.addEventListener("scroll", function () {
      topBtn.classList.toggle("is-visible", window.scrollY > 420);
    }, { passive: true });
    topBtn.addEventListener("click", function () {
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  }

  document.querySelectorAll("[data-export-task-tab]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var key = btn.getAttribute("data-export-task-tab");
      if (!key) return;
      document.querySelectorAll("[data-export-task-tab]").forEach(function (b) {
        var on = b.getAttribute("data-export-task-tab") === key;
        b.classList.toggle("is-active", on);
        b.setAttribute("aria-selected", on ? "true" : "false");
      });
      document.querySelectorAll("[data-export-task-panel]").forEach(function (panel) {
        var show = panel.getAttribute("data-export-task-panel") === key;
        panel.hidden = !show;
        panel.setAttribute("aria-hidden", show ? "false" : "true");
      });
      applyTaskFilter();
    });
  });

  refreshExportSummary();
})();
`.trim();

  const mainContentSingle =
    sectionBlocksTerminal ||
    `<div class="empty-state print-hidden"><strong>No tasks matched</strong>Try widening filters and export again.</div>`;

  const mainContentDual = `
    <div class="export-task-tabs print-hidden" role="tablist" aria-label="Task list view">
      <button type="button" class="export-task-tab is-active" role="tab" aria-selected="true" data-export-task-tab="terminal">Terminal only</button>
      <button type="button" class="export-task-tab" role="tab" aria-selected="false" data-export-task-tab="all">All statuses</button>
    </div>
    <h2 class="export-print-section-title">Terminal only</h2>
    <div id="brag-panel-terminal" class="brag-tab-panel" role="tabpanel" aria-hidden="false" data-export-task-panel="terminal">
      ${sectionBlocksTerminal || emptyListHtml("terminal")}
    </div>
    <h2 class="export-print-section-title">All statuses</h2>
    <div id="brag-panel-all" class="brag-tab-panel" role="tabpanel" aria-hidden="true" hidden data-export-task-panel="all">
      ${sectionBlocksAll || emptyListHtml("all")}
    </div>
  `;

  const mainContent = useDualTaskTabs ? mainContentDual : mainContentSingle;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)}</title>
  <style>${css}</style>
</head>
<body>
  <div class="wrap">
    <header class="brag-hero">
      <div class="brag-hero__inner">
        <h1>${escapeHtml(title)}</h1>
        <p class="sub">${escapeHtml(subtitle)}</p>
        <div class="brag-hero__stats">
          ${
            useDualTaskTabs
              ? `<span class="stat"><span class="stat__num">${totalTasks}</span> terminal</span>
          <span class="stat"><span class="stat__num">${allTabRowCount}</span> all statuses</span>`
              : `<span class="stat"><span class="stat__num">${totalTasks}</span> tasks</span>`
          }
          <span class="stat"><span class="stat__num">${sectionCount}</span> ${sectionCount === 1 ? "section" : "sections"}</span>
        </div>
        <p class="meta">${escapeHtml(scopeNote)}<br />Generated ${escapeHtml(generatedAtIso)}</p>
      </div>
    </header>

    <div class="brag-toolbar print-hidden" id="brag-toolbar">
      <label class="brag-search-wrap">
        <span class="sr-only">Filter tasks</span>
        <input type="search" id="brag-search" placeholder="Filter by title, owner, tags…" autocomplete="off" />
      </label>
      <div class="brag-toolbar-actions">
        ${toolbarExtra}
        <button type="button" class="btn btn-icon" id="theme-toggle" title="Theme">Dark</button>
      </div>
    </div>

    ${filterToolbarHtml}

    ${summaryPanelHtml}

    ${worklogSummaryHtml ?? ""}

    <main id="brag-main">
      ${mainContent}
      <p id="brag-filter-empty" class="empty-state print-hidden" hidden>No tasks match your filters. Clear the search box or reset type, priority, and status to show tasks again.</p>
    </main>
  </div>

  <script type="application/json" id="export-row-slices-json">${slicesJson}</script>

  <button type="button" class="print-hidden" id="brag-to-top" aria-label="Back to top">↑</button>
  <script>${script}</script>
</body>
</html>`;
}
