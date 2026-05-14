import type { Metadata } from "next";
import { DashboardShell } from "@/components/DashboardShell";
import { OwnersListClient } from "@/components/OwnersListClient";
import { getServerTranslator } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getServerTranslator();
  return { title: t("nav.owners") };
}

export default function OwnersPage() {
  return (
    <DashboardShell>
      <OwnersListClient />
    </DashboardShell>
  );
}
