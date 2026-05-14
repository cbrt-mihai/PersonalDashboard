import type { Metadata } from "next";
import { AuditLogClient } from "@/components/AuditLogClient";
import { DashboardShell } from "@/components/DashboardShell";
import { getServerTranslator } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getServerTranslator();
  return { title: t("nav.audit") };
}

export default function AuditPage() {
  return (
    <DashboardShell as="div">
      <AuditLogClient />
    </DashboardShell>
  );
}
