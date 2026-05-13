"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useDashboardConfig } from "@/components/DashboardSettingsProvider";
import { formatJiraDuration } from "@/lib/jiraDuration";
import type { Worklog } from "@/lib/schemas";

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

export function WorklogsClient() {
  const { settings } = useDashboardConfig();
  const mpd = settings?.worklogMinutesPerDay ?? 1440;
  const [logs, setLogs] = useState<Worklog[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const r = await fetch("/api/worklogs");
      const data = (await r.json()) as Worklog[];
      if (!Array.isArray(data)) throw new Error("Bad response");
      setLogs(data.sort((a, b) => b.startedAt.localeCompare(a.startedAt)));
    } catch {
      setErr("Failed to load worklogs");
      setLogs([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    queueMicrotask(() => {
      void load();
    });
  }, [load]);

  return (
    <div className="mx-auto max-w-5xl">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">Worklogs</h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Time logged across tasks, epics, notes, projects, and owners. Log work from any item&apos;s page.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm dark:border-zinc-600"
        >
          Refresh
        </button>
      </div>

      {err ? (
        <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
          {err}
        </p>
      ) : null}

      {loading ? (
        <p className="mt-6 text-zinc-500">Loading…</p>
      ) : logs.length === 0 ? (
        <p className="mt-6 text-zinc-500">No worklogs yet.</p>
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
    </div>
  );
}
