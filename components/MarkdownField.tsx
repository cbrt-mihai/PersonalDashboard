"use client";

import { useId, useState } from "react";
import { MarkdownView } from "./MarkdownView";

export function MarkdownField({
  label,
  value,
  onChange,
  rows = 8,
  minHeight = "12rem",
}: {
  label?: string;
  value: string;
  onChange: (v: string) => void;
  rows?: number;
  minHeight?: string;
}) {
  const id = useId();
  const [tab, setTab] = useState<"edit" | "preview">("edit");

  return (
    <div className="flex flex-col gap-2">
      {label ? (
        <label htmlFor={id} className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
          {label}
        </label>
      ) : null}
      <div className="flex gap-1 rounded-lg border border-zinc-200 bg-zinc-50 p-1 dark:border-zinc-700 dark:bg-zinc-900/50">
        <button
          type="button"
          onClick={() => setTab("edit")}
          className={`rounded-md px-3 py-1 text-sm font-medium ${
            tab === "edit"
              ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-800 dark:text-zinc-100"
              : "text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
          }`}
        >
          Edit
        </button>
        <button
          type="button"
          onClick={() => setTab("preview")}
          className={`rounded-md px-3 py-1 text-sm font-medium ${
            tab === "preview"
              ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-800 dark:text-zinc-100"
              : "text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
          }`}
        >
          Preview
        </button>
      </div>
      {tab === "edit" ? (
        <textarea
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={rows}
          spellCheck={false}
          className="w-full resize-y rounded-lg border border-zinc-300 bg-white p-3 font-mono text-sm text-zinc-900 shadow-inner outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-100"
          style={{ minHeight }}
        />
      ) : (
        <div
          className="min-h-[12rem] overflow-auto rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-600 dark:bg-zinc-950"
          style={{ minHeight }}
        >
          {value.trim() ? (
            <MarkdownView markdown={value} />
          ) : (
            <p className="text-sm text-zinc-400">Nothing to preview yet.</p>
          )}
        </div>
      )}
    </div>
  );
}
