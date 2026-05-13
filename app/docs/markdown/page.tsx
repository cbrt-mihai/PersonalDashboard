import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Metadata } from "next";
import { getServerTranslator } from "@/lib/i18n/server";
import { MarkdownDocBody } from "./MarkdownDocBody";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getServerTranslator();
  return { title: t("nav.markdown") };
}

export default async function MarkdownDocsPage() {
  const markdown = readFileSync(join(process.cwd(), "docs", "MARKDOWN.md"), "utf-8");
  const markdownRo = readFileSync(join(process.cwd(), "docs", "MARKDOWN.ro.md"), "utf-8");
  return (
    <main className="mx-auto w-full max-w-[min(100%,90rem)] flex-1 px-4 py-8 sm:px-6 lg:px-8">
      <MarkdownDocBody markdown={markdown} markdownRo={markdownRo} />
    </main>
  );
}
