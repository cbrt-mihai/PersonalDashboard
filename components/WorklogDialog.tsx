"use client";

import { useCallback, useState } from "react";
import { EntityKeyTagInput } from "@/components/EntityKeyTagInput";
import type { WorklogTarget } from "@/lib/schemas";

type Props = {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  target: WorklogTarget;
  minutesPerDay: number;
  disabled?: boolean;
};

export function WorklogDialog({
  open,
  onClose,
  onSaved,
  target,
  minutesPerDay,
  disabled = false,
}: Props) {
  const [startedAt, setStartedAt] = useState(() => {
    const d = new Date();
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().slice(0, 16);
  });
  const [timeSpent, setTimeSpent] = useState("1h");
  const [comment, setComment] = useState("");
  const [keyTag, setKeyTag] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const reset = useCallback(() => {
    const d = new Date();
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    setStartedAt(d.toISOString().slice(0, 16));
    setTimeSpent("1h");
    setComment("");
    setKeyTag("");
    setErr(null);
  }, []);

  if (!open) return null;

  async function submit() {
    setSaving(true);
    setErr(null);
    try {
      const startedIso = new Date(startedAt).toISOString();
      const r = await fetch("/api/worklogs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          target,
          startedAt: startedIso,
          timeSpent: timeSpent.trim(),
          comment: comment.trim(),
          ...(keyTag.trim() ? { keyTag: keyTag.trim() } : {}),
        }),
      });
      if (!r.ok) {
        const j = (await r.json().catch(() => ({}))) as { error?: unknown };
        setErr(typeof j.error === "string" ? j.error : "Save failed");
        return;
      }
      reset();
      onSaved();
      onClose();
    } catch {
      setErr("Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="worklog-dialog-title"
    >
      <div className="max-h-[90vh] w-full max-w-md overflow-auto rounded-xl border border-zinc-200 bg-white p-5 shadow-xl dark:border-zinc-700 dark:bg-zinc-950">
        <h2 id="worklog-dialog-title" className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
          Log work
        </h2>
        {err ? (
          <p className="mt-2 rounded border border-red-200 bg-red-50 px-2 py-1 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/50 dark:text-red-200">
            {err}
          </p>
        ) : null}
        <div className="mt-4 flex flex-col gap-3 text-sm">
          <label className="flex flex-col gap-1">
            <span className="text-zinc-600 dark:text-zinc-400">Started</span>
            <input
              type="datetime-local"
              value={startedAt}
              onChange={(e) => setStartedAt(e.target.value)}
              disabled={disabled || saving}
              className="rounded-lg border border-zinc-300 px-2 py-1.5 dark:border-zinc-600 dark:bg-zinc-900"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-zinc-600 dark:text-zinc-400">
              Time spent (e.g. 30m, 1h, 2d — 1d = {minutesPerDay}m)
            </span>
            <input
              value={timeSpent}
              onChange={(e) => setTimeSpent(e.target.value)}
              disabled={disabled || saving}
              className="rounded-lg border border-zinc-300 px-2 py-1.5 dark:border-zinc-600 dark:bg-zinc-900"
              placeholder="1h 30m"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-zinc-600 dark:text-zinc-400">Comment</span>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              disabled={disabled || saving}
              rows={3}
              className="rounded-lg border border-zinc-300 px-2 py-1.5 dark:border-zinc-600 dark:bg-zinc-900"
            />
          </label>
          <EntityKeyTagInput
            value={keyTag}
            onChange={setKeyTag}
            defaultTag="WLG"
            disabled={disabled || saving}
          />
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={() => {
              reset();
              onClose();
            }}
            className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm dark:border-zinc-600"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={disabled || saving}
            onClick={() => void submit()}
            className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
