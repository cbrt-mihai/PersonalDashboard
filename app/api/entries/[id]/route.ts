import { NextResponse } from "next/server";
import { z } from "zod";
import { appendAudit, auditDetailForDelete, auditDetailForUpdate } from "@/lib/auditLog";
import { mutateStore, readStore } from "@/lib/jsonStore";
import { closedAtAfterNoteStatusChange } from "@/lib/noteClosedAt";
import { validateNoteAttribution } from "@/lib/noteAttribution";
import { dedupeTags } from "@/lib/noteTags";
import { findOwnerEntryByIdOrKey } from "@/lib/resolveEntityId";
import { ownerEntrySchema } from "@/lib/schemas";
import { buildStatusMapFromRows } from "@/lib/statusConfig";

const NOTE_UPDATE_AUDIT_KEYS = [
  "archivedAt",
  "ownerId",
  "projectId",
  "title",
  "body",
  "status",
  "type",
  "priority",
  "tags",
  "closedAt",
] as const;
const NOTE_DELETE_AUDIT_KEYS = [
  "ownerId",
  "projectId",
  "archivedAt",
  "title",
  "status",
  "type",
  "priority",
  "tags",
  "body",
  "closedAt",
] as const;

const patchBody = z.object({
  archivedAt: z.string().nullable().optional(),
  ownerId: z.string().uuid().nullable().optional(),
  projectId: z.string().uuid().nullable().optional(),
  title: z.string().min(1).optional(),
  body: z.string().optional(),
  status: z.string().min(1).max(64).optional(),
  type: z.string().min(1).max(64).optional(),
  priority: z.string().min(1).max(32).optional(),
  tags: z.array(z.string().min(1).max(48)).max(24).optional(),
});

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const { id: idOrKey } = await ctx.params;
  const entry = findOwnerEntryByIdOrKey(readStore(), idOrKey);
  if (!entry) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(entry);
}

export async function PATCH(req: Request, ctx: Ctx) {
  const { id: idOrKey } = await ctx.params;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = patchBody.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const store = readStore();
  const cur = findOwnerEntryByIdOrKey(store, idOrKey);
  if (!cur) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const id = cur.id;
  const patch = { ...parsed.data };
  if (patch.tags !== undefined) {
    patch.tags = dedupeTags(patch.tags);
  }
  const next = { ...cur, ...patch };
  const nextOwnerId = next.ownerId ?? null;
  const nextProjectId = next.projectId ?? null;
  const v = validateNoteAttribution(nextOwnerId, nextProjectId, store);
  if (!v.ok) {
    return NextResponse.json({ error: v.error }, { status: v.status });
  }
  let updated = false;
  const entry = mutateStore((s) => {
    const i = s.ownerEntries.findIndex((x) => x.id === id);
    if (i === -1) return;
    const curInner = s.ownerEntries[i]!;
    const patchInner = { ...parsed.data };
    if (patchInner.tags !== undefined) {
      patchInner.tags = dedupeTags(patchInner.tags);
    }
    const mergedBase = { ...curInner, ...patchInner };
    const noteMap = buildStatusMapFromRows(s.settings.noteStatuses);
    const nowIso = new Date().toISOString();
    const closedAt = closedAtAfterNoteStatusChange({
      prevStatus: curInner.status,
      prevClosedAt: curInner.closedAt ?? null,
      nextStatus: mergedBase.status,
      map: noteMap,
      nowIso,
    });
    const merged = { ...mergedBase, closedAt };
    s.ownerEntries[i] = ownerEntrySchema.parse(merged);
    updated = true;
    const e = s.ownerEntries[i]!;
    appendAudit(s, {
      action: "update",
      entity: "owner_entry",
      entityId: id,
      summary: `Updated note "${e.title}"`,
      detail: auditDetailForUpdate(cur, e, NOTE_UPDATE_AUDIT_KEYS),
    });
  }).ownerEntries.find((x) => x.id === id);
  if (!updated || !entry) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json(entry);
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const { id: idOrKey } = await ctx.params;
  const row = findOwnerEntryByIdOrKey(readStore(), idOrKey);
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const id = row.id;
  mutateStore((s) => {
    const e = s.ownerEntries.find((x) => x.id === id);
    if (e) {
      appendAudit(s, {
        action: "delete",
        entity: "owner_entry",
        entityId: id,
        summary: `Deleted note "${e.title}"`,
        detail: auditDetailForDelete(e, NOTE_DELETE_AUDIT_KEYS),
      });
    }
    s.ownerEntries = s.ownerEntries.filter((x) => x.id !== id);
  });
  return new NextResponse(null, { status: 204 });
}
