import { cookies } from "next/headers";
import {
  LOCALE_COOKIE_NAME,
  resolveLocale,
  translate,
  type TranslationKey,
  type TranslationValues,
} from "@/lib/i18n";

export async function getServerLocale() {
  const cookieStore = await cookies();
  return resolveLocale(cookieStore.get(LOCALE_COOKIE_NAME)?.value);
}

export async function getServerTranslator() {
  const locale = await getServerLocale();
  return (key: TranslationKey, values?: TranslationValues) => translate(locale, key, values);
}
