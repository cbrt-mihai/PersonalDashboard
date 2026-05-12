import { NextResponse } from "next/server";
import { storeSchema } from "@/lib/schemas";
import { readStore, writeStore } from "@/lib/jsonStore";

export async function GET() {
  const store = readStore();
  const date = new Date().toISOString().slice(0, 10);
  const filename = `personal-dashboard-store-${date}.json`;
  const payload = `${JSON.stringify(store, null, 2)}\n`;
  return new Response(payload, {
    status: 200,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "content-disposition": `attachment; filename="${filename}"`,
      "cache-control": "no-store",
    },
  });
}

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = storeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid store file", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    writeStore(parsed.data);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Could not write store";
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

