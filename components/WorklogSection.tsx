"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useDashboardConfig } from "@/components/DashboardSettingsProvider";
import { DetailCollapsibleSection } from "@/components/DetailCollapsibleSection";
import { WorklogDialog } from "@/components/WorklogDialog";
import { formatJiraDuration } from "@/lib/jiraDuration";
import { aggregateWorklogsForTarget } from "@/lib/worklogs";
import type { Worklog, WorklogTarget } from "@/lib/schemas";

type RangePreset = "all" | "7d" | "30d" | "month" | "custom";

function ymd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function targetId(t: WorklogTarget): string {
  switch (t.kind) {
    case "task":
      return t.taskId;
    case "epic":
      return t.groupId;
    case "note":
      return t.entryId;
    case "project":
      return t.projectId;
    case "owner":
      return t.ownerId;
    default:
      return "";
  }
}

function rangeStorageKey(t: WorklogTarget): string {
  return `worklog-stats-range:${t.kind}:${targetId(t)}`;
}

function buildQuery(target: WorklogTarget): string {
  const q = new URLSearchParams();
  switch (target.kind) {
    case "task":
      q.set("taskId", target.taskId);
      break;
    case "epic":
      q.set("groupId", target.groupId);
      break;
    case "note":
      q.set("entryId", target.entryId);
      break;
    case "project":
      q.set("projectId", target.projectId);
      break;
    case "owner":
      q.set("ownerId", target.ownerId);
      break;
    default:
      break;
  }
  return q.toString();
}

export function WorklogSection({ target, disabled = false }: { target: WorklogTarget; disabled?: boolean }) {
  const { settings } = useDashboardConfig();
  const mpd = settings?.worklogMinutesPerDay ?? 1440;
  const [preset, setPreset] = useState<RangePreset>("all");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [logs, setLogs] = useState<Worklog[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);

  useEffect(() => {
    queueMicrotask(() => {
      try {
        const raw = localStorage.getItem(rangeStorageKey(target));
        if (raw === "7d" || raw === "30d" || raw === "month" || raw === "custom" || raw === "all") {
          setPreset(raw);
        }
      } catch {
        /* ignore */
      }
    });
  }, [target]);

  useEffect(() => {
    try {
      localStorage.setItem(rangeStorageKey(target), preset);
    } catch {
      /* ignore */
    }
  }, [target, preset]);

  const rangeBounds = useMemo(() => {
    if (preset === "all") return { from: null as string | null, to: null as string | null };
    const now = new Date();
    const to = ymd(now);
    if (preset === "7d") {
      return { from: ymd(new Date(now.getTime() - 7 * 86400000)), to };
    }
    if (preset === "30d") {
      return { from: ymd(new Date(now.getTime() - 30 * 86400000)), to };
    }
    if (preset === "month") {
      const from = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
      return { from, to };
    }
    const from = customFrom.trim().slice(0, 10);
    const t = customTo.trim().slice(0, 10);
    return {
      from: from.length === 10 ? from : null,
      to: t.length === 10 ? t : null,
    };
  }, [preset, customFrom, customTo]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const qs = buildQuery(target);
      const r = await fetch(`/api/worklogs?${qs}`);
      const data = (await r.json()) as Worklog[];
      setLogs(Array.isArray(data) ? data : []);
    } catch {
      setLogs([]);
    } finally {
      setLoading(false);
    }
  }, [target]);

  useEffect(() => {
    queueMicrotask(() => {
      void load();
    });
  }, [load]);

  const agg = useMemo(
    () => aggregateWorklogsForTarget(logs, target, rangeBounds),
    [logs, target, rangeBounds],
  );

  const displayLogs = useMemo(() => {
    const { from, to } = rangeBounds;
    return logs.filter((w) => {
      const d = w.startedAt.trim().slice(0, 10);
      if (from && d < from) return false;
      if (to && d > to) return false;
      return true;
    });
  }, [logs, rangeBounds]);

  return (
    <>
      <DetailCollapsibleSection
        title="Work log"
        titleClassName="text-lg font-semibold text-zinc-900 dark:text-zinc-50"
      >
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-zinc-500">Range</span>
            <select
              value={preset}
              onChange={(e) => setPreset(e.target.value as RangePreset)}
              className="rounded-lg border border-zinc-300 px-2 py-1.5 dark:border-zinc-600 dark:bg-zinc-900"
            >
              <option value="all">All time</option>
              <option value="7d">Last 7 days</option>
              <option value="30d">Last 30 days</option>
              <option value="month">This month</option>
              <option value="custom">Custom</option>
            </select>
          </label>
          {preset === "custom" ? (
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
            </>
          ) : null}
          <button
            type="button"
            disabled={disabled}
            onClick={() => setDialogOpen(true)}
            className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            Log work
          </button>
        </div>

        <div className="mt-4 grid gap-2 rounded-lg border border-zinc-200 bg-zinc-50/80 p-3 text-sm dark:border-zinc-800 dark:bg-zinc-900/40 sm:grid-cols-3">
          <div>
            <div className="text-zinc-500">Total (range)</div>
            <div className="font-semibold text-zinc-900 dark:text-zinc-100">
              {formatJiraDuration(agg.totalMinutes, { minutesPerDay: mpd })}
            </div>
          </div>
          <div>
            <div className="text-zinc-500">Entries</div>
            <div className="font-semibold text-zinc-900 dark:text-zinc-100">{agg.entryCount}</div>
          </div>
          <div>
            <div className="text-zinc-500">Span</div>
            <div className="text-xs text-zinc-700 dark:text-zinc-300">
              {agg.firstStartedAt && agg.lastStartedAt
                ? `${agg.firstStartedAt.slice(0, 10)} → ${agg.lastStartedAt.slice(0, 10)}`
                : "—"}
            </div>
          </div>
        </div>

        {loading ? (
          <p className="mt-3 text-sm text-zinc-500">Loading worklogs…</p>
        ) : displayLogs.length === 0 ? (
          <p className="mt-3 text-sm text-zinc-500">No worklogs in this range.</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[480px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-zinc-200 text-zinc-500 dark:border-zinc-700">
                  <th className="py-2 pr-2 font-medium">Date</th>
                  <th className="py-2 pr-2 font-medium">Time</th>
                  <th className="py-2 font-medium">Comment</th>
                </tr>
              </thead>
              <tbody>
                {displayLogs.map((w) => (
                  <tr key={w.id} className="border-b border-zinc-100 dark:border-zinc-800">
                    <td className="py-2 pr-2 whitespace-nowrap text-zinc-800 dark:text-zinc-200">
                      {w.startedAt.slice(0, 10)}
                    </td>
                    <td className="py-2 pr-2 whitespace-nowrap font-medium text-zinc-900 dark:text-zinc-100">
                      {formatJiraDuration(w.durationMinutes, { minutesPerDay: mpd })}
                    </td>
                    <td className="py-2 text-zinc-600 dark:text-zinc-400">
                      {w.comment?.trim() ? w.comment : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </DetailCollapsibleSection>

      <WorklogDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onSaved={() => void load()}
        target={target}
        minutesPerDay={mpd}
        disabled={disabled}
      />
    </>
  );
}
