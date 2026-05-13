import { NextResponse } from "next/server";
import { z } from "zod";
import { appendAudit, auditDetailForDelete, auditDetailForUpdate } from "@/lib/auditLog";
import { mutateStore, readStore } from "@/lib/jsonStore";
import { dedupeTags } from "@/lib/noteTags";
import { findTaskGroupByIdOrKey } from "@/lib/resolveEntityId";
import { taskGroupSchema } from "@/lib/schemas";

const EPIC_UPDATE_AUDIT_KEYS = [
  "ownerId",
  "projectId",
  "archivedAt",
  "name",
  "description",
  "tags",
] as const;
const EPIC_DELETE_AUDIT_KEYS = [
  "ownerId",
  "projectId",
  "archivedAt",
  "name",
  "description",
  "tags",
] as const;

const patchBody = z.object({
  name: z.string().min(1).optional(),
  archivedAt: z.string().nullable().optional(),
  description: z.string().optional(),
  tags: z.array(z.string()).optional(),
  projectId: z.string().uuid().nullable().optional(),
});

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const { id: idOrKey } = await ctx.params;
  const g = findTaskGroupByIdOrKey(readStore(), idOrKey);
  if (!g) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(g);
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

  if (
    parsed.data.projectId !== undefined &&
    parsed.data.projectId !== null &&
    !readStore().projects.some((p) => p.id === parsed.data.projectId)
  ) {
    return NextResponse.json({ error: "Unknown projectId" }, { status: 400 });
  }

  const row = findTaskGroupByIdOrKey(readStore(), idOrKey);
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const id = row.id;
  let updated = false;
  const group = mutateStore((s) => {
    const i = s.taskGroups.findIndex((x) => x.id === id);
    if (i === -1) return;
    const cur = s.taskGroups[i]!;
    const nextTags =
      parsed.data.tags !== undefined ? dedupeTags(parsed.data.tags) : cur.tags ?? [];
    const next = { ...cur, ...parsed.data, tags: nextTags };
    s.taskGroups[i] = taskGroupSchema.parse(next);
    updated = true;
    const g = s.taskGroups[i]!;
    appendAudit(s, {
      action: "update",
      entity: "task_group",
      entityId: id,
      summary: `Updated epic "${g.name}"`,
      detail: auditDetailForUpdate(cur, g, EPIC_UPDATE_AUDIT_KEYS),
    });
  }).taskGroups.find((x) => x.id === id);
  if (!updated || !group) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json(group);
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const { id: idOrKey } = await ctx.params;
  const store = readStore();
  const row = findTaskGroupByIdOrKey(store, idOrKey);
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const id = row.id;
  mutateStore((s) => {
    const g = s.taskGroups.find((x) => x.id === id);
    if (g) {
      appendAudit(s, {
        action: "delete",
        entity: "task_group",
        entityId: id,
        summary: `Deleted epic "${g.name}" (tasks in epic ungrouped)`,
        detail: auditDetailForDelete(g, EPIC_DELETE_AUDIT_KEYS),
      });
    }
    s.taskGroups = s.taskGroups.filter((x) => x.id !== id);
    for (const t of s.tasks) {
      if (t.groupId === id) t.groupId = null;
    }
  });
  return new NextResponse(null, { status: 204 });
}
