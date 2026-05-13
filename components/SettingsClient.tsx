"use client";

import type { ReactNode } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useDashboardConfig } from "@/components/DashboardSettingsProvider";
import { useTheme } from "@/components/ThemeProvider";
import {
  expandHex,
  HexColorPickerRow,
  TintBackgroundPickerRow,
} from "@/components/OwnerStyleColorPicker";
import type { DashboardSettings, TaskStatusRow } from "@/lib/schemas";
import { STATUS_BG_SWATCHES, STATUS_TEXT_COLOR_SWATCHES } from "@/lib/presetColors";
import type { ThemeMode } from "@/lib/themeStorage";
import {
  formatWorkdayMinutesForSettingsInput,
  JiraDurationParseError,
  parseWorkdayMinutesFromSettingsInput,
} from "@/lib/jiraDuration";

function confirmRemoveItem(label: string): boolean {
  return typeof window !== "undefined" && confirm(`Remove ${label}?`);
}

function swapAdjacent<T>(arr: T[], i: number, j: number): T[] {
  if (j < 0 || j >= arr.length) return arr;
  const next = [...arr];
  [next[i], next[j]] = [next[j]!, next[i]!];
  return next;
}

function section(title: string, children: ReactNode) {
  return (
    <section className="min-w-0 rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
      <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">{title}</h2>
      <div className="mt-4 flex flex-col gap-3">{children}</div>
    </section>
  );
}

export function SettingsClient() {
  const { theme, setTheme, themeNavToggle, setThemeNavToggle } = useTheme();
  const { settings, reload, loading } = useDashboardConfig();
  const [draft, setDraft] = useState<DashboardSettings | null>(null);
  const [worklogDayInput, setWorklogDayInput] = useState("24h");
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [paletteDialogOpen, setPaletteDialogOpen] = useState(false);
  const importInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!settings) return;
    queueMicrotask(() => setDraft(settings));
  }, [settings]);

  useEffect(() => {
    if (!draft) return;
    setWorklogDayInput(formatWorkdayMinutesForSettingsInput(draft.worklogMinutesPerDay));
  }, [draft?.worklogMinutesPerDay]);

  const exportAllData = useCallback(async () => {
    setExporting(true);
    setMsg(null);
    try {
      const r = await fetch("/api/store", { method: "GET" });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        setMsg(typeof j.error === "string" ? j.error : "Export failed");
        return;
      }
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      const cd = r.headers.get("content-disposition");
      const m = /filename="([^"]+)"/.exec(cd ?? "");
      const fallback = `personal-dashboard-store-${new Date().toISOString().slice(0, 10)}.json`;
      const filename = m?.[1] ?? fallback;

      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setMsg("Exported.");
    } catch {
      setMsg("Export failed");
    } finally {
      setExporting(false);
    }
  }, []);

  const importAllData = useCallback(async (file: File) => {
    const ok = confirm(
      "Import will REPLACE all data (owners, epics, tasks, notes, settings, and audit log). Continue?",
    );
    if (!ok) return;
    setImporting(true);
    setMsg(null);
    try {
      const text = await file.text();
      let data: unknown;
      try {
        data = JSON.parse(text);
      } catch {
        setMsg("Invalid JSON file");
        return;
      }
      const r = await fetch("/api/store", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        setMsg(typeof j.error === "string" ? j.error : "Import failed");
        return;
      }
      setMsg("Imported. Reloading…");
      window.location.reload();
    } catch {
      setMsg("Import failed");
    } finally {
      setImporting(false);
      if (importInputRef.current) importInputRef.current.value = "";
    }
  }, []);

  const save = useCallback(async () => {
    if (!draft) return;
    setSaving(true);
    setMsg(null);
    let body: DashboardSettings;
    try {
      const mpd = parseWorkdayMinutesFromSettingsInput(worklogDayInput);
      body = { ...draft, worklogMinutesPerDay: mpd };
    } catch (e) {
      setMsg(e instanceof JiraDurationParseError ? e.message : "Invalid workday length");
      setSaving(false);
      return;
    }
    try {
      const r = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        setMsg(typeof j.error === "string" ? j.error : "Save failed");
        return;
      }
      setMsg("Saved.");
      await reload();
    } catch {
      setMsg("Save failed");
    } finally {
      setSaving(false);
    }
  }, [draft, reload, worklogDayInput]);

  const resetDefaults = useCallback(async () => {
    if (!confirm("Reset all lists, colors, and task statuses to built-in defaults?")) return;
    setSaving(true);
    setMsg(null);
    try {
      const r = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reset: true }),
      });
      if (!r.ok) {
        setMsg("Reset failed");
        return;
      }
      const next: DashboardSettings = await r.json();
      setDraft(next);
      setMsg("Restored defaults.");
      await reload();
    } finally {
      setSaving(false);
    }
  }, [reload]);

  if (loading || !draft) {
    return <p className="text-zinc-500">Loading configuration…</p>;
  }

  const themes: ThemeMode[] = ["light", "dark", "system"];

  function updateStatus(i: number, patch: Partial<TaskStatusRow>) {
    setDraft((d) => {
      if (!d) return d;
      const taskStatuses = d.taskStatuses.map((row, j) =>
        j === i ? { ...row, ...patch } : row,
      );
      return { ...d, taskStatuses };
    });
  }

  function updateNoteStatus(i: number, patch: Partial<TaskStatusRow>) {
    setDraft((d) => {
      if (!d) return d;
      const noteStatuses = d.noteStatuses.map((row, j) =>
        j === i ? { ...row, ...patch } : row,
      );
      return { ...d, noteStatuses };
    });
  }

  function updateTaskTypeRow(
    i: number,
    patch: Partial<DashboardSettings["taskTypes"][number]>,
  ) {
    setDraft((d) => {
      if (!d) return d;
      const taskTypes = d.taskTypes.map((row, j) => (j === i ? { ...row, ...patch } : row));
      return { ...d, taskTypes };
    });
  }

  function updateTaskPriorityRow(
    i: number,
    patch: Partial<DashboardSettings["taskPriorities"][number]>,
  ) {
    setDraft((d) => {
      if (!d) return d;
      const taskPriorities = d.taskPriorities.map((row, j) =>
        j === i ? { ...row, ...patch } : row,
      );
      return { ...d, taskPriorities };
    });
  }

  const statusTextSwatches = draft.statusTextColorSwatches?.length
    ? draft.statusTextColorSwatches
    : STATUS_TEXT_COLOR_SWATCHES.map((value) => ({ name: value, value }));

  const statusBgSwatches = draft.statusBgSwatches?.length
    ? draft.statusBgSwatches
    : STATUS_BG_SWATCHES.map((value) => ({ name: value, value }));

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          Settings
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          Appearance uses your browser profile (stored locally). Lists and colors are saved in{" "}
          <code className="rounded bg-zinc-200 px-1 text-xs dark:bg-zinc-800">data/store.json</code>
          .
        </p>
      </div>

      {msg ? (
        <p className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900">
          {msg}
        </p>
      ) : null}

      {section(
        "Data import/export",
        <>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Export downloads a JSON backup of{" "}
            <code className="rounded bg-zinc-200 px-1 text-xs dark:bg-zinc-800">
              data/store.json
            </code>
            . Import replaces the entire file.
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={saving || exporting || importing}
              onClick={() => void exportAllData()}
              className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm dark:border-zinc-600 disabled:opacity-50"
            >
              {exporting ? "Exporting…" : "Export all data"}
            </button>
            <button
              type="button"
              disabled={saving || exporting || importing}
              onClick={() => importInputRef.current?.click()}
              className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm dark:border-zinc-600 disabled:opacity-50"
            >
              {importing ? "Importing…" : "Import data"}
            </button>
            <input
              ref={importInputRef}
              type="file"
              accept="application/json"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void importAllData(f);
              }}
            />
          </div>
        </>,
      )}

      {section(
        "Worklogs",
        <>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Jira-style durations use <code className="rounded bg-zinc-200 px-1 text-xs dark:bg-zinc-800">d</code> for a
            &quot;day&quot; of this many minutes. Use <code className="rounded bg-zinc-200 px-1 text-xs dark:bg-zinc-800">h</code>{" "}
            and <code className="rounded bg-zinc-200 px-1 text-xs dark:bg-zinc-800">m</code> (e.g.{" "}
            <code className="rounded bg-zinc-200 px-1 text-xs dark:bg-zinc-800">8h</code>,{" "}
            <code className="rounded bg-zinc-200 px-1 text-xs dark:bg-zinc-800">7h 30m</code>) or a minute count
            60–2880. Example: 8h = one working day for <code className="rounded bg-zinc-200 px-1 text-xs dark:bg-zinc-800">1d</code> in
            worklog strings.
          </p>
          <label className="flex max-w-md flex-col gap-1 text-sm">
            <span className="text-zinc-700 dark:text-zinc-300">Minutes per day</span>
            <input
              type="text"
              value={worklogDayInput}
              onChange={(e) => setWorklogDayInput(e.target.value)}
              onBlur={() => {
                try {
                  const n = parseWorkdayMinutesFromSettingsInput(worklogDayInput);
                  setDraft((d) => (d ? { ...d, worklogMinutesPerDay: n } : d));
                  setWorklogDayInput(formatWorkdayMinutesForSettingsInput(n));
                } catch {
                  /* keep text; save will surface error */
                }
              }}
              spellCheck={false}
              className="rounded-lg border border-zinc-300 px-2 py-1.5 font-mono text-sm dark:border-zinc-600 dark:bg-zinc-900"
              placeholder="8h or 480"
            />
          </label>
        </>,
      )}

      {section(
        "Appearance",
        <>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Matches the nav toggle. “System” follows your OS light/dark setting.
          </p>
          <div className="flex flex-wrap gap-2">
            {themes.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setTheme(m)}
                className={`rounded-lg border px-3 py-1.5 text-sm font-medium capitalize ${
                  theme === m
                    ? "border-blue-600 bg-blue-600 text-white"
                    : "border-zinc-300 dark:border-zinc-600"
                }`}
              >
                {m}
              </button>
            ))}
          </div>
          <div className="mt-4 border-t border-zinc-100 pt-4 dark:border-zinc-800">
            <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
              Nav theme toggle
            </p>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              Choose the control shown in the header next to the page links (stored in this
              browser).
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setThemeNavToggle("classic")}
                className={`rounded-lg border px-3 py-1.5 text-sm font-medium ${
                  themeNavToggle === "classic"
                    ? "border-blue-600 bg-blue-600 text-white"
                    : "border-zinc-300 dark:border-zinc-600"
                }`}
              >
                Classic slider
              </button>
              <button
                type="button"
                onClick={() => setThemeNavToggle("scenic")}
                className={`rounded-lg border px-3 py-1.5 text-sm font-medium ${
                  themeNavToggle === "scenic"
                    ? "border-blue-600 bg-blue-600 text-white"
                    : "border-zinc-300 dark:border-zinc-600"
                }`}
              >
                Scenic toggle
              </button>
            </div>
          </div>
        </>,
      )}

      {section(
        "Suggested color presets",
        <>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Named colors shown when creating or editing owners and projects. Choose each with the color
            picker only (no preset chips here).
          </p>
          {draft.ownerColorPresets.map((row, i) => (
            <div
              key={`${row.color}-${i}`}
              className="flex flex-col gap-2 rounded-lg border border-zinc-100 p-3 dark:border-zinc-800 sm:flex-row sm:items-start"
            >
              <label className="flex min-w-[10rem] flex-1 flex-col gap-1 text-xs text-zinc-500">
                Name
                <input
                  value={row.name}
                  onChange={(e) => {
                    const name = e.target.value;
                    setDraft((d) => {
                      if (!d) return d;
                      const ownerColorPresets = d.ownerColorPresets.map((r, j) =>
                        j === i ? { ...r, name } : r,
                      );
                      return { ...d, ownerColorPresets };
                    });
                  }}
                  className="rounded-lg border border-zinc-300 px-2 py-1.5 text-sm text-zinc-900 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
                />
              </label>
              <div className="text-sm">
                <span className="text-xs text-zinc-500">Color</span>
                <div className="mt-2">
                  <input
                    type="color"
                    value={expandHex(row.color)}
                    onChange={(e) => {
                      const color = expandHex(e.target.value);
                      setDraft((d) => {
                        if (!d) return d;
                        const ownerColorPresets = d.ownerColorPresets.map((r, j) =>
                          j === i ? { ...r, color } : r,
                        );
                        return { ...d, ownerColorPresets };
                      });
                    }}
                    className="h-8 w-14 cursor-pointer rounded border border-zinc-300 dark:border-zinc-600"
                  />
                </div>
              </div>
              <button
                type="button"
                className="self-start text-sm text-red-600 hover:underline dark:text-red-400 sm:mt-5"
                onClick={() => {
                  if (!confirmRemoveItem("this owner color preset")) return;
                  setDraft((d) => {
                    if (!d || d.ownerColorPresets.length <= 1) return d;
                    return {
                      ...d,
                      ownerColorPresets: d.ownerColorPresets.filter((_, j) => j !== i),
                    };
                  });
                }}
              >
                Remove
              </button>
            </div>
          ))}
          <button
            type="button"
            className="self-start rounded-lg border border-zinc-300 px-3 py-1.5 text-sm dark:border-zinc-600"
            onClick={() =>
              setDraft((d) =>
                d
                  ? {
                      ...d,
                      ownerColorPresets: [
                        { name: "New swatch", color: "#64748b" },
                        ...d.ownerColorPresets,
                      ],
                    }
                  : d,
              )
            }
          >
            Add color
          </button>
        </>,
      )}

      {section(
        "Task types",
        <>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Order matches dropdowns elsewhere (e.g. new task, edit task). Use the arrows to reorder.
          </p>
          {draft.taskTypes.map((row, i) => {
            const cannotRemove = draft.taskTypes.length <= 1;
            return (
              <div
                key={`${row.label}-${i}`}
                className="grid grid-cols-1 gap-3 rounded-lg border border-zinc-100 p-3 dark:border-zinc-800 sm:grid-cols-12 sm:items-end"
              >
                <div className="sm:col-span-1">
                  <div className="flex shrink-0 flex-row gap-1 sm:flex-col sm:gap-0.5">
                    <button
                      type="button"
                      disabled={i === 0}
                      aria-label="Move type up"
                      title="Move up"
                      onClick={() =>
                        setDraft((d) =>
                          d && i > 0
                            ? { ...d, taskTypes: swapAdjacent(d.taskTypes, i, i - 1) }
                            : d,
                        )
                      }
                      className="rounded border border-zinc-200 px-1.5 py-0.5 text-xs leading-none text-zinc-700 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800"
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      disabled={i === draft.taskTypes.length - 1}
                      aria-label="Move type down"
                      title="Move down"
                      onClick={() =>
                        setDraft((d) =>
                          d && i < d.taskTypes.length - 1
                            ? { ...d, taskTypes: swapAdjacent(d.taskTypes, i, i + 1) }
                            : d,
                        )
                      }
                      className="rounded border border-zinc-200 px-1.5 py-0.5 text-xs leading-none text-zinc-700 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800"
                    >
                      ↓
                    </button>
                  </div>
                </div>

                <div className="sm:col-span-2">
                  <span className="text-xs text-zinc-500">Preview</span>
                  <div className="mt-1">
                    <span
                      className="inline-flex max-w-[14rem] items-center gap-1.5 truncate rounded-full px-2 py-0.5 text-xs font-medium"
                      style={{ color: row.color, backgroundColor: row.bg }}
                      title={row.label}
                    >
                      {row.icon ? <span aria-hidden>{row.icon}</span> : null}
                      <span className="truncate">{row.label}</span>
                    </span>
                  </div>
                </div>

                <label className="flex flex-col gap-1 text-xs text-zinc-500 sm:col-span-2">
                  Icon
                  <input
                    value={row.icon ?? ""}
                    onChange={(e) => updateTaskTypeRow(i, { icon: e.target.value })}
                    className="rounded-lg border border-zinc-300 px-2 py-1 text-sm dark:border-zinc-600 dark:bg-zinc-900"
                    placeholder="🧩"
                  />
                </label>

                <label className="flex flex-col gap-1 text-xs text-zinc-500 sm:col-span-3">
                  Label
                  <input
                    value={row.label}
                    onChange={(e) => updateTaskTypeRow(i, { label: e.target.value })}
                    className="w-full rounded-lg border border-zinc-300 px-2 py-1 text-sm dark:border-zinc-600 dark:bg-zinc-900"
                  />
                </label>

                <label className="flex flex-col gap-1 text-xs text-zinc-500 sm:col-span-1">
                  Color
                  <input
                    type="color"
                    value={expandHex(row.color)}
                    onChange={(e) => updateTaskTypeRow(i, { color: expandHex(e.target.value) })}
                    className="h-8 w-14 cursor-pointer rounded border border-zinc-300 dark:border-zinc-600"
                  />
                </label>

                <div className="sm:col-span-2">
                  <span className="text-xs text-zinc-500">Background</span>
                  <div className="mt-1">
                    <TintBackgroundPickerRow
                      value={row.bg}
                      onChange={(bg) => updateTaskTypeRow(i, { bg })}
                      swatches={[]}
                    />
                  </div>
                </div>

                <div className="flex justify-end sm:col-span-1">
                  <button
                    type="button"
                    disabled={cannotRemove}
                    className="text-sm text-red-600 hover:underline disabled:cursor-not-allowed disabled:opacity-40 dark:text-red-400"
                    onClick={() => {
                      if (cannotRemove) return;
                      if (!confirmRemoveItem("this task type")) return;
                      setDraft((d) => {
                        if (!d || d.taskTypes.length <= 1) return d;
                        return { ...d, taskTypes: d.taskTypes.filter((_, j) => j !== i) };
                      });
                    }}
                    title={cannotRemove ? "At least one task type is required" : "Remove"}
                  >
                    Remove
                  </button>
                </div>
              </div>
            );
          })}
          <button
            type="button"
            className="self-start rounded-lg border border-zinc-300 px-3 py-1.5 text-sm dark:border-zinc-600"
            onClick={() =>
              setDraft((d) =>
                d
                  ? {
                      ...d,
                      taskTypes: [
                        ...d.taskTypes,
                        {
                          label: "New type",
                          color: "#64748b",
                          bg: "rgba(100,116,139,0.15)",
                          icon: "",
                        },
                      ],
                    }
                  : d,
              )
            }
          >
            Add task type
          </button>
        </>,
      )}

      {section(
        "Task priorities",
        <>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Order matches priority dropdowns and is also used when sorting by priority in tables
            (top = least urgent, bottom = most urgent). Use the arrows to reorder.
          </p>
          {draft.taskPriorities.map((row, i) => {
            const cannotRemove = draft.taskPriorities.length <= 1;
            return (
              <div
                key={`${row.label}-${i}`}
                className="grid grid-cols-1 gap-3 rounded-lg border border-zinc-100 p-3 dark:border-zinc-800 sm:grid-cols-12 sm:items-end"
              >
                <div className="sm:col-span-1">
                  <div className="flex shrink-0 flex-row gap-1 sm:flex-col sm:gap-0.5">
                    <button
                      type="button"
                      disabled={i === 0}
                      aria-label="Move priority up"
                      title="Move up"
                      onClick={() =>
                        setDraft((d) =>
                          d && i > 0
                            ? {
                                ...d,
                                taskPriorities: swapAdjacent(d.taskPriorities, i, i - 1),
                              }
                            : d,
                        )
                      }
                      className="rounded border border-zinc-200 px-1.5 py-0.5 text-xs leading-none text-zinc-700 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800"
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      disabled={i === draft.taskPriorities.length - 1}
                      aria-label="Move priority down"
                      title="Move down"
                      onClick={() =>
                        setDraft((d) =>
                          d && i < d.taskPriorities.length - 1
                            ? {
                                ...d,
                                taskPriorities: swapAdjacent(d.taskPriorities, i, i + 1),
                              }
                            : d,
                        )
                      }
                      className="rounded border border-zinc-200 px-1.5 py-0.5 text-xs leading-none text-zinc-700 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800"
                    >
                      ↓
                    </button>
                  </div>
                </div>

                <div className="sm:col-span-2">
                  <span className="text-xs text-zinc-500">Preview</span>
                  <div className="mt-1">
                    <span
                      className="inline-flex max-w-[14rem] items-center gap-1.5 truncate rounded-full px-2 py-0.5 text-xs font-medium"
                      style={{ color: row.color, backgroundColor: row.bg }}
                      title={row.label}
                    >
                      {row.icon ? <span aria-hidden>{row.icon}</span> : null}
                      <span className="truncate">{row.label}</span>
                    </span>
                  </div>
                </div>

                <label className="flex flex-col gap-1 text-xs text-zinc-500 sm:col-span-2">
                  Icon
                  <input
                    value={row.icon ?? ""}
                    onChange={(e) => updateTaskPriorityRow(i, { icon: e.target.value })}
                    className="rounded-lg border border-zinc-300 px-2 py-1 text-sm dark:border-zinc-600 dark:bg-zinc-900"
                    placeholder="🔥"
                  />
                </label>

                <label className="flex flex-col gap-1 text-xs text-zinc-500 sm:col-span-3">
                  Label
                  <input
                    value={row.label}
                    onChange={(e) => updateTaskPriorityRow(i, { label: e.target.value })}
                    className="w-full rounded-lg border border-zinc-300 px-2 py-1 text-sm dark:border-zinc-600 dark:bg-zinc-900"
                  />
                </label>

                <label className="flex flex-col gap-1 text-xs text-zinc-500 sm:col-span-1">
                  Color
                  <input
                    type="color"
                    value={expandHex(row.color)}
                    onChange={(e) => updateTaskPriorityRow(i, { color: expandHex(e.target.value) })}
                    className="h-8 w-14 cursor-pointer rounded border border-zinc-300 dark:border-zinc-600"
                  />
                </label>

                <div className="sm:col-span-2">
                  <span className="text-xs text-zinc-500">Background</span>
                  <div className="mt-1">
                    <TintBackgroundPickerRow
                      value={row.bg}
                      onChange={(bg) => updateTaskPriorityRow(i, { bg })}
                      swatches={[]}
                    />
                  </div>
                </div>

                <div className="flex justify-end sm:col-span-1">
                  <button
                    type="button"
                    disabled={cannotRemove}
                    className="text-sm text-red-600 hover:underline disabled:cursor-not-allowed disabled:opacity-40 dark:text-red-400"
                    onClick={() => {
                      if (cannotRemove) return;
                      if (!confirmRemoveItem("this task priority")) return;
                      setDraft((d) => {
                        if (!d || d.taskPriorities.length <= 1) return d;
                        return {
                          ...d,
                          taskPriorities: d.taskPriorities.filter((_, j) => j !== i),
                        };
                      });
                    }}
                    title={cannotRemove ? "At least one priority is required" : "Remove"}
                  >
                    Remove
                  </button>
                </div>
              </div>
            );
          })}
          <button
            type="button"
            className="self-start rounded-lg border border-zinc-300 px-3 py-1.5 text-sm dark:border-zinc-600"
            onClick={() =>
              setDraft((d) =>
                d
                  ? {
                      ...d,
                      taskPriorities: [
                        ...d.taskPriorities,
                        { label: "New", color: "#64748b", bg: "rgba(100,116,139,0.15)", icon: "" },
                      ],
                    }
                  : d,
              )
            }
          >
            Add priority
          </button>
        </>,
      )}

      {section(
        "Note types",
        <>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Default note types for every note (any owner or project). Order matches note type dropdowns. Use the arrows to reorder.
          </p>
          {draft.noteTypes.map((t, i) => (
            <div key={i} className="flex items-center gap-2">
              <div className="flex shrink-0 flex-col gap-0.5">
                <button
                  type="button"
                  disabled={i === 0}
                  aria-label="Move note type up"
                  title="Move up"
                  onClick={() =>
                    setDraft((d) =>
                      d && i > 0 ? { ...d, noteTypes: swapAdjacent(d.noteTypes, i, i - 1) } : d,
                    )
                  }
                  className="rounded border border-zinc-200 px-1.5 py-0.5 text-xs leading-none text-zinc-700 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800"
                >
                  ↑
                </button>
                <button
                  type="button"
                  disabled={i === draft.noteTypes.length - 1}
                  aria-label="Move note type down"
                  title="Move down"
                  onClick={() =>
                    setDraft((d) =>
                      d && i < d.noteTypes.length - 1
                        ? { ...d, noteTypes: swapAdjacent(d.noteTypes, i, i + 1) }
                        : d,
                    )
                  }
                  className="rounded border border-zinc-200 px-1.5 py-0.5 text-xs leading-none text-zinc-700 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800"
                >
                  ↓
                </button>
              </div>
              <input
                value={t}
                onChange={(e) => {
                  const v = e.target.value;
                  setDraft((d) => {
                    if (!d) return d;
                    const noteTypes = [...d.noteTypes];
                    noteTypes[i] = v;
                    return { ...d, noteTypes };
                  });
                }}
                className="flex-1 rounded-lg border border-zinc-300 px-2 py-1 text-sm dark:border-zinc-600 dark:bg-zinc-900"
              />
              <button
                type="button"
                className="shrink-0 text-sm text-red-600 dark:text-red-400"
                onClick={() => {
                  if (!confirmRemoveItem("this note type")) return;
                  setDraft((d) => {
                    if (!d || d.noteTypes.length <= 1) return d;
                    return { ...d, noteTypes: d.noteTypes.filter((_, j) => j !== i) };
                  });
                }}
              >
                Remove
              </button>
            </div>
          ))}
          <button
            type="button"
            className="self-start rounded-lg border border-zinc-300 px-3 py-1.5 text-sm dark:border-zinc-600"
            onClick={() => setDraft((d) => (d ? { ...d, noteTypes: [...d.noteTypes, "New"] } : d))}
          >
            Add note type
          </button>
        </>,
      )}

      {section(
        "Notes statuses",
        <>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            <code className="rounded bg-zinc-100 px-1 text-xs dark:bg-zinc-800">Id</code> is stored on
            owner notes (normalized like task statuses). Changing ids can orphan existing notes
            until you edit their status. This list is independent from task statuses.
          </p>
          <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
            <table className="w-full min-w-[72rem] text-left text-sm">
              <thead>
                <tr className="border-b border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900/50">
                  <th className="p-2 font-medium">Id</th>
                  <th className="p-2 font-medium">Label</th>
                  <th className="min-w-[11rem] p-2 font-medium">Color</th>
                  <th className="min-w-[11rem] p-2 font-medium">Background</th>
                  <th className="p-2 font-medium">Order</th>
                  <th className="p-2 font-medium">Terminal</th>
                  <th className="sticky right-0 z-10 p-2 text-right font-medium bg-zinc-50 dark:bg-zinc-900/50">
                    Remove
                  </th>
                </tr>
              </thead>
              <tbody>
                {draft.noteStatuses.map((row, i) => (
                  <tr key={i} className="border-b border-zinc-100 dark:border-zinc-800/80">
                    <td className="p-1 align-top">
                      <input
                        value={row.id}
                        onChange={(e) => updateNoteStatus(i, { id: e.target.value })}
                        className="w-full rounded border border-zinc-200 px-1 py-0.5 font-mono text-xs dark:border-zinc-700 dark:bg-zinc-900"
                      />
                    </td>
                    <td className="p-1 align-top">
                      <input
                        value={row.label}
                        onChange={(e) => updateNoteStatus(i, { label: e.target.value })}
                        className="w-full rounded border border-zinc-200 px-1 py-0.5 dark:border-zinc-700 dark:bg-zinc-900"
                      />
                    </td>
                    <td className="p-1 align-top">
                      <div className="flex flex-col gap-1">
                        <span
                          className="inline-flex w-fit items-center gap-1.5 rounded-full border border-zinc-200 px-2 py-0.5 text-xs font-medium dark:border-zinc-600"
                          style={{ color: row.color, backgroundColor: row.bg }}
                        >
                          Preview
                        </span>
                        <HexColorPickerRow
                          value={row.color}
                          onChange={(color) => updateNoteStatus(i, { color })}
                          swatches={statusTextSwatches.map((s) => s.value)}
                          swatchTitles={statusTextSwatches.map((s) => s.name)}
                        />
                      </div>
                    </td>
                    <td className="p-1 align-top">
                      <div className="flex flex-col gap-1">
                        <span
                          className="h-6 w-full max-w-[10rem] rounded-md border border-zinc-200 dark:border-zinc-600"
                          style={{ backgroundColor: row.bg }}
                          title={row.bg}
                          aria-hidden
                        />
                        <TintBackgroundPickerRow
                          value={row.bg}
                          onChange={(bg) => updateNoteStatus(i, { bg })}
                          swatches={statusBgSwatches.map((s) => s.value)}
                          swatchTitles={statusBgSwatches.map((s) => s.name)}
                        />
                      </div>
                    </td>
                    <td className="p-1 align-top">
                      <input
                        type="number"
                        value={row.order}
                        onChange={(e) =>
                          updateNoteStatus(i, { order: Number.parseInt(e.target.value, 10) || 0 })
                        }
                        className="w-16 rounded border border-zinc-200 px-1 py-0.5 dark:border-zinc-700 dark:bg-zinc-900"
                      />
                    </td>
                    <td className="p-1 align-top text-center">
                      <input
                        type="checkbox"
                        checked={Boolean(row.terminal)}
                        onChange={(e) => updateNoteStatus(i, { terminal: e.target.checked })}
                      />
                    </td>
                    <td className="sticky right-0 z-10 border-l border-zinc-100 bg-white p-1 align-top text-right dark:border-zinc-800/80 dark:bg-zinc-950">
                      <button
                        type="button"
                        className="text-xs text-red-600 dark:text-red-400"
                        onClick={() => {
                          if (!confirmRemoveItem("this note status")) return;
                          setDraft((d) => {
                            if (!d || d.noteStatuses.length <= 1) return d;
                            return {
                              ...d,
                              noteStatuses: d.noteStatuses.filter((_, j) => j !== i),
                            };
                          });
                        }}
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button
            type="button"
            className="self-start rounded-lg border border-zinc-300 px-3 py-1.5 text-sm dark:border-zinc-600"
            onClick={() => setPaletteDialogOpen(true)}
          >
            Add/Edit palette
          </button>
          <button
            type="button"
            className="self-start rounded-lg border border-zinc-300 px-3 py-1.5 text-sm dark:border-zinc-600"
            onClick={() =>
              setDraft((d) =>
                d
                  ? {
                      ...d,
                      noteStatuses: [
                        ...d.noteStatuses,
                        {
                          id: "new_note_status",
                          label: "New note status",
                          color: "#737373",
                          bg: "rgba(115,115,115,0.12)",
                          order: Math.max(...d.noteStatuses.map((s) => s.order), 0) + 1,
                        },
                      ],
                    }
                  : d,
              )
            }
          >
            Add note status
          </button>
        </>,
      )}

      {section(
        "Task statuses",
        <>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            <code className="rounded bg-zinc-100 px-1 text-xs dark:bg-zinc-800">Id</code> is stored on
            tasks (normalized to lowercase with spaces as underscores). Changing ids can orphan
            existing tasks until you edit their status.
          </p>
          <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
            <table className="w-full min-w-[72rem] text-left text-sm">
              <thead>
                <tr className="border-b border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900/50">
                  <th className="p-2 font-medium">Id</th>
                  <th className="p-2 font-medium">Label</th>
                  <th className="min-w-[11rem] p-2 font-medium">Color</th>
                  <th className="min-w-[11rem] p-2 font-medium">Background</th>
                  <th className="p-2 font-medium">Order</th>
                  <th className="p-2 font-medium">Terminal</th>
                  <th className="sticky right-0 z-10 p-2 text-right font-medium bg-zinc-50 dark:bg-zinc-900/50">
                    Remove
                  </th>
                </tr>
              </thead>
              <tbody>
                {draft.taskStatuses.map((row, i) => (
                  <tr key={i} className="border-b border-zinc-100 dark:border-zinc-800/80">
                    <td className="p-1 align-top">
                      <input
                        value={row.id}
                        onChange={(e) => updateStatus(i, { id: e.target.value })}
                        className="w-full rounded border border-zinc-200 px-1 py-0.5 font-mono text-xs dark:border-zinc-700 dark:bg-zinc-900"
                      />
                    </td>
                    <td className="p-1 align-top">
                      <input
                        value={row.label}
                        onChange={(e) => updateStatus(i, { label: e.target.value })}
                        className="w-full rounded border border-zinc-200 px-1 py-0.5 dark:border-zinc-700 dark:bg-zinc-900"
                      />
                    </td>
                    <td className="p-1 align-top">
                      <div className="flex flex-col gap-1">
                        <span
                          className="inline-flex w-fit items-center gap-1.5 rounded-full border border-zinc-200 px-2 py-0.5 text-xs font-medium dark:border-zinc-600"
                          style={{ color: row.color, backgroundColor: row.bg }}
                        >
                          Preview
                        </span>
                        <HexColorPickerRow
                          value={row.color}
                          onChange={(color) => updateStatus(i, { color })}
                          swatches={statusTextSwatches.map((s) => s.value)}
                          swatchTitles={statusTextSwatches.map((s) => s.name)}
                        />
                      </div>
                    </td>
                    <td className="p-1 align-top">
                      <div className="flex flex-col gap-1">
                        <span
                          className="h-6 w-full max-w-[10rem] rounded-md border border-zinc-200 dark:border-zinc-600"
                          style={{ backgroundColor: row.bg }}
                          title={row.bg}
                          aria-hidden
                        />
                        <TintBackgroundPickerRow
                          value={row.bg}
                          onChange={(bg) => updateStatus(i, { bg })}
                          swatches={statusBgSwatches.map((s) => s.value)}
                          swatchTitles={statusBgSwatches.map((s) => s.name)}
                        />
                      </div>
                    </td>
                    <td className="p-1 align-top">
                      <input
                        type="number"
                        value={row.order}
                        onChange={(e) =>
                          updateStatus(i, { order: Number.parseInt(e.target.value, 10) || 0 })
                        }
                        className="w-16 rounded border border-zinc-200 px-1 py-0.5 dark:border-zinc-700 dark:bg-zinc-900"
                      />
                    </td>
                    <td className="p-1 align-top text-center">
                      <input
                        type="checkbox"
                        checked={Boolean(row.terminal)}
                        onChange={(e) => updateStatus(i, { terminal: e.target.checked })}
                      />
                    </td>
                    <td className="sticky right-0 z-10 border-l border-zinc-100 bg-white p-1 align-top text-right dark:border-zinc-800/80 dark:bg-zinc-950">
                      <button
                        type="button"
                        className="text-xs text-red-600 dark:text-red-400"
                        onClick={() => {
                          if (!confirmRemoveItem("this task status")) return;
                          setDraft((d) => {
                            if (!d || d.taskStatuses.length <= 1) return d;
                            return {
                              ...d,
                              taskStatuses: d.taskStatuses.filter((_, j) => j !== i),
                            };
                          });
                        }}
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button
            type="button"
            className="self-start rounded-lg border border-zinc-300 px-3 py-1.5 text-sm dark:border-zinc-600"
            onClick={() => setPaletteDialogOpen(true)}
          >
            Add/Edit palette
          </button>
          <button
            type="button"
            className="self-start rounded-lg border border-zinc-300 px-3 py-1.5 text-sm dark:border-zinc-600"
            onClick={() =>
              setDraft((d) =>
                d
                  ? {
                      ...d,
                      taskStatuses: [
                        ...d.taskStatuses,
                        {
                          id: "new_status",
                          label: "New status",
                          color: "#737373",
                          bg: "rgba(115,115,115,0.12)",
                          order: Math.max(...d.taskStatuses.map((s) => s.order), 0) + 1,
                        },
                      ],
                    }
                  : d,
              )
            }
          >
            Add status
          </button>
        </>,
      )}

      {paletteDialogOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-xl bg-white p-6 shadow-xl dark:bg-zinc-950">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
                  Status palette
                </h3>
                <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                  Names appear on hover after 1 second.
                </p>
              </div>
              <button
                type="button"
                className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm dark:border-zinc-600"
                onClick={() => setPaletteDialogOpen(false)}
              >
                Close
              </button>
            </div>

            <div className="mt-6 grid gap-6 lg:grid-cols-2">
              <div className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
                <div className="flex items-center justify-between gap-2">
                  <h4 className="font-medium text-zinc-900 dark:text-zinc-100">Text color swatches</h4>
                  <button
                    type="button"
                    className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm dark:border-zinc-600"
                    onClick={() =>
                      setDraft((d) =>
                        d
                          ? {
                              ...d,
                              statusTextColorSwatches: [
                                { name: "New", value: "#64748b" },
                                ...(d.statusTextColorSwatches ?? []),
                              ],
                            }
                          : d,
                      )
                    }
                  >
                    Add
                  </button>
                </div>
                <div className="mt-3 flex flex-col gap-2">
                  {(draft.statusTextColorSwatches ?? []).map((row, i) => (
                    <div key={i} className="flex flex-wrap items-end gap-2">
                      <label className="flex min-w-[12rem] flex-1 flex-col gap-1 text-xs text-zinc-500">
                        Name
                        <input
                          value={row.name}
                          onChange={(e) => {
                            const name = e.target.value;
                            setDraft((d) => {
                              if (!d) return d;
                              const next = [...(d.statusTextColorSwatches ?? [])];
                              next[i] = { ...next[i]!, name };
                              return { ...d, statusTextColorSwatches: next };
                            });
                          }}
                          className="rounded-lg border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-600 dark:bg-zinc-900"
                        />
                      </label>
                      <label className="flex flex-col gap-1 text-xs text-zinc-500">
                        Color
                        <input
                          type="color"
                          value={expandHex(row.value)}
                          onChange={(e) => {
                            const value = expandHex(e.target.value);
                            setDraft((d) => {
                              if (!d) return d;
                              const next = [...(d.statusTextColorSwatches ?? [])];
                              next[i] = { ...next[i]!, value };
                              return { ...d, statusTextColorSwatches: next };
                            });
                          }}
                          className="h-9 w-14 cursor-pointer rounded border border-zinc-300 dark:border-zinc-600"
                        />
                      </label>
                      <button
                        type="button"
                        className="pb-2 text-sm text-red-600 hover:underline dark:text-red-400"
                        onClick={() => {
                          setDraft((d) => {
                            if (!d) return d;
                            const next = (d.statusTextColorSwatches ?? []).filter((_, j) => j !== i);
                            return { ...d, statusTextColorSwatches: next.length ? next : d.statusTextColorSwatches };
                          });
                        }}
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
                <div className="flex items-center justify-between gap-2">
                  <h4 className="font-medium text-zinc-900 dark:text-zinc-100">Background swatches</h4>
                  <button
                    type="button"
                    className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm dark:border-zinc-600"
                    onClick={() =>
                      setDraft((d) =>
                        d
                          ? {
                              ...d,
                              statusBgSwatches: [
                                { name: "New", value: "rgba(100,116,139,0.15)" },
                                ...(d.statusBgSwatches ?? []),
                              ],
                            }
                          : d,
                      )
                    }
                  >
                    Add
                  </button>
                </div>
                <div className="mt-3 flex flex-col gap-2">
                  {(draft.statusBgSwatches ?? []).map((row, i) => (
                    <div key={i} className="flex flex-wrap items-end gap-2">
                      <label className="flex min-w-[12rem] flex-1 flex-col gap-1 text-xs text-zinc-500">
                        Name
                        <input
                          value={row.name}
                          onChange={(e) => {
                            const name = e.target.value;
                            setDraft((d) => {
                              if (!d) return d;
                              const next = [...(d.statusBgSwatches ?? [])];
                              next[i] = { ...next[i]!, name };
                              return { ...d, statusBgSwatches: next };
                            });
                          }}
                          className="rounded-lg border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-600 dark:bg-zinc-900"
                        />
                      </label>
                      <label className="flex flex-1 flex-col gap-1 text-xs text-zinc-500">
                        Color (CSS)
                        <input
                          value={row.value}
                          onChange={(e) => {
                            const value = e.target.value;
                            setDraft((d) => {
                              if (!d) return d;
                              const next = [...(d.statusBgSwatches ?? [])];
                              next[i] = { ...next[i]!, value };
                              return { ...d, statusBgSwatches: next };
                            });
                          }}
                          className="rounded-lg border border-zinc-300 px-2 py-1.5 text-sm font-mono dark:border-zinc-600 dark:bg-zinc-900"
                        />
                      </label>
                      <button
                        type="button"
                        className="pb-2 text-sm text-red-600 hover:underline dark:text-red-400"
                        onClick={() => {
                          setDraft((d) => {
                            if (!d) return d;
                            const next = (d.statusBgSwatches ?? []).filter((_, j) => j !== i);
                            return { ...d, statusBgSwatches: next.length ? next : d.statusBgSwatches };
                          });
                        }}
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                  <p className="text-xs text-zinc-500">
                    Tip: use strings like{" "}
                    <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-900">
                      rgba(99,102,241,0.12)
                    </code>
                    .
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          disabled={saving}
          onClick={() => void save()}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save configuration"}
        </button>
        <button
          type="button"
          disabled={saving}
          onClick={() => void resetDefaults()}
          className="rounded-lg border border-red-300 px-4 py-2 text-sm text-red-700 dark:border-red-800 dark:text-red-300"
        >
          Reset to defaults
        </button>
      </div>
    </div>
  );
}
