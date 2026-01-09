import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    ok: true,
    status: "Backend operational",
    timestamp: Date.now()
  });
}
