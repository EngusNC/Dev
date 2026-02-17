import { NextRequest, NextResponse } from "next/server";
import { getCards, createCard } from "@/lib/notion";

export async function GET(req: NextRequest) {
  const dbId = req.nextUrl.searchParams.get("db");
  const year = parseInt(req.nextUrl.searchParams.get("year") || String(new Date().getFullYear()));
  if (!dbId) return NextResponse.json({ error: "Missing db parameter" }, { status: 400 });

  try {
    const cards = await getCards(dbId, year);
    return NextResponse.json(cards);
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Notion API error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const dbId = req.nextUrl.searchParams.get("db");
  if (!dbId) return NextResponse.json({ error: "Missing db parameter" }, { status: 400 });

  try {
    const body = await req.json();
    const card = await createCard(dbId, body);
    return NextResponse.json(card, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Notion API error" }, { status: 500 });
  }
}
