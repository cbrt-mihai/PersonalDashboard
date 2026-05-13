import type { Metadata } from "next";
import { Suspense } from "react";
import { NotesClient } from "@/components/NotesClient";
import { getServerTranslator } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getServerTranslator();
  return { title: t("nav.notes") };
}

export default async function NotesPage() {
  const t = await getServerTranslator();
  return (
    <main className="mx-auto max-w-[min(100%,96rem)] flex-1 px-4 py-8">
      <Suspense fallback={<p className="text-zinc-500">{t("common.loading")}</p>}>
        <NotesClient />
      </Suspense>
    </main>
  );
}
