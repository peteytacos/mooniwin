import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "i challenge you to play moon, i win!";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          background: "#000",
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 24,
        }}
      >
        <div style={{ fontSize: 200 }}>🌕</div>
        <div
          style={{
            color: "#fff",
            fontSize: 48,
            fontWeight: 700,
            textAlign: "center",
          }}
        >
          i challenge you to play moon, i win!
        </div>
      </div>
    ),
    { ...size },
  );
}
