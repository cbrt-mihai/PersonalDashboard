export function isArchived(x: { archivedAt?: string | null } | null | undefined): boolean {
  return Boolean(x?.archivedAt);
}

export function archiveNowIso(): string {
  return new Date().toISOString();
}

export function matchesQuery(haystack: string, q: string): boolean {
  const ql = q.trim().toLowerCase();
  if (!ql) return false;
  return haystack.toLowerCase().includes(ql);
}

