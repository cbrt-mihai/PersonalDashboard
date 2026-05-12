import type { Metadata } from "next";
import { Suspense } from "react";
import { HomeClient } from "@/components/HomeClient";

export const metadata: Metadata = {
  title: { absolute: "Personal dashboard" },
};

export default function Home() {
  return (
    <main className="mx-auto max-w-[min(100%,96rem)] flex-1 px-4 py-8">
      <Suspense fallback={<p className="text-zinc-500">Loading…</p>}>
        <HomeClient />
      </Suspense>
    </main>
  );
}
