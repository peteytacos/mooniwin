# Homepage Cinematic Redesign — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the marketing-style homepage with an immersive Three.js cinematic intro where two particle-constructed figures watch a moon rise, one declares "Moon, I win!", and the text transitions into the site logo with navigation.

**Architecture:** A full-viewport Three.js Canvas renders the cinematic scene. A shared module-level timeline object coordinates animation across components. Each 3D sub-component (figures, moon, text) reads elapsed time and animates independently via `useFrame`. HTML nav and replay button are overlaid on the canvas and shown/hidden based on timeline callbacks.

**Tech Stack:** Next.js 16, React 19, Three.js (via @react-three/fiber + drei + postprocessing), Tailwind CSS, Framer Motion (HTML overlays only)

**Design doc:** `docs/plans/2026-03-01-homepage-cinematic-design.md`

---

## File Structure

```
src/components/
  CinematicScene.tsx              # Canvas + HTML overlay (nav, replay)
  cinematic/
    timeline.ts                   # Shared mutable timeline object
    SceneContent.tsx              # Inner Canvas content, drives timeline
    ParticleFigures.tsx           # Two silhouette particle systems
    RisingMoon.tsx                # Moon sphere rising animation
    ParticleText.tsx              # "Moon, I win!" text → logo particles
    figureData.ts                 # Silhouette point generation
    textSampler.ts                # Canvas-based text → particle positions

src/app/
  page.tsx                        # Simplified homepage (just CinematicScene)
```

---

## Task 1: Timeline and Scene Scaffold

Create the shared timeline, Canvas wrapper, and basic starfield.

**Files:**
- Create: `src/components/cinematic/timeline.ts`
- Create: `src/components/cinematic/SceneContent.tsx`
- Create: `src/components/CinematicScene.tsx`

### Step 1: Create timeline module

```ts
// src/components/cinematic/timeline.ts

export const timeline = {
  elapsed: 0,
  playing: true,
};

export function resetTimeline() {
  timeline.elapsed = 0;
  timeline.playing = true;
}

// Phase boundaries (seconds)
export const PHASES = {
  STARS_START: 0,
  STARS_END: 1,
  FIGURES_START: 1,
  FIGURES_END: 3,
  MOON_START: 3,
  MOON_END: 5,
  ARM_START: 4,
  ARM_END: 5,
  TEXT_START: 5,
  TEXT_END: 6,
  LOGO_START: 6,
  LOGO_END: 7,
  NAV_START: 6.5,
  NAV_END: 7.5,
  DONE: 7.5,
};

/** Returns 0→1 progress for a value within a range, clamped */
export function progress(elapsed: number, start: number, end: number): number {
  if (elapsed < start) return 0;
  if (elapsed > end) return 1;
  return (elapsed - start) / (end - start);
}

/** Ease-out cubic */
export function easeOut(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

/** Ease-in-out cubic */
export function easeInOut(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}
```

### Step 2: Create SceneContent

```tsx
// src/components/cinematic/SceneContent.tsx
"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { Stars, AdaptiveDpr } from "@react-three/drei";
import { EffectComposer, Bloom, Vignette } from "@react-three/postprocessing";
import { useRef, useEffect } from "react";
import { timeline, PHASES, progress } from "./timeline";

interface SceneContentProps {
  onNavReady: () => void;
}

export default function SceneContent({ onNavReady }: SceneContentProps) {
  const navFired = useRef(false);
  const { viewport } = useThree();

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

  const starsOpacity = progress(timeline.elapsed, PHASES.STARS_START, PHASES.STARS_END);

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
```

### Step 3: Create CinematicScene wrapper

```tsx
// src/components/CinematicScene.tsx
"use client";

import { Canvas } from "@react-three/fiber";
import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import SceneContent from "./cinematic/SceneContent";
import { resetTimeline } from "./cinematic/timeline";

const navLinks = [
  { href: "/rules", label: "Rules" },
  { href: "/play", label: "Play" },
  { href: "/win", label: "Declare Win" },
  { href: "/challenge", label: "Challenge" },
];

export default function CinematicScene() {
  const [showNav, setShowNav] = useState(false);

  const handleNavReady = useCallback(() => {
    setShowNav(true);
  }, []);

  const handleReplay = useCallback(() => {
    setShowNav(false);
    resetTimeline();
  }, []);

  return (
    <div className="relative w-screen h-dvh bg-[#030712]">
      <Canvas
        camera={{ position: [0, 0, 10], fov: 50 }}
        gl={{ antialias: true, alpha: false }}
        dpr={[1, 2]}
        style={{ position: "absolute", inset: 0 }}
      >
        <color attach="background" args={["#030712"]} />
        <SceneContent onNavReady={handleNavReady} />
      </Canvas>

      {/* Nav overlay */}
      <AnimatePresence>
        {showNav && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1 }}
            className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none z-10"
          >
            <nav className="flex flex-col sm:flex-row items-center gap-4 sm:gap-8 mt-24 pointer-events-auto">
              {navLinks.map(({ href, label }, i) => (
                <motion.div
                  key={href}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.1, duration: 0.5 }}
                >
                  <Link
                    href={href}
                    className="text-sm sm:text-base font-medium text-slate-300/80 hover:text-white transition-colors"
                  >
                    {label}
                  </Link>
                </motion.div>
              ))}
            </nav>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Replay button */}
      <AnimatePresence>
        {showNav && (
          <motion.button
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.4 }}
            whileHover={{ opacity: 0.9 }}
            transition={{ duration: 0.5 }}
            onClick={handleReplay}
            className="absolute bottom-6 right-6 sm:bottom-8 sm:right-8 z-20 text-slate-400 hover:text-white transition-colors text-xl cursor-pointer"
            aria-label="Replay animation"
          >
            ↻
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}
```

### Step 4: Wire to homepage temporarily

Replace `src/app/page.tsx` to test the scaffold:

```tsx
// src/app/page.tsx
"use client";

import dynamic from "next/dynamic";

const CinematicScene = dynamic(() => import("@/components/CinematicScene"), {
  ssr: false,
});

export default function Home() {
  return (
    <main className="bg-[#030712]">
      <CinematicScene />
    </main>
  );
}
```

### Step 5: Verify

Run: `bun run dev`
Expected: Full-viewport dark scene with stars, bloom, and vignette. After ~7s, nav links and replay button appear. Clicking replay hides nav and restarts.

### Step 6: Commit

```bash
git add src/components/CinematicScene.tsx src/components/cinematic/ src/app/page.tsx
git commit -m "feat: scaffold cinematic scene with timeline, stars, and nav overlay"
```

---

## Task 2: Particle Figures

Build the two human silhouettes from particles that swarm from random scatter into form.

**Files:**
- Create: `src/components/cinematic/figureData.ts`
- Create: `src/components/cinematic/ParticleFigures.tsx`
- Modify: `src/components/cinematic/SceneContent.tsx`

### Step 1: Create figure point generator

The figures are defined as collections of simple geometric primitives (ellipses, rectangles). Points are scattered within each primitive via rejection sampling. Two poses exist: `standing` (arms at sides) and `pointing` (right figure's arm raised).

```ts
// src/components/cinematic/figureData.ts

type Shape =
  | { type: "ellipse"; cx: number; cy: number; rx: number; ry: number; count: number }
  | { type: "rect"; x: number; y: number; w: number; h: number; count: number }
  | { type: "line"; x1: number; y1: number; x2: number; y2: number; thickness: number; count: number };

function sampleShape(shape: Shape, seed: number): [number, number][] {
  const points: [number, number][] = [];
  let s = seed;
  const rand = () => {
    s = (s * 16807 + 0) % 2147483647;
    return s / 2147483647;
  };

  if (shape.type === "ellipse") {
    for (let i = 0; i < shape.count; i++) {
      const angle = rand() * Math.PI * 2;
      const r = Math.sqrt(rand());
      points.push([
        shape.cx + Math.cos(angle) * r * shape.rx,
        shape.cy + Math.sin(angle) * r * shape.ry,
      ]);
    }
  } else if (shape.type === "rect") {
    for (let i = 0; i < shape.count; i++) {
      points.push([
        shape.x + rand() * shape.w,
        shape.y + rand() * shape.h,
      ]);
    }
  } else if (shape.type === "line") {
    for (let i = 0; i < shape.count; i++) {
      const t = rand();
      const px = shape.x1 + (shape.x2 - shape.x1) * t;
      const py = shape.y1 + (shape.y2 - shape.y1) * t;
      // perpendicular offset
      const dx = shape.x2 - shape.x1;
      const dy = shape.y2 - shape.y1;
      const len = Math.sqrt(dx * dx + dy * dy);
      const nx = -dy / len;
      const ny = dx / len;
      const offset = (rand() - 0.5) * shape.thickness;
      points.push([px + nx * offset, py + ny * offset]);
    }
  }
  return points;
}

/** Base human silhouette shapes (standing, arms at sides). Origin at feet center. */
function standingShapes(): Shape[] {
  return [
    // Head
    { type: "ellipse", cx: 0, cy: 1.45, rx: 0.08, ry: 0.09, count: 30 },
    // Neck
    { type: "rect", x: -0.025, y: 1.32, w: 0.05, h: 0.1, count: 8 },
    // Torso
    { type: "rect", x: -0.14, y: 0.75, w: 0.28, h: 0.57, count: 80 },
    // Left arm
    { type: "line", x1: -0.14, y1: 1.25, x2: -0.18, y2: 0.8, thickness: 0.05, count: 25 },
    // Right arm
    { type: "line", x1: 0.14, y1: 1.25, x2: 0.18, y2: 0.8, thickness: 0.05, count: 25 },
    // Left leg
    { type: "rect", x: -0.12, y: 0, w: 0.09, h: 0.75, count: 40 },
    // Right leg
    { type: "rect", x: 0.03, y: 0, w: 0.09, h: 0.75, count: 40 },
  ];
}

/** Right arm raised, pointing up-right at ~60 degrees */
function pointingArmShape(): Shape {
  return {
    type: "line",
    x1: 0.14, y1: 1.25,
    x2: 0.45, y2: 1.75,
    thickness: 0.05,
    count: 25,
  };
}

export interface FigureData {
  /** Target positions for standing pose (flat xyz array) */
  standingPositions: Float32Array;
  /** Target positions for pointing pose — only differs for right figure (flat xyz array) */
  pointingPositions: Float32Array;
  /** Random scatter positions for initial state (flat xyz array) */
  scatterPositions: Float32Array;
  /** Number of particles */
  count: number;
}

/**
 * Generate figure data for one silhouette.
 * @param offsetX — horizontal offset in world space
 * @param offsetY — vertical offset (feet position)
 * @param scale — size multiplier
 * @param hasPointing — whether this figure has a pointing variant
 * @param seed — random seed
 */
export function generateFigure(
  offsetX: number,
  offsetY: number,
  scale: number,
  hasPointing: boolean,
  seed: number
): FigureData {
  const shapes = standingShapes();
  const allPoints: [number, number][] = [];
  let s = seed;

  for (const shape of shapes) {
    allPoints.push(...sampleShape(shape, s));
    s += 1000;
  }

  const count = allPoints.length;
  const standingPositions = new Float32Array(count * 3);
  const pointingPositions = new Float32Array(count * 3);
  const scatterPositions = new Float32Array(count * 3);

  // Generate pointing arm points (replaces right arm in standing)
  let pointingArmPoints: [number, number][] = [];
  if (hasPointing) {
    pointingArmPoints = sampleShape(pointingArmShape(), seed + 9999);
  }

  // Find the right arm indices (particles 143-167 based on shape order: 30+8+80+25 = 143 start of right arm, 25 particles)
  const rightArmStart = 30 + 8 + 80 + 25; // after head + neck + torso + left arm
  const rightArmEnd = rightArmStart + 25;

  const rand = (() => {
    let rs = seed + 50000;
    return () => {
      rs = (rs * 16807 + 0) % 2147483647;
      return rs / 2147483647;
    };
  })();

  for (let i = 0; i < count; i++) {
    const [x, y] = allPoints[i];

    // Standing position
    standingPositions[i * 3] = x * scale + offsetX;
    standingPositions[i * 3 + 1] = y * scale + offsetY;
    standingPositions[i * 3 + 2] = 0;

    // Pointing position
    if (hasPointing && i >= rightArmStart && i < rightArmEnd) {
      const armIdx = i - rightArmStart;
      if (armIdx < pointingArmPoints.length) {
        pointingPositions[i * 3] = pointingArmPoints[armIdx][0] * scale + offsetX;
        pointingPositions[i * 3 + 1] = pointingArmPoints[armIdx][1] * scale + offsetY;
      } else {
        pointingPositions[i * 3] = standingPositions[i * 3];
        pointingPositions[i * 3 + 1] = standingPositions[i * 3 + 1];
      }
    } else {
      pointingPositions[i * 3] = standingPositions[i * 3];
      pointingPositions[i * 3 + 1] = standingPositions[i * 3 + 1];
    }
    pointingPositions[i * 3 + 2] = 0;

    // Scatter position — random within a large area
    scatterPositions[i * 3] = (rand() - 0.5) * 12 + offsetX;
    scatterPositions[i * 3 + 1] = (rand() - 0.5) * 8 + offsetY + 2;
    scatterPositions[i * 3 + 2] = (rand() - 0.5) * 4;
  }

  return { standingPositions, pointingPositions, scatterPositions, count };
}
```

### Step 2: Create ParticleFigures component

```tsx
// src/components/cinematic/ParticleFigures.tsx
"use client";

import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { generateFigure, type FigureData } from "./figureData";
import { timeline, PHASES, progress, easeOut, easeInOut } from "./timeline";

const FIGURE_Y = -3.2; // feet at bottom of viewport
const FIGURE_SCALE = 1.8;

export default function ParticleFigures() {
  const pointsRef1 = useRef<THREE.Points>(null);
  const pointsRef2 = useRef<THREE.Points>(null);

  const figure1 = useMemo(
    () => generateFigure(-0.7, FIGURE_Y, FIGURE_SCALE, false, 12345),
    []
  );
  const figure2 = useMemo(
    () => generateFigure(0.7, FIGURE_Y, FIGURE_SCALE, true, 67890),
    []
  );

  // Working position buffers (mutated each frame)
  const positions1 = useMemo(() => new Float32Array(figure1.count * 3), [figure1.count]);
  const positions2 = useMemo(() => new Float32Array(figure2.count * 3), [figure2.count]);

  useFrame(() => {
    const t = timeline.elapsed;

    // Phase: scatter → standing (1-3s)
    const formProgress = easeOut(progress(t, PHASES.FIGURES_START, PHASES.FIGURES_END));

    // Phase: standing → pointing for figure 2 (4-5s)
    const armProgress = easeInOut(progress(t, PHASES.ARM_START, PHASES.ARM_END));

    // Update figure 1 (no pointing)
    updateFigurePositions(positions1, figure1, formProgress, 0);
    if (pointsRef1.current) {
      const geo = pointsRef1.current.geometry;
      geo.setAttribute("position", new THREE.BufferAttribute(positions1, 3));
      geo.attributes.position.needsUpdate = true;
    }

    // Update figure 2 (has pointing)
    updateFigurePositions(positions2, figure2, formProgress, armProgress);
    if (pointsRef2.current) {
      const geo = pointsRef2.current.geometry;
      geo.setAttribute("position", new THREE.BufferAttribute(positions2, 3));
      geo.attributes.position.needsUpdate = true;
    }

    // Subtle shimmer in rest state
    if (t > PHASES.FIGURES_END) {
      addShimmer(positions1, figure1.standingPositions, t, figure1.count);
      addShimmer(positions2, figure2.pointingPositions, t, figure2.count);
    }
  });

  const material = useMemo(
    () =>
      new THREE.PointsMaterial({
        color: new THREE.Color("#c0d0e0"),
        size: 0.04,
        transparent: true,
        opacity: 0.9,
        sizeAttenuation: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    []
  );

  return (
    <>
      <points ref={pointsRef1} material={material} frustumCulled={false}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            count={figure1.count}
            array={positions1}
            itemSize={3}
          />
        </bufferGeometry>
      </points>
      <points ref={pointsRef2} material={material} frustumCulled={false}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            count={figure2.count}
            array={positions2}
            itemSize={3}
          />
        </bufferGeometry>
      </points>
    </>
  );
}

function updateFigurePositions(
  out: Float32Array,
  figure: FigureData,
  formProgress: number,
  armProgress: number
) {
  for (let i = 0; i < figure.count; i++) {
    const i3 = i * 3;

    // Blend scatter → standing
    const sx = figure.scatterPositions[i3];
    const sy = figure.scatterPositions[i3 + 1];
    const sz = figure.scatterPositions[i3 + 2];

    // Blend standing → pointing (only matters for pointing figure)
    const tx =
      figure.standingPositions[i3] +
      (figure.pointingPositions[i3] - figure.standingPositions[i3]) * armProgress;
    const ty =
      figure.standingPositions[i3 + 1] +
      (figure.pointingPositions[i3 + 1] - figure.standingPositions[i3 + 1]) * armProgress;
    const tz = 0;

    // Blend scatter → target
    out[i3] = sx + (tx - sx) * formProgress;
    out[i3 + 1] = sy + (ty - sy) * formProgress;
    out[i3 + 2] = sz + (tz - sz) * formProgress;
  }
}

function addShimmer(
  positions: Float32Array,
  targets: Float32Array,
  time: number,
  count: number
) {
  for (let i = 0; i < count; i++) {
    const i3 = i * 3;
    const drift = Math.sin(time * 0.5 + i * 0.7) * 0.008;
    positions[i3] = targets[i3] + drift;
    positions[i3 + 1] = targets[i3 + 1] + Math.cos(time * 0.4 + i * 1.1) * 0.006;
  }
}
```

### Step 3: Add ParticleFigures to SceneContent

In `SceneContent.tsx`, add:
```tsx
import ParticleFigures from "./ParticleFigures";

// Inside the return, alongside Stars:
<ParticleFigures />
```

### Step 4: Verify

Run: `bun run dev`
Expected: After 1s, particles swarm in from random positions and settle into two human silhouettes at the bottom of the scene. They shimmer subtly once formed.

### Step 5: Commit

```bash
git add src/components/cinematic/figureData.ts src/components/cinematic/ParticleFigures.tsx src/components/cinematic/SceneContent.tsx
git commit -m "feat: add particle figure silhouettes with scatter-to-form animation"
```

---

## Task 3: Rising Moon

Add the moon sphere that rises from below the horizon with glow and bloom.

**Files:**
- Create: `src/components/cinematic/RisingMoon.tsx`
- Modify: `src/components/cinematic/SceneContent.tsx`

### Step 1: Create RisingMoon component

```tsx
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
```

### Step 2: Add to SceneContent

In `SceneContent.tsx`, add:
```tsx
import RisingMoon from "./RisingMoon";

// Inside the return:
<RisingMoon />
```

### Step 3: Verify

Run: `bun run dev`
Expected: At 3s, the moon begins rising from below the scene. It reaches the upper area by 5s, with a soft glow halo. After rising, it drifts very slowly upward. Bloom makes the moon glow beautifully.

### Step 4: Commit

```bash
git add src/components/cinematic/RisingMoon.tsx src/components/cinematic/SceneContent.tsx
git commit -m "feat: add rising moon with glow and bloom"
```

---

## Task 4: Particle Text ("Moon, I win!" → Logo)

Sample text glyphs into particle positions. The text first forms as a small constellation near the pointing figure, then morphs to center-screen as the logo.

**Files:**
- Create: `src/components/cinematic/textSampler.ts`
- Create: `src/components/cinematic/ParticleText.tsx`
- Modify: `src/components/cinematic/SceneContent.tsx`

### Step 1: Create text sampler utility

```ts
// src/components/cinematic/textSampler.ts

/**
 * Render text to an offscreen canvas and sample filled pixel positions
 * as particle targets. Returns normalized positions centered on origin.
 */
export function sampleTextPositions(
  text: string,
  targetCount: number,
  fontSize: number = 64,
  fontFamily: string = "sans-serif"
): Float32Array {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d")!;

  // Size canvas to fit text
  ctx.font = `bold ${fontSize}px ${fontFamily}`;
  const metrics = ctx.measureText(text);
  const padding = 10;
  canvas.width = Math.ceil(metrics.width) + padding * 2;
  canvas.height = fontSize * 1.5 + padding * 2;

  // Draw text
  ctx.fillStyle = "white";
  ctx.font = `bold ${fontSize}px ${fontFamily}`;
  ctx.textBaseline = "middle";
  ctx.fillText(text, padding, canvas.height / 2);

  // Read pixels
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const filledPixels: [number, number][] = [];

  // Sample every Nth pixel for performance
  const step = Math.max(1, Math.floor(Math.sqrt((canvas.width * canvas.height) / (targetCount * 4))));
  for (let y = 0; y < canvas.height; y += step) {
    for (let x = 0; x < canvas.width; x += step) {
      const idx = (y * canvas.width + x) * 4;
      if (imageData.data[idx + 3] > 128) {
        filledPixels.push([x, y]);
      }
    }
  }

  // Downsample to target count
  const selected: [number, number][] = [];
  const stride = Math.max(1, Math.floor(filledPixels.length / targetCount));
  for (let i = 0; i < filledPixels.length && selected.length < targetCount; i += stride) {
    selected.push(filledPixels[i]);
  }

  // Pad if needed
  while (selected.length < targetCount) {
    selected.push(selected[selected.length - 1] || [0, 0]);
  }

  // Normalize to centered coordinates (-0.5 to 0.5 range for width)
  const positions = new Float32Array(targetCount * 3);
  const w = canvas.width;
  const h = canvas.height;
  for (let i = 0; i < targetCount; i++) {
    const [px, py] = selected[i];
    positions[i * 3] = (px / w - 0.5); // -0.5 to 0.5
    positions[i * 3 + 1] = -(py / h - 0.5); // flip Y
    positions[i * 3 + 2] = 0;
  }

  return positions;
}
```

### Step 2: Create ParticleText component

```tsx
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
  const { speechTargets, logoTargets, scatterPositions } = useMemo(() => {
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

    return { speechTargets: speech, logoTargets: logo, scatterPositions: scatter };
  }, []);

  useEffect(() => {
    setReady(true);
  }, []);

  const positions = useMemo(() => new Float32Array(PARTICLE_COUNT * 3), []);

  useFrame(() => {
    if (!ready || !pointsRef.current) return;
    const t = timeline.elapsed;

    // Phase: scatter → speech text (5-6s)
    const textProgress = easeOut(progress(t, PHASES.TEXT_START, PHASES.TEXT_END));

    // Phase: speech → logo (6-7s)
    const logoProgress = easeInOut(progress(t, PHASES.LOGO_START, PHASES.LOGO_END));

    // Opacity: invisible before text phase
    const opacity = progress(t, PHASES.TEXT_START, PHASES.TEXT_START + 0.3);
    (pointsRef.current.material as THREE.PointsMaterial).opacity = opacity * 0.9;

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const i3 = i * 3;

      // First lerp: scatter → speech
      const sx = scatterPositions[i3] + (speechTargets[i3] - scatterPositions[i3]) * textProgress;
      const sy = scatterPositions[i3 + 1] + (speechTargets[i3 + 1] - scatterPositions[i3 + 1]) * textProgress;
      const sz = scatterPositions[i3 + 2] + (speechTargets[i3 + 2] - scatterPositions[i3 + 2]) * textProgress;

      // Second lerp: speech → logo
      positions[i3] = sx + (logoTargets[i3] - sx) * logoProgress;
      positions[i3 + 1] = sy + (logoTargets[i3 + 1] - sy) * logoProgress;
      positions[i3 + 2] = sz + (logoTargets[i3 + 2] - sz) * logoProgress;
    }

    // Shimmer in rest state
    if (t > PHASES.LOGO_END) {
      for (let i = 0; i < PARTICLE_COUNT; i++) {
        const i3 = i * 3;
        positions[i3] = logoTargets[i3] + Math.sin(t * 0.3 + i * 0.5) * 0.005;
        positions[i3 + 1] = logoTargets[i3 + 1] + Math.cos(t * 0.25 + i * 0.8) * 0.004;
        positions[i3 + 2] = logoTargets[i3 + 2];
      }
    }

    const geo = pointsRef.current.geometry;
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geo.attributes.position.needsUpdate = true;
  });

  return (
    <points ref={pointsRef} frustumCulled={false}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={PARTICLE_COUNT}
          array={positions}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial
        color="#c0d0e0"
        size={0.035}
        transparent
        opacity={0}
        sizeAttenuation
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </points>
  );
}
```

### Step 3: Add to SceneContent

In `SceneContent.tsx`, add:
```tsx
import ParticleText from "./ParticleText";

// Inside the return:
<ParticleText />
```

### Step 4: Verify

Run: `bun run dev`
Expected: At 5s, particle text fades in and forms "Moon, I win!" as a constellation near the right figure. At 6s, the particles drift smoothly to center-screen, forming a larger logo. After 7s, the logo particles shimmer gently.

### Step 5: Commit

```bash
git add src/components/cinematic/textSampler.ts src/components/cinematic/ParticleText.tsx src/components/cinematic/SceneContent.tsx
git commit -m "feat: add particle text with speech-to-logo morph animation"
```

---

## Task 5: Mouse Parallax and Camera

Add subtle mouse-following camera parallax for the rest state, and responsive FOV.

**Files:**
- Modify: `src/components/cinematic/SceneContent.tsx`

### Step 1: Add camera parallax and responsive FOV

In `SceneContent.tsx`, add a `CameraController` inner component:

```tsx
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
      camera.position.y = THREE.MathUtils.lerp(camera.position.y, mouse.y * 0.15 , 0.02);
    }
  });

  return null;
}
```

Add `<CameraController />` to the SceneContent return.

Import `THREE` if not already imported:
```tsx
import * as THREE from "three";
```

### Step 2: Verify

Run: `bun run dev`
Expected: On portrait (narrow) browser windows, the FOV widens so the full scene is visible. After the animation completes, moving the mouse gently shifts the camera. The effect is subtle.

### Step 3: Commit

```bash
git add src/components/cinematic/SceneContent.tsx
git commit -m "feat: add responsive FOV and mouse parallax camera"
```

---

## Task 6: Responsive Polish

Reduce particle count on mobile, adjust figure/text positioning for portrait, and ensure performance.

**Files:**
- Modify: `src/components/cinematic/ParticleFigures.tsx`
- Modify: `src/components/cinematic/ParticleText.tsx`
- Modify: `src/components/CinematicScene.tsx`

### Step 1: Add mobile detection utility

In `CinematicScene.tsx`, detect mobile and pass to Canvas children:

```tsx
const isMobile = typeof window !== "undefined" && window.innerWidth < 768;
```

Pass as a data attribute or use React context. Simplest: check `window.innerWidth` inside the 3D components directly, since they're client-only.

### Step 2: Reduce particle count in figureData

In `figureData.ts`, add an optional `densityScale` parameter (0-1) that multiplies each shape's `count`. Default 1.0, pass 0.65 on mobile.

### Step 3: Reduce text particle count on mobile

In `ParticleText.tsx`, use `const PARTICLE_COUNT = window.innerWidth < 768 ? 180 : 300;`

### Step 4: Adjust replay button position

Already handled in `CinematicScene.tsx` — the replay button uses `bottom-6 right-6 sm:bottom-8 sm:right-8`.

For mobile, center it: add `sm:right-8` variant and on small screens use `left-1/2 -translate-x-1/2`.

### Step 5: Verify

Run: `bun run dev`
Test in browser with DevTools responsive mode:
- Desktop (1440px): full particle count, horizontal nav, replay bottom-right
- Mobile (375px): reduced particles, vertical nav, replay bottom-center, wider FOV

### Step 6: Commit

```bash
git add src/components/cinematic/ src/components/CinematicScene.tsx
git commit -m "feat: responsive adjustments — particle reduction, mobile layout"
```

---

## Task 7: Cleanup and Final Integration

Remove old homepage components no longer needed. Clean up unused code.

**Files:**
- Modify: `src/app/page.tsx` (already done in Task 1)
- Keep: `src/components/MoonScene.tsx` (still used by other pages)
- Keep: `src/components/Nav.tsx` (still used by other pages)

### Step 1: Verify build

Run: `bun run build`
Expected: Build succeeds with no errors. All routes generate.

### Step 2: Visual review

Run: `bun run dev`
Walk through the full animation:
1. Stars appear (0-1s)
2. Figures form from particle scatter (1-3s)
3. Moon rises with glow (3-5s)
4. One figure's arm raises to point (4-5s)
5. "Moon, I win!" text forms as constellation near figure (5-6s)
6. Text morphs to center logo (6-7s)
7. Nav links fade in below logo (6.5-7.5s)
8. Rest state: moon drifts, particles shimmer, mouse parallax
9. Replay button resets entire sequence

### Step 3: Verify other pages still work

Navigate to `/rules`, `/play`, `/win`, `/challenge` — they should be unchanged and functional.

### Step 4: Commit

```bash
git add -A
git commit -m "feat: homepage cinematic redesign — particle figures, rising moon, animated logo"
```
