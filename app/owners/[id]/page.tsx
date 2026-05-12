import type { Metadata } from "next";
import { OwnerViewClient } from "@/components/OwnerViewClient";
import { metadataTitleForOwner } from "@/lib/pageMetadata";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  return { title: metadataTitleForOwner(id) };
}

export default async function OwnerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <main className="mx-auto max-w-6xl flex-1 px-4 py-8">
      <OwnerViewClient ownerId={id} />
    </main>
  );
}

