import { Redis } from "@upstash/redis";
import { NextResponse } from "next/server";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

export async function POST() {
  try {
    await redis.incr("visits:total");
  } catch {
    // non-critical — never fail the page load
  }
  return new NextResponse(null, { status: 204 });
}
