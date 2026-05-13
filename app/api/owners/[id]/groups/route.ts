import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { appendAudit, auditDetailForCreate } from "@/lib/auditLog";
import { nextEntityKey } from "@/lib/apiEntityKey";
import { ENTITY_KEY_TAG_MAX, normalizeKeyTag } from "@/lib/entityKey";
import { mutateStore, readStore } from "@/lib/jsonStore";
import { dedupeTags } from "@/lib/noteTags";
import { taskGroupSchema } from "@/lib/schemas";

const EPIC_CREATE_AUDIT_KEYS = ["ownerId", "projectId", "name", "description", "tags"] as const;

const createBody = z.object({
  name: z.string().min(1),
  description: z.string().optional().default(""),
  tags: z.array(z.string()).optional().default([]),
  projectId: z.string().uuid().nullable().optional(),
  keyTag: z.string().max(ENTITY_KEY_TAG_MAX).optional(),
});

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const { id: ownerId } = await ctx.params;
  if (!readStore().owners.some((p) => p.id === ownerId)) {
    return NextResponse.json({ error: "Owner not found" }, { status: 404 });
  }
  const groups = readStore().taskGroups.filter((g) => g.ownerId === ownerId);
  return NextResponse.json(groups);
}

export async function POST(req: Request, ctx: Ctx) {
  const { id: ownerId } = await ctx.params;
  const store = readStore();
  if (!store.owners.some((p) => p.id === ownerId)) {
    return NextResponse.json({ error: "Owner not found" }, { status: 404 });
  }
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = createBody.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const projectId = parsed.data.projectId ?? null;
  if (projectId !== null && !store.projects.some((p) => p.id === projectId)) {
    return NextResponse.json({ error: "Unknown projectId" }, { status: 400 });
  }
  const group = taskGroupSchema.parse({
    id: randomUUID(),
    key: nextEntityKey(normalizeKeyTag(parsed.data.keyTag, "EPC")),
    ownerId,
    projectId,
    name: parsed.data.name,
    description: parsed.data.description ?? "",
    tags: dedupeTags(parsed.data.tags ?? []),
  });
  mutateStore((s) => {
    s.taskGroups.push(group);
    appendAudit(s, {
      action: "create",
      entity: "task_group",
      entityId: group.id,
      summary: `Created epic "${group.name}"`,
      detail: auditDetailForCreate(group, EPIC_CREATE_AUDIT_KEYS),
    });
  });
  return NextResponse.json(group, { status: 201 });
}
