export const TASK_FORM_TYPES = ["Task", "Spike", "Bug"] as const;
export const TASK_FORM_PRIORITIES = ["Trivial", "Low", "Medium", "High", "Critical", "Blocker"] as const;

/** Match stored type to a configured label (e.g. `task` → `Task`). Unknown values are left as-is. */
export function canonicalTaskTypeLabel(
  value: string,
  known: readonly string[] = TASK_FORM_TYPES,
): string {
  const v = value.trim();
  if (!v) return value;
  const hit = known.find((t) => t.toLowerCase() === v.toLowerCase());
  return hit ?? v;
}

/** Match stored priority to configured label casing (e.g. `low` → `Low`). */
export function canonicalPriorityLabel(
  value: string,
  known: readonly string[],
): string {
  const v = value.trim();
  if (!v) return value;
  const hit = known.find((p) => p.toLowerCase() === v.toLowerCase());
  return hit ?? v;
}

/** Priority labels from dashboard settings, or built-in defaults when empty. */
export function taskPriorityKnownLabels(
  taskPriorities: readonly { label: string }[] | undefined,
): readonly string[] {
  return taskPriorities?.length ? taskPriorities.map((r) => r.label) : [...TASK_FORM_PRIORITIES];
}

export function normalizePriorityKey(value: string): string {
  return value.trim().toLowerCase();
}

/** Map normalized priority label → its configured order index. */
export function buildPriorityRankMap(known: readonly string[]): Map<string, number> {
  const map = new Map<string, number>();
  for (let i = 0; i < known.length; i++) {
    const k = normalizePriorityKey(known[i] ?? "");
    if (!k) continue;
    map.set(k, i);
  }
  return map;
}
