import type { Metadata } from "next";
import { DashboardShell } from "@/components/DashboardShell";
import { WorklogsClient } from "@/components/WorklogsClient";
import { getServerTranslator } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getServerTranslator();
  return { title: t("nav.worklogs") };
}

export default function WorklogsPage() {
  return (
    <DashboardShell>
      <WorklogsClient />
    </DashboardShell>
  );
}
