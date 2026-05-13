/**
 * Normalizes legacy `store.json` keys (`partners`, `partnerId`, …) to the current
 * owner-based shape before Zod parsing. Safe to run on already-migrated data.
 */
import {
  allocateEntityKey,
  allocateNoteEntryKey,
  type DefaultEntityKeyTag,
  isValidEntityKey,
} from "./entityKey";

function collectUsedKeys(items: unknown[] | undefined, used: Set<string>) {
  if (!Array.isArray(items)) return;
  for (const item of items) {
    if (!item || typeof item !== "object") continue;
    const k = (item as Record<string, unknown>).key;
    if (typeof k === "string" && isValidEntityKey(k)) used.add(k);
  }
}

function assignMissingKeys(items: unknown[] | undefined, prefix: DefaultEntityKeyTag, used: Set<string>) {
  if (!Array.isArray(items)) return;
  for (const item of items) {
    if (!item || typeof item !== "object") continue;
    const r = item as Record<string, unknown>;
    const k = r.key;
    if (typeof k === "string" && isValidEntityKey(k)) continue;
    r.key = allocateEntityKey(prefix, used);
  }
}

function assignMissingEntryKeys(
  entries: unknown[] | undefined,
  owners: unknown[] | undefined,
  projects: unknown[] | undefined,
  used: Set<string>,
) {
  if (!Array.isArray(entries)) return;
  const ownerKey = new Map<string, string>();
  for (const raw of owners ?? []) {
    if (!raw || typeof raw !== "object") continue;
    const r = raw as Record<string, unknown>;
    const id = typeof r.id === "string" ? r.id : "";
    const k = typeof r.key === "string" ? r.key : "";
    if (id && isValidEntityKey(k)) ownerKey.set(id, k);
  }
  const projectKey = new Map<string, string>();
  for (const raw of projects ?? []) {
    if (!raw || typeof raw !== "object") continue;
    const r = raw as Record<string, unknown>;
    const id = typeof r.id === "string" ? r.id : "";
    const k = typeof r.key === "string" ? r.key : "";
    if (id && isValidEntityKey(k)) projectKey.set(id, k);
  }
  for (const item of entries) {
    if (!item || typeof item !== "object") continue;
    const r = item as Record<string, unknown>;
    const k = r.key;
    if (typeof k === "string" && isValidEntityKey(k)) continue;
    const ownerId = typeof r.ownerId === "string" ? r.ownerId : null;
    const projectId = typeof r.projectId === "string" ? r.projectId : null;
    let parent: string | undefined;
    if (ownerId) parent = ownerKey.get(ownerId);
    if (!parent && projectId) parent = projectKey.get(projectId);
    if (parent) r.key = allocateNoteEntryKey(parent, used);
    else r.key = allocateEntityKey("NTE", used);
  }
}

export function migrateLegacyStoreJson(raw: unknown): unknown {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return raw;
  const o = { ...(raw as Record<string, unknown>) };

  if ("partners" in o && !("owners" in o)) {
    o.owners = o.partners;
    delete o.partners;
  }

  if ("partnerEntries" in o && !("ownerEntries" in o)) {
    o.ownerEntries = o.partnerEntries;
    delete o.partnerEntries;
  }

  if (o.settings && typeof o.settings === "object" && !Array.isArray(o.settings)) {
    const s = { ...(o.settings as Record<string, unknown>) };
    if ("partnerColorPresets" in s && !("ownerColorPresets" in s)) {
      s.ownerColorPresets = s.partnerColorPresets;
      delete s.partnerColorPresets;
    }
    if (typeof s.worklogMinutesPerDay !== "number" || !Number.isFinite(s.worklogMinutesPerDay)) {
      s.worklogMinutesPerDay = 1440;
    }
    o.settings = s;
  }

  const mapTaskLike = (x: unknown) => {
    if (!x || typeof x !== "object" || Array.isArray(x)) return x;
    const t = { ...(x as Record<string, unknown>) };
    if ("partnerId" in t && !("ownerId" in t)) {
      t.ownerId = t.partnerId;
      delete t.partnerId;
    }
    return t;
  };

  if (Array.isArray(o.tasks)) o.tasks = o.tasks.map(mapTaskLike);
  if (Array.isArray(o.taskGroups)) o.taskGroups = o.taskGroups.map(mapTaskLike);

  if (Array.isArray(o.ownerEntries)) {
    o.ownerEntries = o.ownerEntries.map((e) => {
      if (!e || typeof e !== "object") return e;
      const x = { ...(e as Record<string, unknown>) };
      if ("partnerId" in x && !("ownerId" in x)) {
        x.ownerId = x.partnerId;
        delete x.partnerId;
      }
      return x;
    });
  }

  if (Array.isArray(o.auditLog)) {
    o.auditLog = o.auditLog.map((ev) => {
      if (!ev || typeof ev !== "object") return ev;
      const x = { ...(ev as Record<string, unknown>) };
      if (x.entity === "partner") x.entity = "owner";
      if (x.entity === "partner_entry") x.entity = "owner_entry";
      return x;
    });
  }

  if (!Array.isArray(o.worklogs)) {
    o.worklogs = [];
  }

  const used = new Set<string>();
  collectUsedKeys(o.owners as unknown[] | undefined, used);
  collectUsedKeys(o.projects as unknown[] | undefined, used);
  collectUsedKeys(o.taskGroups as unknown[] | undefined, used);
  collectUsedKeys(o.tasks as unknown[] | undefined, used);
  collectUsedKeys(o.ownerEntries as unknown[] | undefined, used);
  collectUsedKeys(o.worklogs as unknown[] | undefined, used);
  assignMissingKeys(o.owners as unknown[] | undefined, "OWN", used);
  assignMissingKeys(o.projects as unknown[] | undefined, "PRJ", used);
  assignMissingKeys(o.taskGroups as unknown[] | undefined, "EPC", used);
  assignMissingKeys(o.tasks as unknown[] | undefined, "TSK", used);
  assignMissingEntryKeys(
    o.ownerEntries as unknown[] | undefined,
    o.owners as unknown[] | undefined,
    o.projects as unknown[] | undefined,
    used,
  );
  assignMissingKeys(o.worklogs as unknown[] | undefined, "WLG", used);

  return o;
}
