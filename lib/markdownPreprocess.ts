/** Leading YAML frontmatter (`---` … `---`) is stripped before Markdown parse (Obsidian-style metadata). */
export function stripYamlFrontmatter(md: string): string {
  const re = /^---\r?\n[\s\S]*?\r?\n---\r?\n/;
  const m = md.match(re);
  if (!m || m.index !== 0) return md;
  return md.slice(m[0].length);
}

/** Wiki links + frontmatter strip order for task/note bodies. */
export function preprocessMarkdownBody(md: string, wikiPreprocess: (s: string) => string): string {
  return wikiPreprocess(stripYamlFrontmatter(md ?? ""));
}
