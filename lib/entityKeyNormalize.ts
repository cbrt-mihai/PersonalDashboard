/** Minimum / maximum length of the tag prefix (`TAG` in `TAG-1234`, A–Z and 0–9). */
export const ENTITY_KEY_TAG_MIN = 2;
export const ENTITY_KEY_TAG_MAX = 16;

/** Default tag segments when `keyTag` is omitted on create (non-note entities). */
export type DefaultEntityKeyTag = "OWN" | "PRJ" | "EPC" | "TSK" | "NTE" | "WLG";

/**
 * Normalize optional user tag: uppercase A–Z and digits 0–9, length ENTITY_KEY_TAG_MIN–ENTITY_KEY_TAG_MAX, else `fallback`.
 */
export function normalizeKeyTag(raw: unknown, fallback: DefaultEntityKeyTag): string {
  if (typeof raw !== "string") return fallback;
  const t = raw.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (t.length >= ENTITY_KEY_TAG_MIN && t.length <= ENTITY_KEY_TAG_MAX) return t;
  return fallback;
}
