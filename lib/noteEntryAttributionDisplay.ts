import type { Owner, OwnerEntry, Project } from "@/lib/schemas";

/** Props derived for `OwnerSwatch` on notes: owner wins when set; else project color/icon. */
export type NoteEntrySwatchAttribution = {
  owner: Owner | undefined;
  color: string;
  iconDataUrl: string | null | undefined;
  title: string;
};

export function noteEntrySwatchFromEntities(
  owner: Owner | null | undefined,
  project: Project | null | undefined,
): NoteEntrySwatchAttribution {
  if (owner) {
    return {
      owner,
      color: owner.color,
      iconDataUrl: undefined,
      title: owner.name,
    };
  }
  if (project) {
    return {
      owner: undefined,
      color: project.color,
      iconDataUrl: project.iconDataUrl ?? null,
      title: project.name,
    };
  }
  return {
    owner: undefined,
    color: "#64748b",
    iconDataUrl: null,
    title: "Note",
  };
}

export function noteEntryAttributionForSwatch(
  entry: Pick<OwnerEntry, "ownerId" | "projectId">,
  owners: Owner[],
  projects: Project[],
): NoteEntrySwatchAttribution {
  const owner = entry.ownerId
    ? (owners.find((x) => x.id === entry.ownerId) ?? null)
    : null;
  const project = entry.projectId
    ? (projects.find((x) => x.id === entry.projectId) ?? null)
    : null;
  return noteEntrySwatchFromEntities(owner, project);
}
