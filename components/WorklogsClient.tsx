"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, Fragment } from "react";
import { DashboardPager } from "@/components/DashboardPager";
import { FilterMultiDropdown } from "@/components/FilterMultiDropdown";
import { WorklogDialog } from "@/components/WorklogDialog";
import { WorklogListTargetRichCell } from "@/components/WorklogListTargetRichCell";
import { OwnerSwatch, ProjectSwatch } from "@/components/OwnerSwatch";
import { useDashboardConfig } from "@/components/DashboardSettingsProvider";
import { useI18n } from "@/components/LocaleProvider";
import { normalizeDateRange } from "@/lib/achievements";
import { API_PAGE_SIZE_DEFAULT } from "@/lib/apiPagination";
import { formatJiraDuration } from "@/lib/jiraDuration";
import type { Owner, OwnerEntry, Project, Task, TaskGroup, Worklog } from "@/lib/schemas";
import { dashboardIconBtnPrimaryClass } from "@/lib/dashboardTableActionClasses";
import { PencilIcon } from "@/components/icons";
import {
  buildWorklogEntityMaps,
  resolveWorklogOwnerGroupKey,
  resolveWorklogTargetDisplay,
} from "@/lib/worklogTargetDisplay";
import { worklogMatchesUiFilters } from "@/lib/worklogs";
import type { TranslationKey, TranslationValues } from "@/lib/i18n";

const VIEW_STORAGE_KEY = "pd-worklogs-view";
const TABLE_RANGE_STORAGE_KEY = "pd-worklogs-table-range";
const LIST_RANGE_STORAGE_KEY = "pd-worklogs-list-range";
const WORKLOG_FILTERS_STORAGE_KEY = "pd-worklogs-filters-v1";
const WORKLOG_TABLE_COLS_STORAGE_KEY = "pd-worklogs-table-cols-v1";
const PROJECT_FILTER_NONE = "__none__";
const MAX_TABLE_RANGE_DAYS = 400;
const YMD_RE = /^\d{4}-\d{2}-\d{2}$/;

type PagedWorklogs = { items: Worklog[]; total: number; page: number; pageSize: number };

function isPagedWorklogs(x: unknown): x is PagedWorklogs {
  return (
    !!x &&
    typeof x === "object" &&
    "items" in x &&
    Array.isArray((x as PagedWorklogs).items) &&
    typeof (x as PagedWorklogs).total === "number"
  );
}

function localYmd(iso: string): string {
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function monthBoundsUTC(year: number, monthIndex: number): { from: string; to: string; days: string[] } {
  const first = new Date(year, monthIndex, 1);
  const last = new Date(year, monthIndex + 1, 0);
  const days: string[] = [];
  for (let d = new Date(first); d <= last; d.setDate(d.getDate() + 1)) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    days.push(`${y}-${m}-${day}`);
  }
  const fy = first.getFullYear();
  const fm = String(first.getMonth() + 1).padStart(2, "0");
  const fd = String(first.getDate()).padStart(2, "0");
  const ly = last.getFullYear();
  const lm = String(last.getMonth() + 1).padStart(2, "0");
  const ld = String(last.getDate()).padStart(2, "0");
  return { from: `${fy}-${fm}-${fd}`, to: `${ly}-${lm}-${ld}`, days };
}

/** Inclusive local-calendar days from `fromYmd` through `toYmd` (expects valid YYYY-MM-DD). */
function daySequenceYmd(fromYmd: string, toYmd: string): string[] {
  const { from, to } = normalizeDateRange(fromYmd, toYmd);
  if (!YMD_RE.test(from) || !YMD_RE.test(to)) return [];
  const [fy, fm, fd] = from.split("-").map(Number);
  const [ty, tm, td] = to.split("-").map(Number);
  const start = new Date(fy, fm - 1, fd);
  const end = new Date(ty, tm - 1, td);
  const days: string[] = [];
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    days.push(`${y}-${m}-${day}`);
  }
  return days;
}

type TableRangeSpec =
  | { kind: "ok"; from: string; to: string; days: string[]; heading: string }
  | { kind: "invalid"; message: string }
  | { kind: "too_long"; message: string };

function buildTableRangeSpec(
  mode: "month" | "custom",
  tableMonth: { y: number; m: number },
  customFrom: string,
  customTo: string,
  messages: {
    chooseCustomRange: string;
    rangeTooLong: (days: number) => string;
  },
): TableRangeSpec {
  if (mode === "month") {
    const { from, to, days } = monthBoundsUTC(tableMonth.y, tableMonth.m);
    const heading = new Date(tableMonth.y, tableMonth.m, 1).toLocaleString(undefined, {
      month: "short",
      year: "numeric",
    });
    return { kind: "ok", from, to, days, heading };
  }
  const { from, to } = normalizeDateRange(customFrom, customTo);
  if (!YMD_RE.test(from) || !YMD_RE.test(to)) {
    return { kind: "invalid", message: messages.chooseCustomRange };
  }
  const days = daySequenceYmd(from, to);
  if (days.length > MAX_TABLE_RANGE_DAYS) {
    return {
      kind: "too_long",
      message: messages.rangeTooLong(days.length),
    };
  }
  return { kind: "ok", from, to, days, heading: `${from} – ${to}` };
}

function fmtHours(mins: number): string {
  if (mins <= 0) return "";
  const h = mins / 60;
  const s = h % 1 === 0 ? String(h) : h.toFixed(2).replace(/0$/, "").replace(/\.$/, "");
  return `${s}h`;
}

type RowModel = {
  rowKey: string;
  label: string;
  href: string;
  deleted: boolean;
  minutesByDay: Record<string, number>;
  totalM: number;
  projectId: string | null;
  targetKind: Worklog["target"]["kind"];
};

type TableColsState = {
  owner: boolean;
  ownerTotal: boolean;
  project: boolean;
  entry: boolean;
  rowTotal: boolean;
};

type WorklogTableColumnId = keyof TableColsState;

const WORKLOG_TABLE_COLUMNS: WorklogTableColumnId[] = [
  "owner",
  "ownerTotal",
  "project",
  "entry",
  "rowTotal",
];

function worklogTableColumnLabel(
  id: WorklogTableColumnId,
  t: (key: TranslationKey, values?: TranslationValues) => string,
): string {
  switch (id) {
    case "owner":
      return t("worklog.columnOwnerGroup");
    case "ownerTotal":
      return t("worklog.columnOwnerTotal");
    case "project":
      return t("worklog.columnProject");
    case "entry":
      return t("worklog.columnEntry");
    case "rowTotal":
      return t("worklog.columnRowTotal");
    default:
      return id;
  }
}

const DEFAULT_TABLE_COLS: TableColsState = {
  owner: true,
  ownerTotal: true,
  project: true,
  entry: true,
  rowTotal: true,
};

function readStoredWorklogFilters(): {
  ownerIds: string[];
  projectIds: string[];
  kinds: string[];
} {
  if (typeof window === "undefined") return { ownerIds: [], projectIds: [], kinds: [] };
  try {
    const raw = localStorage.getItem(WORKLOG_FILTERS_STORAGE_KEY);
    if (!raw) return { ownerIds: [], projectIds: [], kinds: [] };
    const o = JSON.parse(raw) as { ownerIds?: unknown; projectIds?: unknown; kinds?: unknown };
    const asStrArr = (x: unknown) => (Array.isArray(x) ? x.filter((v): v is string => typeof v === "string") : []);
    return {
      ownerIds: asStrArr(o.ownerIds),
      projectIds: asStrArr(o.projectIds),
      kinds: asStrArr(o.kinds),
    };
  } catch {
    return { ownerIds: [], projectIds: [], kinds: [] };
  }
}

function readStoredTableCols(): TableColsState {
  if (typeof window === "undefined") return DEFAULT_TABLE_COLS;
  try {
    const raw = localStorage.getItem(WORKLOG_TABLE_COLS_STORAGE_KEY);
    if (!raw) return DEFAULT_TABLE_COLS;
    const o = JSON.parse(raw) as Partial<TableColsState>;
    const owner = typeof o.owner === "boolean" ? o.owner : DEFAULT_TABLE_COLS.owner;
    const ownerTotal =
      owner && (typeof o.ownerTotal === "boolean" ? o.ownerTotal : DEFAULT_TABLE_COLS.ownerTotal);
    return {
      owner,
      ownerTotal,
      project: typeof o.project === "boolean" ? o.project : DEFAULT_TABLE_COLS.project,
      entry: typeof o.entry === "boolean" ? o.entry : DEFAULT_TABLE_COLS.entry,
      rowTotal: typeof o.rowTotal === "boolean" ? o.rowTotal : DEFAULT_TABLE_COLS.rowTotal,
    };
  } catch {
    return DEFAULT_TABLE_COLS;
  }
}

function stickyLeftRem(cols: TableColsState): { owner: string; ownerTot: string; project: string; entry: string } {
  let rem = 0;
  const cur = () => `${rem}rem`;
  const out = { owner: "0rem", ownerTot: "0rem", project: "0rem", entry: "0rem" };
  const effectiveOwnerTotal = cols.owner && cols.ownerTotal;
  if (cols.owner) {
    out.owner = cur();
    rem += 9;
    if (effectiveOwnerTotal) {
      out.ownerTot = cur();
      rem += 4.5;
    }
  }
  if (cols.project) {
    out.project = cur();
    rem += 4;
  }
  if (cols.entry) {
    out.entry = cur();
  }
  return out;
}

type OwnerBlock = {
  ownerId: string;
  ownerName: string;
  rows: RowModel[];
  totalM: number;
};

function readStoredListRange(): { from: string; to: string } {
  if (typeof window === "undefined") return { from: "", to: "" };
  try {
    const lr = localStorage.getItem(LIST_RANGE_STORAGE_KEY);
    if (!lr) return { from: "", to: "" };
    const o = JSON.parse(lr) as { from?: string; to?: string };
    return {
      from: typeof o.from === "string" ? o.from : "",
      to: typeof o.to === "string" ? o.to : "",
    };
  } catch {
    return { from: "", to: "" };
  }
}

function readStoredTableRange(): {
  mode: "month" | "custom";
  month: { y: number; m: number };
  customFrom: string;
  customTo: string;
} {
  const fallback = defaultTableRange();
  if (typeof window === "undefined") return fallback;
  try {
    const tr = localStorage.getItem(TABLE_RANGE_STORAGE_KEY);
    if (!tr) return fallback;
    const o = JSON.parse(tr) as {
      mode?: string;
      y?: number;
      m?: number;
      customFrom?: string;
      customTo?: string;
    };
    if (o.mode === "custom") {
      return {
        mode: "custom",
        month: fallback.month,
        customFrom: typeof o.customFrom === "string" ? o.customFrom : "",
        customTo: typeof o.customTo === "string" ? o.customTo : "",
      };
    }
    if (o.mode === "month" && typeof o.y === "number" && typeof o.m === "number") {
      return { mode: "month", month: { y: o.y, m: o.m }, customFrom: "", customTo: "" };
    }
  } catch {
    /* ignore */
  }
  return fallback;
}

function defaultTableRange(): {
  mode: "month";
  month: { y: number; m: number };
  customFrom: string;
  customTo: string;
} {
  const n = new Date();
  const defaultMonth = { y: n.getFullYear(), m: n.getMonth() };
  return { mode: "month", month: defaultMonth, customFrom: "", customTo: "" };
}

export function WorklogsClient() {
  const { t } = useI18n();
  const { settings } = useDashboardConfig();
  const mpd = settings?.worklogMinutesPerDay ?? 1440;
  const [view, setView] = useState<"list" | "table">("table");

  const [logs, setLogs] = useState<Worklog[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [tableRangeBootstrap] = useState(() => defaultTableRange());
  const [tableMonth, setTableMonth] = useState(tableRangeBootstrap.month);
  const [tableRangeMode, setTableRangeMode] = useState<"month" | "custom">(tableRangeBootstrap.mode);
  const [customFrom, setCustomFrom] = useState(tableRangeBootstrap.customFrom);
  const [customTo, setCustomTo] = useState(tableRangeBootstrap.customTo);
  const [listBootstrap] = useState(() => ({ from: "", to: "" }));
  const [listFrom, setListFrom] = useState(listBootstrap.from);
  const [listTo, setListTo] = useState(listBootstrap.to);
  const [filterOwnerIds, setFilterOwnerIds] = useState<string[]>([]);
  const [filterProjectIds, setFilterProjectIds] = useState<string[]>([]);
  const [filterKinds, setFilterKinds] = useState<string[]>([]);
  const [listSearchInput, setListSearchInput] = useState("");
  const [listSearchDebounced, setListSearchDebounced] = useState("");
  const [tableCols, setTableCols] = useState<TableColsState>(DEFAULT_TABLE_COLS);
  const [tableLogs, setTableLogs] = useState<Worklog[]>([]);
  const [owners, setOwners] = useState<Owner[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [groups, setGroups] = useState<TaskGroup[]>([]);
  const [entries, setEntries] = useState<OwnerEntry[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [tableLoading, setTableLoading] = useState(false);
  const [tableRefresh, setTableRefresh] = useState(0);
  const [listEditWorklog, setListEditWorklog] = useState<Worklog | null>(null);
  const [listRemovingId, setListRemovingId] = useState<string | null>(null);
  const [entityCatalogReady, setEntityCatalogReady] = useState(false);
  const [storageReady, setStorageReady] = useState(false);

  const tableRangeSpec = useMemo(
    () =>
      buildTableRangeSpec(tableRangeMode, tableMonth, customFrom, customTo, {
        chooseCustomRange: t("worklog.chooseCustomRange"),
        rangeTooLong: (days) =>
          t("worklog.rangeTooLong", { days, maxDays: MAX_TABLE_RANGE_DAYS }),
      }),
    [tableRangeMode, tableMonth.y, tableMonth.m, customFrom, customTo, t],
  );

  const loadEntityCatalog = useCallback(async () => {
    try {
      const [ow, tk, gr, en, pj] = await Promise.all([
        fetch("/api/owners").then((r) => r.json()),
        fetch("/api/tasks").then((r) => r.json()),
        fetch("/api/groups").then((r) => r.json()),
        fetch("/api/entries").then((r) => r.json()),
        fetch("/api/projects").then((r) => r.json()),
      ]);
      setOwners(Array.isArray(ow) ? ow : []);
      setTasks(Array.isArray(tk) ? tk : []);
      setGroups(Array.isArray(gr) ? gr : []);
      setEntries(Array.isArray(en) ? en : []);
      setProjects(Array.isArray(pj) ? pj : []);
    } catch {
      /* ignore */
    } finally {
      setEntityCatalogReady(true);
    }
  }, []);

  const toggleWorklogTableColumn = useCallback((id: WorklogTableColumnId) => {
    setTableCols((c) => {
      let next: TableColsState;
      switch (id) {
        case "owner":
          next = { ...c, owner: !c.owner, ownerTotal: !c.owner ? false : c.ownerTotal };
          break;
        case "ownerTotal":
          next = { ...c, ownerTotal: !c.ownerTotal };
          break;
        case "project":
          next = { ...c, project: !c.project };
          break;
        case "entry":
          next = { ...c, entry: !c.entry };
          break;
        case "rowTotal":
          next = { ...c, rowTotal: !c.rowTotal };
          break;
        default:
          return c;
      }
      if (!next.owner) next.ownerTotal = false;
      if (!next.entry && !next.project) next.entry = true;
      return next;
    });
  }, []);

  useEffect(() => {
    queueMicrotask(() => {
      void loadEntityCatalog();
    });
  }, [loadEntityCatalog]);

  useEffect(() => {
    queueMicrotask(() => {
      try {
        const v = localStorage.getItem(VIEW_STORAGE_KEY);
        if (v === "list" || v === "table") setView(v);
        const tableRange = readStoredTableRange();
        setTableMonth(tableRange.month);
        setTableRangeMode(tableRange.mode);
        setCustomFrom(tableRange.customFrom);
        setCustomTo(tableRange.customTo);
        const listRange = readStoredListRange();
        setListFrom(listRange.from);
        setListTo(listRange.to);
        const fr = readStoredWorklogFilters();
        setFilterOwnerIds(fr.ownerIds);
        setFilterProjectIds(fr.projectIds);
        setFilterKinds(fr.kinds);
        setTableCols(readStoredTableCols());
      } catch {
        /* ignore */
      } finally {
        setStorageReady(true);
      }
    });
  }, []);

  useEffect(() => {
    if (!storageReady) return;
    try {
      localStorage.setItem(VIEW_STORAGE_KEY, view);
    } catch {
      /* ignore */
    }
  }, [storageReady, view]);

  useEffect(() => {
    if (!storageReady) return;
    try {
      localStorage.setItem(
        TABLE_RANGE_STORAGE_KEY,
        JSON.stringify(
          tableRangeMode === "custom"
            ? { mode: "custom", customFrom, customTo }
            : { mode: "month", y: tableMonth.y, m: tableMonth.m },
        ),
      );
    } catch {
      /* ignore */
    }
  }, [storageReady, tableRangeMode, tableMonth.y, tableMonth.m, customFrom, customTo]);

  useEffect(() => {
    if (!storageReady) return;
    try {
      localStorage.setItem(LIST_RANGE_STORAGE_KEY, JSON.stringify({ from: listFrom, to: listTo }));
    } catch {
      /* ignore */
    }
  }, [storageReady, listFrom, listTo]);

  useEffect(() => {
    if (!storageReady) return;
    try {
      localStorage.setItem(
        WORKLOG_FILTERS_STORAGE_KEY,
        JSON.stringify({
          ownerIds: filterOwnerIds,
          projectIds: filterProjectIds,
          kinds: filterKinds,
        }),
      );
    } catch {
      /* ignore */
    }
  }, [storageReady, filterOwnerIds, filterProjectIds, filterKinds]);

  useEffect(() => {
    if (!storageReady) return;
    try {
      localStorage.setItem(WORKLOG_TABLE_COLS_STORAGE_KEY, JSON.stringify(tableCols));
    } catch {
      /* ignore */
    }
  }, [storageReady, tableCols]);

  useEffect(() => {
    const t = setTimeout(() => setListSearchDebounced(listSearchInput.trim()), 400);
    return () => clearTimeout(t);
  }, [listSearchInput]);

  const loadList = useCallback(async (p: number) => {
    setLoading(true);
    setErr(null);
    try {
      const qs = new URLSearchParams({
        page: String(p),
        pageSize: String(API_PAGE_SIZE_DEFAULT),
      });
      const { from: rf, to: rt } = normalizeDateRange(listFrom, listTo);
      if (YMD_RE.test(rf)) qs.set("from", rf);
      if (YMD_RE.test(rt)) qs.set("to", rt);
      if (filterOwnerIds.length) qs.set("ownerIds", filterOwnerIds.join(","));
      if (filterProjectIds.length) qs.set("projectIds", filterProjectIds.join(","));
      if (filterKinds.length) qs.set("kinds", filterKinds.join(","));
      if (listSearchDebounced) qs.set("q", listSearchDebounced);
      const r = await fetch(`/api/worklogs?${qs.toString()}`);
      const data: unknown = await r.json();
      if (isPagedWorklogs(data)) {
        setLogs(data.items);
        setTotal(data.total);
        setPage(data.page);
      } else if (Array.isArray(data)) {
        setLogs(data.sort((a, b) => b.startedAt.localeCompare(a.startedAt)));
        setTotal(data.length);
        setPage(1);
      } else {
        throw new Error("Bad response");
      }
    } catch {
      setErr("Failed to load worklogs");
      setLogs([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [listFrom, listTo, filterOwnerIds, filterProjectIds, filterKinds, listSearchDebounced]);

  const removeListWorklog = useCallback(
    async (w: Worklog) => {
      if (
        !window.confirm(
          "Remove this worklog entry? Time and comment will be discarded. This cannot be undone.",
        )
      ) {
        return;
      }
      setListRemovingId(w.id);
      setErr(null);
      try {
        const r = await fetch(`/api/worklogs/${encodeURIComponent(w.id)}`, { method: "DELETE" });
        if (!r.ok) {
          setErr("Could not remove worklog.");
          return;
        }
        if (listEditWorklog?.id === w.id) setListEditWorklog(null);
        await loadList(page);
      } finally {
        setListRemovingId(null);
      }
    },
    [page, loadList, listEditWorklog?.id],
  );

  useEffect(() => {
    queueMicrotask(() => {
      void loadList(1);
    });
  }, [loadList]);

  useEffect(() => {
    if (view !== "table") return;
    const spec = tableRangeSpec;
    if (spec.kind !== "ok") {
      queueMicrotask(() => {
        setTableLoading(false);
        setTableLogs([]);
      });
      return;
    }
    const { from, to } = spec;
    let cancelled = false;
    queueMicrotask(async () => {
      setTableLoading(true);
      try {
        const qs = new URLSearchParams({ from, to });
        const [wl, ow, tk, gr, en, pj] = await Promise.all([
          fetch(`/api/worklogs?${qs}`).then((r) => r.json()),
          fetch("/api/owners").then((r) => r.json()),
          fetch("/api/tasks").then((r) => r.json()),
          fetch("/api/groups").then((r) => r.json()),
          fetch("/api/entries").then((r) => r.json()),
          fetch("/api/projects").then((r) => r.json()),
        ]);
        if (cancelled) return;
        const list = Array.isArray(wl) ? (wl as Worklog[]) : (wl as PagedWorklogs).items ?? [];
        setTableLogs(list);
        setOwners(Array.isArray(ow) ? ow : []);
        setTasks(Array.isArray(tk) ? tk : []);
        setGroups(Array.isArray(gr) ? gr : []);
        setEntries(Array.isArray(en) ? en : []);
        setProjects(Array.isArray(pj) ? pj : []);
        setEntityCatalogReady(true);
      } catch {
        if (!cancelled) setTableLogs([]);
        setEntityCatalogReady(true);
      } finally {
        if (!cancelled) setTableLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [view, tableRangeSpec, tableRefresh]);

  const ownerName = useCallback((id: string) => {
    if (id === "__orphan__") return t("worklog.removedTargets");
    if (id === "__project__") return t("nav.projects");
    if (id === "__unassigned__") return t("worklog.unassigned");
    return owners.find((o) => o.id === id)?.name ?? id;
  }, [owners, t]);

  const entityMaps = useMemo(
    () => buildWorklogEntityMaps(tasks, groups, entries, projects, owners),
    [tasks, groups, entries, projects, owners],
  );

  const effectiveTableCols = useMemo((): TableColsState => {
    const c = { ...tableCols };
    if (!c.owner) c.ownerTotal = false;
    if (!c.entry && !c.project) c.entry = true;
    return c;
  }, [tableCols]);

  const worklogUiFilter = useMemo(
    () => ({
      ownerIds: filterOwnerIds.length ? filterOwnerIds : null,
      projectIds: filterProjectIds.length ? filterProjectIds : null,
      kinds: filterKinds.length ? filterKinds : null,
    }),
    [filterOwnerIds, filterProjectIds, filterKinds],
  );

  const filteredTableLogs = useMemo(
    () => tableLogs.filter((w) => worklogMatchesUiFilters(w, entityMaps, worklogUiFilter)),
    [tableLogs, entityMaps, worklogUiFilter],
  );

  const ownerFilterOptions = useMemo(() => {
    const opts = owners.map((o) => ({ value: o.id, label: o.name }));
    opts.push(
      { value: "__project__", label: t("nav.projects") },
      { value: "__unassigned__", label: t("worklog.unassigned") },
      { value: "__orphan__", label: t("worklog.removedTargets") },
    );
    return opts.sort((a, b) => a.label.localeCompare(b.label));
  }, [owners, t]);

  const projectFilterOptions = useMemo(() => {
    const opts = projects.map((p) => ({ value: p.id, label: p.name }));
    opts.push({ value: PROJECT_FILTER_NONE, label: t("common.noProject") });
    return opts.sort((a, b) => a.label.localeCompare(b.label));
  }, [projects, t]);

  const kindFilterOptions = useMemo(
    () => [
      { value: "task", label: t("common.task") },
      { value: "epic", label: t("common.epic") },
      { value: "note", label: t("common.note") },
      { value: "project", label: t("worklog.kindProject") },
      { value: "owner", label: t("worklog.kindOwner") },
    ],
    [t],
  );

  const stickyRem = useMemo(() => stickyLeftRem(effectiveTableCols), [effectiveTableCols]);

  const tableBlocks = useMemo((): OwnerBlock[] => {
    function targetRowKey(w: Worklog): string {
      const t = w.target;
      if (t.kind === "task") return `task:${t.taskId}`;
      if (t.kind === "epic") return `epic:${t.groupId}`;
      if (t.kind === "note") return `note:${t.entryId}`;
      if (t.kind === "project") return `project:${t.projectId}`;
      if (t.kind === "owner") return `ownerlog:${t.ownerId}`;
      return "?";
    }

    function rowMeta(w: Worklog): { rowKey: string; label: string; href: string; deleted: boolean } {
      const r = resolveWorklogTargetDisplay(w, entityMaps);
      return {
        rowKey: targetRowKey(w),
        label: `${r.publicId} - ${r.entryName}`,
        href: r.href,
        deleted: r.deleted,
      };
    }

    const byOwner = new Map<
      string,
      Map<
        string,
        {
          meta: { rowKey: string; label: string; href: string; deleted: boolean };
          minutesByDay: Record<string, number>;
          projectId: string | null;
          targetKind: Worklog["target"]["kind"];
        }
      >
    >();

    for (const w of filteredTableLogs) {
      const oid = resolveWorklogOwnerGroupKey(w, entityMaps);
      const day = localYmd(w.startedAt);
      const meta = rowMeta(w);
      const r = resolveWorklogTargetDisplay(w, entityMaps);
      if (!byOwner.has(oid)) byOwner.set(oid, new Map());
      const m = byOwner.get(oid)!;
      if (!m.has(meta.rowKey)) {
        m.set(meta.rowKey, {
          meta,
          minutesByDay: {},
          projectId: r.projectId,
          targetKind: w.target.kind,
        });
      }
      const cell = m.get(meta.rowKey)!;
      cell.minutesByDay[day] = (cell.minutesByDay[day] ?? 0) + w.durationMinutes;
    }

    const blocks: OwnerBlock[] = [];
    const ownerIds = [...byOwner.keys()].sort((a, b) => ownerName(a).localeCompare(ownerName(b)));
    for (const oid of ownerIds) {
      const rowMap = byOwner.get(oid)!;
      const rows: RowModel[] = [];
      let ownerTotal = 0;
      for (const [, v] of rowMap) {
        let totalM = 0;
        for (const mins of Object.values(v.minutesByDay)) totalM += mins;
        ownerTotal += totalM;
        rows.push({
          rowKey: v.meta.rowKey,
          label: v.meta.label,
          href: v.meta.href,
          deleted: v.meta.deleted,
          minutesByDay: v.minutesByDay,
          totalM,
          projectId: v.projectId,
          targetKind: v.targetKind,
        });
      }
      rows.sort((a, b) => a.label.localeCompare(b.label));
      blocks.push({
        ownerId: oid,
        ownerName: ownerName(oid),
        rows,
        totalM: ownerTotal,
      });
    }
    return blocks;
  }, [filteredTableLogs, entityMaps, ownerName]);

  const tableDisplay = useMemo(() => {
    if (effectiveTableCols.owner) {
      return { mode: "grouped" as const, blocks: tableBlocks };
    }
    const rows: { row: RowModel; ownerId: string; ownerName: string }[] = [];
    for (const b of tableBlocks) {
      for (const r of b.rows) {
        rows.push({ row: r, ownerId: b.ownerId, ownerName: b.ownerName });
      }
    }
    rows.sort(
      (a, b) => a.ownerName.localeCompare(b.ownerName) || a.row.label.localeCompare(b.row.label),
    );
    return { mode: "flat" as const, rows };
  }, [tableBlocks, effectiveTableCols.owner]);

  const tableDays = tableRangeSpec.kind === "ok" ? tableRangeSpec.days : [];
  const tableHeading = tableRangeSpec.kind === "ok" ? tableRangeSpec.heading : t("nav.worklogs");

  const pageCount = Math.max(1, Math.ceil(total / API_PAGE_SIZE_DEFAULT));

  const hasStructureFilters =
    filterOwnerIds.length > 0 || filterProjectIds.length > 0 || filterKinds.length > 0;
  const hasListSearch = listSearchDebounced.length > 0;

  const worklogColumnOnlyEntry = tableCols.entry && !tableCols.project;
  const worklogColumnOnlyProject = tableCols.project && !tableCols.entry;

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
            {t("nav.worklogs")}
          </h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            {t("worklog.pageDescription")}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-lg border border-zinc-300 p-0.5 dark:border-zinc-600">
            <button
              type="button"
              onClick={() => {
                setView("list");
                void loadList(1);
              }}
              className={`rounded-md px-3 py-1.5 text-sm font-medium ${
                view === "list"
                  ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                  : "text-zinc-700 dark:text-zinc-300"
              }`}
            >
              {t("worklog.list")}
            </button>
            <button
              type="button"
              onClick={() => setView("table")}
              className={`rounded-md px-3 py-1.5 text-sm font-medium ${
                view === "table"
                  ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                  : "text-zinc-700 dark:text-zinc-300"
              }`}
            >
              {t("worklog.table")}
            </button>
          </div>
          <button
            type="button"
            onClick={() => {
              void loadEntityCatalog();
              if (view === "list") void loadList(page);
              else setTableRefresh((n) => n + 1);
            }}
            className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm dark:border-zinc-600"
          >
            {t("common.refresh")}
          </button>
        </div>
      </div>

      {err ? (
        <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
          {err}
        </p>
      ) : null}

      <div className="mt-4 flex flex-col gap-3 rounded-xl border border-zinc-200 bg-zinc-50/70 p-3 dark:border-zinc-800 dark:bg-zinc-900/40">
        <div className="flex flex-wrap items-end gap-3">
          <FilterMultiDropdown
            label={t("worklog.filterByOwner")}
            options={ownerFilterOptions}
            selected={filterOwnerIds}
            onChange={setFilterOwnerIds}
          />
          <FilterMultiDropdown
            label={t("worklog.filterByProject")}
            options={projectFilterOptions}
            selected={filterProjectIds}
            onChange={setFilterProjectIds}
          />
          <FilterMultiDropdown
            label={t("worklog.filterByKind")}
            options={kindFilterOptions}
            selected={filterKinds}
            onChange={setFilterKinds}
          />
          {view === "list" ? (
            <label className="flex min-w-[12rem] flex-1 flex-col gap-1 text-sm">
              <span className="text-zinc-500">{t("worklog.filterSearchList")}</span>
              <input
                type="search"
                value={listSearchInput}
                onChange={(e) => setListSearchInput(e.target.value)}
                placeholder={t("worklog.filterSearchPlaceholder")}
                autoComplete="off"
                className="rounded-lg border border-zinc-300 px-2 py-1.5 dark:border-zinc-600 dark:bg-zinc-900"
              />
            </label>
          ) : null}
          <button
            type="button"
            className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm dark:border-zinc-600"
            onClick={() => {
              setFilterOwnerIds([]);
              setFilterProjectIds([]);
              setFilterKinds([]);
              setListSearchInput("");
            }}
          >
            {t("worklog.clearFilters")}
          </button>
        </div>
      </div>

      {view === "list" ? (
        <>
          <div className="mt-3 flex flex-wrap items-end gap-3 rounded-xl border border-zinc-200 bg-zinc-50/60 p-3 dark:border-zinc-800 dark:bg-zinc-900/30">
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-zinc-500">{t("worklog.fromOptional")}</span>
              <input
                type="date"
                value={listFrom}
                onChange={(e) => setListFrom(e.target.value)}
                className="rounded-lg border border-zinc-300 px-2 py-1.5 dark:border-zinc-600 dark:bg-zinc-900"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-zinc-500">{t("worklog.toOptional")}</span>
              <input
                type="date"
                value={listTo}
                onChange={(e) => setListTo(e.target.value)}
                className="rounded-lg border border-zinc-300 px-2 py-1.5 dark:border-zinc-600 dark:bg-zinc-900"
              />
            </label>
            <button
              type="button"
              className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm dark:border-zinc-600"
              onClick={() => {
                setListFrom("");
                setListTo("");
              }}
            >
              {t("worklog.clearDates")}
            </button>
            <p className="w-full text-xs text-zinc-500 sm:w-auto sm:flex-1 sm:self-end">
              {t("worklog.listDateHelp")}
            </p>
          </div>
          <DashboardPager
            className="mt-4"
            page={page}
            pageCount={pageCount}
            total={total}
            pageSize={API_PAGE_SIZE_DEFAULT}
            onPageChange={(p) => void loadList(p)}
          />
          {loading ? (
            <p className="mt-6 text-zinc-500">{t("common.loading")}</p>
          ) : logs.length > 0 && !entityCatalogReady ? (
            <p className="mt-6 text-zinc-500">{t("common.loading")}</p>
          ) : logs.length === 0 ? (
            <p className="mt-6 text-zinc-500">
              {hasStructureFilters || hasListSearch
                ? t("worklog.noMatchesFilters")
                : listFrom.trim() || listTo.trim()
                  ? t("worklog.noWorklogsDateRange")
                  : t("worklog.noWorklogsYet")}
            </p>
          ) : (
            <div className="mt-6 overflow-x-auto rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
              <table className="w-full min-w-[720px] border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-zinc-200 text-zinc-500 dark:border-zinc-700">
                    <th className="min-w-[16rem] px-3 py-2 font-medium">Entry</th>
                    <th className="whitespace-nowrap px-3 py-2 font-medium">Started</th>
                    <th className="px-3 py-2 font-medium">Time</th>
                    <th className="px-3 py-2 font-medium">Comment</th>
                    <th className="min-w-[7rem] px-3 py-2 text-right font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((w) => {
                    const r = resolveWorklogTargetDisplay(w, entityMaps);
                    const owner = r.ownerId ? entityMaps.ownerById.get(r.ownerId) : undefined;
                    const project = r.projectId ? entityMaps.projectById.get(r.projectId) : undefined;
                    return (
                      <tr key={w.id} className="border-b border-zinc-100 dark:border-zinc-800">
                        <td className="px-3 py-2 align-top">
                          <WorklogListTargetRichCell resolved={r} owner={owner} project={project} />
                          <div className="mt-1 font-mono text-[10px] text-zinc-400 dark:text-zinc-500">{w.key}</div>
                        </td>
                        <td className="px-3 py-2 align-top whitespace-nowrap text-zinc-800 dark:text-zinc-200">
                          {w.startedAt.slice(0, 16).replace("T", " ")}
                        </td>
                        <td className="px-3 py-2 align-top font-medium text-zinc-900 dark:text-zinc-100">
                          {formatJiraDuration(w.durationMinutes, { minutesPerDay: mpd })}
                        </td>
                        <td className="max-w-md truncate px-3 py-2 align-top text-zinc-600 dark:text-zinc-400">
                          {w.comment?.trim() || "—"}
                        </td>
                        <td className="px-3 py-2 align-top text-right">
                          <span className="inline-flex flex-wrap items-center justify-end gap-1.5">
                            <button
                              type="button"
                              disabled={listRemovingId === w.id}
                              onClick={() => setListEditWorklog(w)}
                              className={`${dashboardIconBtnPrimaryClass} disabled:opacity-50`}
                              aria-label="Edit worklog"
                              title="Edit worklog"
                            >
                              <PencilIcon />
                            </button>
                            <button
                              type="button"
                              disabled={listRemovingId === w.id}
                              onClick={() => void removeListWorklog(w)}
                              className="rounded-md border border-red-200 px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-50 dark:border-red-900/60 dark:text-red-300 dark:hover:bg-red-950/40"
                            >
                              {listRemovingId === w.id ? "…" : "Remove"}
                            </button>
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      ) : (
        <div className="mt-6 flex flex-col gap-4">
          <div className="flex flex-wrap items-end gap-3 rounded-xl border border-zinc-200 bg-zinc-50/60 p-3 dark:border-zinc-800 dark:bg-zinc-900/30">
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-zinc-500">Period</span>
              <select
                value={tableRangeMode}
                onChange={(e) => {
                  const mode = e.target.value as "month" | "custom";
                  setTableRangeMode(mode);
                  if (mode === "custom") {
                    const cf = customFrom.trim().slice(0, 10);
                    const ct = customTo.trim().slice(0, 10);
                    if (!YMD_RE.test(cf) || !YMD_RE.test(ct)) {
                      const b = monthBoundsUTC(tableMonth.y, tableMonth.m);
                      setCustomFrom(b.from);
                      setCustomTo(b.to);
                    }
                  }
                }}
                className="rounded-lg border border-zinc-300 px-2 py-1.5 dark:border-zinc-600 dark:bg-zinc-900"
              >
                <option value="month">Calendar month</option>
                <option value="custom">Custom range</option>
              </select>
            </label>
            {tableRangeMode === "month" ? (
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm dark:border-zinc-600"
                  onClick={() =>
                    setTableMonth(({ y, m }) => {
                      const d = new Date(y, m - 1, 1);
                      return { y: d.getFullYear(), m: d.getMonth() };
                    })
                  }
                >
                  {t("worklog.previousMonth")}
                </button>
                <button
                  type="button"
                  className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm dark:border-zinc-600"
                  onClick={() =>
                    setTableMonth(({ y, m }) => {
                      const d = new Date(y, m + 1, 1);
                      return { y: d.getFullYear(), m: d.getMonth() };
                    })
                  }
                >
                  {t("worklog.nextMonth")}
                </button>
                <button
                  type="button"
                  className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm dark:border-zinc-600"
                  onClick={() => {
                    const n = new Date();
                    setTableMonth({ y: n.getFullYear(), m: n.getMonth() });
                  }}
                >
                  {t("worklog.thisMonth")}
                </button>
              </div>
            ) : (
              <>
                <label className="flex flex-col gap-1 text-sm">
                  <span className="text-zinc-500">{t("worklog.from")}</span>
                  <input
                    type="date"
                    value={customFrom}
                    onChange={(e) => setCustomFrom(e.target.value)}
                    className="rounded-lg border border-zinc-300 px-2 py-1.5 dark:border-zinc-600 dark:bg-zinc-900"
                  />
                </label>
                <label className="flex flex-col gap-1 text-sm">
                  <span className="text-zinc-500">{t("worklog.to")}</span>
                  <input
                    type="date"
                    value={customTo}
                    onChange={(e) => setCustomTo(e.target.value)}
                    className="rounded-lg border border-zinc-300 px-2 py-1.5 dark:border-zinc-600 dark:bg-zinc-900"
                  />
                </label>
                <button
                  type="button"
                  className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm dark:border-zinc-600"
                  onClick={() => {
                    const b = monthBoundsUTC(tableMonth.y, tableMonth.m);
                    setCustomFrom(b.from);
                    setCustomTo(b.to);
                  }}
                >
                  {t("worklog.useCurrentMonth")}
                </button>
              </>
            )}
          </div>
          {tableRangeSpec.kind === "ok" ? (
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              {t("worklog.tableRangeHelp", {
                from: tableRangeSpec.from,
                to: tableRangeSpec.to,
                projects: t("nav.projects"),
                maxDays: MAX_TABLE_RANGE_DAYS,
                list: t("worklog.list"),
              })}
            </p>
          ) : tableRangeSpec.kind === "invalid" ? (
            <p className="text-sm text-zinc-600 dark:text-zinc-400">{tableRangeSpec.message}</p>
          ) : (
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-100">
              {tableRangeSpec.message}
            </p>
          )}
          {tableRangeSpec.kind === "ok" ? (
            <div className="mb-2 flex flex-wrap items-center justify-end gap-2">
              <details className="relative rounded-lg border border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-900">
                <summary className="cursor-pointer list-none px-3 py-2 text-sm font-medium text-zinc-700 marker:hidden dark:text-zinc-200 [&::-webkit-details-marker]:hidden">
                  {t("dashboard.columns")}
                </summary>
                <div className="absolute right-0 z-10 mt-1 min-w-[12rem] rounded-lg border border-zinc-200 bg-white p-2 shadow-lg dark:border-zinc-600 dark:bg-zinc-950">
                  {WORKLOG_TABLE_COLUMNS.map((colId) => (
                    <label
                      key={colId}
                      className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-900"
                    >
                      <input
                        type="checkbox"
                        checked={tableCols[colId]}
                        disabled={
                          (colId === "ownerTotal" && !tableCols.owner) ||
                          (colId === "entry" && worklogColumnOnlyEntry) ||
                          (colId === "project" && worklogColumnOnlyProject)
                        }
                        onChange={() => toggleWorklogTableColumn(colId)}
                        className="rounded border-zinc-300 dark:border-zinc-600"
                      />
                      {worklogTableColumnLabel(colId, t)}
                    </label>
                  ))}
                </div>
              </details>
            </div>
          ) : null}
          {tableLoading ? (
            <p className="text-zinc-500">{t("common.loading")}</p>
          ) : tableRangeSpec.kind !== "ok" ? null : tableLogs.length === 0 ? (
            <p className="text-zinc-500">{t("worklog.noWorklogsInRange")}</p>
          ) : filteredTableLogs.length === 0 ? (
            <p className="text-zinc-500">{t("worklog.noMatchesFilters")}</p>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
              <table className="w-full min-w-[48rem] border-collapse text-center text-xs">
                <caption className="border-b border-zinc-200 bg-zinc-50 px-3 py-2.5 text-left text-sm font-semibold tracking-tight text-zinc-800 dark:border-zinc-700 dark:bg-zinc-900/60 dark:text-zinc-100">
                  {tableHeading}
                </caption>
                <thead>
                  <tr className="border-b border-zinc-200 bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-800/80">
                    {effectiveTableCols.owner ? (
                      <th
                        className="sticky z-[32] w-36 min-w-[9rem] max-w-[9rem] border-r border-zinc-200 bg-zinc-100 px-1 py-2 text-[10px] font-semibold uppercase tracking-wide text-zinc-600 shadow-[4px_0_8px_-4px_rgba(0,0,0,0.08)] dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400 dark:shadow-[4px_0_12px_-4px_rgba(0,0,0,0.35)]"
                        style={{ left: stickyRem.owner }}
                      >
                        {t("common.owner")}
                      </th>
                    ) : null}
                    {effectiveTableCols.owner && effectiveTableCols.ownerTotal ? (
                      <th
                        className="sticky z-[31] w-[4.5rem] min-w-[4.5rem] max-w-[4.5rem] border-r border-zinc-200 bg-zinc-100 px-0.5 py-2 text-[10px] font-semibold uppercase tracking-wide text-zinc-600 shadow-[4px_0_8px_-4px_rgba(0,0,0,0.06)] dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400 dark:shadow-[4px_0_12px_-4px_rgba(0,0,0,0.3)]"
                        style={{ left: stickyRem.ownerTot }}
                        title={t("worklog.columnOwnerTotal")}
                      >
                        <abbr className="no-underline" title={t("worklog.columnOwnerTotal")}>
                          Σ
                        </abbr>
                      </th>
                    ) : null}
                    {effectiveTableCols.project ? (
                      <th
                        className="sticky z-[30] w-16 min-w-16 max-w-16 border-r border-zinc-200 bg-zinc-100 px-0.5 py-2 text-[10px] font-semibold uppercase tracking-wide text-zinc-600 shadow-[4px_0_8px_-4px_rgba(0,0,0,0.06)] dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400"
                        style={{ left: stickyRem.project }}
                      >
                        {t("common.project")}
                      </th>
                    ) : null}
                    {effectiveTableCols.entry ? (
                      <th
                        className="sticky z-[29] min-w-[14rem] max-w-[18rem] border-r border-zinc-200 bg-zinc-100 px-2 py-2 text-left text-[10px] font-semibold uppercase tracking-wide text-zinc-600 shadow-[4px_0_8px_-4px_rgba(0,0,0,0.06)] dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400"
                        style={{ left: stickyRem.entry }}
                      >
                        {t("worklog.target")}
                      </th>
                    ) : null}
                    {effectiveTableCols.rowTotal ? (
                      <th
                        className="w-14 min-w-[3.5rem] border-r border-zinc-200 bg-zinc-100 px-1 py-2 text-[10px] font-semibold uppercase tracking-wide text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400"
                        title={t("worklog.columnRowTotal")}
                      >
                        <abbr className="no-underline" title={t("worklog.columnRowTotal")}>
                          Σ
                        </abbr>
                      </th>
                    ) : null}
                    {tableDays.map((d) => {
                      const dt = new Date(d + "T12:00:00");
                      const wd = dt.getDay();
                      const weekend = wd === 0 || wd === 6;
                      return (
                        <th
                          key={d}
                          className={`min-w-[2.5rem] border-l border-zinc-200 px-0.5 py-1 font-medium text-zinc-700 dark:border-zinc-700 dark:text-zinc-200 ${
                            weekend ? "bg-zinc-200/60 dark:bg-zinc-700/50" : ""
                          }`}
                        >
                          <div>{d.slice(8, 10)}</div>
                          <div className="font-normal text-zinc-500 dark:text-zinc-400">
                            {[t("worklog.sunday"), t("worklog.monday"), t("worklog.tuesday"), t("worklog.wednesday"), t("worklog.thursday"), t("worklog.friday"), t("worklog.saturday")][wd]}
                          </div>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {tableDisplay.mode === "grouped"
                    ? tableDisplay.blocks.map((block) => (
                        <Fragment key={block.ownerId}>
                          {block.rows.map((row, ri) => {
                            const ownerStored =
                              block.ownerId !== "__orphan__" &&
                              block.ownerId !== "__project__" &&
                              block.ownerId !== "__unassigned__"
                                ? entityMaps.ownerById.get(block.ownerId)
                                : undefined;
                            const ownerTint =
                              block.ownerId === "__project__"
                                ? "#6366f1"
                                : block.ownerId === "__unassigned__"
                                  ? "#94a3b8"
                                  : block.ownerId === "__orphan__"
                                    ? "#71717a"
                                    : undefined;
                            const proj = row.projectId
                              ? entityMaps.projectById.get(row.projectId)
                              : undefined;
                            return (
                              <tr
                                key={`${block.ownerId}-${row.rowKey}`}
                                className="border-b border-zinc-100 dark:border-zinc-800"
                              >
                                {effectiveTableCols.owner && ri === 0 ? (
                                  <td
                                    rowSpan={block.rows.length}
                                    className="sticky z-[32] w-36 min-w-[9rem] max-w-[9rem] border-r border-zinc-200 bg-white px-1.5 py-2 align-middle shadow-[4px_0_8px_-4px_rgba(0,0,0,0.06)] dark:border-zinc-700 dark:bg-zinc-950 dark:shadow-[4px_0_12px_-4px_rgba(0,0,0,0.35)]"
                                    style={{ left: stickyRem.owner }}
                                  >
                                    <div className="flex flex-col items-center gap-1.5">
                                      <OwnerSwatch
                                        owner={ownerStored}
                                        color={ownerTint}
                                        className="h-7 w-7 shrink-0 rounded-lg ring-1 ring-black/10 dark:ring-white/10"
                                        title={block.ownerName}
                                      />
                                      <span
                                        className="line-clamp-2 w-full max-w-[8rem] break-words text-center text-[11px] font-medium leading-tight text-zinc-800 dark:text-zinc-100"
                                        title={block.ownerName}
                                      >
                                        {block.ownerName}
                                      </span>
                                    </div>
                                  </td>
                                ) : null}
                                {effectiveTableCols.owner && effectiveTableCols.ownerTotal && ri === 0 ? (
                                  <td
                                    rowSpan={block.rows.length}
                                    className="sticky z-[31] w-[4.5rem] min-w-[4.5rem] max-w-[4.5rem] border-r border-zinc-200 bg-zinc-50 px-0.5 py-2 align-middle text-center text-sm font-semibold tabular-nums text-zinc-900 shadow-[4px_0_8px_-4px_rgba(0,0,0,0.05)] dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
                                    style={{ left: stickyRem.ownerTot }}
                                  >
                                    {fmtHours(block.totalM) || "—"}
                                  </td>
                                ) : null}
                                {effectiveTableCols.project ? (
                                  <td
                                    className="sticky z-[30] w-16 min-w-16 max-w-16 border-r border-zinc-200 bg-white px-1 py-1.5 align-middle dark:border-zinc-800 dark:bg-zinc-950"
                                    style={{ left: stickyRem.project }}
                                  >
                                    {row.projectId ? (
                                      <div className="flex flex-col items-center gap-0.5">
                                        <ProjectSwatch project={proj} className="h-6 w-6 rounded-md" />
                                        <span
                                          className="max-w-[3.25rem] truncate text-[9px] font-medium text-zinc-500 dark:text-zinc-400"
                                          title={proj?.name}
                                        >
                                          {proj?.name ?? "·"}
                                        </span>
                                      </div>
                                    ) : (
                                      <span className="text-zinc-300 dark:text-zinc-600">—</span>
                                    )}
                                  </td>
                                ) : null}
                                {effectiveTableCols.entry ? (
                                  <td
                                    className="sticky z-[29] min-w-[14rem] max-w-[18rem] border-r border-zinc-100 bg-white px-2 py-1.5 text-left align-middle dark:border-zinc-800 dark:bg-zinc-950"
                                    style={{ left: stickyRem.entry }}
                                  >
                                    {row.deleted ? (
                                      <span
                                        className="block truncate text-zinc-400 line-through decoration-zinc-400 dark:text-zinc-500"
                                        title={`${row.label} (deleted)`}
                                      >
                                        {row.label}
                                      </span>
                                    ) : (
                                      <Link
                                        href={row.href}
                                        className="block truncate text-blue-600 hover:underline dark:text-blue-400"
                                        title={row.label}
                                      >
                                        {row.label}
                                      </Link>
                                    )}
                                  </td>
                                ) : null}
                                {effectiveTableCols.rowTotal ? (
                                  <td className="w-14 min-w-[3.5rem] border-r border-zinc-200 bg-zinc-50 px-1 py-1.5 text-right align-middle text-sm font-medium tabular-nums text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100">
                                    {fmtHours(row.totalM) || "—"}
                                  </td>
                                ) : null}
                                {tableDays.map((d) => {
                                  const dt = new Date(d + "T12:00:00");
                                  const wd = dt.getDay();
                                  const weekend = wd === 0 || wd === 6;
                                  const m = row.minutesByDay[d] ?? 0;
                                  return (
                                    <td
                                      key={d}
                                      className={`border-l border-zinc-100 px-0.5 py-1 tabular-nums dark:border-zinc-800 ${
                                        weekend ? "bg-zinc-100/70 dark:bg-zinc-800/40" : ""
                                      }`}
                                    >
                                      {m ? fmtHours(m) : ""}
                                    </td>
                                  );
                                })}
                              </tr>
                            );
                          })}
                        </Fragment>
                      ))
                    : tableDisplay.rows.map(({ row }) => {
                        const proj = row.projectId
                          ? entityMaps.projectById.get(row.projectId)
                          : undefined;
                        return (
                          <tr key={row.rowKey} className="border-b border-zinc-100 dark:border-zinc-800">
                            {effectiveTableCols.project ? (
                              <td
                                className="sticky z-[30] w-16 min-w-16 max-w-16 border-r border-zinc-200 bg-white px-1 py-1.5 align-middle dark:border-zinc-800 dark:bg-zinc-950"
                                style={{ left: stickyRem.project }}
                              >
                                {row.projectId ? (
                                  <div className="flex flex-col items-center gap-0.5">
                                    <ProjectSwatch project={proj} className="h-6 w-6 rounded-md" />
                                    <span
                                      className="max-w-[3.25rem] truncate text-[9px] font-medium text-zinc-500 dark:text-zinc-400"
                                      title={proj?.name}
                                    >
                                      {proj?.name ?? "·"}
                                    </span>
                                  </div>
                                ) : (
                                  <span className="text-zinc-300 dark:text-zinc-600">—</span>
                                )}
                              </td>
                            ) : null}
                            {effectiveTableCols.entry ? (
                              <td
                                className="sticky z-[29] min-w-[14rem] max-w-[18rem] border-r border-zinc-100 bg-white px-2 py-1.5 text-left align-middle dark:border-zinc-800 dark:bg-zinc-950"
                                style={{ left: stickyRem.entry }}
                              >
                                {row.deleted ? (
                                  <span
                                    className="block truncate text-zinc-400 line-through decoration-zinc-400 dark:text-zinc-500"
                                    title={`${row.label} (deleted)`}
                                  >
                                    {row.label}
                                  </span>
                                ) : (
                                  <Link
                                    href={row.href}
                                    className="block truncate text-blue-600 hover:underline dark:text-blue-400"
                                    title={row.label}
                                  >
                                    {row.label}
                                  </Link>
                                )}
                              </td>
                            ) : null}
                            {effectiveTableCols.rowTotal ? (
                              <td className="w-14 min-w-[3.5rem] border-r border-zinc-200 bg-zinc-50 px-1 py-1.5 text-right align-middle text-sm font-medium tabular-nums text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100">
                                {fmtHours(row.totalM) || "—"}
                              </td>
                            ) : null}
                            {tableDays.map((d) => {
                              const dt = new Date(d + "T12:00:00");
                              const wd = dt.getDay();
                              const weekend = wd === 0 || wd === 6;
                              const m = row.minutesByDay[d] ?? 0;
                              return (
                                <td
                                  key={d}
                                  className={`border-l border-zinc-100 px-0.5 py-1 tabular-nums dark:border-zinc-800 ${
                                    weekend ? "bg-zinc-100/70 dark:bg-zinc-800/40" : ""
                                  }`}
                                >
                                  {m ? fmtHours(m) : ""}
                                </td>
                              );
                            })}
                          </tr>
                        );
                      })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
      {listEditWorklog ? (
        <WorklogDialog
          open
          onClose={() => setListEditWorklog(null)}
          onSaved={() => {
            setListEditWorklog(null);
            void loadList(page);
          }}
          target={listEditWorklog.target}
          minutesPerDay={mpd}
          initialWorklog={listEditWorklog}
        />
      ) : null}
    </div>
  );
}
