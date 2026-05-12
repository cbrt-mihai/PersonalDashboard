import { NextResponse } from "next/server";
import { z } from "zod";
import { appendAudit, auditDetailForDelete, auditDetailForUpdate } from "@/lib/auditLog";
import { mutateStore, readStore } from "@/lib/jsonStore";
import { dedupeTags } from "@/lib/noteTags";
import { taskSchema, taskSubtaskSchema } from "@/lib/schemas";
import { canonicalPriorityLabel, taskPriorityKnownLabels } from "@/lib/taskFormOptions";

const TASK_UPDATE_AUDIT_KEYS = [
  "ownerId",
  "groupId",
  "archivedAt",
  "name",
  "description",
  "type",
  "status",
  "date",
  "priority",
  "tags",
  "subtasks",
] as const;

const TASK_DELETE_AUDIT_KEYS = [
  "ownerId",
  "groupId",
  "archivedAt",
  "name",
  "type",
  "status",
  "date",
  "priority",
  "tags",
  "subtasks",
] as const;

const patchBody = z.object({
  ownerId: z.string().uuid().optional(),
  groupId: z.string().uuid().nullable().optional(),
  archivedAt: z.string().nullable().optional(),
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  type: z.string().min(1).optional(),
  status: z.string().min(1).optional(),
  date: z.string().optional(),
  priority: z.string().min(1).optional(),
  tags: z.array(z.string()).optional(),
  subtasks: z.array(taskSubtaskSchema).max(100).optional(),
});

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const t = readStore().tasks.find((x) => x.id === id);
  if (!t) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(t);
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
  const storeBefore = readStore();
  const cur = storeBefore.tasks.find((x) => x.id === id);
  if (!cur) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const ownerId = parsed.data.ownerId ?? cur.ownerId;
  if (!storeBefore.owners.some((p) => p.id === ownerId)) {
    return NextResponse.json({ error: "Unknown owner id" }, { status: 400 });
  }

  const groupId =
    parsed.data.groupId !== undefined ? parsed.data.groupId : cur.groupId;
  if (groupId) {
    const g = storeBefore.taskGroups.find((x) => x.id === groupId);
    if (!g || g.ownerId !== ownerId) {
      return NextResponse.json({ error: "Invalid group for owner" }, { status: 400 });
    }
  }

  const now = new Date().toISOString();
  const knownPriorities = taskPriorityKnownLabels(storeBefore.settings.taskPriorities);
  let updated = false;
  const task = mutateStore((s) => {
    const i = s.tasks.findIndex((x) => x.id === id);
    if (i === -1) return;
    const c = s.tasks[i]!;
    const nextTags =
      parsed.data.tags !== undefined ? dedupeTags(parsed.data.tags) : c.tags ?? [];
    const nextSubtasks =
      parsed.data.subtasks !== undefined ? parsed.data.subtasks : (c.subtasks ?? []);
    const priorityNorm =
      parsed.data.priority !== undefined
        ? canonicalPriorityLabel(parsed.data.priority, knownPriorities)
        : c.priority;
    const next = {
      ...c,
      ...parsed.data,
      ownerId,
      groupId,
      tags: nextTags,
      subtasks: nextSubtasks,
      priority: priorityNorm,
      updatedAt: now,
    };
    s.tasks[i] = taskSchema.parse(next);
    updated = true;
    const t = s.tasks[i]!;
    appendAudit(s, {
      action: "update",
      entity: "task",
      entityId: id,
      summary: `Updated task "${t.name}"`,
      detail: auditDetailForUpdate(c, t, TASK_UPDATE_AUDIT_KEYS),
    });
  }).tasks.find((x) => x.id === id);
  if (!updated || !task) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json(task);
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const exists = readStore().tasks.some((x) => x.id === id);
  if (!exists) return NextResponse.json({ error: "Not found" }, { status: 404 });
  mutateStore((s) => {
    const t = s.tasks.find((x) => x.id === id);
    if (t) {
      appendAudit(s, {
        action: "delete",
        entity: "task",
        entityId: id,
        summary: `Deleted task "${t.name}"`,
        detail: auditDetailForDelete(t, TASK_DELETE_AUDIT_KEYS),
      });
    }
    s.tasks = s.tasks.filter((x) => x.id !== id);
  });
  return new NextResponse(null, { status: 204 });
}
