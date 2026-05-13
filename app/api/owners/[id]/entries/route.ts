import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { appendAudit, auditDetailForCreate } from "@/lib/auditLog";
import { nextOwnerEntryKey } from "@/lib/apiEntityKey";
import { mutateStore, readStore } from "@/lib/jsonStore";
import { closedAtForNewNote } from "@/lib/noteClosedAt";
import { normalizeNoteAnchors } from "@/lib/noteAttribution";
import { dedupeTags } from "@/lib/noteTags";
import { ownerEntrySchema } from "@/lib/schemas";
import { firstStatusIdByOrder } from "@/lib/statusConfig";

const NOTE_CREATE_AUDIT_KEYS = [
  "ownerId",
  "projectId",
  "taskId",
  "taskGroupId",
  "title",
  "status",
  "type",
  "priority",
  "tags",
  "body",
  "closedAt",
] as const;

const createBody = z.object({
  title: z.string().min(1),
  body: z.string().optional().default(""),
  status: z.string().optional(),
  type: z.string().optional().default("Note"),
  priority: z.string().optional().default("Medium"),
  tags: z.array(z.string().min(1).max(48)).max(24).optional(),
  projectId: z.string().uuid().nullable().optional(),
  taskId: z.string().uuid().nullable().optional(),
  taskGroupId: z.string().uuid().nullable().optional(),
});

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const { id: ownerId } = await ctx.params;
  if (!readStore().owners.some((p) => p.id === ownerId)) {
    return NextResponse.json({ error: "Owner not found" }, { status: 404 });
  }
  const entries = readStore()
    .ownerEntries.filter((e) => e.ownerId === ownerId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return NextResponse.json(entries);
}

export async function POST(req: Request, ctx: Ctx) {
  const { id: ownerId } = await ctx.params;
  if (!readStore().owners.some((p) => p.id === ownerId)) {
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
  const store = readStore();
  const projectId = parsed.data.projectId ?? null;
  const n = normalizeNoteAnchors(store, {
    ownerId,
    projectId,
    taskId: parsed.data.taskId ?? null,
    taskGroupId: parsed.data.taskGroupId ?? null,
  });
  if (!n.ok) {
    return NextResponse.json({ error: n.error }, { status: n.status });
  }
  const { ownerId: oid, projectId: pid, taskId, taskGroupId } = n.anchors;
  if (oid !== ownerId) {
    return NextResponse.json(
      { error: "Owner does not match URL (task/epic owner differs)" },
      { status: 400 },
    );
  }
  const defaultStatus = firstStatusIdByOrder(store.settings.noteStatuses);
  const createdAt = new Date().toISOString();
  const status = parsed.data.status ?? defaultStatus;
  const entry = ownerEntrySchema.parse({
    id: randomUUID(),
    key: nextOwnerEntryKey(store, {
      ownerId: oid,
      projectId: pid,
      taskId,
      taskGroupId,
    }),
    ownerId: oid,
    projectId: pid,
    taskId,
    taskGroupId,
    title: parsed.data.title,
    body: parsed.data.body ?? "",
    status,
    type: parsed.data.type,
    priority: parsed.data.priority,
    tags: dedupeTags(parsed.data.tags ?? []),
    createdAt,
    closedAt: closedAtForNewNote(status, store.settings.noteStatuses, createdAt),
  });
  mutateStore((s) => {
    s.ownerEntries.push(entry);
    appendAudit(s, {
      action: "create",
      entity: "owner_entry",
      entityId: entry.id,
      summary: `Created note "${entry.title}"`,
      detail: auditDetailForCreate(entry, NOTE_CREATE_AUDIT_KEYS),
    });
  });
  return NextResponse.json(entry, { status: 201 });
}
