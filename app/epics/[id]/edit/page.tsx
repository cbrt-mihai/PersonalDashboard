import type { Metadata } from "next";
import { EpicEditClient } from "@/components/EpicEditClient";
import { getServerTranslator } from "@/lib/i18n/server";
import { metadataTitleForEpic } from "@/lib/pageMetadata";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const t = await getServerTranslator();
  return { title: `${t("common.edit")} · ${metadataTitleForEpic(id, t("common.epic"))}` };
}

export default async function EpicEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <main className="mx-auto max-w-6xl flex-1 px-4 py-8">
      <EpicEditClient epicId={id} />
    </main>
  );
}

