"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { AdaptiveDpr } from "@react-three/drei";
import { EffectComposer, Bloom, Vignette } from "@react-three/postprocessing";
import { useRef } from "react";
import * as THREE from "three";
import { timeline, PHASES } from "./timeline";
import UnifiedParticles from "./UnifiedParticles";

function CameraController() {
  const { camera, size, mouse } = useThree();

  useFrame(() => {
    const aspect = size.width / size.height;
    const baseFov = 50;
    const fov = aspect < 1 ? baseFov + (1 - aspect) * 20 : baseFov;
    (camera as THREE.PerspectiveCamera).fov = fov;
    (camera as THREE.PerspectiveCamera).updateProjectionMatrix();

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

    if (!navFired.current && timeline.elapsed >= PHASES.NAV_START) {
      navFired.current = true;
      onNavReady();
    }

    if (timeline.elapsed >= PHASES.DONE) {
      timeline.playing = false;
    }
  });

  return (
    <>
      <CameraController />
      <UnifiedParticles />
      <AdaptiveDpr pixelated />
      <EffectComposer>
        <Bloom
          intensity={0.6}
          luminanceThreshold={0.3}
          luminanceSmoothing={0.9}
          mipmapBlur
        />
        <Vignette eskil={false} offset={0.3} darkness={0.5} />
      </EffectComposer>
    </>
  );
}
