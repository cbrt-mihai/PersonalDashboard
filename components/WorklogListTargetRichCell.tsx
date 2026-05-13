"use client";

import Link from "next/link";
import { OwnerSwatch } from "@/components/OwnerSwatch";
import { TaskTypeBadge } from "@/components/TaskMetaBadges";
import type { Owner, Project } from "@/lib/schemas";
import type { ResolvedWorklogTarget } from "@/lib/worklogTargetDisplay";

type Props = {
  resolved: ResolvedWorklogTarget;
  owner?: Owner | null;
  project?: Project | null;
};

const KIND_LABEL: Record<ResolvedWorklogTarget["kind"], string> = {
  task: "Task",
  epic: "Epic",
  note: "Note",
  project: "Project",
  owner: "Owner",
};

export function WorklogListTargetRichCell({ resolved, owner, project }: Props) {
  const primary = `${resolved.publicId} - ${resolved.entryName}`;
  const line = (
    <span className="inline-flex min-w-0 flex-wrap items-center gap-2">
      {resolved.kind === "task" && resolved.taskType ? (
        <span className="shrink-0">
          <TaskTypeBadge type={resolved.taskType} />
        </span>
      ) : (
        <span className="shrink-0 rounded-md bg-zinc-200 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300">
          {KIND_LABEL[resolved.kind]}
        </span>
      )}
      {resolved.deleted ? (
        <span
          className="min-w-0 truncate font-medium text-zinc-400 line-through decoration-zinc-400 dark:text-zinc-500"
          title={`${primary} (deleted)`}
        >
          {primary}
        </span>
      ) : (
        <Link
          href={resolved.href}
          className="min-w-0 truncate font-medium text-blue-600 hover:underline dark:text-blue-400"
          title={primary}
        >
          {primary}
        </Link>
      )}
    </span>
  );

  return (
    <div className="flex min-w-0 items-start gap-2.5">
      <OwnerSwatch owner={owner ?? undefined} className="h-8 w-8 shrink-0 rounded-lg ring-1 ring-zinc-200/80 dark:ring-zinc-600/80" />
      {project ? (
        <span
          className="mt-1.5 h-6 w-1 shrink-0 rounded-full"
          style={{ backgroundColor: project.color ?? "#6366f1" }}
          title={project.name}
          aria-hidden
        />
      ) : (
        <span className="mt-1.5 w-1 shrink-0" aria-hidden />
      )}
      <div className="min-w-0 flex-1">
        {line}
        <div className="mt-0.5 flex min-w-0 flex-wrap gap-x-2 gap-y-0.5 text-xs text-zinc-500 dark:text-zinc-400">
          {project ? <span className="truncate">{project.name}</span> : null}
          {project && owner ? <span aria-hidden>·</span> : null}
          {owner ? <span className="truncate">{owner.name}</span> : null}
          {!project && !owner && resolved.deleted ? (
            <span className="italic text-zinc-400">Target no longer in workspace</span>
          ) : null}
        </div>
      </div>
    </div>
  );
}
