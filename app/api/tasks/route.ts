import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { appendAudit, auditDetailForCreate } from "@/lib/auditLog";
import { mutateStore, readStore } from "@/lib/jsonStore";
import { dedupeTags } from "@/lib/noteTags";
import { taskSchema, taskSubtaskSchema } from "@/lib/schemas";
import {
  TASK_FORM_TYPES,
  canonicalPriorityLabel,
  taskPriorityKnownLabels,
} from "@/lib/taskFormOptions";

const TASK_CREATE_AUDIT_KEYS = [
  "ownerId",
  "groupId",
  "type",
  "status",
  "date",
  "priority",
  "tags",
  "subtasks",
] as const;

const createBody = z.object({
  ownerId: z.string().uuid(),
  groupId: z.string().uuid().nullable().optional(),
  name: z.string().min(1),
  description: z.string().optional().default(""),
  type: z.string().optional().default(TASK_FORM_TYPES[0]),
  status: z.string().optional().default("open"),
  date: z.string().optional().default(""),
  priority: z.string().optional().default("Medium"),
  tags: z.array(z.string()).optional().default([]),
  subtasks: z.array(taskSubtaskSchema).max(100).optional().default([]),
});

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const ownerId = searchParams.get("ownerId");
  const groupId = searchParams.get("groupId");
  let { tasks } = readStore();
  if (ownerId) tasks = tasks.filter((t) => t.ownerId === ownerId);
  if (groupId === "null" || groupId === "") {
    tasks = tasks.filter((t) => t.groupId === null);
  } else if (groupId) {
    tasks = tasks.filter((t) => t.groupId === groupId);
  }
  return NextResponse.json(tasks);
}

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
  if (!store.owners.some((p) => p.id === parsed.data.ownerId)) {
    return NextResponse.json({ error: "Unknown owner id" }, { status: 400 });
  }
  const groupId: string | null = parsed.data.groupId ?? null;
  if (groupId) {
    const g = store.taskGroups.find((x) => x.id === groupId);
    if (!g || g.ownerId !== parsed.data.ownerId) {
      return NextResponse.json({ error: "Invalid group for owner" }, { status: 400 });
    }
  }
  const now = new Date().toISOString();
  const dateStr =
    parsed.data.date && parsed.data.date.length > 0
      ? parsed.data.date
      : now.slice(0, 10);
  const knownPriorities = taskPriorityKnownLabels(store.settings.taskPriorities);
  const priority = canonicalPriorityLabel(parsed.data.priority ?? "Medium", knownPriorities);
  const task = taskSchema.parse({
    id: randomUUID(),
    ownerId: parsed.data.ownerId,
    groupId,
    name: parsed.data.name,
    description: parsed.data.description ?? "",
    type: parsed.data.type,
    status: parsed.data.status,
    date: dateStr,
    priority,
    tags: dedupeTags(parsed.data.tags ?? []),
    subtasks: parsed.data.subtasks ?? [],
    createdAt: now,
    updatedAt: now,
  });
  mutateStore((s) => {
    s.tasks.push(task);
    appendAudit(s, {
      action: "create",
      entity: "task",
      entityId: task.id,
      summary: `Created task "${task.name}"`,
      detail: auditDetailForCreate(task, TASK_CREATE_AUDIT_KEYS),
    });
  });
  return NextResponse.json(task, { status: 201 });
}
