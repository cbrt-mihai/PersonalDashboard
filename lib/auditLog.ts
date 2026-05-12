import { randomUUID } from "node:crypto";
import { auditEventSchema, type AuditEntity, type Store } from "@/lib/schemas";

const AUDIT_MAX = 2500;
const AUDIT_DETAIL_MAX = 4000;
const AUDIT_SUMMARY_MAX = 500;

type AppendAuditInput = {
  action: "create" | "update" | "delete";
  entity: AuditEntity;
  /** `null` for whole-store actions such as settings. */
  entityId: string | null;
  summary: string;
  detail?: string;
};

function clampWithEllipsis(s: string, max: number): string {
  if (s.length <= max) return s;
  if (max <= 1) return "…".slice(0, max);
  return `${s.slice(0, max - 1)}…`;
}

function summarizeString(value: string, key?: string): string {
  const v = value;
  if (!v) return v;
  if (key === "iconDataUrl" || v.startsWith("data:image/")) {
    const prefix = v.slice(0, Math.min(48, v.length));
    return `${prefix}${v.length > prefix.length ? "…" : ""} (len=${v.length})`;
  }
  const max = key === "body" || key === "description" ? 320 : 240;
  if (v.length <= max) return v;
  return `${v.slice(0, max - 1)}… (len=${v.length})`;
}

function auditJsonReplacer(key: string, value: unknown) {
  if (typeof value === "string") return summarizeString(value, key);
  if (Array.isArray(value) && value.length > 60) {
    return {
      _type: "array",
      length: value.length,
      sample: value.slice(0, 60),
    };
  }
  return value;
}

export function formatAuditDetail(detail: unknown): string {
  try {
    const pretty = JSON.stringify(detail, auditJsonReplacer, 2) ?? "";
    if (pretty.length <= AUDIT_DETAIL_MAX) return pretty;
    const compact = JSON.stringify(detail, auditJsonReplacer) ?? "";
    if (compact.length <= AUDIT_DETAIL_MAX) return compact;
    return clampWithEllipsis(compact, AUDIT_DETAIL_MAX);
  } catch {
    return clampWithEllipsis(String(detail), AUDIT_DETAIL_MAX);
  }
}

function isPlainObject(x: unknown): x is Record<string, unknown> {
  return Boolean(x) && typeof x === "object" && !Array.isArray(x);
}

function deepEqual(a: unknown, b: unknown, depth = 0): boolean {
  if (a === b) return true;
  if (depth > 6) return false;
  if (a === null || b === null) return a === b;
  const ta = typeof a;
  const tb = typeof b;
  if (ta !== tb) return false;
  if (ta !== "object") return a === b;

  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b)) return false;
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (!deepEqual(a[i], b[i], depth + 1)) return false;
    }
    return true;
  }

  if (!isPlainObject(a) || !isPlainObject(b)) return false;
  const ak = Object.keys(a).sort();
  const bk = Object.keys(b).sort();
  if (ak.length !== bk.length) return false;
  for (let i = 0; i < ak.length; i++) {
    if (ak[i] !== bk[i]) return false;
  }
  for (const k of ak) {
    if (!deepEqual(a[k], b[k], depth + 1)) return false;
  }
  return true;
}

export type AuditChangeSet = Record<string, { from: unknown; to: unknown }>;

export function buildAuditChanges(
  before: unknown,
  after: unknown,
  keys: readonly string[],
): AuditChangeSet {
  const b = isPlainObject(before) ? before : {};
  const a = isPlainObject(after) ? after : {};
  const out: AuditChangeSet = {};
  for (const key of keys) {
    if (!(key in b) && !(key in a)) continue;
    const from = b[key];
    const to = a[key];
    if (deepEqual(from, to)) continue;
    out[key] = { from, to };
  }
  return out;
}

export function auditDetailForUpdate(
  before: unknown,
  after: unknown,
  keys: readonly string[],
): string | undefined {
  const changes = buildAuditChanges(before, after, keys);
  if (Object.keys(changes).length === 0) return "No changes.";
  return formatAuditDetail({ changes });
}

export function auditDetailForCreate(
  created: unknown,
  keys: readonly string[],
): string {
  const c = isPlainObject(created) ? created : {};
  const picked: Record<string, unknown> = {};
  for (const k of keys) {
    if (k in c) picked[k] = c[k];
  }
  return formatAuditDetail({ created: picked });
}

export function auditDetailForDelete(
  deleted: unknown,
  keys: readonly string[],
): string {
  const d = isPlainObject(deleted) ? deleted : {};
  const picked: Record<string, unknown> = {};
  for (const k of keys) {
    if (k in d) picked[k] = d[k];
  }
  return formatAuditDetail({ deleted: picked });
}

/** Append one audit row and cap list size (oldest dropped). Call inside `mutateStore`. */
export function appendAudit(store: Store, input: AppendAuditInput) {
  const entry = auditEventSchema.parse({
    id: randomUUID(),
    at: new Date().toISOString(),
    action: input.action,
    entity: input.entity,
    entityId: input.entityId,
    summary: clampWithEllipsis(input.summary, AUDIT_SUMMARY_MAX),
    ...(input.detail !== undefined
      ? { detail: clampWithEllipsis(input.detail, AUDIT_DETAIL_MAX) }
      : {}),
  });
  store.auditLog.push(entry);
  if (store.auditLog.length > AUDIT_MAX) {
    store.auditLog = store.auditLog.slice(-AUDIT_MAX);
  }
}
