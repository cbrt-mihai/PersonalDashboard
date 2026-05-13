import type { Metadata } from "next";
import { OwnerEntryEditClient } from "@/components/OwnerEntryEditClient";
import { getServerTranslator } from "@/lib/i18n/server";
import { metadataTitleForOwnerEntry } from "@/lib/pageMetadata";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ entryId: string }>;
}): Promise<Metadata> {
  const { entryId } = await params;
  const t = await getServerTranslator();
  return { title: `${t("common.edit")} · ${metadataTitleForOwnerEntry(entryId, t("common.note"))}` };
}

export default async function OwnerEntryEditPage({
  params,
}: {
  params: Promise<{ id: string; entryId: string }>;
}) {
  const { id, entryId } = await params;
  return (
    <main className="mx-auto max-w-6xl flex-1 px-4 py-8">
      <OwnerEntryEditClient ownerId={id} entryId={entryId} />
    </main>
  );
}
