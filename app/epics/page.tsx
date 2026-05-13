import type { Metadata } from "next";
import { EpicsClient } from "@/components/EpicsClient";
import { getServerTranslator } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getServerTranslator();
  return { title: t("nav.epics") };
}

export default function EpicsPage() {
  return (
    <main className="mx-auto max-w-[min(100%,96rem)] flex-1 px-4 py-8">
      <EpicsClient />
    </main>
  );
}
