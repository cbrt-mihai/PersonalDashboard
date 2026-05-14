"use client";

import { useEffect, useId, useRef, useState } from "react";
import { SUPPORTED_LOCALES, type SupportedLocale } from "@/lib/i18n";
import { LocaleFlagIcon } from "@/components/LocaleFlagIcon";
import { useI18n } from "@/components/LocaleProvider";

function LocaleFlag({ locale }: { locale: SupportedLocale }) {
  return (
    <LocaleFlagIcon
      locale={locale}
      className="pointer-events-none h-3.5 w-auto shrink-0"
    />
  );
}

export function LanguageSelect() {
  const { locale, setLocale, t } = useI18n();
  const triggerId = useId();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const labels: Record<SupportedLocale, string> = {
    en: t("language.english"),
    ro: t("language.romanian"),
  };

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div
      ref={rootRef}
      className="relative flex items-center gap-2 text-xs font-medium text-zinc-600 dark:text-zinc-300"
    >
      <span className="sr-only">{t("language.label")}</span>
      <button
        type="button"
        id={triggerId}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={t("language.label")}
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-lg border border-zinc-300 bg-white px-2 py-1.5 text-xs text-zinc-700 shadow-sm outline-none ring-blue-500 focus-visible:ring-2 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
      >
        <LocaleFlag locale={locale} />
        <span className="whitespace-nowrap">{labels[locale]}</span>
      </button>
      {open ? (
        <ul
          role="listbox"
          aria-labelledby={triggerId}
          className="absolute right-0 z-50 mt-1 min-w-[10rem] rounded-lg border border-zinc-200 bg-white py-1 shadow-lg dark:border-zinc-700 dark:bg-zinc-950"
        >
          {SUPPORTED_LOCALES.map((code) => (
            <li key={code} role="presentation">
              <button
                type="button"
                role="option"
                aria-selected={code === locale}
                className={`flex w-full items-center gap-2 px-2 py-1.5 text-left text-xs text-zinc-800 hover:bg-zinc-100 dark:text-zinc-100 dark:hover:bg-zinc-900 ${
                  code === locale ? "bg-zinc-50 dark:bg-zinc-900" : ""
                }`}
                onClick={() => {
                  setLocale(code);
                  setOpen(false);
                }}
              >
                <LocaleFlag locale={code} />
                <span className="whitespace-nowrap">{labels[code]}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
