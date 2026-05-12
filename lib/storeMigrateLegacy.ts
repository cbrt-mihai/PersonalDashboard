/**
 * Normalizes legacy `store.json` keys (`partners`, `partnerId`, …) to the current
 * owner-based shape before Zod parsing. Safe to run on already-migrated data.
 */
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

  return o;
}
