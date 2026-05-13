"use client";

import { ENTITY_KEY_TAG_MAX } from "@/lib/entityKeyNormalize";

/** Optional letter prefix for generated public keys (`TAG-<digits>`), up to ENTITY_KEY_TAG_MAX letters. */
export function EntityKeyTagInput({
  value,
  onChange,
  defaultTag,
  disabled,
}: {
  value: string;
  onChange: (next: string) => void;
  defaultTag: string;
  disabled?: boolean;
}) {
  const tag = value.trim() ? value.slice(0, ENTITY_KEY_TAG_MAX) : defaultTag;
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="text-zinc-500">Public key tag</span>
      <input
        value={value}
        disabled={disabled}
        onChange={(e) =>
          onChange(
            e.target.value.toUpperCase().replace(/[^A-Z]/g, "").slice(0, ENTITY_KEY_TAG_MAX),
          )
        }
        maxLength={ENTITY_KEY_TAG_MAX}
        placeholder={defaultTag}
        className="mt-1 w-full rounded-lg border border-zinc-300 px-2 py-2 font-mono text-xs tracking-wide uppercase disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-900"
        autoCapitalize="characters"
        spellCheck={false}
        aria-describedby="entity-key-tag-hint"
      />
      <p id="entity-key-tag-hint" className="text-xs text-zinc-500 dark:text-zinc-400">
        Letters A–Z only, 2–{ENTITY_KEY_TAG_MAX} characters. The app appends random digits (example:{" "}
        <span className="font-mono text-zinc-700 dark:text-zinc-300">{tag}-3435</span>
        ). Leave blank to use <span className="font-mono">{defaultTag}</span>.
      </p>
    </label>
  );
}
