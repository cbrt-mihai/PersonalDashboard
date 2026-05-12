import type { Metadata } from "next";
import { AchievementsClient } from "@/components/AchievementsClient";

export const metadata: Metadata = {
  title: "Achievements",
};

export default function AchievementsPage() {
  return (
    <main className="mx-auto max-w-[min(100%,96rem)] flex-1 px-4 py-8">
      <AchievementsClient />
    </main>
  );
}
