import { NextResponse } from "next/server";
import { loadData } from "@/lib/data";

export async function GET() {
  const quests = await loadData("quests");
  return NextResponse.json(quests);
}
