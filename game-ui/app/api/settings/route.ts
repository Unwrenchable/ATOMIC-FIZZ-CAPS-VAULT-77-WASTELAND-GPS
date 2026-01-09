import { NextResponse } from "next/server";
import { loadData } from "@/lib/data";

export async function GET() {
  const settings = await loadData("settings");
  return NextResponse.json(settings);
}

