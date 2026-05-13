import { noteEntryViewHref } from "@/lib/noteEntryPaths";
import type { Store, Worklog } from "@/lib/schemas";

export type DashboardSearchHitKind =
  | "owner"
  | "project"
  | "epic"
  | "task"
  | "note"
  | "worklog";

export type DashboardSearchHit = {
  kind: DashboardSearchHitKind;
  id: string;
  key: string;
  title: string;
  subtitle: string;
  href: string;
  score: number;
};

function norm(s: string): string {
  return s.trim().toLowerCase();
}

function rank(q: string, title: string, key: string, haystack: string[]): number {
  const ql = norm(q);
  if (!ql) return 50;
  const tl = norm(title);
  const kl = norm(key);
  const extras = haystack.map(norm).filter(Boolean);
  if (kl === ql) return 0;
  if (tl === ql) return 1;
  if (kl.startsWith(ql)) return 2;
  if (tl.startsWith(ql)) return 3;
  if (extras.some((x) => x.includes(ql))) return 4;
  if (tl.includes(ql)) return 5;
  if (kl.includes(ql)) return 6;
  return 100;
}

function worklogHref(store: Store, w: Worklog): string {
  const t = w.target;
  switch (t.kind) {
    case "task":
      return `/tasks/${t.taskId}`;
    case "epic":
      return `/epics/${t.groupId}`;
    case "project":
      return `/projects/${t.projectId}`;
    case "owner":
      return `/owners/${t.ownerId}`;
    case "note": {
      const e = store.ownerEntries.find((x) => x.id === t.entryId);
      return e ? noteEntryViewHref(e) : `/notes/${t.entryId}`;
    }
    default: {
      const _x: never = t;
      void _x;
      return "/worklogs";
    }
  }
}

function worklogSubtitle(store: Store, w: Worklog): string {
  const t = w.target;
  switch (t.kind) {
    case "task":
      return store.tasks.find((x) => x.id === t.taskId)?.name ?? w.targetEntryName ?? "Task";
    case "epic":
      return store.taskGroups.find((x) => x.id === t.groupId)?.name ?? w.targetEntryName ?? "Epic";
    case "project":
      return store.projects.find((x) => x.id === t.projectId)?.name ?? w.targetEntryName ?? "Project";
    case "owner":
      return store.owners.find((x) => x.id === t.ownerId)?.name ?? w.targetEntryName ?? "Owner";
    case "note":
      return store.ownerEntries.find((x) => x.id === t.entryId)?.title ?? w.targetEntryName ?? "Note";
    default: {
      const _x: never = t;
      void _x;
      return "";
    }
  }
}

/**
 * Lightweight substring search across primary entities (local JSON store).
 */
export function searchDashboardStore(
  store: Store,
  query: string,
  opts?: { limit?: number },
): DashboardSearchHit[] {
  const limit = opts?.limit ?? 40;
  const q = query.trim();
  if (q.length < 1) return [];

  const hits: DashboardSearchHit[] = [];

  for (const o of store.owners) {
    const sc = rank(q, o.name, o.key, [o.name]);
    if (sc < 100) {
      hits.push({
        kind: "owner",
        id: o.id,
        key: o.key,
        title: o.name,
        subtitle: `Owner · ${o.key}`,
        href: `/owners/${o.id}`,
        score: sc,
      });
    }
  }

  for (const p of store.projects) {
    const sc = rank(q, p.name, p.key, [p.name, p.description?.slice(0, 200) ?? ""]);
    if (sc < 100) {
      hits.push({
        kind: "project",
        id: p.id,
        key: p.key,
        title: p.name,
        subtitle: `Project · ${p.key}`,
        href: `/projects/${p.id}`,
        score: sc + 0.1,
      });
    }
  }

  for (const g of store.taskGroups) {
    const sc = rank(q, g.name, g.key, [g.name]);
    if (sc < 100) {
      hits.push({
        kind: "epic",
        id: g.id,
        key: g.key,
        title: g.name,
        subtitle: `Epic · ${g.key}`,
        href: `/epics/${g.id}`,
        score: sc + 0.2,
      });
    }
  }

  for (const t of store.tasks) {
    const sc = rank(q, t.name, t.key, [t.name, t.description?.slice(0, 200) ?? ""]);
    if (sc < 100) {
      hits.push({
        kind: "task",
        id: t.id,
        key: t.key,
        title: t.name,
        subtitle: `Task · ${t.key}`,
        href: `/tasks/${t.id}`,
        score: sc + 0.3,
      });
    }
  }

  for (const e of store.ownerEntries) {
    const sc = rank(q, e.title, e.key, [e.title, e.body?.slice(0, 200) ?? ""]);
    if (sc < 100) {
      hits.push({
        kind: "note",
        id: e.id,
        key: e.key,
        title: e.title,
        subtitle: `Note · ${e.key}`,
        href: noteEntryViewHref(e),
        score: sc + 0.4,
      });
    }
  }

  for (const w of store.worklogs) {
    const sub = worklogSubtitle(store, w);
    const sc = rank(q, w.key, w.key, [w.comment, sub, w.startedAt]);
    if (sc < 100) {
      hits.push({
        kind: "worklog",
        id: w.id,
        key: w.key,
        title: w.comment.trim() ? w.comment.trim().slice(0, 80) : w.key,
        subtitle: `Worklog · ${sub} · ${w.startedAt.slice(0, 10)}`,
        href: worklogHref(store, w),
        score: sc + 0.5,
      });
    }
  }

  hits.sort((a, b) => a.score - b.score || a.title.localeCompare(b.title));
  return hits.slice(0, limit);
}
