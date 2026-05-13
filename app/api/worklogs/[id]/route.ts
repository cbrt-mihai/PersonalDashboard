import { NextResponse } from "next/server";
import { z } from "zod";
import { appendAudit, auditDetailForDelete, auditDetailForUpdate } from "@/lib/auditLog";
import { JiraDurationParseError, parseJiraDuration } from "@/lib/jiraDuration";
import { mutateStore, readStore } from "@/lib/jsonStore";
import { findWorklogByIdOrKey } from "@/lib/resolveEntityId";
import { worklogSchema } from "@/lib/schemas";

const WORKLOG_UPDATE_AUDIT_KEYS = [
  "startedAt",
  "durationMinutes",
  "comment",
  "target",
] as const;
const WORKLOG_DELETE_AUDIT_KEYS = WORKLOG_UPDATE_AUDIT_KEYS;

const patchBody = z
  .object({
    startedAt: z.string().min(1).optional(),
    durationMinutes: z.number().int().positive().optional(),
    timeSpent: z.string().optional(),
    comment: z.string().max(2000).optional(),
  })
  .refine(
    (d) =>
      d.startedAt !== undefined ||
      d.durationMinutes !== undefined ||
      (d.timeSpent !== undefined && d.timeSpent.trim() !== "") ||
      d.comment !== undefined,
    { message: "No changes" },
  );

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const { id: idOrKey } = await ctx.params;
  const w = findWorklogByIdOrKey(readStore(), idOrKey);
  if (!w) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(w);
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
  const store0 = readStore();
  const cur = findWorklogByIdOrKey(store0, idOrKey);
  if (!cur) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const id = cur.id;
  const minutesPerDay = store0.settings.worklogMinutesPerDay;
  let durationMinutes = cur.durationMinutes;
  if (parsed.data.durationMinutes !== undefined) {
    durationMinutes = parsed.data.durationMinutes;
  } else if (parsed.data.timeSpent !== undefined && parsed.data.timeSpent.trim()) {
    try {
      durationMinutes = parseJiraDuration(parsed.data.timeSpent, { minutesPerDay });
    } catch (e) {
      const msg = e instanceof JiraDurationParseError ? e.message : "Invalid time spent";
      return NextResponse.json({ error: msg }, { status: 400 });
    }
  }
  const now = new Date().toISOString();
  let updated = false;
  const wl = mutateStore((s) => {
    const i = s.worklogs.findIndex((x) => x.id === id);
    if (i === -1) return;
    const c = s.worklogs[i]!;
    const next = {
      ...c,
      startedAt: parsed.data.startedAt ?? c.startedAt,
      durationMinutes,
      comment: parsed.data.comment !== undefined ? parsed.data.comment : c.comment,
      updatedAt: now,
    };
    s.worklogs[i] = worklogSchema.parse(next);
    updated = true;
    const after = s.worklogs[i]!;
    appendAudit(s, {
      action: "update",
      entity: "worklog",
      entityId: id,
      summary: "Updated worklog",
      detail: auditDetailForUpdate(c, after, WORKLOG_UPDATE_AUDIT_KEYS),
    });
  }).worklogs.find((x) => x.id === id);
  if (!updated || !wl) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(wl);
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const { id: idOrKey } = await ctx.params;
  const row = findWorklogByIdOrKey(readStore(), idOrKey);
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const id = row.id;
  mutateStore((s) => {
    const w = s.worklogs.find((x) => x.id === id);
    if (w) {
      appendAudit(s, {
        action: "delete",
        entity: "worklog",
        entityId: id,
        summary: "Deleted worklog",
        detail: auditDetailForDelete(w, WORKLOG_DELETE_AUDIT_KEYS),
      });
    }
    s.worklogs = s.worklogs.filter((x) => x.id !== id);
  });
  return new NextResponse(null, { status: 204 });
}
