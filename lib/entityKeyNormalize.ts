/** Minimum / maximum length of the letter prefix (`TAG` in `TAG-1234`). */
export const ENTITY_KEY_TAG_MIN = 2;
export const ENTITY_KEY_TAG_MAX = 16;

/** Default tag segments when `keyTag` is omitted on create (non-note entities). */
export type DefaultEntityKeyTag = "OWN" | "PRJ" | "EPC" | "TSK" | "NTE" | "WLG";

/**
 * Normalize optional user tag: uppercase A–Z only, length ENTITY_KEY_TAG_MIN–ENTITY_KEY_TAG_MAX, else `fallback`.
 */
export function normalizeKeyTag(raw: unknown, fallback: DefaultEntityKeyTag): string {
  if (typeof raw !== "string") return fallback;
  const t = raw.trim().toUpperCase().replace(/[^A-Z]/g, "");
  if (t.length >= ENTITY_KEY_TAG_MIN && t.length <= ENTITY_KEY_TAG_MAX) return t;
  return fallback;
}
