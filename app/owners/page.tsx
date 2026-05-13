import type { Metadata } from "next";
import { OwnersListClient } from "@/components/OwnersListClient";

export const metadata: Metadata = {
  title: "Owners",
};

export default function OwnersPage() {
  return (
    <main className="mx-auto max-w-[min(100%,96rem)] flex-1 px-4 py-8">
      <OwnersListClient />
    </main>
  );
}
