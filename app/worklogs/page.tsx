import type { Metadata } from "next";
import { WorklogsClient } from "@/components/WorklogsClient";

export const metadata: Metadata = {
  title: "Worklogs",
};

export default function WorklogsPage() {
  return (
    <main className="mx-auto max-w-[min(100%,96rem)] flex-1 px-4 py-8">
      <WorklogsClient />
    </main>
  );
}
