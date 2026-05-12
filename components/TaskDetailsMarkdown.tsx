import { MarkdownView } from "./MarkdownView";

/** Fixed-height scroll region so long Markdown does not stretch the layout. */
export function TaskDetailsMarkdown({
  markdown,
  variant = "compact",
}: {
  markdown: string;
  /** `page` = taller panel for full task view */
  variant?: "compact" | "page";
}) {
  const maxH =
    variant === "page"
      ? "max-h-[min(85vh,48rem)]"
      : "max-h-[min(70vh,32rem)]";
  return (
    <div
      className={`min-h-0 w-full min-w-0 ${maxH} overflow-y-auto overflow-x-auto overscroll-contain rounded-lg border border-zinc-200 bg-white p-3 shadow-inner [scrollbar-gutter:stable] dark:border-zinc-700 dark:bg-zinc-950`}
      style={{ maxWidth: "100%" }}
    >
      <MarkdownView
        markdown={markdown}
        className="min-w-0 max-w-full break-words [overflow-wrap:anywhere] [&_p]:break-words [&_li]:break-words [&_td]:break-words [&_th]:break-words [&_pre]:max-w-full [&_pre]:overflow-x-auto [&_pre]:whitespace-pre-wrap [&_p_code]:break-words"
      />
    </div>
  );
}
