import type { Metadata } from "next";
import { TaskEditClient } from "@/components/TaskEditClient";
import { getServerTranslator } from "@/lib/i18n/server";
import { metadataTitleForTask } from "@/lib/pageMetadata";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const t = await getServerTranslator();
  return { title: `${t("common.edit")} · ${metadataTitleForTask(id, t("common.task"))}` };
}

export default async function TaskEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <main className="mx-auto max-w-6xl flex-1 px-4 py-8">
      <TaskEditClient taskId={id} />
    </main>
  );
}
