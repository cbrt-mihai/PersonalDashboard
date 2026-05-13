import { readStore } from "@/lib/jsonStore";

const MAX = 52;

function trunc(s: string): string {
  const t = s.trim();
  if (t.length <= MAX) return t;
  return `${t.slice(0, MAX - 1)}…`;
}

export function metadataTitleForTask(id: string, fallback = "Task"): string {
  const t = readStore().tasks.find((x) => x.id === id);
  return t?.name ? trunc(t.name) : fallback;
}

export function metadataTitleForOwner(id: string, fallback = "Owner"): string {
  const p = readStore().owners.find((x) => x.id === id);
  return p?.name ? trunc(p.name) : fallback;
}

export function metadataTitleForProject(id: string, fallback = "Project"): string {
  const p = readStore().projects.find((x) => x.id === id);
  return p?.name ? trunc(p.name) : fallback;
}

export function metadataTitleForOwnerEntry(id: string, fallback = "Note"): string {
  const e = readStore().ownerEntries.find((x) => x.id === id);
  return e?.title ? trunc(e.title) : fallback;
}

export function metadataTitleForEpic(id: string, fallback = "Epic"): string {
  const g = readStore().taskGroups.find((x) => x.id === id);
  return g?.name ? trunc(g.name) : fallback;
}
