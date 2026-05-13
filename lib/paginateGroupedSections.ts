export type LabeledSection<T> = { heading: string; rows: T[] };

/**
 * Slice grouped rows into a window of `pageSize` items while preserving section headings.
 * `page` is 1-based.
 */
export function paginateGroupedSections<T>(
  sections: LabeledSection<T>[],
  page: number,
  pageSize: number,
): { sections: LabeledSection<T>[]; total: number } {
  const total = sections.reduce((n, s) => n + s.rows.length, 0);
  const p = Math.max(1, Math.floor(page));
  const ps = Math.max(1, Math.floor(pageSize));
  const start = (p - 1) * ps;
  const end = Math.min(start + ps, total);
  if (start >= total || end <= start) {
    return { sections: [], total };
  }

  let global = 0;
  const out: LabeledSection<T>[] = [];
  for (const sec of sections) {
    const len = sec.rows.length;
    const gs = global;
    const sliceStart = Math.max(0, start - gs);
    const sliceEnd = Math.min(len, end - gs);
    if (sliceStart < sliceEnd) {
      out.push({
        heading: sec.heading,
        rows: sec.rows.slice(sliceStart, sliceEnd),
      });
    }
    global += len;
    if (global >= end) break;
  }
  return { sections: out, total };
}
