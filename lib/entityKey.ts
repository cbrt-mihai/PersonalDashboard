/**
 * Public reference keys (never UUID-shaped):
 * - Standard: `TAG-<digits>` — 2–16 letters, hyphen, then **1–32** digits (e.g. `ONE-3`, `RBRAND-435343`).
 * - Note: parent’s full key + hyphen + **1–32** digits (e.g. `ONE-3435-44`).
 * - Legacy: `TAG-ABC12D` — 2–16 letters, hyphen, exactly 6 chars from the old alphabet (still accepted).
 */
import { ENTITY_KEY_TAG_MAX, ENTITY_KEY_TAG_MIN } from "./entityKeyNormalize";

export type { DefaultEntityKeyTag } from "./entityKeyNormalize";
export {
  ENTITY_KEY_TAG_MAX,
  ENTITY_KEY_TAG_MIN,
  normalizeKeyTag,
} from "./entityKeyNormalize";

/** Max length of a digit-only suffix (avoids pathological keys; still generous for imports). */
export const ENTITY_KEY_DIGIT_SUFFIX_MAX = 32;

const tagSeg = `[A-Z]{${ENTITY_KEY_TAG_MIN},${ENTITY_KEY_TAG_MAX}}`;
export const ENTITY_KEY_TAG_REGEX = new RegExp(`^${tagSeg}$`);

const LEGACY_BODY = new RegExp(`^${tagSeg}-[A-Z0-9]{6}$`);
const digitSuffix = `\\d{1,${ENTITY_KEY_DIGIT_SUFFIX_MAX}}`;
const STANDARD_DIGITS = new RegExp(`^${tagSeg}-${digitSuffix}$`);
/** Note: parent key (legacy or digit standard) + hyphen + note-only digits. */
const NOTE_CHILD = new RegExp(
  `^(?:${tagSeg}-[A-Z0-9]{6}|${tagSeg}-${digitSuffix})-${digitSuffix}$`,
);

export function isValidEntityKey(k: string): boolean {
  const s = k.trim();
  return LEGACY_BODY.test(s) || STANDARD_DIGITS.test(s) || NOTE_CHILD.test(s);
}

/** Zod / validation: any accepted public key shape (includes legacy). */
export const ENTITY_KEY_REGEX = new RegExp(
  `^(?:${tagSeg}-(?:[A-Z0-9]{6}|\\d{1,${ENTITY_KEY_DIGIT_SUFFIX_MAX}})(?:-\\d{1,${ENTITY_KEY_DIGIT_SUFFIX_MAX}})?)$`,
);

/** True if this key is a note “child” key (parent key + extra digit segment). */
export function isNoteChildKey(k: string): boolean {
  return NOTE_CHILD.test(k.trim());
}

/** Random digit suffix for new keys (length 1–8, no leading zero). */
function randomKeyDigitSuffix(): string {
  const maxLen = Math.min(8, ENTITY_KEY_DIGIT_SUFFIX_MAX);
  const len = 1 + Math.floor(Math.random() * maxLen);
  if (len === 1) return String(1 + Math.floor(Math.random() * 9));
  const min = 10 ** (len - 1);
  const max = 10 ** len - 1;
  return String(min + Math.floor(Math.random() * (max - min + 1)));
}

/** Returns `TAG-<digits>` unique within `used` (mutates `used`). */
export function allocateEntityKey(tag: string, used: Set<string>): string {
  const prefix = ENTITY_KEY_TAG_REGEX.test(tag) ? tag : "KEY";
  for (;;) {
    const k = `${prefix}-${randomKeyDigitSuffix()}`;
    if (!used.has(k)) {
      used.add(k);
      return k;
    }
  }
}

/**
 * Note key: `<parentKey>-<digits>` where parent is an owner/project (legacy or digit) key.
 */
export function allocateNoteEntryKey(parentKey: string, used: Set<string>): string {
  const p = parentKey.trim();
  if (!isValidEntityKey(p) || isNoteChildKey(p)) {
    return allocateEntityKey("NTE", used);
  }
  for (;;) {
    const k = `${p}-${randomKeyDigitSuffix()}`;
    if (!used.has(k)) {
      used.add(k);
      return k;
    }
  }
}

export function isUuidLike(s: string): boolean {
  return /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/.test(
    s.trim(),
  );
}

export function collectEntityKeysFromStorePieces(input: {
  owners: { key?: string }[];
  projects: { key?: string }[];
  taskGroups: { key?: string }[];
  tasks: { key?: string }[];
  ownerEntries: { key?: string }[];
  worklogs?: { key?: string }[];
}): Set<string> {
  const used = new Set<string>();
  const add = (k: string | undefined | null) => {
    if (k && isValidEntityKey(k)) used.add(k);
  };
  for (const x of input.owners) add(x.key);
  for (const x of input.projects) add(x.key);
  for (const x of input.taskGroups) add(x.key);
  for (const x of input.tasks) add(x.key);
  for (const x of input.ownerEntries) add(x.key);
  for (const x of input.worklogs ?? []) add(x.key);
  return used;
}
