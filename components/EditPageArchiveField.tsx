"use client";

import { useState } from "react";

type Props = {
  archived: boolean;
  disabled?: boolean;
  onCommit: (archived: boolean) => Promise<void>;
};

export function EditPageArchiveField({ archived, disabled, onCommit }: Props) {
  const [busy, setBusy] = useState(false);
  const [toggleErr, setToggleErr] = useState<string | null>(null);

  async function onChange(checked: boolean) {
    setBusy(true);
    setToggleErr(null);
    try {
      await onCommit(checked);
    } catch (e) {
      setToggleErr(e instanceof Error ? e.message : "Could not update");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-xl border border-zinc-200 bg-zinc-50/80 p-4 dark:border-zinc-800 dark:bg-zinc-900/40">
      <label className="flex cursor-pointer items-start gap-3 text-sm">
        <input
          type="checkbox"
          className="mt-0.5 h-4 w-4 rounded border-zinc-300 dark:border-zinc-600"
          checked={archived}
          disabled={disabled || busy}
          onChange={(e) => void onChange(e.target.checked)}
        />
        <span>
          <span className="font-medium text-zinc-900 dark:text-zinc-100">Archived</span>
          <span className="mt-0.5 block text-xs text-zinc-500">
            Archived items may be hidden from default lists and searches.
          </span>
        </span>
      </label>
      {busy ? <p className="mt-2 text-xs text-zinc-500">Saving…</p> : null}
      {toggleErr ? <p className="mt-2 text-xs text-red-600">{toggleErr}</p> : null}
    </div>
  );
}
