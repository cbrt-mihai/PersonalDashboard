import type { Metadata } from "next";
import { OwnerEditClient } from "@/components/OwnerEditClient";
import { getServerTranslator } from "@/lib/i18n/server";
import { metadataTitleForOwner } from "@/lib/pageMetadata";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const t = await getServerTranslator();
  return { title: `${t("common.edit")} · ${metadataTitleForOwner(id, t("common.owner"))}` };
}

export default async function OwnerEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <main className="mx-auto max-w-6xl flex-1 px-4 py-8">
      <OwnerEditClient ownerId={id} />
    </main>
  );
}
