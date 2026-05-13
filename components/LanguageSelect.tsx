"use client";

import { SUPPORTED_LOCALES, type SupportedLocale } from "@/lib/i18n";
import { useI18n } from "@/components/LocaleProvider";

export function LanguageSelect() {
  const { locale, setLocale, t } = useI18n();

  const labels: Record<SupportedLocale, string> = {
    en: t("language.english"),
    ro: t("language.romanian"),
  };

  return (
    <label className="flex items-center gap-2 text-xs font-medium text-zinc-600 dark:text-zinc-300">
      <span className="sr-only">{t("language.label")}</span>
      <select
        value={locale}
        aria-label={t("language.label")}
        onChange={(e) => setLocale(e.target.value as SupportedLocale)}
        className="rounded-lg border border-zinc-300 bg-white px-2 py-1.5 text-xs text-zinc-700 shadow-sm outline-none ring-blue-500 focus:ring-2 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
      >
        {SUPPORTED_LOCALES.map((code) => (
          <option key={code} value={code}>
            {labels[code]}
          </option>
        ))}
      </select>
    </label>
  );
}
