/**
 * Resolves wiki-style links before Markdown parsing.
 * Supported:
 * - [[owner:<uuid>]] (also accepts legacy [[partner:<uuid>]])
 * - [[project:<uuid>]]
 * - [[epic:<uuid>]]
 * - [[task:<uuid>]]
 * - [[note:<ownerUuid>:<entryUuid>]] (legacy)
 * - [[note:entry:<entryUuid>]] (canonical when no owner)
 * - [[note:project:<projectUuid>:<entryUuid>]] (resolves to /notes/<entryUuid>)
 * → app routes.
 * Bare [[Anything else]] → unresolved chip (raw HTML span; sanitized in MarkdownView via rehype).
 */
export function preprocessWikiLinks(md: string): string {
  return md.replace(/\[\[([^\]]+)]]/g, (_full, inner: string) => {
    const t = inner.trim();
    const ownerMatch = /^(?:owner|partner):([0-9a-fA-F-]{36})$/.exec(t);
    if (ownerMatch) {
      const id = ownerMatch[1];
      return `[Owner](/owners/${id})`;
    }
    const project = /^project:([0-9a-fA-F-]{36})$/.exec(t);
    if (project) {
      const id = project[1];
      return `[Project](/projects/${id})`;
    }
    const epic = /^epic:([0-9a-fA-F-]{36})$/.exec(t);
    if (epic) {
      const id = epic[1];
      return `[Epic](/epics/${id})`;
    }
    const task = /^task:([0-9a-fA-F-]{36})$/.exec(t);
    if (task) {
      const id = task[1];
      return `[Task](/tasks/${id})`;
    }
    const noteEntryOnly = /^note:entry:([0-9a-fA-F-]{36})$/.exec(t);
    if (noteEntryOnly) {
      const entryId = noteEntryOnly[1];
      return `[Note](/notes/${entryId})`;
    }
    const noteProject = /^note:project:([0-9a-fA-F-]{36}):([0-9a-fA-F-]{36})$/.exec(t);
    if (noteProject) {
      const entryId = noteProject[2];
      return `[Note](/notes/${entryId})`;
    }
    const note = /^note:([0-9a-fA-F-]{36}):([0-9a-fA-F-]{36})$/.exec(t);
    if (note) {
      const ownerId = note[1];
      const entryId = note[2];
      return `[Note](/owners/${ownerId}/entries/${entryId})`;
    }
    return `\`⟦${t.replace(/`/g, "'")}⟧\``;
  });
}
