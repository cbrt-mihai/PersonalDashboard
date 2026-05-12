import type { Metadata } from "next";
import { OwnerEntryViewClient } from "@/components/OwnerEntryViewClient";
import { metadataTitleForOwnerEntry } from "@/lib/pageMetadata";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ entryId: string }>;
}): Promise<Metadata> {
  const { entryId } = await params;
  return { title: metadataTitleForOwnerEntry(entryId) };
}

export default async function OwnerEntryPage({
  params,
}: {
  params: Promise<{ id: string; entryId: string }>;
}) {
  const { id, entryId } = await params;
  return (
    <main className="mx-auto max-w-4xl flex-1 px-4 py-8">
      <OwnerEntryViewClient ownerId={id} entryId={entryId} />
    </main>
  );
}
