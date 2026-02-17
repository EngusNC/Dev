import { NextRequest, NextResponse } from "next/server";
import { getCategories } from "@/lib/notion";

export async function GET(req: NextRequest) {
  const dbId = req.nextUrl.searchParams.get("db");
  if (!dbId) return NextResponse.json({ error: "Missing db parameter" }, { status: 400 });

  try {
    const categories = await getCategories(dbId);
    return NextResponse.json(categories);
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Notion API error" }, { status: 500 });
  }
}
