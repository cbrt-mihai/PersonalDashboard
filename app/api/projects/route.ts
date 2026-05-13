import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { appendAudit, auditDetailForCreate } from "@/lib/auditLog";
import { nextEntityKey } from "@/lib/apiEntityKey";
import { ENTITY_KEY_TAG_MAX, normalizeKeyTag } from "@/lib/entityKey";
import { mutateStore, readStore } from "@/lib/jsonStore";
import { dedupeTags } from "@/lib/noteTags";
import { projectSchema, ownerSchema } from "@/lib/schemas";
import {
  parseListPagination,
  sliceToPage,
  wantsPaginatedList,
} from "@/lib/apiPagination";

const PROJECT_CREATE_AUDIT_KEYS = ["name", "color", "iconDataUrl", "description", "tags"] as const;

const createBody = z.object({
  name: z.string().min(1),
  color: z.string().optional().default("#6366f1"),
  iconDataUrl: z.string().optional().nullable(),
  description: z.string().optional().default(""),
  tags: z.array(z.string()).optional().default([]),
  keyTag: z.string().max(ENTITY_KEY_TAG_MAX).optional(),
});

export async function GET(req: Request) {
  const { projects } = readStore();
  const { searchParams } = new URL(req.url);
  if (wantsPaginatedList(searchParams)) {
    const { page, pageSize } = parseListPagination(searchParams);
    return NextResponse.json(sliceToPage(projects, page, pageSize));
  }
  return NextResponse.json(projects);
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
  const project = projectSchema.parse({
    id: randomUUID(),
    key: nextEntityKey(normalizeKeyTag(parsed.data.keyTag, "PRJ")),
    name: parsed.data.name.trim(),
    color: colorCheck.data,
    iconDataUrl: iconCheck.data ?? null,
    description: parsed.data.description ?? "",
    tags: dedupeTags(parsed.data.tags ?? []),
  });
  mutateStore((s) => {
    s.projects.push(project);
    appendAudit(s, {
      action: "create",
      entity: "project",
      entityId: project.id,
      summary: `Created project "${project.name}"`,
      detail: auditDetailForCreate(project, PROJECT_CREATE_AUDIT_KEYS),
    });
  });
  return NextResponse.json(project, { status: 201 });
}

