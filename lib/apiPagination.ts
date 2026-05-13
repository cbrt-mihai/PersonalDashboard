/** Default page size when `page` is sent without `pageSize`. */
export const API_PAGE_SIZE_DEFAULT = 50;
export const API_PAGE_SIZE_MAX = 200;

export type PaginatedListJson<T> = {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
};

/** True when client requested a paged response (`page`, `pageSize`, or `limit`). */
export function wantsPaginatedList(searchParams: URLSearchParams): boolean {
  return (
    searchParams.has("page") ||
    searchParams.has("pageSize") ||
    searchParams.has("limit")
  );
}

export function parseListPagination(searchParams: URLSearchParams): {
  page: number;
  pageSize: number;
} {
  const rawPage = searchParams.get("page");
  const rawSize = searchParams.get("pageSize") ?? searchParams.get("limit");
  const page = Math.max(1, Math.floor(Number.parseInt(rawPage ?? "1", 10)) || 1);
  let pageSize =
    Math.floor(Number.parseInt(rawSize ?? String(API_PAGE_SIZE_DEFAULT), 10)) ||
    API_PAGE_SIZE_DEFAULT;
  pageSize = Math.min(API_PAGE_SIZE_MAX, Math.max(1, pageSize));
  return { page, pageSize };
}

export function sliceToPage<T>(
  sorted: T[],
  page: number,
  pageSize: number,
): PaginatedListJson<T> {
  const total = sorted.length;
  const start = (page - 1) * pageSize;
  const items = sorted.slice(start, start + pageSize);
  return { items, total, page, pageSize };
}
