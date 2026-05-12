import type { Metadata } from "next";
import { OwnerEntryEditClient } from "@/components/OwnerEntryEditClient";
import { metadataTitleForOwnerEntry } from "@/lib/pageMetadata";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ entryId: string }>;
}): Promise<Metadata> {
  const { entryId } = await params;
  return { title: `Edit · ${metadataTitleForOwnerEntry(entryId)}` };
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
