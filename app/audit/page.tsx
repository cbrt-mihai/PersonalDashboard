import type { Metadata } from "next";
import { AuditLogClient } from "@/components/AuditLogClient";
import { getServerTranslator } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getServerTranslator();
  return { title: t("nav.audit") };
}

export default function AuditPage() {
  return (
    <div className="mx-auto max-w-[min(100%,96rem)] px-4 py-8">
      <AuditLogClient />
    </div>
  );
}
