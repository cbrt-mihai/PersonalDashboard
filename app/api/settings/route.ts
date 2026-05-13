import { NextResponse } from "next/server";
import { z } from "zod";
import { DEFAULT_DASHBOARD_SETTINGS } from "@/lib/defaultDashboardSettings";
import { appendAudit, auditDetailForUpdate } from "@/lib/auditLog";
import { mutateStore, readStore } from "@/lib/jsonStore";
import { dashboardSettingsSchema } from "@/lib/schemas";
import { normalizeStatusKey } from "@/lib/statusConfig";

const SETTINGS_AUDIT_KEYS = [
  "ownerColorPresets",
  "statusTextColorSwatches",
  "statusBgSwatches",
  "taskTypes",
  "taskPriorities",
  "noteTypes",
  "taskStatuses",
  "noteStatuses",
  "worklogMinutesPerDay",
] as const;

const hexColor = z
  .string()
  .min(4)
  .max(7)
  .refine(
    (s) => /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(s),
    "Expected #RGB or #RRGGBB",
  );

const taskStatusRowPatch = z.object({
  id: z.string().min(1).max(64),
  label: z.string().min(1).max(100),
  color: z.string().min(1).max(64),
  bg: z.string().min(1).max(120),
  order: z.number().int(),
  terminal: z.boolean().optional(),
});

const ownerColorPresetPatch = z.object({
  name: z.string().min(1).max(80),
  color: hexColor,
});

const namedSwatchPatch = z.object({
  name: z.string().min(1).max(80),
  value: z.string().min(1).max(120),
});

const taskTypeRowPatch = z.object({
  label: z.string().min(1).max(64),
  color: hexColor,
  bg: z.string().min(1).max(120),
  icon: z.string().max(32).optional(),
});

const taskPriorityRowPatch = z.object({
  label: z.string().min(1).max(32),
  color: hexColor,
  bg: z.string().min(1).max(120),
  icon: z.string().max(32).optional(),
});

const patchBody = z
  .object({
    reset: z.literal(true).optional(),
    ownerColorPresets: z.array(ownerColorPresetPatch).min(1).max(40).optional(),
    statusTextColorSwatches: z.array(namedSwatchPatch).min(1).max(80).optional(),
    statusBgSwatches: z.array(namedSwatchPatch).min(1).max(80).optional(),
    taskTypes: z.array(taskTypeRowPatch).min(1).max(40).optional(),
    taskPriorities: z.array(taskPriorityRowPatch).min(1).max(24).optional(),
    noteTypes: z.array(z.string().min(1).max(64)).min(1).max(40).optional(),
    taskStatuses: z.array(taskStatusRowPatch).min(1).max(40).optional(),
    noteStatuses: z.array(taskStatusRowPatch).min(1).max(40).optional(),
    worklogMinutesPerDay: z.number().int().min(60).max(2880).optional(),
  })
  .strict();

function assertUniqueStatusIds(rows: { id: string }[]) {
  const keys = rows.map((r) => normalizeStatusKey(r.id));
  if (new Set(keys).size !== keys.length) {
    throw new Error("Duplicate status id (after normalization)");
  }
}

export async function GET() {
  const s = readStore();
  return NextResponse.json(s.settings);
}

export async function PATCH(req: Request) {
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
  const { reset, ...rest } = parsed.data;
  try {
    const next = mutateStore((store) => {
      const before = store.settings;
      if (reset) {
        store.settings = dashboardSettingsSchema.parse(
          structuredClone(DEFAULT_DASHBOARD_SETTINGS),
        );
        appendAudit(store, {
          action: "update",
          entity: "settings",
          entityId: null,
          summary: "Reset dashboard settings to defaults",
          detail: auditDetailForUpdate(before, store.settings, SETTINGS_AUDIT_KEYS),
        });
        return;
      }
      if (rest.taskStatuses) assertUniqueStatusIds(rest.taskStatuses);
      if (rest.noteStatuses) assertUniqueStatusIds(rest.noteStatuses);
      store.settings = dashboardSettingsSchema.parse({
        ...store.settings,
        ...rest,
      });
      appendAudit(store, {
        action: "update",
        entity: "settings",
        entityId: null,
        summary: "Saved dashboard settings",
        detail: auditDetailForUpdate(before, store.settings, SETTINGS_AUDIT_KEYS),
      });
    }).settings;
    return NextResponse.json(next);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Invalid settings";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
