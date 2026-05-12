import { NextResponse } from "next/server";
import { z } from "zod";
import { appendAudit, auditDetailForDelete, auditDetailForUpdate } from "@/lib/auditLog";
import { mutateStore, readStore } from "@/lib/jsonStore";
import { ownerEntrySchema, ownerSchema } from "@/lib/schemas";

const OWNER_UPDATE_AUDIT_KEYS = ["name", "archivedAt", "color", "iconDataUrl"] as const;
const OWNER_DELETE_AUDIT_KEYS = ["name", "archivedAt", "color", "iconDataUrl"] as const;

const patchBody = z.object({
  name: z.string().min(1).optional(),
  archivedAt: z.string().nullable().optional(),
  color: ownerSchema.shape.color.optional(),
  iconDataUrl: ownerSchema.shape.iconDataUrl.optional(),
});

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const p = readStore().owners.find((x) => x.id === id);
  if (!p) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(p);
}

export async function PATCH(req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
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
  let updated = false;
  const owner = mutateStore((s) => {
    const i = s.owners.findIndex((x) => x.id === id);
    if (i === -1) return;
    const cur = s.owners[i]!;
    const next = { ...cur, ...parsed.data };
    s.owners[i] = ownerSchema.parse(next);
    updated = true;
    const after = s.owners[i]!;
    const name = after.name;
    appendAudit(s, {
      action: "update",
      entity: "owner",
      entityId: id,
      summary: `Updated owner "${name}"`,
      detail: auditDetailForUpdate(cur, after, OWNER_UPDATE_AUDIT_KEYS),
    });
  }).owners.find((x) => x.id === id);
  if (!updated || !owner) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json(owner);
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const store = readStore();
  if (!store.owners.some((x) => x.id === id)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (store.tasks.some((t) => t.ownerId === id)) {
    return NextResponse.json(
      { error: "Owner has tasks; delete or reassign tasks first." },
      { status: 409 },
    );
  }
  if (store.taskGroups.some((g) => g.ownerId === id)) {
    return NextResponse.json(
      { error: "Owner has groups; delete groups first." },
      { status: 409 },
    );
  }
  if (store.ownerEntries.some((e) => e.ownerId === id && e.projectId == null)) {
    return NextResponse.json(
      { error: "Owner has notes that are not linked to a project; delete or reassign those notes first." },
      { status: 409 },
    );
  }
  mutateStore((s) => {
    for (let i = 0; i < s.ownerEntries.length; i++) {
      const e = s.ownerEntries[i]!;
      if (e.ownerId === id && e.projectId != null) {
        s.ownerEntries[i] = ownerEntrySchema.parse({ ...e, ownerId: null });
      }
    }
    const p = s.owners.find((x) => x.id === id);
    if (p) {
      appendAudit(s, {
        action: "delete",
        entity: "owner",
        entityId: id,
        summary: `Deleted owner "${p.name}"`,
        detail: auditDetailForDelete(p, OWNER_DELETE_AUDIT_KEYS),
      });
    }
    s.owners = s.owners.filter((x) => x.id !== id);
  });
  return new NextResponse(null, { status: 204 });
}
