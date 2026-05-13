import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Metadata } from "next";
import { MarkdownDocBody } from "./MarkdownDocBody";

export const metadata: Metadata = {
  title: "Markdown",
};

export default function MarkdownDocsPage() {
  const markdown = readFileSync(join(process.cwd(), "docs", "MARKDOWN.md"), "utf-8");
  return (
    <main className="mx-auto w-full max-w-[min(100%,90rem)] flex-1 px-4 py-8 sm:px-6 lg:px-8">
      <MarkdownDocBody markdown={markdown} />
    </main>
  );
}
