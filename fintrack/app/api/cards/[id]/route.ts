import { NextRequest, NextResponse } from "next/server";
import { updateCard, deleteCard, moveCard } from "@/lib/notion";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await req.json();
    const { id } = params;

    // Move operation (just update the date)
    if (body.date && Object.keys(body).length === 1) {
      await moveCard(id, body.date);
    } else {
      await updateCard(id, body);
    }
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Notion API error" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await deleteCard(params.id);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Notion API error" }, { status: 500 });
  }
}
