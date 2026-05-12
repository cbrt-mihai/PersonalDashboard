import { z } from "zod";
import {
  DEFAULT_DASHBOARD_SETTINGS,
  ensureTodoNoteStatusInRows,
} from "./defaultDashboardSettings";
import { normalizeOwnerColorPresetsForParse } from "./presetColors";
import { firstStatusIdByOrder } from "./statusConfig";

const hexColor = z
  .string()
  .min(4)
  .max(7)
  .refine(
    (s) => /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(s),
    "Expected #RGB or #RRGGBB",
  );

export const auditActionSchema = z.enum(["create", "update", "delete"]);
export const auditEntitySchema = z.enum([
  "owner",
  "project",
  "task_group",
  "task",
  "owner_entry",
  "settings",
]);

export const auditEventSchema = z.object({
  id: z.string().uuid(),
  at: z.string(),
  action: auditActionSchema,
  entity: auditEntitySchema,
  entityId: z.union([z.string().uuid(), z.null()]),
  summary: z.string().max(500),
  detail: z.string().max(4000).optional(),
});

export type AuditEvent = z.infer<typeof auditEventSchema>;
export type AuditAction = z.infer<typeof auditActionSchema>;
export type AuditEntity = z.infer<typeof auditEntitySchema>;

export const ownerSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(200),
  color: hexColor,
  archivedAt: z.preprocess(
    (v) => (v === undefined ? null : v),
    z.string().nullable().default(null),
  ),
  /**
   * Optional icon image (stored as a data URL). Intended to be rendered on top
   * of `color` as an overlay. Keeping it optional preserves backwards
   * compatibility with existing `data/store.json`.
   */
  iconDataUrl: z
    .string()
    .max(500_000)
    .refine(
      (s) =>
        s.startsWith("data:image/png;base64,") ||
        s.startsWith("data:image/jpeg;base64,") ||
        s.startsWith("data:image/webp;base64,") ||
        s.startsWith("data:image/svg+xml;base64,") ||
        s.startsWith("data:image/svg+xml,"),
      "Expected a data:image/* data URL",
    )
    .optional()
    .nullable(),
});

export const projectSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(200),
  archivedAt: z.preprocess(
    (v) => (v === undefined ? null : v),
    z.string().nullable().default(null),
  ),
  color: z.preprocess((v) => (v === null || v === undefined ? "#6366f1" : v), hexColor),
  iconDataUrl: z
    .preprocess((v) => (v === undefined ? null : v), ownerSchema.shape.iconDataUrl)
    .nullable()
    .optional()
    .default(null),
  description: z.preprocess(
    (v) => (v === null || v === undefined ? "" : v),
    z.string().max(200_000).default(""),
  ),
  tags: z.preprocess(
    (v) => (v === null || v === undefined ? [] : v),
    z.array(z.string().min(1).max(48)).max(24).default([]),
  ),
});

export const taskGroupSchema = z.object({
  id: z.string().uuid(),
  ownerId: z.string().uuid(),
  projectId: z.preprocess(
    (v) => (v === undefined ? null : v),
    z.string().uuid().nullable().default(null),
  ),
  archivedAt: z.preprocess(
    (v) => (v === undefined ? null : v),
    z.string().nullable().default(null),
  ),
  name: z.string().min(1).max(200),
  description: z.preprocess(
    (v) => (v === null || v === undefined ? "" : v),
    z.string().max(200_000).default(""),
  ),
  tags: z.preprocess(
    (v) => (v === null || v === undefined ? [] : v),
    z.array(z.string().min(1).max(48)).max(24).default([]),
  ),
});

export const taskSubtaskSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1).max(500),
  done: z.boolean().default(false),
});

export const taskSchema = z.object({
  id: z.string().uuid(),
  ownerId: z.string().uuid(),
  groupId: z.string().uuid().nullable(),
  archivedAt: z.preprocess(
    (v) => (v === undefined ? null : v),
    z.string().nullable().default(null),
  ),
  name: z.string().min(1).max(500),
  description: z.preprocess(
    (v) => (v === null || v === undefined ? "" : v),
    z.string().max(200_000).default(""),
  ),
  type: z.string().min(1).max(64),
  status: z.string().min(1).max(64),
  date: z.string().max(32),
  priority: z.string().min(1).max(32),
  tags: z.preprocess(
    (v) => (v === null || v === undefined ? [] : v),
    z.array(z.string().min(1).max(48)).max(24).default([]),
  ),
  subtasks: z.preprocess(
    (v) => (v === null || v === undefined ? [] : v),
    z.array(taskSubtaskSchema).max(100).default([]),
  ),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const ownerEntrySchema = z
  .object({
    id: z.string().uuid(),
    /** When set, the note is attributed to this owner (at most one). */
    ownerId: z.preprocess(
      (v) => (v === undefined || v === null || v === "" ? null : v),
      z.string().uuid().nullable(),
    ),
    /** When set, the note is attributed to this project (at most one). */
    projectId: z.preprocess(
      (v) => (v === undefined || v === null || v === "" ? null : v),
      z.string().uuid().nullable(),
    ),
    archivedAt: z.preprocess(
      (v) => (v === undefined ? null : v),
      z.string().nullable().default(null),
    ),
    title: z.string().min(1).max(300),
    body: z.preprocess(
      (v) => (v === null || v === undefined ? "" : v),
      z.string().max(200_000).default(""),
    ),
    createdAt: z.string(),
    /** Set when the note reaches a terminal status (per Settings → Notes); cleared when reopened. */
    closedAt: z.preprocess(
      (v) => (v === undefined ? null : v),
      z.string().nullable().default(null),
    ),
    /** Workflow-style fields for notes (Jira-like metadata). */
    status: z
      .string()
      .max(64)
      .default(() => firstStatusIdByOrder(DEFAULT_DASHBOARD_SETTINGS.noteStatuses)),
    type: z.string().max(64).default("Note"),
    priority: z.string().max(32).default("Medium"),
    tags: z.preprocess(
      (v) => (v === null || v === undefined ? [] : v),
      z.array(z.string().min(1).max(48)).max(24).default([]),
    ),
  })
  .superRefine((e, ctx) => {
    if (e.ownerId == null && e.projectId == null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Note must belong to at least one owner or one project",
        path: ["ownerId"],
      });
    }
  });

export const taskStatusDefinitionSchema = z.object({
  id: z.string().min(1).max(64),
  label: z.string().min(1).max(100),
  color: z.string().min(1).max(64),
  bg: z.string().min(1).max(120),
  order: z.number().int(),
  terminal: z.boolean().optional(),
});

export const ownerColorPresetSchema = z.object({
  name: z.string().min(1).max(80),
  color: hexColor,
});

export type OwnerColorPreset = z.infer<typeof ownerColorPresetSchema>;

export const namedSwatchSchema = z.object({
  name: z.string().min(1).max(80),
  value: z.string().min(1).max(120),
});

export const taskTypeDefinitionSchema = z.object({
  label: z.string().min(1).max(64),
  color: hexColor,
  bg: z
    .string()
    .min(1)
    .max(120)
    .default("rgba(100,116,139,0.15)"),
  icon: z.preprocess(
    (v) => (v === null || v === undefined ? "" : v),
    z.string().max(32),
  ),
});

export const taskPriorityDefinitionSchema = z.object({
  label: z.string().min(1).max(32),
  color: hexColor,
  bg: z
    .string()
    .min(1)
    .max(120)
    .default("rgba(100,116,139,0.15)"),
  icon: z.preprocess(
    (v) => (v === null || v === undefined ? "" : v),
    z.string().max(32),
  ),
});

function coerceTaskTypeRows(raw: unknown) {
  if (!Array.isArray(raw) || raw.length === 0) {
    return DEFAULT_DASHBOARD_SETTINGS.taskTypes.map((r) => ({ ...r }));
  }
  if (raw.every((x) => typeof x === "string")) {
    const rows = (raw as string[])
      .map((s) => s.trim())
      .filter(Boolean)
      .map((label) => {
        const hit = DEFAULT_DASHBOARD_SETTINGS.taskTypes.find(
          (r) => r.label.trim().toLowerCase() === label.toLowerCase(),
        );
        return {
          label,
          color: hit?.color ?? "#64748b",
          bg: hit?.bg ?? "rgba(100,116,139,0.15)",
          icon: hit?.icon ?? "",
        };
      });
    return rows.length ? rows : DEFAULT_DASHBOARD_SETTINGS.taskTypes.map((r) => ({ ...r }));
  }
  return (raw as unknown[]).map((x) => {
    if (!x || typeof x !== "object") return x;
    const o = x as Record<string, unknown>;
    if (typeof o.label !== "string") return x;
    if (typeof o.bg === "string" && o.bg.trim()) return x;
    const label = o.label.trim();
    const hit = DEFAULT_DASHBOARD_SETTINGS.taskTypes.find(
      (r) => r.label.trim().toLowerCase() === label.toLowerCase(),
    );
    return {
      ...o,
      bg: hit?.bg ?? "rgba(100,116,139,0.15)",
    };
  });
}

function coerceTaskPriorityRows(raw: unknown) {
  if (!Array.isArray(raw) || raw.length === 0) {
    return DEFAULT_DASHBOARD_SETTINGS.taskPriorities.map((r) => ({ ...r }));
  }
  if (raw.every((x) => typeof x === "string")) {
    const rows = (raw as string[])
      .map((s) => s.trim())
      .filter(Boolean)
      .map((label) => {
        const hit = DEFAULT_DASHBOARD_SETTINGS.taskPriorities.find(
          (r) => r.label.trim().toLowerCase() === label.toLowerCase(),
        );
        return {
          label,
          color: hit?.color ?? "#64748b",
          bg: hit?.bg ?? "rgba(100,116,139,0.15)",
          icon: hit?.icon ?? "",
        };
      });
    return rows.length ? rows : DEFAULT_DASHBOARD_SETTINGS.taskPriorities.map((r) => ({ ...r }));
  }
  return (raw as unknown[]).map((x) => {
    if (!x || typeof x !== "object") return x;
    const o = x as Record<string, unknown>;
    if (typeof o.label !== "string") return x;
    if (typeof o.bg === "string" && o.bg.trim()) return x;
    const label = o.label.trim();
    const hit = DEFAULT_DASHBOARD_SETTINGS.taskPriorities.find(
      (r) => r.label.trim().toLowerCase() === label.toLowerCase(),
    );
    return {
      ...o,
      bg: hit?.bg ?? "rgba(100,116,139,0.15)",
    };
  });
}

export const dashboardSettingsSchema = z.object({
  ownerColorPresets: z.preprocess(
    (raw) => {
      if (raw === undefined || raw === null) {
        return DEFAULT_DASHBOARD_SETTINGS.ownerColorPresets.map((p) => ({ ...p }));
      }
      return normalizeOwnerColorPresetsForParse(raw);
    },
    z.array(ownerColorPresetSchema).min(1).max(40),
  ),
  statusTextColorSwatches: z
    .array(namedSwatchSchema)
    .min(1)
    .max(80)
    .default(() =>
      DEFAULT_DASHBOARD_SETTINGS.statusTextColorSwatches.map((r) => ({ ...r })),
    ),
  statusBgSwatches: z
    .array(namedSwatchSchema)
    .min(1)
    .max(80)
    .default(() => DEFAULT_DASHBOARD_SETTINGS.statusBgSwatches.map((r) => ({ ...r }))),
  taskTypes: z.preprocess(
    (raw) => coerceTaskTypeRows(raw),
    z
      .array(taskTypeDefinitionSchema)
      .min(1)
      .max(40)
      .default(() => DEFAULT_DASHBOARD_SETTINGS.taskTypes.map((r) => ({ ...r }))),
  ),
  taskPriorities: z.preprocess(
    (raw) => coerceTaskPriorityRows(raw),
    z
      .array(taskPriorityDefinitionSchema)
      .min(1)
      .max(24)
      .default(() => DEFAULT_DASHBOARD_SETTINGS.taskPriorities.map((r) => ({ ...r }))),
  ),
  noteTypes: z
    .array(z.string().min(1).max(64))
    .min(1)
    .max(40)
    .default(() => [...DEFAULT_DASHBOARD_SETTINGS.noteTypes]),
  taskStatuses: z
    .array(taskStatusDefinitionSchema)
    .min(1)
    .max(40)
    .default(() => DEFAULT_DASHBOARD_SETTINGS.taskStatuses.map((r) => ({ ...r }))),
  noteStatuses: z.preprocess(
    (raw) => ensureTodoNoteStatusInRows(raw),
    z
      .array(taskStatusDefinitionSchema)
      .min(1)
      .max(40)
      .default(() => DEFAULT_DASHBOARD_SETTINGS.noteStatuses.map((r) => ({ ...r }))),
  ),
});

const settingsFromStore = z.preprocess(
  (data) => (data === undefined || data === null ? {} : data),
  dashboardSettingsSchema,
);

export const storeSchema = z.object({
  settings: settingsFromStore,
  owners: z.array(ownerSchema),
  projects: z.preprocess(
    (v) => (v === null || v === undefined ? [] : v),
    z.array(projectSchema).default([]),
  ),
  taskGroups: z.array(taskGroupSchema),
  tasks: z.array(taskSchema),
  ownerEntries: z.array(ownerEntrySchema),
  auditLog: z.array(auditEventSchema).max(5000).default([]),
});

export type Owner = z.infer<typeof ownerSchema>;
export type Project = z.infer<typeof projectSchema>;
export type TaskGroup = z.infer<typeof taskGroupSchema>;
export type TaskSubtask = z.infer<typeof taskSubtaskSchema>;
export type Task = z.infer<typeof taskSchema>;
export type OwnerEntry = z.infer<typeof ownerEntrySchema>;
export type DashboardSettings = z.infer<typeof dashboardSettingsSchema>;
export type TaskStatusRow = z.infer<typeof taskStatusDefinitionSchema>;
export type Store = z.infer<typeof storeSchema>;

export const emptyStore = (): Store => ({
  settings: dashboardSettingsSchema.parse({}),
  owners: [],
  projects: [],
  taskGroups: [],
  tasks: [],
  ownerEntries: [],
  auditLog: [],
});
