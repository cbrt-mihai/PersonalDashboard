import { NextResponse } from "next/server";
import { z } from "zod";
import { appendAudit, auditDetailForDelete, auditDetailForUpdate } from "@/lib/auditLog";
import { mutateStore, readStore } from "@/lib/jsonStore";
import { dedupeTags } from "@/lib/noteTags";
import { findProjectByIdOrKey } from "@/lib/resolveEntityId";
import { ownerEntrySchema, ownerSchema, projectSchema } from "@/lib/schemas";

const PROJECT_UPDATE_AUDIT_KEYS = [
  "name",
  "archivedAt",
  "color",
  "iconDataUrl",
  "description",
  "tags",
] as const;
const PROJECT_DELETE_AUDIT_KEYS = [
  "name",
  "archivedAt",
  "color",
  "iconDataUrl",
  "description",
  "tags",
] as const;

const patchBody = z.object({
  name: z.string().min(1).optional(),
  archivedAt: z.string().nullable().optional(),
  color: ownerSchema.shape.color.optional(),
  iconDataUrl: ownerSchema.shape.iconDataUrl.optional(),
  description: z.string().optional(),
  tags: z.array(z.string()).optional(),
});

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const { id: idOrKey } = await ctx.params;
  const p = findProjectByIdOrKey(readStore(), idOrKey);
  if (!p) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(p);
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

  const row = findProjectByIdOrKey(readStore(), idOrKey);
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const id = row.id;
  let updated = false;
  const project = mutateStore((s) => {
    const i = s.projects.findIndex((x) => x.id === id);
    if (i === -1) return;
    const cur = s.projects[i]!;
    const nextTags =
      parsed.data.tags !== undefined ? dedupeTags(parsed.data.tags) : cur.tags ?? [];
    const next = { ...cur, ...parsed.data, tags: nextTags };
    s.projects[i] = projectSchema.parse(next);
    updated = true;
    const after = s.projects[i]!;
    appendAudit(s, {
      action: "update",
      entity: "project",
      entityId: id,
      summary: `Updated project "${after.name}"`,
      detail: auditDetailForUpdate(cur, after, PROJECT_UPDATE_AUDIT_KEYS),
    });
  }).projects.find((x) => x.id === id);

  if (!updated || !project) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json(project);
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const { id: idOrKey } = await ctx.params;
  const store = readStore();
  const row = findProjectByIdOrKey(store, idOrKey);
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const id = row.id;
  if (store.ownerEntries.some((e) => e.projectId === id && e.ownerId == null)) {
    return NextResponse.json(
      {
        error:
          "Project has notes that are not linked to an owner; delete or reassign those notes first.",
      },
      { status: 409 },
    );
  }
  mutateStore((s) => {
    for (let i = 0; i < s.ownerEntries.length; i++) {
      const e = s.ownerEntries[i]!;
      if (e.projectId === id && e.ownerId != null) {
        s.ownerEntries[i] = ownerEntrySchema.parse({ ...e, projectId: null });
      }
    }
    const p = s.projects.find((x) => x.id === id);
    if (p) {
      appendAudit(s, {
        action: "delete",
        entity: "project",
        entityId: id,
        summary: `Deleted project "${p.name}" (epics unassigned)`,
        detail: auditDetailForDelete(p, PROJECT_DELETE_AUDIT_KEYS),
      });
    }
    s.projects = s.projects.filter((x) => x.id !== id);
    for (const g of s.taskGroups) {
      if (g.projectId === id) g.projectId = null;
    }
  });
  return new NextResponse(null, { status: 204 });
}

