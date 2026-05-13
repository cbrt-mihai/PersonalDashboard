"use client";

import { useEffect, useMemo, useState } from "react";
import { DASHBOARD_PAGE_SIZE, paginateLocal } from "@/components/DashboardPager";

export type DashboardLocalPager = {
  page: number;
  setPage: (p: number) => void;
  pageCount: number;
  total: number;
  pageSize: number;
  slice: <T>(items: T[]) => T[];
};

/**
 * Client-side paging over an already-filtered list. Resets to page 1 when `resetKey` changes
 * (use a serialized fingerprint of filters + sort, not a fresh object each render).
 */
export function useDashboardLocalPager(itemCount: number, resetKey: string): DashboardLocalPager {
  const [page, setPage] = useState(1);
  const pageSize = DASHBOARD_PAGE_SIZE;

  useEffect(() => {
    queueMicrotask(() => {
      setPage(1);
    });
  }, [resetKey]);

  const pageCount = Math.max(1, Math.ceil(itemCount / pageSize) || 1);
  const safePage = Math.min(Math.max(1, page), pageCount);

  const slice = useMemo(() => {
    return <T,>(items: T[]) => paginateLocal(items, safePage, pageSize);
  }, [safePage, pageSize]);

  return {
    page: safePage,
    setPage,
    pageCount,
    total: itemCount,
    pageSize,
    slice,
  };
}
