"use client";

import { MarkdownView } from "@/components/MarkdownView";

export function MarkdownDocBody({ markdown }: { markdown: string }) {
  return (
    <article className="min-w-0">
      <MarkdownView markdown={markdown} className="max-w-none" />
    </article>
  );
}
