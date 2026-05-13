import type { Metadata } from "next";
import { ProjectViewClient } from "@/components/ProjectViewClient";
import { getServerTranslator } from "@/lib/i18n/server";
import { metadataTitleForProject } from "@/lib/pageMetadata";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const t = await getServerTranslator();
  return { title: metadataTitleForProject(id, t("common.project")) };
}

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <main className="mx-auto max-w-5xl flex-1 px-4 py-8">
      <ProjectViewClient projectId={id} />
    </main>
  );
}

