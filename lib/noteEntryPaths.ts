import type { OwnerEntry } from "@/lib/schemas";

export function noteEntryViewHref(e: Pick<OwnerEntry, "id" | "ownerId">): string {
  return e.ownerId ? `/owners/${e.ownerId}/entries/${e.id}` : `/notes/${e.id}`;
}

export function noteEntryEditHref(e: Pick<OwnerEntry, "id" | "ownerId">): string {
  return e.ownerId ? `/owners/${e.ownerId}/entries/${e.id}/edit` : `/notes/${e.id}/edit`;
}

/** Wiki syntax for linking to this note (legacy `[[note:<ownerUuid>:…]]` when owner-scoped). */
export function noteWikiLinkSyntax(
  e: Pick<OwnerEntry, "id" | "ownerId" | "projectId">,
): string {
  if (e.ownerId) {
    return `[[note:${e.ownerId}:${e.id}]]`;
  }
  if (e.projectId) {
    return `[[note:project:${e.projectId}:${e.id}]]`;
  }
  return `[[note:entry:${e.id}]]`;
}
