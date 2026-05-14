import type { Metadata } from "next";
import { AchievementsClient } from "@/components/AchievementsClient";
import { DashboardShell } from "@/components/DashboardShell";
import { getServerTranslator } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getServerTranslator();
  return { title: t("nav.achievements") };
}

export default function AchievementsPage() {
  return (
    <DashboardShell>
      <AchievementsClient />
    </DashboardShell>
  );
}
