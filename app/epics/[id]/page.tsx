import type { Metadata } from "next";
import { EpicViewClient } from "@/components/EpicViewClient";
import { getServerTranslator } from "@/lib/i18n/server";
import { metadataTitleForEpic } from "@/lib/pageMetadata";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const t = await getServerTranslator();
  return { title: metadataTitleForEpic(id, t("common.epic")) };
}

export default async function EpicPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <main className="mx-auto max-w-4xl flex-1 px-4 py-8">
      <EpicViewClient epicId={id} />
    </main>
  );
}

