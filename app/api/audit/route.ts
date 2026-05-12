import { NextResponse } from "next/server";
import { readStore } from "@/lib/jsonStore";

const PAGE_SIZE = 100;

/** Newest-first audit trail (stored in `data/store.json`). Paginated with `page` (1-based, 100 per page). */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const log = readStore().auditLog;
  const sorted = [...log].sort((a, b) => b.at.localeCompare(a.at));
  const total = sorted.length;

  const pageRaw = searchParams.get("page");
  if (pageRaw != null) {
    let page = Number.parseInt(pageRaw, 10);
    if (!Number.isFinite(page) || page < 1) page = 1;
    const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
    page = Math.min(page, pageCount);
    const start = (page - 1) * PAGE_SIZE;
    const entries = sorted.slice(start, start + PAGE_SIZE);
    return NextResponse.json({
      entries,
      total,
      page,
      pageSize: PAGE_SIZE,
    });
  }

  /** Legacy: `?limit=` without `page` (newest first, capped). */
  const raw = searchParams.get("limit");
  const n = raw ? Number.parseInt(raw, 10) : 200;
  const limit = Number.isFinite(n) ? Math.min(500, Math.max(1, n)) : 200;
  return NextResponse.json(sorted.slice(0, limit));
}
