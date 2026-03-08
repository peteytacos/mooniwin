import { kv } from "@vercel/kv";
import { NextResponse } from "next/server";

function todayUtc() {
  return new Date().toISOString().slice(0, 10);
}

export async function GET() {
  try {
    const [winsToday, totalWins, totalVisits] = await Promise.all([
      kv.get<number>(`wins:${todayUtc()}`),
      kv.get<number>("wins:total"),
      kv.get<number>("visits:total"),
    ]);

    return NextResponse.json(
      { winsToday: winsToday ?? 0, totalWins: totalWins ?? 0, totalVisits: totalVisits ?? 0 },
      { headers: { "Cache-Control": "s-maxage=30, stale-while-revalidate=60" } }
    );
  } catch {
    return NextResponse.json({ winsToday: 0, totalWins: 0, totalVisits: 0 });
  }
}
