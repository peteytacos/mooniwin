"use client";

import { useFrame } from "@react-three/fiber";
import { Stars, AdaptiveDpr } from "@react-three/drei";
import { EffectComposer, Bloom, Vignette } from "@react-three/postprocessing";
import { useRef } from "react";
import { timeline, PHASES } from "./timeline";

interface SceneContentProps {
  onNavReady: () => void;
}

export default function SceneContent({ onNavReady }: SceneContentProps) {
  const navFired = useRef(false);

  useFrame((_, delta) => {
    if (!timeline.playing) return;
    timeline.elapsed += delta;

    // Signal nav ready
    if (!navFired.current && timeline.elapsed >= PHASES.NAV_START) {
      navFired.current = true;
      onNavReady();
    }

    // Stop advancing after animation completes
    if (timeline.elapsed >= PHASES.DONE) {
      timeline.playing = false;
    }
  });

  return (
    <>
      <ambientLight intensity={0.02} />
      <directionalLight position={[5, 3, 5]} intensity={0.6} color="#e8e4df" />
      <Stars
        radius={120}
        depth={60}
        count={5000}
        factor={4}
        fade
        speed={0.3}
      />
      <AdaptiveDpr pixelated />
      <EffectComposer>
        <Bloom
          intensity={0.8}
          luminanceThreshold={0.5}
          luminanceSmoothing={0.9}
          mipmapBlur
        />
        <Vignette eskil={false} offset={0.2} darkness={0.7} />
      </EffectComposer>
    </>
  );
}
