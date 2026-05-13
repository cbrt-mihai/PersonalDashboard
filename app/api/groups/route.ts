import { NextResponse } from "next/server";
import { readStore } from "@/lib/jsonStore";
import {
  parseListPagination,
  sliceToPage,
  wantsPaginatedList,
} from "@/lib/apiPagination";

/** List all task groups (for home filters / epic view). */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const list = readStore().taskGroups;
  if (wantsPaginatedList(searchParams)) {
    const { page, pageSize } = parseListPagination(searchParams);
    return NextResponse.json(sliceToPage(list, page, pageSize));
  }
  return NextResponse.json(list);
}
