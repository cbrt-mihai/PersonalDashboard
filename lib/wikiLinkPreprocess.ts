/**
 * Resolves wiki-style links before Markdown parsing.
 * Supported:
 * - [[owner:<uuid>]] or [[owner:<KEY>]]
 * - [[project:<uuid|KEY>]]
 * - [[epic:<uuid|KEY>]]
 * - [[task:<uuid|KEY>]]
 * - [[note:<ownerUuid|KEY>:<entryUuid|KEY>]] (legacy)
 * - [[note:entry:<uuid|KEY>]] (canonical when no owner)
 * - [[note:project:<projectUuid|KEY>:<entryUuid|KEY>]] (resolves to /notes/<entry>)
 * → app routes.
 * Bare [[Anything else]] → unresolved chip (raw HTML span; sanitized in MarkdownView via rehype).
 */
import { ENTITY_KEY_DIGIT_SUFFIX_MAX } from "./entityKey";
import { ENTITY_KEY_TAG_MAX, ENTITY_KEY_TAG_MIN } from "./entityKeyNormalize";

/** UUID, legacy `TAG-XXXXXX`, digit standard `TAG-<1–N digits>`, or note child with an extra `-<digits>`. */
const ID_OR_KEY = `(?:[0-9a-fA-F-]{36}|[A-Z]{${ENTITY_KEY_TAG_MIN},${ENTITY_KEY_TAG_MAX}}-(?:[A-Z0-9]{6}|\\d{1,${ENTITY_KEY_DIGIT_SUFFIX_MAX}})(?:-\\d{1,${ENTITY_KEY_DIGIT_SUFFIX_MAX}})?)`;

export function preprocessWikiLinks(md: string): string {
  return md.replace(/\[\[([^\]]+)]]/g, (_full, inner: string) => {
    const t = inner.trim();
    const ownerMatch = new RegExp(`^owner:(${ID_OR_KEY})$`).exec(t);
    if (ownerMatch) {
      const id = ownerMatch[1];
      return `[Owner](/owners/${id})`;
    }
    const project = new RegExp(`^project:(${ID_OR_KEY})$`).exec(t);
    if (project) {
      const id = project[1];
      return `[Project](/projects/${id})`;
    }
    const epic = new RegExp(`^epic:(${ID_OR_KEY})$`).exec(t);
    if (epic) {
      const id = epic[1];
      return `[Epic](/epics/${id})`;
    }
    const task = new RegExp(`^task:(${ID_OR_KEY})$`).exec(t);
    if (task) {
      const id = task[1];
      return `[Task](/tasks/${id})`;
    }
    const noteEntryOnly = new RegExp(`^note:entry:(${ID_OR_KEY})$`).exec(t);
    if (noteEntryOnly) {
      const entryId = noteEntryOnly[1];
      return `[Note](/notes/${entryId})`;
    }
    const noteProject = new RegExp(`^note:project:(${ID_OR_KEY}):(${ID_OR_KEY})$`).exec(t);
    if (noteProject) {
      const entryId = noteProject[2];
      return `[Note](/notes/${entryId})`;
    }
    const note = new RegExp(`^note:(${ID_OR_KEY}):(${ID_OR_KEY})$`).exec(t);
    if (note) {
      const ownerId = note[1];
      const entryId = note[2];
      return `[Note](/owners/${ownerId}/entries/${entryId})`;
    }
    return `\`⟦${t.replace(/`/g, "'")}⟧\``;
  });
}
