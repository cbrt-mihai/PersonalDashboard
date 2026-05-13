import { NextResponse } from "next/server";
import { searchDashboardStore } from "@/lib/dashboardSearch";
import { readStore } from "@/lib/jsonStore";

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams.get("q") ?? "";
  const trimmed = q.trim();
  if (trimmed.length > 120) {
    return NextResponse.json({ error: "Query too long" }, { status: 400 });
  }
  const store = readStore();
  const results = searchDashboardStore(store, trimmed, { limit: 40 });
  return NextResponse.json({ query: trimmed, results });
}
