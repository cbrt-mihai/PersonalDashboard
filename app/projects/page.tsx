import type { Metadata } from "next";
import { ProjectsListClient } from "@/components/ProjectsListClient";
import { getServerTranslator } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getServerTranslator();
  return { title: t("nav.projects") };
}

export default function ProjectsPage() {
  return (
    <main className="mx-auto max-w-[min(100%,96rem)] flex-1 px-4 py-8">
      <ProjectsListClient />
    </main>
  );
}

