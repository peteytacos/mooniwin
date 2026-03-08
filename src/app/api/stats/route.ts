import { Redis } from "@upstash/redis";
import { NextResponse } from "next/server";

const redis = new Redis({
  url: process.env.moon_KV_REST_API_URL!,
  token: process.env.moon_KV_REST_API_TOKEN!,
});

function todayUtc() {
  return new Date().toISOString().slice(0, 10);
}

export async function GET() {
  try {
    const [winsToday, totalWins, totalVisits] = await Promise.all([
      redis.get<number>(`wins:${todayUtc()}`),
      redis.get<number>("wins:total"),
      redis.get<number>("visits:total"),
    ]);

    return NextResponse.json(
      { winsToday: winsToday ?? 0, totalWins: totalWins ?? 0, totalVisits: totalVisits ?? 0 },
      { headers: { "Cache-Control": "s-maxage=30, stale-while-revalidate=60" } }
    );
  } catch {
    return NextResponse.json({ winsToday: 0, totalWins: 0, totalVisits: 0 });
  }
}
