"use client";

import { DashboardSettingsProvider } from "@/components/DashboardSettingsProvider";
import { DashboardWidthProvider } from "@/components/DashboardWidthProvider";
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
        <DashboardWidthProvider>
          <DashboardSettingsProvider>{children}</DashboardSettingsProvider>
        </DashboardWidthProvider>
      </ThemeProvider>
    </LocaleProvider>
  );
}
