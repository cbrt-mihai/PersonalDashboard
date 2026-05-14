import type { SupportedLocale } from "@/lib/i18n";
import type { ComponentPropsWithoutRef } from "react";

type Props = {
  locale: SupportedLocale;
} & Omit<ComponentPropsWithoutRef<"img">, "alt" | "src">;

const base =
  "block shrink-0 rounded-[2px] shadow-sm ring-1 ring-black/10 dark:ring-white/15";

const flagSources = {
  en: "/flags/locale-en.svg",
  ro: "/flags/locale-ro.svg",
} as const satisfies Record<SupportedLocale, string>;

export function LocaleFlagIcon({ locale, className = "", ...props }: Props) {
  const cn = `${base} ${className}`.trim();

  return (
    <img
      src={flagSources[locale]}
      alt=""
      className={cn}
      aria-hidden
      {...props}
    />
  );
}
