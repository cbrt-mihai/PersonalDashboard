import type { AchievementsFilters } from "@/lib/achievements";
import { escapeHtml, filterTasksForAchievements, normalizeDateRange } from "@/lib/achievements";
import { isArchived } from "@/lib/archive";
import { formatJiraDuration } from "@/lib/jiraDuration";
import { entryMatchesTagKeys } from "@/lib/noteTags";
import type { Owner, OwnerEntry, Project, Task, TaskGroup, Worklog } from "@/lib/schemas";
import type { StatusDef } from "@/lib/statusConfig";
import type { WorklogEntityMaps } from "@/lib/worklogTargetDisplay";

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

export type WorklogExportSwatch = {
  color: string;
  bg: string;
  /** Owner / project icon (data URL). */
  iconDataUrl?: string;
  /** Emoji or short text inside swatch when no image. */
  glyph: string;
};

/** Roll-up bucket for epic / project / owner (`__none__` id = not linked to that dimension). */
export type WorklogAchievementRollupRow = {
  id: string;
  label: string;
  entries: number;
  minutes: number;
  /** Present when {@link attachWorklogRollupSwatches} ran (export HTML). */
  swatch?: WorklogExportSwatch;
};

/** Task `type`, note `type`, or structural labels for epic / project / owner targets. */
export type WorklogAchievementEntryTypeStats = {
  key: string;
  label: string;
  entries: number;
  minutes: number;
  swatch?: WorklogExportSwatch;
};

const ROLLUP_NONE_ID = "__none__";

function hexToTintRgba(hex: string, alpha = 0.14): string {
  const t = hex.trim();
  const m = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.exec(t);
  if (!m) return `rgba(100,116,139,${alpha})`;
  const h = m[1]!.length === 3 ? m[1]!.split("").map((c) => c + c).join("") : m[1]!;
  const n = parseInt(h, 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return `rgba(${r},${g},${b},${alpha})`;
}

function matchTaskTypeRow(
  taskTypes: readonly { label: string; color: string; bg: string; icon: string }[],
  typeName: string,
): { label: string; color: string; bg: string; icon: string } | undefined {
  const v = typeName.trim().toLowerCase();
  if (!v) return undefined;
  return taskTypes.find((r) => r.label.trim().toLowerCase() === v);
}

function ownerSwatch(id: string, maps: WorklogEntityMaps): WorklogExportSwatch {
  if (id === ROLLUP_NONE_ID) {
    return { color: "#71717a", bg: "rgba(113,113,122,0.12)", glyph: "—" };
  }
  const o = maps.ownerById.get(id);
  if (!o) return { color: "#71717a", bg: "rgba(113,113,122,0.12)", glyph: "?" };
  const g = o.name.trim().slice(0, 2) || o.key.slice(0, 2) || "·";
  return {
    color: o.color,
    bg: hexToTintRgba(o.color, 0.14),
    iconDataUrl: o.iconDataUrl ?? undefined,
    glyph: g,
  };
}

function projectSwatch(id: string, maps: WorklogEntityMaps): WorklogExportSwatch {
  if (id === ROLLUP_NONE_ID) {
    return { color: "#71717a", bg: "rgba(113,113,122,0.12)", glyph: "—" };
  }
  const p = maps.projectById.get(id);
  if (!p) return { color: "#71717a", bg: "rgba(113,113,122,0.12)", glyph: "?" };
  const g = p.name.trim().slice(0, 2) || p.key.slice(0, 2) || "·";
  return {
    color: p.color,
    bg: hexToTintRgba(p.color, 0.14),
    iconDataUrl: p.iconDataUrl ?? undefined,
    glyph: g,
  };
}

function epicSwatch(id: string, maps: WorklogEntityMaps): WorklogExportSwatch {
  if (id === ROLLUP_NONE_ID) {
    return { color: "#71717a", bg: "rgba(113,113,122,0.12)", glyph: "—" };
  }
  const group = maps.groupById.get(id);
  if (!group) return { color: "#6366f1", bg: "rgba(99,102,241,0.12)", glyph: "◎" };
  const owner = maps.ownerById.get(group.ownerId);
  const c = owner?.color ?? "#6366f1";
  const g = group.name.trim().slice(0, 2) || group.key.slice(0, 2) || "◎";
  return {
    color: c,
    bg: hexToTintRgba(c, 0.14),
    iconDataUrl: owner?.iconDataUrl ?? undefined,
    glyph: g,
  };
}

/** Attach owner / project / epic swatches for HTML export. */
export function attachWorklogRollupSwatches(
  kind: "owner" | "project" | "epic",
  rows: WorklogAchievementRollupRow[],
  maps: WorklogEntityMaps,
): WorklogAchievementRollupRow[] {
  const fn =
    kind === "owner" ? ownerSwatch : kind === "project" ? projectSwatch : epicSwatch;
  return rows.map((r) => ({ ...r, swatch: fn(r.id, maps) }));
}

export function attachWorklogEntryTypeSwatches(
  rows: WorklogAchievementEntryTypeStats[],
  taskTypes: readonly { label: string; color: string; bg: string; icon: string }[],
): WorklogAchievementEntryTypeStats[] {
  return rows.map((r) => {
    if (r.key.startsWith("task:")) {
      const ty = r.key.slice("task:".length);
      const hit = matchTaskTypeRow(taskTypes, ty);
      if (hit) {
        return {
          ...r,
          swatch: {
            color: hit.color,
            bg: hit.bg?.trim() ? hit.bg : hexToTintRgba(hit.color, 0.14),
            glyph: hit.icon?.trim() || ty.slice(0, 2),
          },
        };
      }
      return {
        ...r,
        swatch: { color: "#64748b", bg: "rgba(100,116,139,0.14)", glyph: "◆" },
      };
    }
    if (r.key.startsWith("note:")) {
      return {
        ...r,
        swatch: { color: "#7c3aed", bg: "rgba(124,58,237,0.12)", glyph: "📝" },
      };
    }
    if (r.key === "epic") {
      return { ...r, swatch: { color: "#ea580c", bg: "rgba(234,88,12,0.12)", glyph: "🎯" } };
    }
    if (r.key === "project") {
      return { ...r, swatch: { color: "#4f46e5", bg: "rgba(79,70,229,0.12)", glyph: "📁" } };
    }
    if (r.key === "owner") {
      return { ...r, swatch: { color: "#0d9488", bg: "rgba(13,148,136,0.12)", glyph: "👤" } };
    }
    return { ...r, swatch: { color: "#71717a", bg: "rgba(113,113,122,0.12)", glyph: "·" } };
  });
}

const KIND_SWATCH: Record<
  Worklog["target"]["kind"],
  { color: string; bg: string; glyph: string }
> = {
  task: { color: "#2563eb", bg: "rgba(37,99,235,0.12)", glyph: "✓" },
  epic: { color: "#ea580c", bg: "rgba(234,88,12,0.12)", glyph: "🎯" },
  project: { color: "#4f46e5", bg: "rgba(79,70,229,0.12)", glyph: "📁" },
  owner: { color: "#0d9488", bg: "rgba(13,148,136,0.12)", glyph: "👤" },
  note: { color: "#7c3aed", bg: "rgba(124,58,237,0.12)", glyph: "📝" },
};

function kindRowSwatch(
  kind: Worklog["target"]["kind"],
  taskTypes: readonly { label: string; color: string; bg: string; icon: string }[],
): WorklogExportSwatch {
  if (kind === "task") {
    const hit = matchTaskTypeRow(taskTypes, "Task") ?? taskTypes[0];
    if (hit) {
      return {
        color: hit.color,
        bg: hit.bg?.trim() ? hit.bg : hexToTintRgba(hit.color, 0.14),
        glyph: hit.icon?.trim() || "◆",
      };
    }
  }
  const d = KIND_SWATCH[kind];
  return { color: d.color, bg: d.bg, glyph: d.glyph };
}

function glyphLooksEmoji(g: string): boolean {
  const t = g.trim();
  if (!t) return false;
  const c = t.codePointAt(0);
  if (c == null) return false;
  return c >= 0x203c || (c >= 0x2600 && c <= 0x27bf) || c >= 0x1f300;
}

/** Full-row tint so bar length reflects share of total time, not the auto-sized first column. */
function worklogMetricRowTrAttrs(
  minutes: number,
  totalMinutes: number,
  sw?: WorklogExportSwatch,
): string {
  const pct = totalMinutes > 0 ? Math.min(100, (minutes / totalMinutes) * 100) : 0;
  const pctStr = `${Number(pct.toFixed(4))}%`;
  const accent = sw?.color ?? "#71717a";
  const tint = sw?.bg ?? "rgba(113,113,122,0.12)";
  const bg = `linear-gradient(to right, ${tint} 0%, ${tint} ${pctStr}, var(--surface-solid) ${pctStr}, var(--surface-solid) 100%)`;
  return `class="export-wl-dataRow" style="background:${escapeHtml(bg)};box-shadow:inset 3px 0 0 0 ${escapeHtml(accent)}"`;
}

function buildSwatchLeadCell(label: string, sw?: WorklogExportSwatch): string {
  if (!sw) {
    return `<td class="export-wl-lead"><div class="export-wl-leadRow"><span class="export-wl-name">${escapeHtml(label)}</span></div></td>`;
  }
  const emoji = glyphLooksEmoji(sw.glyph);
  const swatchClass = emoji ? "export-wl-swatch export-wl-swatch--emoji" : "export-wl-swatch";
  const glyphClass = emoji ? "export-wl-swatch__glyph export-wl-swatch__glyph--emoji" : "export-wl-swatch__glyph";
  const img =
    sw.iconDataUrl && sw.iconDataUrl.length > 0
      ? `<img class="export-wl-swatch__img" src="${escapeHtml(sw.iconDataUrl)}" width="32" height="32" alt="" decoding="async" />`
      : `<span class="${glyphClass}" aria-hidden="true">${escapeHtml(sw.glyph)}</span>`;
  return `<td class="export-wl-lead">
    <div class="export-wl-leadRow">
      <span class="${swatchClass}" style="background-color:${escapeHtml(sw.color)}">${img}</span>
      <span class="export-wl-name">${escapeHtml(label)}</span>
    </div>
  </td>`;
}

function shortUuid(u: string): string {
  return u.length <= 13 ? u : `${u.slice(0, 8)}…`;
}

function bumpRollup(
  map: Map<string, { entries: number; minutes: number }>,
  id: string,
  minutes: number,
) {
  const cur = map.get(id) ?? { entries: 0, minutes: 0 };
  cur.entries += 1;
  cur.minutes += minutes;
  map.set(id, cur);
}

/** Epic attributed from the worklog target (task’s epic, note’s epic, or epic target). */
export function epicIdForWorklogAchievementRollup(w: Worklog, maps: WorklogEntityMaps): string {
  const t = w.target;
  if (t.kind === "epic") return t.groupId;
  if (t.kind === "task") {
    const task = maps.taskById.get(t.taskId);
    return task?.groupId ?? ROLLUP_NONE_ID;
  }
  if (t.kind === "note") {
    const e = maps.entryById.get(t.entryId);
    if (!e) return ROLLUP_NONE_ID;
    if (e.taskGroupId) return e.taskGroupId;
    if (e.taskId) {
      const task = maps.taskById.get(e.taskId);
      return task?.groupId ?? ROLLUP_NONE_ID;
    }
    return ROLLUP_NONE_ID;
  }
  return ROLLUP_NONE_ID;
}

/** Project from direct project target, epic’s project, task’s epic’s project, or note links. */
export function projectIdForWorklogAchievementRollup(w: Worklog, maps: WorklogEntityMaps): string {
  const t = w.target;
  if (t.kind === "project") return t.projectId;
  if (t.kind === "task") {
    const task = maps.taskById.get(t.taskId);
    if (!task?.groupId) return ROLLUP_NONE_ID;
    const g = maps.groupById.get(task.groupId);
    return g?.projectId ?? ROLLUP_NONE_ID;
  }
  if (t.kind === "epic") {
    const g = maps.groupById.get(t.groupId);
    return g?.projectId ?? ROLLUP_NONE_ID;
  }
  if (t.kind === "note") {
    const e = maps.entryById.get(t.entryId);
    if (!e) return ROLLUP_NONE_ID;
    if (e.projectId) return e.projectId;
    if (e.taskGroupId) {
      const g = maps.groupById.get(e.taskGroupId);
      return g?.projectId ?? ROLLUP_NONE_ID;
    }
    if (e.taskId) {
      const task = maps.taskById.get(e.taskId);
      if (!task?.groupId) return ROLLUP_NONE_ID;
      const g = maps.groupById.get(task.groupId);
      return g?.projectId ?? ROLLUP_NONE_ID;
    }
    return ROLLUP_NONE_ID;
  }
  return ROLLUP_NONE_ID;
}

/** Owner from owner target, task owner, epic owner, or note / inferred links. */
export function ownerIdForWorklogAchievementRollup(w: Worklog, maps: WorklogEntityMaps): string {
  const t = w.target;
  if (t.kind === "owner") return t.ownerId;
  if (t.kind === "task") {
    const task = maps.taskById.get(t.taskId);
    return task?.ownerId ?? ROLLUP_NONE_ID;
  }
  if (t.kind === "epic") {
    const g = maps.groupById.get(t.groupId);
    return g?.ownerId ?? ROLLUP_NONE_ID;
  }
  if (t.kind === "note") {
    const e = maps.entryById.get(t.entryId);
    if (!e) return ROLLUP_NONE_ID;
    if (e.ownerId) return e.ownerId;
    if (e.taskGroupId) {
      const g = maps.groupById.get(e.taskGroupId);
      return g?.ownerId ?? ROLLUP_NONE_ID;
    }
    if (e.taskId) {
      const task = maps.taskById.get(e.taskId);
      return task?.ownerId ?? ROLLUP_NONE_ID;
    }
    return ROLLUP_NONE_ID;
  }
  return ROLLUP_NONE_ID;
}

function epicRollupLabel(id: string, maps: WorklogEntityMaps, logs: Worklog[]): string {
  if (id === ROLLUP_NONE_ID) {
    return "No epic (owner/project targets, tasks without an epic, or notes not on an epic)";
  }
  const g = maps.groupById.get(id);
  if (g) return `${g.key} – ${g.name}`;
  const snap = logs.find((w) => w.target.kind === "epic" && w.target.groupId === id);
  if (snap?.targetEntryName) {
    return snap.targetEntryKey
      ? `${snap.targetEntryKey} – ${snap.targetEntryName}`
      : snap.targetEntryName;
  }
  return `Epic (${shortUuid(id)})`;
}

function projectRollupLabel(id: string, maps: WorklogEntityMaps, logs: Worklog[]): string {
  if (id === ROLLUP_NONE_ID) {
    return "No project (owner-only targets or nothing linked to a project)";
  }
  const p = maps.projectById.get(id);
  if (p) return `${p.key} – ${p.name}`;
  const snap = logs.find((w) => w.target.kind === "project" && w.target.projectId === id);
  if (snap?.targetEntryName) {
    return snap.targetEntryKey
      ? `${snap.targetEntryKey} – ${snap.targetEntryName}`
      : snap.targetEntryName;
  }
  return `Project (${shortUuid(id)})`;
}

function ownerRollupLabel(id: string, maps: WorklogEntityMaps, logs: Worklog[]): string {
  if (id === ROLLUP_NONE_ID) {
    return "No owner (project-only worklogs or missing links)";
  }
  const o = maps.ownerById.get(id);
  if (o) return `${o.key} – ${o.name}`;
  const snap = logs.find((w) => w.target.kind === "owner" && w.target.ownerId === id);
  if (snap?.targetEntryName) {
    return snap.targetEntryKey
      ? `${snap.targetEntryKey} – ${snap.targetEntryName}`
      : snap.targetEntryName;
  }
  return `Owner (${shortUuid(id)})`;
}

function finalizeRollupMap(
  map: Map<string, { entries: number; minutes: number }>,
  labelFor: (id: string) => string,
): WorklogAchievementRollupRow[] {
  const rows: WorklogAchievementRollupRow[] = Array.from(map.entries()).map(([id, v]) => ({
    id,
    label: labelFor(id),
    entries: v.entries,
    minutes: v.minutes,
  }));
  const none = rows.filter((r) => r.id === ROLLUP_NONE_ID);
  const rest = rows.filter((r) => r.id !== ROLLUP_NONE_ID).sort((a, b) => b.minutes - a.minutes);
  none.sort((a, b) => b.minutes - a.minutes);
  return [...rest, ...none];
}

export function aggregateWorklogAchievementEntityRollups(
  logs: Worklog[],
  maps: WorklogEntityMaps,
): {
  byEpic: WorklogAchievementRollupRow[];
  byProject: WorklogAchievementRollupRow[];
  byOwner: WorklogAchievementRollupRow[];
} {
  const epicM = new Map<string, { entries: number; minutes: number }>();
  const projectM = new Map<string, { entries: number; minutes: number }>();
  const ownerM = new Map<string, { entries: number; minutes: number }>();
  for (const w of logs) {
    bumpRollup(epicM, epicIdForWorklogAchievementRollup(w, maps), w.durationMinutes);
    bumpRollup(projectM, projectIdForWorklogAchievementRollup(w, maps), w.durationMinutes);
    bumpRollup(ownerM, ownerIdForWorklogAchievementRollup(w, maps), w.durationMinutes);
  }
  return {
    byEpic: finalizeRollupMap(epicM, (id) => epicRollupLabel(id, maps, logs)),
    byProject: finalizeRollupMap(projectM, (id) => projectRollupLabel(id, maps, logs)),
    byOwner: finalizeRollupMap(ownerM, (id) => ownerRollupLabel(id, maps, logs)),
  };
}

/**
 * Groups time by task `type` and note `type`; epic / project / owner worklogs count as those labels.
 */
export function aggregateWorklogByEntryTypeStats(
  logs: Worklog[],
  maps: WorklogEntityMaps,
): WorklogAchievementEntryTypeStats[] {
  const m = new Map<string, { label: string; entries: number; minutes: number }>();
  for (const w of logs) {
    const t = w.target;
    let key: string;
    let label: string;
    if (t.kind === "task") {
      const task = maps.taskById.get(t.taskId);
      const ty = task?.type ?? "_unknown_";
      key = `task:${ty}`;
      label =
        task?.type ??
        (w.targetEntryKey ? `${w.targetEntryKey} (removed task)` : "Task (unknown type)");
    } else if (t.kind === "note") {
      const e = maps.entryById.get(t.entryId);
      const ty = e?.type ?? "_unknown_";
      key = `note:${ty}`;
      label =
        e?.type ?? (w.targetEntryKey ? `${w.targetEntryKey} (removed note)` : "Note (unknown type)");
    } else if (t.kind === "epic") {
      key = "epic";
      label = "Epic";
    } else if (t.kind === "project") {
      key = "project";
      label = "Project";
    } else if (t.kind === "owner") {
      key = "owner";
      label = "Owner";
    } else {
      continue;
    }
    const cur = m.get(key) ?? { label, entries: 0, minutes: 0 };
    cur.entries += 1;
    cur.minutes += w.durationMinutes;
    cur.label = label;
    m.set(key, cur);
  }
  return Array.from(m.entries())
    .map(([key, v]) => ({ key, label: v.label, entries: v.entries, minutes: v.minutes }))
    .sort((a, b) => b.minutes - a.minutes);
}

function rollupPanelHtml(
  title: string,
  firstColHeader: string,
  rows: WorklogAchievementRollupRow[],
  jiraOpts: { minutesPerDay: number },
  totalMinutes: number,
): string {
  if (rows.length === 0) return "";
  const body = rows
    .map(
      (r) =>
        `<tr ${worklogMetricRowTrAttrs(r.minutes, totalMinutes, r.swatch)}>${buildSwatchLeadCell(r.label, r.swatch)}<td class="export-summary__num export-wl-metric">${r.entries}</td><td class="export-summary__num export-wl-metric">${escapeHtml(formatJiraDuration(r.minutes, jiraOpts))}</td></tr>`,
    )
    .join("");
  return `<div class="export-wl-panel">
  <h3 class="export-wl-panel__title">${escapeHtml(title)}</h3>
  <div class="export-wl-tableWrap">
    <table class="export-summary__table export-wl-table">
      <thead><tr><th scope="col" class="export-wl-th-lead">${escapeHtml(firstColHeader)}</th><th scope="col" class="export-wl-th-metric">Entries</th><th scope="col" class="export-wl-th-metric">Time</th></tr></thead>
      <tbody>${body}</tbody>
    </table>
  </div>
</div>`;
}

function wlMetricTableHtml(
  title: string,
  firstColHeader: string,
  bodyRows: string,
  subtitle?: string,
): string {
  const sub = subtitle
    ? `<p class="export-wl-panel__sub">${escapeHtml(subtitle)}</p>`
    : "";
  return `<div class="export-wl-panel">
  <h3 class="export-wl-panel__title">${escapeHtml(title)}</h3>
  ${sub}
  <div class="export-wl-tableWrap">
    <table class="export-summary__table export-wl-table">
      <thead><tr><th scope="col" class="export-wl-th-lead">${escapeHtml(firstColHeader)}</th><th scope="col" class="export-wl-th-metric">Entries</th><th scope="col" class="export-wl-th-metric">Time</th></tr></thead>
      <tbody>${bodyRows}</tbody>
    </table>
  </div>
</div>`;
}

/** Standalone HTML fragment for achievements export (reuses export-summary styles). */
export function buildAchievementsWorklogSummaryHtml(opts: {
  from: string;
  to: string;
  totalMinutes: number;
  entryCount: number;
  byKind: WorklogAchievementKindStats[];
  byEpic: WorklogAchievementRollupRow[];
  byProject: WorklogAchievementRollupRow[];
  byOwner: WorklogAchievementRollupRow[];
  byEntryType: WorklogAchievementEntryTypeStats[];
  minutesPerDay: number;
  taskTypes: readonly { label: string; color: string; bg: string; icon: string }[];
}): string {
  const {
    from,
    to,
    totalMinutes,
    entryCount,
    byKind,
    byEpic,
    byProject,
    byOwner,
    byEntryType,
    minutesPerDay,
    taskTypes,
  } = opts;
  const jiraOpts = { minutesPerDay };
  const totalJira = formatJiraDuration(totalMinutes, jiraOpts);

  if (entryCount === 0) {
    return `<section class="export-summary export-worklog-summary" aria-labelledby="export-worklog-heading">
  <h2 id="export-worklog-heading" class="export-summary__title">Worklogs</h2>
  <p class="export-summary__lead">No worklogs with a start date in <strong>${escapeHtml(from)}</strong>–<strong>${escapeHtml(to)}</strong> matched these filters (or none were logged).</p>
</section>`;
  }

  const kindRows = byKind
    .map((r) => {
      const sw = kindRowSwatch(r.kind, taskTypes);
      return `<tr ${worklogMetricRowTrAttrs(r.minutes, totalMinutes, sw)}>${buildSwatchLeadCell(KIND_LABEL[r.kind], sw)}<td class="export-summary__num export-wl-metric">${r.entries}</td><td class="export-summary__num export-wl-metric">${escapeHtml(formatJiraDuration(r.minutes, jiraOpts))}</td></tr>`;
    })
    .join("");

  const entryTypeRows = byEntryType
    .map(
      (r) =>
        `<tr ${worklogMetricRowTrAttrs(r.minutes, totalMinutes, r.swatch)}>${buildSwatchLeadCell(r.label, r.swatch)}<td class="export-summary__num export-wl-metric">${r.entries}</td><td class="export-summary__num export-wl-metric">${escapeHtml(formatJiraDuration(r.minutes, jiraOpts))}</td></tr>`,
    )
    .join("");

  const epicBlock = rollupPanelHtml("Time by epic", "Epic", byEpic, jiraOpts, totalMinutes);
  const projectBlock = rollupPanelHtml("Time by project", "Project", byProject, jiraOpts, totalMinutes);
  const ownerBlock = rollupPanelHtml("Time by owner", "Owner", byOwner, jiraOpts, totalMinutes);

  const rollupGrid = [epicBlock, projectBlock, ownerBlock].filter(Boolean).join("");

  const splitTables = `${wlMetricTableHtml(
    "By worklog target",
    "Target",
    kindRows,
    "What you logged time against (task, epic, project, owner, or note).",
  )}${wlMetricTableHtml(
    "By entry type",
    "Type",
    entryTypeRows,
    "Task types and note types from your settings; epic, project, and owner rows are time logged directly on those entities.",
  )}`;

  return `<section class="export-summary export-worklog-summary" aria-labelledby="export-worklog-heading">
  <div class="export-worklog-hero">
    <h2 id="export-worklog-heading" class="export-worklog-hero__title">Worklogs</h2>
    <p class="export-worklog-hero__lead">Time logged on targets that match your filters. Start dates fall within <strong>${escapeHtml(from)}</strong>–<strong>${escapeHtml(to)}</strong> (same range as task dates above). Task-type worklogs use tasks that match type, status, priority, and tags, ignoring each task’s own date field.</p>
    <div class="export-summary__grid export-worklog-hero__stats">
      <div class="export-summary__card export-worklog-stat-card">
        <span class="export-summary__value">${escapeHtml(String(entryCount))}</span>
        <span class="export-summary__label">Worklog entries</span>
      </div>
      <div class="export-summary__card export-worklog-stat-card export-worklog-stat-card--accent">
        <span class="export-summary__value">${escapeHtml(totalJira)}</span>
        <span class="export-summary__label">Total time</span>
      </div>
    </div>
  </div>
  <div class="export-worklog-rollup-grid">${rollupGrid}</div>
  <div class="export-worklog-split">${splitTables}</div>
</section>`;
}
