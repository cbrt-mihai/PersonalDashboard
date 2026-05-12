export const NOTE_TAG_MAX = 24;
export const NOTE_TAG_MAX_LEN = 48;

export function normalizeTagKey(tag: string): string {
  return tag.trim().toLowerCase();
}

/** Dedupe case-insensitively; keep first spelling; cap count and length per tag. */
export function dedupeTags(tags: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of tags) {
    const t = raw.trim().slice(0, NOTE_TAG_MAX_LEN);
    const k = normalizeTagKey(t);
    if (!k || seen.has(k)) continue;
    seen.add(k);
    out.push(t);
    if (out.length >= NOTE_TAG_MAX) break;
  }
  return out;
}

export function tagOptionsFromEntries(
  entries: { tags?: string[] }[],
): { value: string; label: string }[] {
  const m = new Map<string, string>();
  for (const e of entries) {
    for (const t of e.tags ?? []) {
      const k = normalizeTagKey(t);
      if (k && !m.has(k)) m.set(k, t.trim().slice(0, NOTE_TAG_MAX_LEN));
    }
  }
  return [...m.entries()]
    .sort((a, b) => a[1].localeCompare(b[1]))
    .map(([value, label]) => ({ value, label }));
}

export function entryMatchesTagKeys(entryTags: string[] | undefined, selectedKeys: string[]) {
  if (!selectedKeys.length) return true;
  const keys = new Set((entryTags ?? []).map(normalizeTagKey));
  return selectedKeys.some((k) => keys.has(normalizeTagKey(k)));
}
