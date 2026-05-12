import { NextResponse } from "next/server";
import { readStore } from "@/lib/jsonStore";

/** List all task groups (for home filters / epic view). */
export async function GET() {
  return NextResponse.json(readStore().taskGroups);
}
