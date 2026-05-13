import { en } from "@/lib/i18n/locales/en";
import { ro } from "@/lib/i18n/locales/ro";
import type { Messages, TranslationKey, TranslationValues } from "@/lib/i18n/types";

export type { Messages, TranslationKey, TranslationValues };

export const DEFAULT_LOCALE = "en";
export const LOCALE_COOKIE_NAME = "pd-locale";

export const LOCALES = {
  en,
  ro,
} as const satisfies Record<string, Messages>;

export type SupportedLocale = keyof typeof LOCALES;

export const SUPPORTED_LOCALES = Object.keys(LOCALES) as SupportedLocale[];

export function isSupportedLocale(value: string | undefined | null): value is SupportedLocale {
  return Boolean(value && value in LOCALES);
}

export function resolveLocale(value: string | undefined | null): SupportedLocale {
  return isSupportedLocale(value) ? value : DEFAULT_LOCALE;
}

function lookupMessage(messages: Messages, key: TranslationKey): string {
  let current: unknown = messages;
  for (const part of key.split(".")) {
    if (!current || typeof current !== "object" || !(part in current)) {
      return key;
    }
    current = (current as Record<string, unknown>)[part];
  }
  return typeof current === "string" ? current : key;
}

export function interpolate(template: string, values?: TranslationValues): string {
  if (!values) return template;
  return template.replace(/\{([a-zA-Z0-9_]+)\}/g, (match, name: string) => {
    const value = values[name];
    return value === null || value === undefined ? match : String(value);
  });
}

export function translate(
  locale: SupportedLocale,
  key: TranslationKey,
  values?: TranslationValues,
): string {
  return interpolate(lookupMessage(LOCALES[locale], key), values);
}

export function createTranslator(locale: SupportedLocale) {
  return (key: TranslationKey, values?: TranslationValues) => translate(locale, key, values);
}
