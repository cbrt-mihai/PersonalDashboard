import type { Metadata } from "next";
import { Suspense } from "react";
import { DashboardShell } from "@/components/DashboardShell";
import { HomeClient } from "@/components/HomeClient";
import { getServerTranslator } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getServerTranslator();
  return { title: { absolute: t("app.name") } };
}

export default async function Home() {
  const t = await getServerTranslator();
  return (
    <DashboardShell>
      <Suspense fallback={<p className="text-zinc-500">{t("common.loading")}</p>}>
        <HomeClient />
      </Suspense>
    </DashboardShell>
  );
}
