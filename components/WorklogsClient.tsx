"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, Fragment } from "react";
import { useDashboardConfig } from "@/components/DashboardSettingsProvider";
import { DashboardPager } from "@/components/DashboardPager";
import { normalizeDateRange } from "@/lib/achievements";
import { API_PAGE_SIZE_DEFAULT } from "@/lib/apiPagination";
import { formatJiraDuration } from "@/lib/jiraDuration";
import type { Owner, OwnerEntry, Task, TaskGroup, Worklog } from "@/lib/schemas";

const VIEW_STORAGE_KEY = "pd-worklogs-view";
const TABLE_RANGE_STORAGE_KEY = "pd-worklogs-table-range";
const LIST_RANGE_STORAGE_KEY = "pd-worklogs-list-range";
const MAX_TABLE_RANGE_DAYS = 400;
const YMD_RE = /^\d{4}-\d{2}-\d{2}$/;

function targetHref(w: Worklog): string {
  switch (w.target.kind) {
    case "task":
      return `/tasks/${w.target.taskId}`;
    case "epic":
      return `/epics/${w.target.groupId}`;
    case "note":
      return `/notes/${w.target.entryId}`;
    case "project":
      return `/projects/${w.target.projectId}`;
    case "owner":
      return `/owners/${w.target.ownerId}`;
    default:
      return "/";
  }
}

function targetLabel(w: Worklog): string {
  switch (w.target.kind) {
    case "task":
      return "Task";
    case "epic":
      return "Epic";
    case "note":
      return "Note";
    case "project":
      return "Project";
    case "owner":
      return "Owner";
    default:
      return "?";
  }
}

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
    return { kind: "invalid", message: "Choose a start and end date for the custom range." };
  }
  const days = daySequenceYmd(from, to);
  if (days.length > MAX_TABLE_RANGE_DAYS) {
    return {
      kind: "too_long",
      message: `This range is ${days.length} days. The table supports at most ${MAX_TABLE_RANGE_DAYS} days (use a shorter range or the List view).`,
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
  minutesByDay: Record<string, number>;
  totalM: number;
};

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
  const n = new Date();
  const defaultMonth = { y: n.getFullYear(), m: n.getMonth() };
  if (typeof window === "undefined") {
    return { mode: "month", month: defaultMonth, customFrom: "", customTo: "" };
  }
  try {
    const tr = localStorage.getItem(TABLE_RANGE_STORAGE_KEY);
    if (!tr) return { mode: "month", month: defaultMonth, customFrom: "", customTo: "" };
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
        month: defaultMonth,
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
  return { mode: "month", month: defaultMonth, customFrom: "", customTo: "" };
}

export function WorklogsClient() {
  const { settings } = useDashboardConfig();
  const mpd = settings?.worklogMinutesPerDay ?? 1440;
  const [view, setView] = useState<"list" | "table">("table");

  const [logs, setLogs] = useState<Worklog[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [tableRangeBootstrap] = useState(() => readStoredTableRange());
  const [tableMonth, setTableMonth] = useState(tableRangeBootstrap.month);
  const [tableRangeMode, setTableRangeMode] = useState<"month" | "custom">(tableRangeBootstrap.mode);
  const [customFrom, setCustomFrom] = useState(tableRangeBootstrap.customFrom);
  const [customTo, setCustomTo] = useState(tableRangeBootstrap.customTo);
  const [listBootstrap] = useState(() => readStoredListRange());
  const [listFrom, setListFrom] = useState(listBootstrap.from);
  const [listTo, setListTo] = useState(listBootstrap.to);
  const [tableLogs, setTableLogs] = useState<Worklog[]>([]);
  const [owners, setOwners] = useState<Owner[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [groups, setGroups] = useState<TaskGroup[]>([]);
  const [entries, setEntries] = useState<OwnerEntry[]>([]);
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([]);
  const [tableLoading, setTableLoading] = useState(false);
  const [tableRefresh, setTableRefresh] = useState(0);

  const tableRangeSpec = useMemo(
    () => buildTableRangeSpec(tableRangeMode, tableMonth, customFrom, customTo),
    [tableRangeMode, tableMonth.y, tableMonth.m, customFrom, customTo],
  );

  useEffect(() => {
    queueMicrotask(() => {
      try {
        const v = localStorage.getItem(VIEW_STORAGE_KEY);
        if (v === "list" || v === "table") setView(v);
      } catch {
        /* ignore */
      }
    });
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(VIEW_STORAGE_KEY, view);
    } catch {
      /* ignore */
    }
  }, [view]);

  useEffect(() => {
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
  }, [tableRangeMode, tableMonth.y, tableMonth.m, customFrom, customTo]);

  useEffect(() => {
    try {
      localStorage.setItem(LIST_RANGE_STORAGE_KEY, JSON.stringify({ from: listFrom, to: listTo }));
    } catch {
      /* ignore */
    }
  }, [listFrom, listTo]);

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
  }, [listFrom, listTo]);

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
        setProjects(
          Array.isArray(pj) ? pj.map((p: { id: string; name: string }) => ({ id: p.id, name: p.name })) : [],
        );
      } catch {
        if (!cancelled) setTableLogs([]);
      } finally {
        if (!cancelled) setTableLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [view, tableRangeSpec, tableRefresh]);

  const ownerName = useCallback(
    (id: string) => owners.find((o) => o.id === id)?.name ?? id,
    [owners],
  );

  const tableBlocks = useMemo((): OwnerBlock[] => {
    const taskById = new Map(tasks.map((t) => [t.id, t] as const));
    const groupById = new Map(groups.map((g) => [g.id, g] as const));
    const entryById = new Map(entries.map((e) => [e.id, e] as const));
    const projectById = new Map(projects.map((p) => [p.id, p] as const));

    function resolveOwnerId(w: Worklog): string {
      const t = w.target;
      if (t.kind === "task") return taskById.get(t.taskId)?.ownerId ?? "__orphan__";
      if (t.kind === "epic") return groupById.get(t.groupId)?.ownerId ?? "__orphan__";
      if (t.kind === "note") {
        const e = entryById.get(t.entryId);
        return e?.ownerId ?? "__unassigned__";
      }
      if (t.kind === "project") return "__project__";
      if (t.kind === "owner") return t.ownerId;
      return "__orphan__";
    }

    function rowMeta(w: Worklog): { rowKey: string; label: string; href: string } {
      const t = w.target;
      if (t.kind === "task") {
        const task = taskById.get(t.taskId);
        const k = task?.key ?? t.taskId;
        const nm = task?.name ?? "Task";
        return { rowKey: `task:${t.taskId}`, label: `${k} · ${nm}`, href: `/tasks/${t.taskId}` };
      }
      if (t.kind === "epic") {
        const g = groupById.get(t.groupId);
        return {
          rowKey: `epic:${t.groupId}`,
          label: `${g?.key ?? "EPC"} · ${g?.name ?? "Epic"}`,
          href: `/epics/${t.groupId}`,
        };
      }
      if (t.kind === "note") {
        const e = entryById.get(t.entryId);
        return {
          rowKey: `note:${t.entryId}`,
          label: `${e?.key ?? "NTE"} · ${e?.title ?? "Note"}`,
          href: `/notes/${t.entryId}`,
        };
      }
      if (t.kind === "project") {
        const p = projectById.get(t.projectId);
        return {
          rowKey: `project:${t.projectId}`,
          label: `${p?.name ?? "Project"}`,
          href: `/projects/${t.projectId}`,
        };
      }
      if (t.kind === "owner") {
        return {
          rowKey: `ownerlog:${t.ownerId}`,
          label: "Owner time",
          href: `/owners/${t.ownerId}`,
        };
      }
      return { rowKey: "?", label: "?", href: "/" };
    }

    const byOwner = new Map<
      string,
      Map<string, { meta: { rowKey: string; label: string; href: string }; minutesByDay: Record<string, number> }>
    >();

    for (const w of tableLogs) {
      const oid = resolveOwnerId(w);
      const day = localYmd(w.startedAt);
      const meta = rowMeta(w);
      if (!byOwner.has(oid)) byOwner.set(oid, new Map());
      const m = byOwner.get(oid)!;
      if (!m.has(meta.rowKey)) {
        m.set(meta.rowKey, { meta, minutesByDay: {} });
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
          minutesByDay: v.minutesByDay,
          totalM,
        });
      }
      rows.sort((a, b) => a.label.localeCompare(b.label));
      blocks.push({
        ownerId: oid,
        ownerName: oid === "__project__" ? "Projects" : oid === "__unassigned__" ? "Unassigned" : ownerName(oid),
        rows,
        totalM: ownerTotal,
      });
    }
    return blocks;
  }, [tableLogs, tasks, groups, entries, projects, ownerName]);

  const tableDays = tableRangeSpec.kind === "ok" ? tableRangeSpec.days : [];
  const tableHeading = tableRangeSpec.kind === "ok" ? tableRangeSpec.heading : "Worklogs";

  const pageCount = Math.max(1, Math.ceil(total / API_PAGE_SIZE_DEFAULT));

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">Worklogs</h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Time logged across tasks, epics, notes, projects, and owners. Log work from any item&apos;s page.
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
              List
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
              Table
            </button>
          </div>
          <button
            type="button"
            onClick={() => {
              if (view === "list") void loadList(page);
              else setTableRefresh((n) => n + 1);
            }}
            className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm dark:border-zinc-600"
          >
            Refresh
          </button>
        </div>
      </div>

      {err ? (
        <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
          {err}
        </p>
      ) : null}

      {view === "list" ? (
        <>
          <div className="mt-4 flex flex-wrap items-end gap-3 rounded-xl border border-zinc-200 bg-zinc-50/60 p-3 dark:border-zinc-800 dark:bg-zinc-900/30">
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-zinc-500">From (optional)</span>
              <input
                type="date"
                value={listFrom}
                onChange={(e) => setListFrom(e.target.value)}
                className="rounded-lg border border-zinc-300 px-2 py-1.5 dark:border-zinc-600 dark:bg-zinc-900"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-zinc-500">To (optional)</span>
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
              Clear dates
            </button>
            <p className="w-full text-xs text-zinc-500 sm:w-auto sm:flex-1 sm:self-end">
              Inclusive local dates; leave blank for all time. Changing dates reloads from page 1.
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
            <p className="mt-6 text-zinc-500">Loading…</p>
          ) : logs.length === 0 ? (
            <p className="mt-6 text-zinc-500">
              {listFrom.trim() || listTo.trim()
                ? "No worklogs in this date range."
                : "No worklogs yet."}
            </p>
          ) : (
            <div className="mt-6 overflow-x-auto rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
              <table className="w-full min-w-[640px] border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-zinc-200 text-zinc-500 dark:border-zinc-700">
                    <th className="px-3 py-2 font-medium">Key</th>
                    <th className="px-3 py-2 font-medium">Target</th>
                    <th className="px-3 py-2 font-medium">Started</th>
                    <th className="px-3 py-2 font-medium">Time</th>
                    <th className="px-3 py-2 font-medium">Comment</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((w) => (
                    <tr key={w.id} className="border-b border-zinc-100 dark:border-zinc-800">
                      <td className="px-3 py-2 font-mono text-xs text-zinc-600 dark:text-zinc-400">{w.key}</td>
                      <td className="px-3 py-2">
                        <Link
                          href={targetHref(w)}
                          className="text-blue-600 hover:underline dark:text-blue-400"
                        >
                          {targetLabel(w)}
                        </Link>
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap text-zinc-800 dark:text-zinc-200">
                        {w.startedAt.slice(0, 16).replace("T", " ")}
                      </td>
                      <td className="px-3 py-2 font-medium text-zinc-900 dark:text-zinc-100">
                        {formatJiraDuration(w.durationMinutes, { minutesPerDay: mpd })}
                      </td>
                      <td className="max-w-md truncate px-3 py-2 text-zinc-600 dark:text-zinc-400">
                        {w.comment?.trim() || "—"}
                      </td>
                    </tr>
                  ))}
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
                  Previous month
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
                  Next month
                </button>
                <button
                  type="button"
                  className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm dark:border-zinc-600"
                  onClick={() => {
                    const n = new Date();
                    setTableMonth({ y: n.getFullYear(), m: n.getMonth() });
                  }}
                >
                  This month
                </button>
              </div>
            ) : (
              <>
                <label className="flex flex-col gap-1 text-sm">
                  <span className="text-zinc-500">From</span>
                  <input
                    type="date"
                    value={customFrom}
                    onChange={(e) => setCustomFrom(e.target.value)}
                    className="rounded-lg border border-zinc-300 px-2 py-1.5 dark:border-zinc-600 dark:bg-zinc-900"
                  />
                </label>
                <label className="flex flex-col gap-1 text-sm">
                  <span className="text-zinc-500">To</span>
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
                  Use current month
                </button>
              </>
            )}
          </div>
          {tableRangeSpec.kind === "ok" ? (
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              Range {tableRangeSpec.from} – {tableRangeSpec.to} (local dates, inclusive). Project-only logs
              appear under &quot;Projects&quot;. The table supports up to {MAX_TABLE_RANGE_DAYS} days; use List for
              longer spans.
            </p>
          ) : tableRangeSpec.kind === "invalid" ? (
            <p className="text-sm text-zinc-600 dark:text-zinc-400">{tableRangeSpec.message}</p>
          ) : (
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-100">
              {tableRangeSpec.message}
            </p>
          )}
          {tableLoading ? (
            <p className="text-zinc-500">Loading…</p>
          ) : tableRangeSpec.kind !== "ok" ? null : tableBlocks.length === 0 ? (
            <p className="text-zinc-500">No worklogs in this range.</p>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
              <table className="w-full border-collapse text-center text-xs">
                <thead>
                  <tr className="border-b border-zinc-200 bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-800/80">
                    <th
                      colSpan={4}
                      className="sticky left-0 z-20 border-r border-zinc-200 bg-zinc-100 px-2 py-2 text-left font-semibold text-zinc-800 shadow-[4px_0_8px_-4px_rgba(0,0,0,0.08)] dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:shadow-[4px_0_12px_-4px_rgba(0,0,0,0.4)]"
                    >
                      {tableHeading}
                    </th>
                    {tableDays.map((d) => {
                      const dt = new Date(d + "T12:00:00");
                      const wd = dt.getDay();
                      const weekend = wd === 0 || wd === 6;
                      return (
                        <th
                          key={d}
                          colSpan={1}
                          className={`min-w-[2.5rem] border-l border-zinc-200 px-0.5 py-1 font-medium text-zinc-700 dark:border-zinc-700 dark:text-zinc-200 ${
                            weekend ? "bg-zinc-200/60 dark:bg-zinc-700/50" : ""
                          }`}
                        >
                          <div>{d.slice(8, 10)}</div>
                          <div className="font-normal text-zinc-500 dark:text-zinc-400">
                            {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"][wd]}
                          </div>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {tableBlocks.map((block) => (
                    <Fragment key={block.ownerId}>
                      {block.rows.map((row, ri) => (
                        <tr
                          key={`${block.ownerId}-${row.rowKey}`}
                          className="border-b border-zinc-100 dark:border-zinc-800"
                        >
                          {ri === 0 ? (
                            <td
                              rowSpan={block.rows.length}
                              className="sticky left-0 z-10 w-40 min-w-40 max-w-40 border-r border-zinc-200 bg-white px-2 py-1.5 text-center align-middle font-medium text-zinc-900 shadow-[4px_0_8px_-4px_rgba(0,0,0,0.06)] dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50 dark:shadow-[4px_0_12px_-4px_rgba(0,0,0,0.35)]"
                            >
                              <span className="line-clamp-3 break-words text-center" title={block.ownerName}>
                                {block.ownerName}
                              </span>
                            </td>
                          ) : null}
                          {ri === 0 ? (
                            <td
                              rowSpan={block.rows.length}
                              className="sticky left-40 z-10 w-16 min-w-16 max-w-16 border-r border-zinc-200 bg-zinc-100 px-2 py-1.5 text-center align-middle tabular-nums text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                            >
                              {fmtHours(block.totalM) || "—"}
                            </td>
                          ) : null}
                          <td className="min-w-[12rem] max-w-xs border-r border-zinc-100 px-2 py-1.5 text-left dark:border-zinc-800">
                            <Link
                              href={row.href}
                              className="block truncate text-blue-600 hover:underline dark:text-blue-400"
                              title={row.label}
                            >
                              {row.label}
                            </Link>
                          </td>
                          <td className="w-16 min-w-16 whitespace-nowrap border-r border-zinc-200 bg-zinc-100 px-2 py-1.5 text-right tabular-nums text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100">
                            {fmtHours(row.totalM) || "—"}
                          </td>
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
                      ))}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
