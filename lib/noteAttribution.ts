import type { Store } from "@/lib/schemas";

/** At least one of ownerId or projectId must be set; IDs must exist when non-null. */
export function validateNoteAttribution(
  ownerId: string | null,
  projectId: string | null,
  store: Store,
): { ok: true } | { ok: false; error: string; status: number } {
  if (ownerId == null && projectId == null) {
    return {
      ok: false,
      error: "Note must belong to at least one owner or one project",
      status: 400,
    };
  }
  if (ownerId != null && !store.owners.some((p) => p.id === ownerId)) {
    return { ok: false, error: "Owner not found", status: 400 };
  }
  if (projectId != null && !store.projects.some((p) => p.id === projectId)) {
    return { ok: false, error: "Project not found", status: 400 };
  }
  return { ok: true };
}
