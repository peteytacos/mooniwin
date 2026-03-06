"use client";

import dynamic from "next/dynamic";

const CinematicScene = dynamic(() => import("@/components/CinematicScene"), {
  ssr: false,
});

export default function Home() {
  return (
    <main className="bg-black">
      <CinematicScene />
    </main>
  );
}
