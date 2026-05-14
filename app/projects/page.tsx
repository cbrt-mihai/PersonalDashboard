import type { Metadata } from "next";
import { DashboardShell } from "@/components/DashboardShell";
import { ProjectsListClient } from "@/components/ProjectsListClient";
import { getServerTranslator } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getServerTranslator();
  return { title: t("nav.projects") };
}

export default function ProjectsPage() {
  return (
    <DashboardShell>
      <ProjectsListClient />
    </DashboardShell>
  );
}

