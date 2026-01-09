import { NextResponse } from "next/server";
import { loadData } from "@/lib/data";

export async function GET() {
  const scavenger = await loadData("scavenger");
  return NextResponse.json(scavenger);
}
