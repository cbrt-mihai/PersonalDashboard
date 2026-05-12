import type { Metadata } from "next";
import { ProjectEditClient } from "@/components/ProjectEditClient";
import { metadataTitleForProject } from "@/lib/pageMetadata";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  return { title: `Edit · ${metadataTitleForProject(id)}` };
}

export default async function ProjectEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <main className="mx-auto max-w-5xl flex-1 px-4 py-8">
      <ProjectEditClient projectId={id} />
    </main>
  );
}

