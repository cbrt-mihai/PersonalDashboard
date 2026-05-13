import type { Metadata } from "next";
import { EpicsClient } from "@/components/EpicsClient";

export const metadata: Metadata = {
  title: "Epics",
};

export default function EpicsPage() {
  return (
    <main className="mx-auto max-w-[min(100%,96rem)] flex-1 px-4 py-8">
      <EpicsClient />
    </main>
  );
}
