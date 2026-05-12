import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { appendAudit, auditDetailForCreate } from "@/lib/auditLog";
import { mutateStore, readStore } from "@/lib/jsonStore";
import { ownerSchema } from "@/lib/schemas";

const OWNER_CREATE_AUDIT_KEYS = ["name", "color", "iconDataUrl"] as const;

const createBody = z.object({
  name: z.string().min(1),
  color: z.string().optional().default("#6366f1"),
  iconDataUrl: z.string().optional().nullable(),
});

export async function GET() {
  const { owners } = readStore();
  return NextResponse.json(owners);
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
  const colorCheck = ownerSchema.shape.color.safeParse(parsed.data.color);
  if (!colorCheck.success) {
    return NextResponse.json({ error: "Invalid color (use #RGB or #RRGGBB)" }, { status: 400 });
  }
  const iconCheck = ownerSchema.shape.iconDataUrl.safeParse(parsed.data.iconDataUrl);
  if (!iconCheck.success) {
    return NextResponse.json({ error: "Invalid icon image" }, { status: 400 });
  }
  const id = randomUUID();
  const owner = ownerSchema.parse({
    id,
    name: parsed.data.name,
    color: colorCheck.data,
    iconDataUrl: iconCheck.data ?? null,
  });
  mutateStore((s) => {
    s.owners.push(owner);
    appendAudit(s, {
      action: "create",
      entity: "owner",
      entityId: owner.id,
      summary: `Created owner "${owner.name}"`,
      detail: auditDetailForCreate(owner, OWNER_CREATE_AUDIT_KEYS),
    });
  });
  return NextResponse.json(owner, { status: 201 });
}
