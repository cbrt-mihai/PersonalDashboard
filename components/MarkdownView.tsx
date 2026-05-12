"use client";

import { useMemo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkGithubBlockquoteAlert from "remark-github-blockquote-alert";
import { remarkHighlightMark } from "remark-highlight-mark";
import rehypeSlug from "rehype-slug";
import rehypeSanitize from "rehype-sanitize";
import { markdownSanitizeSchema } from "@/lib/markdownSanitizeSchema";
import { preprocessMarkdownBody } from "@/lib/markdownPreprocess";
import { preprocessWikiLinks } from "@/lib/wikiLinkPreprocess";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import {
  oneDark,
  oneLight,
} from "react-syntax-highlighter/dist/esm/styles/prism";
import type { Components } from "react-markdown";
import { useTheme } from "@/components/ThemeProvider";

import "remark-github-blockquote-alert/alert.css";

export function MarkdownView({
  markdown,
  className = "",
}: {
  markdown: string;
  className?: string;
}) {
  const { resolvedDark: dark } = useTheme();

  const processed = useMemo(
    () => preprocessMarkdownBody(markdown ?? "", preprocessWikiLinks),
    [markdown],
  );

  const components = useMemo<Components>(
    () => ({
      code({ className: cn, children, ...props }) {
        const match = /language-(\w+)/.exec(cn ?? "");
        const inline = !String(cn ?? "").includes("language-");
        const code = String(children).replace(/\n$/, "");
        if (inline) {
          return (
            <code
              className="break-words rounded bg-[var(--md-inline-bg)] px-1 py-0.5 text-[0.9em] font-mono [overflow-wrap:anywhere]"
              {...props}
            >
              {children}
            </code>
          );
        }
        const lang = match?.[1] ?? "text";
        return (
          <div className="max-w-full overflow-x-auto">
            <SyntaxHighlighter
              style={dark ? oneDark : oneLight}
              language={lang}
              PreTag="div"
              className="rounded-lg text-sm!"
              customStyle={{
                margin: 0,
                borderRadius: "0.5rem",
                maxWidth: "100%",
              }}
            >
              {code}
            </SyntaxHighlighter>
          </div>
        );
      },
      a({ href, children, ...rest }) {
        return (
          <a
            href={href}
            className="break-words text-blue-600 underline underline-offset-2 dark:text-blue-400 [overflow-wrap:anywhere]"
            {...rest}
          >
            {children}
          </a>
        );
      },
      table({ children }) {
        return (
          <div className="my-2 max-w-full overflow-x-auto">
            <table>{children}</table>
          </div>
        );
      },
      mark({ children, ...rest }) {
        return (
          <mark className="md-highlight rounded px-0.5" {...rest}>
            {children}
          </mark>
        );
      },
    }),
    [dark],
  );

  return (
    <div
      className={`md-root min-w-0 w-full max-w-full overflow-x-auto break-words text-[0.95rem] leading-relaxed [overflow-wrap:anywhere] [&_li]:break-words [&_p]:break-words [&_td]:break-words [&_th]:break-words ${className}`}
      style={
        {
          ["--md-inline-bg" as string]: dark
            ? "rgba(255,255,255,0.08)"
            : "rgba(0,0,0,0.06)",
        } as React.CSSProperties
      }
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkHighlightMark, remarkGithubBlockquoteAlert]}
        rehypePlugins={[rehypeSlug, [rehypeSanitize, markdownSanitizeSchema]]}
        components={components}
      >
        {processed}
      </ReactMarkdown>
    </div>
  );
}
