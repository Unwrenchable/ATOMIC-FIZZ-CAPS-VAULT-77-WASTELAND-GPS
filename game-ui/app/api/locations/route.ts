import { NextResponse } from "next/server";
import { loadData } from "@/lib/data";

export async function GET() {
  const locations = await loadData("locations");
  return NextResponse.json(locations);
}
