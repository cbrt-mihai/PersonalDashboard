import type { Metadata } from "next";
import { EpicViewClient } from "@/components/EpicViewClient";
import { metadataTitleForEpic } from "@/lib/pageMetadata";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  return { title: metadataTitleForEpic(id) };
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

