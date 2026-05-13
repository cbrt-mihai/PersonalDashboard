import type { Metadata } from "next";
import { TaskViewClient } from "@/components/TaskViewClient";
import { getServerTranslator } from "@/lib/i18n/server";
import { metadataTitleForTask } from "@/lib/pageMetadata";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const t = await getServerTranslator();
  return { title: metadataTitleForTask(id, t("common.task")) };
}

export default async function TaskPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <main className="mx-auto max-w-4xl flex-1 px-4 py-8">
      <TaskViewClient taskId={id} />
    </main>
  );
}
