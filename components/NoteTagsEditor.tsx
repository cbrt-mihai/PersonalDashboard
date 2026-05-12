"use client";

import { useState } from "react";
import { dedupeTags, normalizeTagKey } from "@/lib/noteTags";

export function NoteTagsEditor({
  tags,
  onChange,
}: {
  tags: string[];
  onChange: (next: string[]) => void;
}) {
  const [input, setInput] = useState("");

  function addFromInput() {
    const parts = input
      .split(/[,]+/g)
      .map((s) => s.trim())
      .filter(Boolean);
    if (!parts.length) return;
    onChange(dedupeTags([...tags, ...parts]));
    setInput("");
  }

  function remove(tag: string) {
    const k = normalizeTagKey(tag);
    onChange(tags.filter((t) => normalizeTagKey(t) !== k));
  }

  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm text-zinc-500">Tags</span>
      {tags.length ? (
        <div className="flex flex-wrap gap-1.5">
          {tags.map((t) => (
            <span
              key={normalizeTagKey(t)}
              className="inline-flex items-center gap-1 rounded-full border border-zinc-200 bg-zinc-50 px-2 py-0.5 text-xs font-medium text-zinc-800 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-200"
            >
              {t}
              <button
                type="button"
                aria-label={`Remove tag ${t}`}
                className="rounded px-0.5 text-zinc-500 hover:bg-zinc-200 hover:text-zinc-900 dark:hover:bg-zinc-700 dark:hover:text-zinc-100"
                onClick={() => remove(t)}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addFromInput();
            }
          }}
          placeholder="Type tags, comma-separated, then Enter"
          className="min-w-[12rem] flex-1 rounded-lg border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-600 dark:bg-zinc-900"
        />
        <button
          type="button"
          onClick={() => addFromInput()}
          className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm dark:border-zinc-600"
        >
          Add
        </button>
      </div>
    </div>
  );
}
