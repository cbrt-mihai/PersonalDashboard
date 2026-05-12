import type { Metadata } from "next";
import { Suspense } from "react";
import { NotesClient } from "@/components/NotesClient";

export const metadata: Metadata = {
  title: "Notes",
};

export default function NotesPage() {
  return (
    <main className="mx-auto max-w-[min(100%,96rem)] flex-1 px-4 py-8">
      <Suspense fallback={<p className="text-zinc-500">Loading…</p>}>
        <NotesClient />
      </Suspense>
    </main>
  );
}
