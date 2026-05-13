import type { Metadata } from "next";
import { OwnerEntryViewClient } from "@/components/OwnerEntryViewClient";
import { getServerTranslator } from "@/lib/i18n/server";
import { metadataTitleForOwnerEntry } from "@/lib/pageMetadata";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ entryId: string }>;
}): Promise<Metadata> {
  const { entryId } = await params;
  const t = await getServerTranslator();
  return { title: metadataTitleForOwnerEntry(entryId, t("common.note")) };
}

export default async function NoteEntryPage({
  params,
}: {
  params: Promise<{ entryId: string }>;
}) {
  const { entryId } = await params;
  return (
    <main className="mx-auto max-w-4xl flex-1 px-4 py-8">
      <OwnerEntryViewClient entryId={entryId} />
    </main>
  );
}
