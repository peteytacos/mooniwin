// src/components/cinematic/RisingMoon.tsx
"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { timeline, PHASES, progress, easeInOut } from "./timeline";

const MOON_START_Y = -5;
const MOON_END_Y = 2;
const MOON_X = 0;
const MOON_Z = -8; // behind figures

export default function RisingMoon() {
  const meshRef = useRef<THREE.Mesh>(null);
  const glowRef = useRef<THREE.Mesh>(null);

  useFrame(() => {
    const t = timeline.elapsed;
    const riseProgress = easeInOut(progress(t, PHASES.MOON_START, PHASES.MOON_END));
    const y = MOON_START_Y + (MOON_END_Y - MOON_START_Y) * riseProgress;

    // Subtle continued drift after rising
    const drift = t > PHASES.MOON_END ? (t - PHASES.MOON_END) * 0.02 : 0;

    if (meshRef.current) {
      meshRef.current.position.set(MOON_X, y + drift, MOON_Z);
      meshRef.current.rotation.y += 0.0005;
    }
    if (glowRef.current) {
      glowRef.current.position.set(MOON_X, y + drift, MOON_Z);
    }
  });

  return (
    <>
      {/* Moon sphere */}
      <mesh ref={meshRef}>
        <sphereGeometry args={[1.5, 64, 64]} />
        <meshStandardMaterial
          color="#e8e4df"
          emissive="#e8e4df"
          emissiveIntensity={0.3}
          roughness={0.9}
          metalness={0.05}
        />
      </mesh>
      {/* Glow halo */}
      <mesh ref={glowRef}>
        <sphereGeometry args={[1.8, 32, 32]} />
        <meshBasicMaterial
          color="#d0d8e8"
          transparent
          opacity={0.06}
          side={THREE.BackSide}
        />
      </mesh>
    </>
  );
}
