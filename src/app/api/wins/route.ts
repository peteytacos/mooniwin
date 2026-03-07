import { put } from "@vercel/blob";
import { NextResponse } from "next/server";

const MAX_SIZE = 5 * 1024 * 1024; // 5MB
const JPEG_MAGIC = [0xff, 0xd8, 0xff];

const rateLimit = new Map<string, number[]>();
const RATE_WINDOW = 60_000; // 1 minute
const RATE_MAX = 2; // 2 uploads per minute per IP

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const timestamps = rateLimit.get(ip) ?? [];
  const recent = timestamps.filter((t) => now - t < RATE_WINDOW);
  if (recent.length >= RATE_MAX) return true;
  recent.push(now);
  rateLimit.set(ip, recent);
  return false;
}

export async function POST(request: Request) {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (isRateLimited(ip)) {
    return NextResponse.json({ error: "Too many uploads" }, { status: 429 });
  }

  const formData = await request.formData();
  const image = formData.get("image") as File | null;

  if (!image) {
    return NextResponse.json({ error: "No image provided" }, { status: 400 });
  }

  if (image.size > MAX_SIZE) {
    return NextResponse.json({ error: "File too large" }, { status: 413 });
  }

  const buffer = new Uint8Array(await image.arrayBuffer());
  if (
    buffer.length < 3 ||
    buffer[0] !== JPEG_MAGIC[0] ||
    buffer[1] !== JPEG_MAGIC[1] ||
    buffer[2] !== JPEG_MAGIC[2]
  ) {
    return NextResponse.json({ error: "Invalid image" }, { status: 400 });
  }

  const id = crypto.randomUUID().slice(0, 8);
  const { url } = await put(`wins/${id}.jpg`, Buffer.from(buffer), {
    access: "public",
    contentType: "image/jpeg",
  });

  return NextResponse.json({ id, imageUrl: url });
}
