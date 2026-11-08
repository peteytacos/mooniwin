"use client";

import dynamic from "next/dynamic";

const StoryExperience = dynamic(() => import("@/components/story/StoryExperience"), {
  ssr: false,
});

export default function Home() {
  return (
    <main className="bg-[#05070f]">
      <StoryExperience />
    </main>
  );
}
