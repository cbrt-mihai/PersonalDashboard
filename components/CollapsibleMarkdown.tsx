"use client";

import { useMemo, useState } from "react";
import { MarkdownView } from "./MarkdownView";

function isLongMarkdown(
  markdown: string,
  maxChars: number,
  maxLines: number,
): boolean {
  const t = markdown.trim();
  if (t.length > maxChars) return true;
  if (t.split(/\r?\n/).length > maxLines) return true;
  return false;
}

export function CollapsibleMarkdown({
  markdown,
  maxChars = 320,
  maxLines = 14,
  collapsedMaxClass = "max-h-52",
}: {
  markdown: string;
  maxChars?: number;
  maxLines?: number;
  /** Tailwind max-height class when collapsed (e.g. max-h-40, max-h-52) */
  collapsedMaxClass?: string;
}) {
  const long = useMemo(
    () => isLongMarkdown(markdown, maxChars, maxLines),
    [markdown, maxChars, maxLines],
  );
  const [expanded, setExpanded] = useState(false);

  if (!markdown.trim()) {
    return <p className="text-sm text-zinc-500 italic">Empty.</p>;
  }

  if (!long) {
    return <MarkdownView markdown={markdown} />;
  }

  return (
    <div>
      <div
        className={
          expanded
            ? ""
            : `relative overflow-hidden rounded-md border border-zinc-100 bg-zinc-50/50 dark:border-zinc-800 dark:bg-zinc-900/40 ${collapsedMaxClass}`
        }
      >
        <div className={expanded ? "" : "p-2"}>
          <MarkdownView markdown={markdown} />
        </div>
        {!expanded ? (
          <div
            className="pointer-events-none absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-white to-transparent dark:from-zinc-950"
            aria-hidden
          />
        ) : null}
      </div>
      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        className="mt-2 text-sm font-medium text-blue-600 hover:underline dark:text-blue-400"
      >
        {expanded ? "Show less" : "Show more"}
      </button>
    </div>
  );
}
