"use client";

import { DashboardSettingsProvider } from "@/components/DashboardSettingsProvider";
import { ThemeProvider } from "@/components/ThemeProvider";

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <DashboardSettingsProvider>{children}</DashboardSettingsProvider>
    </ThemeProvider>
  );
}
