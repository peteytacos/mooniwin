import { kv } from "@vercel/kv";
import { NextResponse } from "next/server";

export async function POST() {
  try {
    await kv.incr("visits:total");
  } catch {
    // non-critical — never fail the page load
  }
  return new NextResponse(null, { status: 204 });
}
