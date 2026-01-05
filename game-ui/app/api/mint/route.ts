import { NextResponse } from "next/server";
import { mintItem } from "@/lib/mint";

export async function POST() {
  try {
    const itemId = await mintItem();
    return NextResponse.json({ ok: true, itemId });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
