// game-ui/app/api/proxy/loot-voucher/route.ts
const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL!; // e.g. http://localhost:3001

export async function POST(req: Request) {
  const body = await req.json();

  const res = await fetch(`${BACKEND_URL}/api/loot-voucher`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const text = await res.text();
  let json: any;
  try {
    json = JSON.parse(text);
  } catch {
    return new Response(text, { status: res.status });
  }

  return Response.json(json, { status: res.status });
}
