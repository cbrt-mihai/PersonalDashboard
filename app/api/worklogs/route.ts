import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { appendAudit, auditDetailForCreate } from "@/lib/auditLog";
import { nextEntityKey } from "@/lib/apiEntityKey";
import { ENTITY_KEY_TAG_MAX, normalizeKeyTag } from "@/lib/entityKey";
import { JiraDurationParseError, parseJiraDuration } from "@/lib/jiraDuration";
import { mutateStore, readStore } from "@/lib/jsonStore";
import { filterWorklogs } from "@/lib/worklogs";
import { worklogSchema, worklogTargetSchema } from "@/lib/schemas";
import {
  parseListPagination,
  sliceToPage,
  wantsPaginatedList,
} from "@/lib/apiPagination";

const WORKLOG_CREATE_AUDIT_KEYS = [
  "key",
  "startedAt",
  "durationMinutes",
  "comment",
  "target",
] as const;

function targetExists(
  store: ReturnType<typeof readStore>,
  target: z.infer<typeof worklogTargetSchema>,
): boolean {
  switch (target.kind) {
    case "task":
      return store.tasks.some((t) => t.id === target.taskId);
    case "epic":
      return store.taskGroups.some((g) => g.id === target.groupId);
    case "note":
      return store.ownerEntries.some((e) => e.id === target.entryId);
    case "project":
      return store.projects.some((p) => p.id === target.projectId);
    case "owner":
      return store.owners.some((o) => o.id === target.ownerId);
    default:
      return false;
  }
}

const createBody = z
  .object({
    target: worklogTargetSchema,
    startedAt: z.string().min(1),
    durationMinutes: z.number().int().positive().optional(),
    timeSpent: z.string().optional(),
    comment: z.string().max(2000).optional().default(""),
    keyTag: z.string().max(ENTITY_KEY_TAG_MAX).optional(),
  })
  .refine(
    (d) =>
      d.durationMinutes !== undefined ||
      (d.timeSpent !== undefined && String(d.timeSpent).trim().length > 0),
    { message: "Provide durationMinutes or timeSpent" },
  );

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const store = readStore();
  const list = filterWorklogs(store, {
    taskId: searchParams.get("taskId"),
    groupId: searchParams.get("groupId"),
    entryId: searchParams.get("entryId"),
    projectId: searchParams.get("projectId"),
    ownerId: searchParams.get("ownerId"),
    from: searchParams.get("from"),
    to: searchParams.get("to"),
  });
  list.sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  if (wantsPaginatedList(searchParams)) {
    const { page, pageSize } = parseListPagination(searchParams);
    return NextResponse.json(sliceToPage(list, page, pageSize));
  }
  return NextResponse.json(list);
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
  if (!targetExists(store, parsed.data.target)) {
    return NextResponse.json({ error: "Target not found" }, { status: 400 });
  }
  const minutesPerDay = store.settings.worklogMinutesPerDay;
  let durationMinutes: number;
  if (parsed.data.durationMinutes !== undefined) {
    durationMinutes = parsed.data.durationMinutes;
  } else {
    try {
      durationMinutes = parseJiraDuration(parsed.data.timeSpent ?? "", { minutesPerDay });
    } catch (e) {
      const msg = e instanceof JiraDurationParseError ? e.message : "Invalid time spent";
      return NextResponse.json({ error: msg }, { status: 400 });
    }
  }
  const now = new Date().toISOString();
  const wl = worklogSchema.parse({
    id: randomUUID(),
    key: nextEntityKey(normalizeKeyTag(parsed.data.keyTag, "WLG")),
    startedAt: parsed.data.startedAt,
    durationMinutes,
    comment: parsed.data.comment ?? "",
    target: parsed.data.target,
    createdAt: now,
    updatedAt: now,
  });
  mutateStore((s) => {
    s.worklogs.push(wl);
    appendAudit(s, {
      action: "create",
      entity: "worklog",
      entityId: wl.id,
      summary: `Logged ${wl.durationMinutes}m on ${wl.target.kind}`,
      detail: auditDetailForCreate(wl, WORKLOG_CREATE_AUDIT_KEYS),
    });
  });
  return NextResponse.json(wl, { status: 201 });
}
