import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    ok: true,
    player: {
      name: "Vault 77 Wanderer",
      level: 1,
      caps: 0,
      inventory: []
    }
  });
}
