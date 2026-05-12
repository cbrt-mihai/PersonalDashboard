import { readStore } from "@/lib/jsonStore";

const MAX = 52;

function trunc(s: string): string {
  const t = s.trim();
  if (t.length <= MAX) return t;
  return `${t.slice(0, MAX - 1)}…`;
}

export function metadataTitleForTask(id: string): string {
  const t = readStore().tasks.find((x) => x.id === id);
  return t?.name ? trunc(t.name) : "Task";
}

export function metadataTitleForOwner(id: string): string {
  const p = readStore().owners.find((x) => x.id === id);
  return p?.name ? trunc(p.name) : "Owner";
}

export function metadataTitleForProject(id: string): string {
  const p = readStore().projects.find((x) => x.id === id);
  return p?.name ? trunc(p.name) : "Project";
}

export function metadataTitleForOwnerEntry(id: string): string {
  const e = readStore().ownerEntries.find((x) => x.id === id);
  return e?.title ? trunc(e.title) : "Note";
}

export function metadataTitleForEpic(id: string): string {
  const g = readStore().taskGroups.find((x) => x.id === id);
  return g?.name ? trunc(g.name) : "Epic";
}
