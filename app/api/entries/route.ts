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
import {
  parseListPagination,
  sliceToPage,
  wantsPaginatedList,
} from "@/lib/apiPagination";

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
  ownerId: z.string().uuid().nullable().optional(),
  projectId: z.string().uuid().nullable().optional(),
  taskId: z.string().uuid().nullable().optional(),
  taskGroupId: z.string().uuid().nullable().optional(),
});

/** All notes, newest first. Optional filters: ownerId, projectId, taskId, taskGroupId. */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const ownerId = searchParams.get("ownerId");
  const projectId = searchParams.get("projectId");
  const taskId = searchParams.get("taskId");
  const taskGroupId = searchParams.get("taskGroupId");
  const store = readStore();
  if (ownerId) {
    if (!store.owners.some((p) => p.id === ownerId)) {
      return NextResponse.json({ error: "Owner not found" }, { status: 404 });
    }
  }
  if (projectId) {
    if (!store.projects.some((p) => p.id === projectId)) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }
  }
  if (taskId) {
    if (!store.tasks.some((t) => t.id === taskId)) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }
  }
  if (taskGroupId) {
    if (!store.taskGroups.some((g) => g.id === taskGroupId)) {
      return NextResponse.json({ error: "Epic not found" }, { status: 404 });
    }
  }
  let entries = store.ownerEntries;
  if (ownerId) entries = entries.filter((e) => e.ownerId === ownerId);
  if (projectId) entries = entries.filter((e) => e.projectId === projectId);
  if (taskId) entries = entries.filter((e) => e.taskId === taskId);
  if (taskGroupId) entries = entries.filter((e) => e.taskGroupId === taskGroupId);
  const sorted = [...entries].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  if (wantsPaginatedList(searchParams)) {
    const { page, pageSize } = parseListPagination(searchParams);
    return NextResponse.json(sliceToPage(sorted, page, pageSize));
  }
  return NextResponse.json(sorted);
}

/** Create a note; link to owner, project, task, and/or epic (at least one required). */
export async function POST(req: Request) {
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
  const n = normalizeNoteAnchors(store, {
    ownerId: parsed.data.ownerId ?? null,
    projectId: parsed.data.projectId ?? null,
    taskId: parsed.data.taskId ?? null,
    taskGroupId: parsed.data.taskGroupId ?? null,
  });
  if (!n.ok) {
    return NextResponse.json({ error: n.error }, { status: n.status });
  }
  const { ownerId, projectId, taskId, taskGroupId } = n.anchors;
  const defaultStatus = firstStatusIdByOrder(store.settings.noteStatuses);
  const createdAt = new Date().toISOString();
  const status = parsed.data.status ?? defaultStatus;
  const entry = ownerEntrySchema.parse({
    id: randomUUID(),
    key: nextOwnerEntryKey(store, { ownerId, projectId, taskId, taskGroupId }),
    ownerId,
    projectId,
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
