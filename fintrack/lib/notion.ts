import { Client } from "@notionhq/client";

const notion = new Client({ auth: process.env.NOTION_TOKEN });

export interface CardData {
  id: string;
  label: string;
  amount: number;
  type: "income" | "expense";
  category: string;
  date: string; // YYYY-MM-DD
  done: boolean;
}

export interface ParsedCard extends CardData {
  year: number;
  month: number; // 0-indexed
  day: number;
}

function parseNotionPage(page: any): ParsedCard | null {
  try {
    const props = page.properties;
    const dateStr = props["Date"]?.date?.start;
    if (!dateStr) return null;
    const [y, m, d] = dateStr.split("-").map(Number);

    return {
      id: page.id,
      label: props["Libellé"]?.title?.[0]?.plain_text || "",
      amount: props["Montant"]?.number || 0,
      type: props["Type"]?.select?.name === "Recette" ? "income" : "expense",
      category: props["Catégorie"]?.select?.name || "Autre",
      date: dateStr,
      done: props["Validé"]?.checkbox || false,
      year: y,
      month: m - 1,
      day: d,
    };
  } catch {
    return null;
  }
}

export async function getCards(dbId: string, year: number): Promise<ParsedCard[]> {
  const results: ParsedCard[] = [];
  let cursor: string | undefined = undefined;

  do {
    const response: any = await notion.databases.query({
      database_id: dbId,
      start_cursor: cursor,
      filter: {
        and: [
          { property: "Date", date: { on_or_after: `${year}-01-01` } },
          { property: "Date", date: { on_or_before: `${year}-12-31` } },
        ],
      },
      sorts: [{ property: "Date", direction: "ascending" }],
    });

    for (const page of response.results) {
      const card = parseNotionPage(page);
      if (card) results.push(card);
    }

    cursor = response.has_more ? response.next_cursor : undefined;
  } while (cursor);

  return results;
}

export async function createCard(
  dbId: string,
  data: { label: string; amount: number; type: "income" | "expense"; category: string; date: string; done?: boolean }
): Promise<ParsedCard | null> {
  const page = await notion.pages.create({
    parent: { database_id: dbId },
    properties: {
      "Libellé": { title: [{ text: { content: data.label } }] },
      "Montant": { number: data.amount },
      "Type": { select: { name: data.type === "income" ? "Recette" : "Dépense" } },
      "Catégorie": { select: { name: data.category } },
      "Date": { date: { start: data.date } },
      "Validé": { checkbox: data.done || false },
    },
  });
  return parseNotionPage(page);
}

export async function updateCard(
  pageId: string,
  data: Partial<{ label: string; amount: number; type: "income" | "expense"; category: string; date: string; done: boolean }>
): Promise<void> {
  const properties: any = {};
  if (data.label !== undefined) properties["Libellé"] = { title: [{ text: { content: data.label } }] };
  if (data.amount !== undefined) properties["Montant"] = { number: data.amount };
  if (data.type !== undefined) properties["Type"] = { select: { name: data.type === "income" ? "Recette" : "Dépense" } };
  if (data.category !== undefined) properties["Catégorie"] = { select: { name: data.category } };
  if (data.date !== undefined) properties["Date"] = { date: { start: data.date } };
  if (data.done !== undefined) properties["Validé"] = { checkbox: data.done };

  await notion.pages.update({ page_id: pageId, properties });
}

export async function deleteCard(pageId: string): Promise<void> {
  await notion.pages.update({ page_id: pageId, archived: true });
}

export async function moveCard(pageId: string, newDate: string): Promise<void> {
  await notion.pages.update({
    page_id: pageId,
    properties: { "Date": { date: { start: newDate } } },
  });
}

export async function getCategories(dbId: string): Promise<string[]> {
  const db = await notion.databases.retrieve({ database_id: dbId });
  const catProp = (db as any).properties["Catégorie"];
  if (catProp?.type === "select") {
    return catProp.select.options.map((o: any) => o.name);
  }
  return ["Autre"];
}

export async function getBalanceBefore(dbId: string, year: number): Promise<{ realized: number; projected: number }> {
  let realized = 0, projected = 0;
  let cursor: string | undefined = undefined;

  do {
    const response: any = await notion.databases.query({
      database_id: dbId,
      start_cursor: cursor,
      filter: {
        property: "Date",
        date: { before: `${year}-01-01` },
      },
    });

    for (const page of response.results) {
      const card = parseNotionPage(page);
      if (card) {
        const sign = card.type === "income" ? 1 : -1;
        projected += sign * card.amount;
        if (card.done) realized += sign * card.amount;
      }
    }

    cursor = response.has_more ? response.next_cursor : undefined;
  } while (cursor);

  return { realized, projected };
}

export async function getStartBalance(dbId: string): Promise<number> {
  const db = await notion.databases.retrieve({ database_id: dbId });
  const desc = (db as any).description;
  if (desc && desc.length > 0) {
    const text = desc.map((d: any) => d.plain_text).join("");
    const match = text.match(/solde[:\s]*(-?\d[\d\s]*[\d.,]*)/i);
    if (match) return parseFloat(match[1].replace(/\s/g, "").replace(",", "."));
  }
  return 0;
}
