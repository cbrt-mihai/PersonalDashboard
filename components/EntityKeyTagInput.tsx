"use client";

import { ENTITY_KEY_TAG_MAX } from "@/lib/entityKeyNormalize";
import { useI18n } from "@/components/LocaleProvider";

/** Optional tag prefix for generated public keys (`TAG-<digits>`), up to ENTITY_KEY_TAG_MAX A–Z / 0–9 chars. */
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
  const { t } = useI18n();
  const tag = value.trim() ? value.slice(0, ENTITY_KEY_TAG_MAX) : defaultTag;
  const example = `${tag}-3435`;
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="text-zinc-500">{t("common.publicKeyTag")}</span>
      <input
        value={value}
        disabled={disabled}
        onChange={(e) =>
          onChange(
            e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, ENTITY_KEY_TAG_MAX),
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
        {t("common.publicKeyTagHint", {
          max: ENTITY_KEY_TAG_MAX,
          example,
          defaultTag,
        })}
      </p>
    </label>
  );
}
