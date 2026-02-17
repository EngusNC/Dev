import { NextRequest, NextResponse } from "next/server";
import { getBalanceBefore } from "@/lib/notion";

export async function GET(req: NextRequest) {
  const dbId = req.nextUrl.searchParams.get("db");
  const year = parseInt(req.nextUrl.searchParams.get("year") || String(new Date().getFullYear()));
  if (!dbId) return NextResponse.json({ error: "Missing db parameter" }, { status: 400 });

  try {
    const balance = await getBalanceBefore(dbId, year);
    return NextResponse.json(balance);
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Notion API error" }, { status: 500 });
  }
}
