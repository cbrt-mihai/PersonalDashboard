import type { Metadata } from "next";
import { ProjectsListClient } from "@/components/ProjectsListClient";

export const metadata: Metadata = {
  title: "Projects",
};

export default function ProjectsPage() {
  return (
    <main className="mx-auto max-w-[min(100%,96rem)] flex-1 px-4 py-8">
      <ProjectsListClient />
    </main>
  );
}

