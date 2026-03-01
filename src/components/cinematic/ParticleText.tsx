// src/components/cinematic/ParticleText.tsx
"use client";

import { useRef, useMemo, useState, useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { sampleTextPositions } from "./textSampler";
import { timeline, PHASES, progress, easeOut, easeInOut } from "./timeline";

const PARTICLE_COUNT = 300;
const SPEECH_SCALE = 1.2; // size of text near figure
const LOGO_SCALE = 3.5; // size of centered logo
const SPEECH_OFFSET = { x: 1.8, y: -0.5, z: 0 }; // near pointing figure
const LOGO_OFFSET = { x: 0, y: 0.5, z: 2 }; // center of screen, closer to camera

export default function ParticleText() {
  const pointsRef = useRef<THREE.Points>(null);
  const [ready, setReady] = useState(false);

  // Sample text positions (client-side only)
  const targets = useMemo(() => {
    if (typeof window === "undefined") {
      return {
        speechTargets: new Float32Array(PARTICLE_COUNT * 3),
        logoTargets: new Float32Array(PARTICLE_COUNT * 3),
        scatterPositions: new Float32Array(PARTICLE_COUNT * 3),
      };
    }

    const raw = sampleTextPositions("Moon, I win!", PARTICLE_COUNT, 48);

    // Scale and offset for speech position (small, near figure)
    const speech = new Float32Array(PARTICLE_COUNT * 3);
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      speech[i * 3] = raw[i * 3] * SPEECH_SCALE + SPEECH_OFFSET.x;
      speech[i * 3 + 1] = raw[i * 3 + 1] * SPEECH_SCALE + SPEECH_OFFSET.y;
      speech[i * 3 + 2] = SPEECH_OFFSET.z;
    }

    // Scale and offset for logo position (large, centered)
    const logo = new Float32Array(PARTICLE_COUNT * 3);
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      logo[i * 3] = raw[i * 3] * LOGO_SCALE + LOGO_OFFSET.x;
      logo[i * 3 + 1] = raw[i * 3 + 1] * LOGO_SCALE + LOGO_OFFSET.y;
      logo[i * 3 + 2] = LOGO_OFFSET.z;
    }

    // Random scatter near speech position
    const scatter = new Float32Array(PARTICLE_COUNT * 3);
    let seed = 99999;
    const rand = () => {
      seed = (seed * 16807) % 2147483647;
      return seed / 2147483647;
    };
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      scatter[i * 3] = SPEECH_OFFSET.x + (rand() - 0.5) * 3;
      scatter[i * 3 + 1] = SPEECH_OFFSET.y + (rand() - 0.5) * 2;
      scatter[i * 3 + 2] = (rand() - 0.5) * 1;
    }

    return {
      speechTargets: speech,
      logoTargets: logo,
      scatterPositions: scatter,
    };
  }, []);

  useEffect(() => {
    setReady(true);
  }, []);

  // Create geometry imperatively (matching ParticleFigures pattern)
  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(PARTICLE_COUNT * 3);
    positions.set(targets.scatterPositions);
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    return geo;
  }, [targets]);

  const material = useMemo(
    () =>
      new THREE.PointsMaterial({
        color: new THREE.Color("#c0d0e0"),
        size: 0.035,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        sizeAttenuation: true,
      }),
    []
  );

  useFrame(() => {
    if (!ready || !pointsRef.current) return;

    const t = timeline.elapsed;
    const posAttr = geometry.getAttribute("position") as THREE.BufferAttribute;
    const positions = posAttr.array as Float32Array;

    const { speechTargets, logoTargets, scatterPositions } = targets;

    // Phase: scatter -> speech text (5-6s)
    const textProgress = easeOut(
      progress(t, PHASES.TEXT_START, PHASES.TEXT_END)
    );

    // Phase: speech -> logo (6-7s)
    const logoProgress = easeInOut(
      progress(t, PHASES.LOGO_START, PHASES.LOGO_END)
    );

    // Opacity: invisible before text phase
    const opacity = progress(t, PHASES.TEXT_START, PHASES.TEXT_START + 0.3);
    material.opacity = opacity * 0.9;

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const i3 = i * 3;

      // First lerp: scatter -> speech
      const sx =
        scatterPositions[i3] +
        (speechTargets[i3] - scatterPositions[i3]) * textProgress;
      const sy =
        scatterPositions[i3 + 1] +
        (speechTargets[i3 + 1] - scatterPositions[i3 + 1]) * textProgress;
      const sz =
        scatterPositions[i3 + 2] +
        (speechTargets[i3 + 2] - scatterPositions[i3 + 2]) * textProgress;

      // Second lerp: speech -> logo
      positions[i3] = sx + (logoTargets[i3] - sx) * logoProgress;
      positions[i3 + 1] = sy + (logoTargets[i3 + 1] - sy) * logoProgress;
      positions[i3 + 2] = sz + (logoTargets[i3 + 2] - sz) * logoProgress;
    }

    // Shimmer in rest state
    if (t > PHASES.LOGO_END) {
      for (let i = 0; i < PARTICLE_COUNT; i++) {
        const i3 = i * 3;
        positions[i3] =
          logoTargets[i3] + Math.sin(t * 0.3 + i * 0.5) * 0.005;
        positions[i3 + 1] =
          logoTargets[i3 + 1] + Math.cos(t * 0.25 + i * 0.8) * 0.004;
        positions[i3 + 2] = logoTargets[i3 + 2];
      }
    }

    posAttr.needsUpdate = true;
  });

  return (
    <points
      ref={pointsRef}
      geometry={geometry}
      material={material}
      frustumCulled={false}
    />
  );
}
