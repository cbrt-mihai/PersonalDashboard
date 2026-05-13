"use client";

import { DashboardSettingsProvider } from "@/components/DashboardSettingsProvider";
import { LocaleProvider } from "@/components/LocaleProvider";
import { ThemeProvider } from "@/components/ThemeProvider";

export function AppProviders({
  children,
  initialLocale,
}: {
  children: React.ReactNode;
  initialLocale?: string;
}) {
  return (
    <LocaleProvider initialLocale={initialLocale}>
      <ThemeProvider>
        <DashboardSettingsProvider>{children}</DashboardSettingsProvider>
      </ThemeProvider>
    </LocaleProvider>
  );
}
