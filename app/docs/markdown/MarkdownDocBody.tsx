"use client";

import { useI18n } from "@/components/LocaleProvider";
import { MarkdownView } from "@/components/MarkdownView";

export function MarkdownDocBody({
  markdown,
  markdownRo,
}: {
  markdown: string;
  markdownRo: string;
}) {
  const { locale } = useI18n();
  const activeMarkdown = locale === "ro" ? markdownRo : markdown;

  return (
    <article className="min-w-0">
      <MarkdownView markdown={activeMarkdown} className="max-w-none" variant="doc" />
    </article>
  );
}
