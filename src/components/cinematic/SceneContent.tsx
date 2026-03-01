"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { Stars, AdaptiveDpr } from "@react-three/drei";
import { EffectComposer, Bloom, Vignette } from "@react-three/postprocessing";
import { useRef } from "react";
import * as THREE from "three";
import { timeline, PHASES } from "./timeline";
import ParticleFigures from "./ParticleFigures";
import RisingMoon from "./RisingMoon";
import ParticleText from "./ParticleText";

function CameraController() {
  const { camera, size, mouse } = useThree();

  useFrame(() => {
    // Responsive FOV
    const aspect = size.width / size.height;
    const baseFov = 50;
    const fov = aspect < 1 ? baseFov + (1 - aspect) * 20 : baseFov; // wider FOV on portrait
    (camera as THREE.PerspectiveCamera).fov = fov;
    (camera as THREE.PerspectiveCamera).updateProjectionMatrix();

    // Mouse parallax (subtle, only in rest state)
    if (timeline.elapsed > PHASES.DONE) {
      camera.position.x = THREE.MathUtils.lerp(camera.position.x, mouse.x * 0.3, 0.02);
      camera.position.y = THREE.MathUtils.lerp(camera.position.y, mouse.y * 0.15, 0.02);
    }
  });

  return null;
}

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
      <CameraController />
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
      <ParticleFigures />
      <RisingMoon />
      <ParticleText />
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
