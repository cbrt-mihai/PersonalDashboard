import { NextResponse } from "next/server";
import { readStore } from "@/lib/jsonStore";

type Ctx = { params: Promise<{ id: string }> };

/** List epics for one project. */
export async function GET(_req: Request, ctx: Ctx) {
  const { id: projectId } = await ctx.params;
  const store = readStore();
  if (!store.projects.some((p) => p.id === projectId)) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }
  return NextResponse.json(store.taskGroups.filter((g) => g.projectId === projectId));
}

