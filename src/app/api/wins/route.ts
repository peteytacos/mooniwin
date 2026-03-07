import { put } from "@vercel/blob";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const formData = await request.formData();
  const image = formData.get("image") as File | null;

  if (!image) {
    return NextResponse.json({ error: "No image provided" }, { status: 400 });
  }

  const id = crypto.randomUUID().slice(0, 8);
  const { url } = await put(`wins/${id}.jpg`, image, {
    access: "public",
    contentType: "image/jpeg",
  });

  return NextResponse.json({ id, imageUrl: url });
}
