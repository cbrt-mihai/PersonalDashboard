import type { Metadata } from "next";
import { AuditLogClient } from "@/components/AuditLogClient";

export const metadata: Metadata = {
  title: "Audit log",
};

export default function AuditPage() {
  return (
    <div className="mx-auto max-w-[min(100%,96rem)] px-4 py-8">
      <AuditLogClient />
    </div>
  );
}
