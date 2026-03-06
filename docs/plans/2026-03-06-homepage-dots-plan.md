# Homepage Dots Redesign Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the current cinematic homepage with a unified white-dots-on-black design — flowing dot field, stippled moon outline, dot figures, max-width nav.

**Architecture:** Single `Points` mesh with custom `ShaderMaterial` handles all ~15k particles. Vertex shader uses embedded GLSL simplex noise for flow field. Each particle has a type attribute controlling its behavior (field/moon/figureL/figureR). Timeline phases drive type transitions.

**Tech Stack:** React Three Fiber, Three.js custom ShaderMaterial, GLSL simplex noise, Tailwind CSS, Framer Motion (nav only)

---

### Task 1: Update timeline phases and color constants

**Files:**
- Modify: `src/components/cinematic/timeline.ts`
- Modify: `src/app/globals.css`
- Modify: `src/app/page.tsx`
- Modify: `src/components/CinematicScene.tsx` (background color only)

**Step 1: Update timeline phases**

Replace the PHASES object in `src/components/cinematic/timeline.ts`:

```ts
export const PHASES = {
  FIELD_START: 0,
  FIGURES_START: 1,
  FIGURES_END: 3,
  MOON_START: 3,
  MOON_END: 5,
  ARM_START: 4,
  ARM_END: 5,
  NAV_START: 5.5,
  DONE: 6.5,
};
```

Remove `STARS_START`, `STARS_END`, `TEXT_START`, `TEXT_END`, `LOGO_START`, `LOGO_END`, `NAV_END`.

**Step 2: Update background colors**

In `src/app/globals.css`, change `--background: #030712` to `--background: #000000`. Change scrollbar track to `#000000`.

In `src/app/page.tsx`, change `bg-[#030712]` to `bg-black`.

In `src/components/CinematicScene.tsx`, change `bg-[#030712]` to `bg-black` and the `<color>` args to `#000000`.

**Step 3: Verify build**

Run: `bun run build`
Expected: Compiles (existing components still imported, that's fine — we'll remove them in later tasks)

**Step 4: Commit**

```bash
git add src/components/cinematic/timeline.ts src/app/globals.css src/app/page.tsx src/components/CinematicScene.tsx
git commit -m "refactor: update timeline phases and background to pure black"
```

---

### Task 2: Create moon data generator

**Files:**
- Create: `src/components/cinematic/moonData.ts`

**Step 1: Implement Fibonacci sphere sampling with rim weighting**

Create `src/components/cinematic/moonData.ts`:

```ts
// src/components/cinematic/moonData.ts
// Generates dot positions for a stippled moon sphere outline.
// Uses Fibonacci sphere sampling, weighted toward the rim (where surface
// normals are perpendicular to the camera view direction).

/**
 * Generate moon dot positions as a Float32Array of [x, y, z] triples.
 * Points are on a sphere surface, biased toward the visible rim.
 *
 * @param radius - Sphere radius
 * @param count - Number of candidate points to sample
 * @param rimBias - 0-1, higher = more points concentrated at rim
 * @param centerX - Moon center X
 * @param centerY - Moon final Y position
 * @param centerZ - Moon center Z
 * @returns Float32Array of length count * 3
 */
export function generateMoonDots(
  radius: number,
  count: number,
  rimBias: number,
  centerX: number,
  centerY: number,
  centerZ: number,
): Float32Array {
  const positions = new Float32Array(count * 3);
  const goldenAngle = Math.PI * (3 - Math.sqrt(5));

  // Camera looks down -Z, so view direction is (0, 0, -1) in local space.
  // Dot product of normal with view = normal.z
  // Rim = where abs(normal.z) is small

  let written = 0;
  let candidate = 0;
  const totalCandidates = count * 4; // oversample then filter

  // Seeded random for deterministic rejection sampling
  let seed = 12345;
  const rand = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };

  while (written < count && candidate < totalCandidates) {
    // Fibonacci sphere point
    const y = 1 - (candidate / (totalCandidates - 1)) * 2; // -1 to 1
    const radiusAtY = Math.sqrt(1 - y * y);
    const theta = goldenAngle * candidate;
    const x = Math.cos(theta) * radiusAtY;
    const z = Math.sin(theta) * radiusAtY;

    // Rim weighting: abs(z) is dot product with camera direction
    // Keep point with probability based on how close to rim it is
    const rimness = 1 - Math.abs(z); // 1 at rim, 0 at center/back
    const keepProbability = (1 - rimBias) + rimBias * rimness;

    if (rand() < keepProbability) {
      positions[written * 3] = x * radius + centerX;
      positions[written * 3 + 1] = y * radius + centerY;
      positions[written * 3 + 2] = z * radius + centerZ;
      written++;
    }

    candidate++;
  }

  // Fill any remaining with rim points if we ran out of candidates
  while (written < count) {
    const theta = rand() * Math.PI * 2;
    const x = Math.cos(theta);
    const y = Math.sin(theta);
    positions[written * 3] = x * radius + centerX;
    positions[written * 3 + 1] = y * radius + centerY;
    positions[written * 3 + 2] = centerZ; // exactly on rim
    written++;
  }

  return positions;
}
```

**Step 2: Verify build**

Run: `bun run build`
Expected: Compiles (file not yet imported anywhere)

**Step 3: Commit**

```bash
git add src/components/cinematic/moonData.ts
git commit -m "feat: add moon dot generator with Fibonacci sphere rim weighting"
```

---

### Task 3: Create unified particle system

This is the core task. One `Points` mesh with custom `ShaderMaterial` manages all dots.

**Files:**
- Create: `src/components/cinematic/UnifiedParticles.tsx`

**Step 1: Create the unified particles component**

Create `src/components/cinematic/UnifiedParticles.tsx`. This is a large file — here's the complete implementation:

```tsx
"use client";

import { useRef, useMemo } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { generateFigure } from "./figureData";
import { generateMoonDots } from "./moonData";
import { timeline, PHASES, progress, easeOut, easeInOut } from "./timeline";

// Particle type constants (match shader)
const TYPE_FIELD = 0;
const TYPE_MOON = 1;
const TYPE_FIGURE_L = 2;
const TYPE_FIGURE_R = 3;

// Counts
const IS_MOBILE =
  typeof window !== "undefined" && window.innerWidth < 768;
const FIELD_COUNT = IS_MOBILE ? 6000 : 12000;
const MOON_COUNT = IS_MOBILE ? 1200 : 2000;
const FIGURE_COUNT = 248; // per figure, matching figureData.ts
const TOTAL = FIELD_COUNT + MOON_COUNT + FIGURE_COUNT * 2;

// Moon position
const MOON_X = 0;
const MOON_START_Y = -5;
const MOON_END_Y = 2;
const MOON_Z = -8;
const MOON_RADIUS = 1.5;

// Simplex noise GLSL (3D) — embedded in vertex shader
const SIMPLEX_NOISE_GLSL = /* glsl */ `
vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 permute(vec4 x) { return mod289(((x*34.0)+1.0)*x); }
vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

float snoise(vec3 v) {
  const vec2 C = vec2(1.0/6.0, 1.0/3.0);
  const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
  vec3 i  = floor(v + dot(v, C.yyy));
  vec3 x0 = v - i + dot(i, C.xxx);
  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min(g.xyz, l.zxy);
  vec3 i2 = max(g.xyz, l.zxy);
  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + C.yyy;
  vec3 x3 = x0 - D.yyy;
  i = mod289(i);
  vec4 p = permute(permute(permute(
    i.z + vec4(0.0, i1.z, i2.z, 1.0))
    + i.y + vec4(0.0, i1.y, i2.y, 1.0))
    + i.x + vec4(0.0, i1.x, i2.x, 1.0));
  float n_ = 0.142857142857;
  vec3 ns = n_ * D.wyz - D.xzx;
  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_);
  vec4 x = x_ * ns.x + ns.yyyy;
  vec4 y = y_ * ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);
  vec4 b0 = vec4(x.xy, y.xy);
  vec4 b1 = vec4(x.zw, y.zw);
  vec4 s0 = floor(b0)*2.0 + 1.0;
  vec4 s1 = floor(b1)*2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));
  vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy;
  vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww;
  vec3 p0 = vec3(a0.xy, h.x);
  vec3 p1 = vec3(a0.zw, h.y);
  vec3 p2 = vec3(a1.xy, h.z);
  vec3 p3 = vec3(a1.zw, h.w);
  vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
  p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
  vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
  m = m * m;
  return 42.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
}
`;

const vertexShader = /* glsl */ `
${SIMPLEX_NOISE_GLSL}

attribute float particleType;
attribute float speed;
attribute float phase;
attribute vec3 targetPosition;
attribute vec3 basePosition;

uniform float uTime;
uniform float uFieldFade;
uniform float uFormProgress;    // figures scatter->standing
uniform float uArmProgress;     // pointing arm
uniform float uMoonFormProgress; // moon formation
uniform float uMoonRiseY;       // current moon Y offset

varying float vOpacity;
varying float vType;

// Viewport bounds for wrapping
const float WRAP_X = 18.0;
const float WRAP_Y = 12.0;
const float WRAP_Z_MIN = -20.0;
const float WRAP_Z_MAX = 5.0;

void main() {
  vType = particleType;
  vec3 pos = basePosition;

  if (particleType < 0.5) {
    // === FIELD PARTICLE ===
    // Flow field: displace by simplex noise
    float t = uTime * 0.15 * speed;
    vec3 noiseInput = pos * 0.08 + vec3(t, t * 0.7, t * 0.5) + phase;
    float nx = snoise(noiseInput) * 2.0;
    float ny = snoise(noiseInput + vec3(100.0, 0.0, 0.0)) * 2.0;
    float nz = snoise(noiseInput + vec3(0.0, 100.0, 0.0)) * 1.0;

    pos += vec3(nx, ny, nz) * speed;

    // Toroidal wrapping
    pos.x = mod(pos.x + WRAP_X, WRAP_X * 2.0) - WRAP_X;
    pos.y = mod(pos.y + WRAP_Y, WRAP_Y * 2.0) - WRAP_Y;
    pos.z = mod(pos.z - WRAP_Z_MIN, WRAP_Z_MAX - WRAP_Z_MIN) + WRAP_Z_MIN;

    vOpacity = uFieldFade * (0.3 + 0.4 * (1.0 + snoise(pos * 0.5 + uTime * 0.1)) * 0.5);
  }
  else if (particleType < 1.5) {
    // === MOON PARTICLE ===
    // Lerp from base (field) position to target (moon surface) position
    vec3 moonTarget = targetPosition;
    moonTarget.y += uMoonRiseY;

    pos = mix(pos, moonTarget, uMoonFormProgress);

    // After formation, add subtle breathing noise
    if (uMoonFormProgress > 0.95) {
      float breath = snoise(targetPosition * 3.0 + uTime * 0.5) * 0.03;
      pos += normalize(targetPosition - vec3(0.0, uMoonRiseY, -8.0)) * breath;
    }

    vOpacity = uMoonFormProgress * 0.9;
  }
  else if (particleType < 2.5) {
    // === FIGURE LEFT ===
    pos = mix(basePosition, targetPosition, uFormProgress);

    // Shimmer after formation
    if (uFormProgress > 0.95) {
      float shimmer = snoise(vec3(phase * 10.0, uTime * 2.0, 0.0));
      pos.x += shimmer * 0.005;
      pos.y += snoise(vec3(phase * 10.0 + 50.0, uTime * 2.0, 0.0)) * 0.005;
    }

    vOpacity = uFormProgress * 0.9;
  }
  else {
    // === FIGURE RIGHT ===
    // Blend standing target with pointing target based on arm progress
    vec3 standTarget = targetPosition;
    // The pointing offset is baked into targetPosition when armProgress=1
    // We store standing in targetPosition, pointing offset added here
    pos = mix(basePosition, targetPosition, uFormProgress);

    if (uFormProgress > 0.95) {
      float shimmer = snoise(vec3(phase * 10.0, uTime * 2.0, 0.0));
      pos.x += shimmer * 0.005;
      pos.y += snoise(vec3(phase * 10.0 + 50.0, uTime * 2.0, 0.0)) * 0.005;
    }

    vOpacity = uFormProgress * 0.9;
  }

  vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);

  // Size attenuation by depth
  float baseSize = particleType < 0.5 ? 1.5 : 2.0;
  gl_PointSize = baseSize * (300.0 / -mvPosition.z);

  gl_Position = projectionMatrix * mvPosition;
}
`;

const fragmentShader = /* glsl */ `
varying float vOpacity;
varying float vType;

void main() {
  // Soft circle
  float dist = length(gl_PointCoord - vec2(0.5));
  if (dist > 0.5) discard;
  float alpha = smoothstep(0.5, 0.2, dist) * vOpacity;

  gl_FragColor = vec4(1.0, 1.0, 1.0, alpha);
}
`;

export default function UnifiedParticles() {
  const meshRef = useRef<THREE.Points>(null);
  const materialRef = useRef<THREE.ShaderMaterial>(null);

  // Generate all particle data once
  const particleData = useMemo(() => {
    // Seeded PRNG
    let seed = 42;
    const rand = () => {
      seed = (seed * 16807) % 2147483647;
      return seed / 2147483647;
    };

    // Arrays for all particles
    const basePositions = new Float32Array(TOTAL * 3);
    const targetPositions = new Float32Array(TOTAL * 3);
    const types = new Float32Array(TOTAL);
    const speeds = new Float32Array(TOTAL);
    const phases = new Float32Array(TOTAL);

    let offset = 0;

    // --- Field particles ---
    for (let i = 0; i < FIELD_COUNT; i++) {
      const idx = (offset + i) * 3;
      basePositions[idx] = (rand() - 0.5) * 36;     // -18 to 18
      basePositions[idx + 1] = (rand() - 0.5) * 24;  // -12 to 12
      basePositions[idx + 2] = -20 + rand() * 25;     // -20 to 5
      // Field particles don't use targetPosition
      types[offset + i] = TYPE_FIELD;
      speeds[offset + i] = 0.5 + rand() * 1.0;
      phases[offset + i] = rand() * 100;
    }
    offset += FIELD_COUNT;

    // --- Moon particles ---
    const moonDots = generateMoonDots(
      MOON_RADIUS,
      MOON_COUNT,
      0.7, // rimBias
      MOON_X,
      MOON_END_Y, // target Y (final position)
      MOON_Z,
    );
    for (let i = 0; i < MOON_COUNT; i++) {
      const idx = (offset + i) * 3;
      // Base position: random field position (they start as field particles)
      basePositions[idx] = (rand() - 0.5) * 36;
      basePositions[idx + 1] = (rand() - 0.5) * 24;
      basePositions[idx + 2] = -20 + rand() * 25;
      // Target: moon surface position
      targetPositions[idx] = moonDots[i * 3];
      targetPositions[idx + 1] = moonDots[i * 3 + 1];
      targetPositions[idx + 2] = moonDots[i * 3 + 2];
      types[offset + i] = TYPE_MOON;
      speeds[offset + i] = 0.5 + rand() * 1.0;
      phases[offset + i] = rand() * 100;
    }
    offset += MOON_COUNT;

    // --- Figure particles ---
    const figure1 = generateFigure(-0.7, -3.2, 1.8, false, 42);
    const figure2 = generateFigure(0.7, -3.2, 1.8, true, 137);

    // Figure Left
    for (let i = 0; i < FIGURE_COUNT; i++) {
      const idx = (offset + i) * 3;
      basePositions[idx] = figure1.scatterPositions[i * 3];
      basePositions[idx + 1] = figure1.scatterPositions[i * 3 + 1];
      basePositions[idx + 2] = figure1.scatterPositions[i * 3 + 2];
      targetPositions[idx] = figure1.standingPositions[i * 3];
      targetPositions[idx + 1] = figure1.standingPositions[i * 3 + 1];
      targetPositions[idx + 2] = figure1.standingPositions[i * 3 + 2];
      types[offset + i] = TYPE_FIGURE_L;
      speeds[offset + i] = 1.0;
      phases[offset + i] = rand() * 100;
    }
    offset += FIGURE_COUNT;

    // Figure Right — needs both standing and pointing targets
    // We'll handle arm transition via a second target attribute
    for (let i = 0; i < FIGURE_COUNT; i++) {
      const idx = (offset + i) * 3;
      basePositions[idx] = figure2.scatterPositions[i * 3];
      basePositions[idx + 1] = figure2.scatterPositions[i * 3 + 1];
      basePositions[idx + 2] = figure2.scatterPositions[i * 3 + 2];
      // Start with standing as target; we'll blend with pointing in useFrame
      targetPositions[idx] = figure2.standingPositions[i * 3];
      targetPositions[idx + 1] = figure2.standingPositions[i * 3 + 1];
      targetPositions[idx + 2] = figure2.standingPositions[i * 3 + 2];
      types[offset + i] = TYPE_FIGURE_R;
      speeds[offset + i] = 1.0;
      phases[offset + i] = rand() * 100;
    }

    return {
      basePositions,
      targetPositions,
      types,
      speeds,
      phases,
      figure2Standing: figure2.standingPositions,
      figure2Pointing: figure2.pointingPositions,
      figure2Offset: FIELD_COUNT + MOON_COUNT + FIGURE_COUNT,
    };
  }, []);

  // Build geometry
  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(TOTAL * 3), 3));
    geo.setAttribute("basePosition", new THREE.BufferAttribute(particleData.basePositions, 3));
    geo.setAttribute("targetPosition", new THREE.BufferAttribute(new Float32Array(particleData.targetPositions), 3));
    geo.setAttribute("particleType", new THREE.BufferAttribute(particleData.types, 1));
    geo.setAttribute("speed", new THREE.BufferAttribute(particleData.speeds, 1));
    geo.setAttribute("phase", new THREE.BufferAttribute(particleData.phases, 1));
    return geo;
  }, [particleData]);

  // Shader material
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader,
        fragmentShader,
        uniforms: {
          uTime: { value: 0 },
          uFieldFade: { value: 0 },
          uFormProgress: { value: 0 },
          uArmProgress: { value: 0 },
          uMoonFormProgress: { value: 0 },
          uMoonRiseY: { value: MOON_START_Y },
        },
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    [],
  );

  useFrame(() => {
    if (!materialRef.current) return;
    const t = timeline.elapsed;
    const mat = materialRef.current;

    // Update uniforms
    mat.uniforms.uTime.value = t;

    // Field fade in (0-1s)
    mat.uniforms.uFieldFade.value = Math.min(1, t / 1.0);

    // Figures form (1-3s)
    mat.uniforms.uFormProgress.value = easeOut(
      progress(t, PHASES.FIGURES_START, PHASES.FIGURES_END),
    );

    // Arm raise (4-5s)
    const armProg = easeInOut(progress(t, PHASES.ARM_START, PHASES.ARM_END));
    mat.uniforms.uArmProgress.value = armProg;

    // Moon formation (3-5s)
    mat.uniforms.uMoonFormProgress.value = easeInOut(
      progress(t, PHASES.MOON_START, PHASES.MOON_END),
    );

    // Moon rise Y
    const riseProgress = easeInOut(progress(t, PHASES.MOON_START, PHASES.MOON_END));
    const moonY = MOON_START_Y + (MOON_END_Y - MOON_START_Y) * riseProgress;
    const drift = t > PHASES.MOON_END ? (t - PHASES.MOON_END) * 0.02 : 0;
    mat.uniforms.uMoonRiseY.value = moonY + drift;

    // Update figure R target positions (blend standing -> pointing)
    if (armProg > 0 && armProg < 1) {
      const targetAttr = geometry.getAttribute("targetPosition") as THREE.BufferAttribute;
      const targetArr = targetAttr.array as Float32Array;
      const { figure2Standing, figure2Pointing, figure2Offset } = particleData;

      for (let i = 0; i < FIGURE_COUNT; i++) {
        const idx = (figure2Offset + i) * 3;
        targetArr[idx] = figure2Standing[i * 3] + (figure2Pointing[i * 3] - figure2Standing[i * 3]) * armProg;
        targetArr[idx + 1] = figure2Standing[i * 3 + 1] + (figure2Pointing[i * 3 + 1] - figure2Standing[i * 3 + 1]) * armProg;
        targetArr[idx + 2] = figure2Standing[i * 3 + 2];
      }
      targetAttr.needsUpdate = true;
    }
  });

  return (
    <points ref={meshRef} frustumCulled={false}>
      <primitive object={geometry} attach="geometry" />
      <primitive object={material} attach="material" ref={materialRef} />
    </points>
  );
}
```

**Step 2: Verify build**

Run: `bun run build`
Expected: Compiles (not yet imported in scene)

**Step 3: Commit**

```bash
git add src/components/cinematic/UnifiedParticles.tsx
git commit -m "feat: add unified particle system with flow field shader"
```

---

### Task 4: Update SceneContent to use unified particles

**Files:**
- Modify: `src/components/cinematic/SceneContent.tsx`

**Step 1: Replace scene contents**

Rewrite `src/components/cinematic/SceneContent.tsx`:

```tsx
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
```

Key changes:
- Removed `Stars`, `ParticleFigures`, `RisingMoon`, `ParticleText` imports
- Removed `ambientLight` and `directionalLight` (dots are self-illuminated via shader)
- Added `UnifiedParticles`
- Lowered bloom `luminanceThreshold` to 0.3 for dot cluster glow
- Reduced vignette darkness to 0.5

**Step 2: Verify build**

Run: `bun run build`
Expected: Compiles. Old component files still exist but are no longer imported.

**Step 3: Commit**

```bash
git add src/components/cinematic/SceneContent.tsx
git commit -m "feat: wire unified particles into scene, remove old components"
```

---

### Task 5: Update navigation layout

**Files:**
- Modify: `src/components/CinematicScene.tsx`

**Step 1: Rewrite nav overlay**

Replace the nav overlay and replay button in `src/components/CinematicScene.tsx` with a max-width constrained layout:

```tsx
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
    <div className="relative w-screen h-dvh bg-black">
      <Canvas
        camera={{ position: [0, 0, 10], fov: 50 }}
        gl={{ antialias: true, alpha: false }}
        dpr={[1, 2]}
        style={{ position: "absolute", inset: 0 }}
      >
        <color attach="background" args={["#000000"]} />
        <SceneContent onNavReady={handleNavReady} />
      </Canvas>

      {/* Nav overlay */}
      <AnimatePresence>
        {showNav && (
          <motion.header
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1 }}
            className="absolute top-0 left-0 right-0 z-10 pointer-events-none"
          >
            <nav className="mx-auto max-w-sm sm:max-w-xl md:max-w-3xl lg:max-w-5xl xl:max-w-7xl px-4 sm:px-6 py-4 sm:py-6 flex items-center justify-between pointer-events-auto">
              <Link
                href="/"
                className="text-sm sm:text-base font-medium text-white hover:text-white/80 transition-colors"
              >
                Moon I Win
              </Link>
              <div className="flex items-center gap-4 sm:gap-6">
                {navLinks.map(({ href, label }, i) => (
                  <motion.div
                    key={href}
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.1, duration: 0.5 }}
                  >
                    <Link
                      href={href}
                      className="text-xs sm:text-sm font-medium text-white/70 hover:text-white transition-colors"
                    >
                      {label}
                    </Link>
                  </motion.div>
                ))}
              </div>
            </nav>
          </motion.header>
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
            className="absolute bottom-6 left-1/2 -translate-x-1/2 sm:left-auto sm:translate-x-0 sm:right-8 sm:bottom-8 z-20 text-white/40 hover:text-white transition-colors text-xl cursor-pointer"
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

Key changes:
- Nav is now `<header>` at top instead of centered overlay
- Max-width container with responsive breakpoints
- "Moon I Win" text on the left, links on the right
- All colors changed to white
- Background `bg-black`

**Step 2: Verify build**

Run: `bun run build`
Expected: Compiles and passes

**Step 3: Commit**

```bash
git add src/components/CinematicScene.tsx
git commit -m "feat: top-aligned max-width navigation with Moon I Win wordmark"
```

---

### Task 6: Delete unused files

**Files:**
- Delete: `src/components/cinematic/ParticleText.tsx`
- Delete: `src/components/cinematic/textSampler.ts`
- Delete: `src/components/cinematic/RisingMoon.tsx`

**Step 1: Delete files**

```bash
rm src/components/cinematic/ParticleText.tsx
rm src/components/cinematic/textSampler.ts
rm src/components/cinematic/RisingMoon.tsx
```

**Step 2: Verify build**

Run: `bun run build`
Expected: Compiles — these files are no longer imported anywhere.

**Step 3: Commit**

```bash
git add -u src/components/cinematic/ParticleText.tsx src/components/cinematic/textSampler.ts src/components/cinematic/RisingMoon.tsx
git commit -m "chore: delete unused ParticleText, textSampler, RisingMoon"
```

---

### Task 7: Visual verification and polish

**Files:**
- Possibly tweak: `src/components/cinematic/UnifiedParticles.tsx` (shader constants)

**Step 1: Run dev server**

Run: `bun run dev`

**Step 2: Visual checklist**

Open browser and verify:
- [ ] Background is pure black (#000)
- [ ] Flowing white dots fill the viewport and are always moving
- [ ] Dots flow in smooth organic currents (not random jitter)
- [ ] Two figure silhouettes form from scattered dots (~1-3s)
- [ ] Moon outline forms from flowing dots (~3-5s), rising from below
- [ ] Moon is a stippled sphere outline (dense at edges, sparse in center)
- [ ] Pointing arm raises on right figure (~4-5s)
- [ ] Nav appears at top (~5.5s) — "Moon I Win" left, links right
- [ ] Nav respects max-width at each breakpoint
- [ ] Mouse parallax works after animation completes
- [ ] No static/fixed dots — everything animates
- [ ] Replay button works
- [ ] Mobile: fewer particles, nav still works, responsive FOV

**Step 3: Tune if needed**

Common adjustments:
- `FIELD_COUNT`: increase/decrease for density
- `speed` range in particle init: adjust flow speed
- Noise frequency (`pos * 0.08` in shader): lower = smoother, larger currents
- `rimBias` in moonData: higher = more pronounced outline
- Bloom `intensity` and `luminanceThreshold`: adjust glow
- Point `baseSize` in vertex shader: adjust dot size

**Step 4: Final commit**

```bash
git add -A
git commit -m "polish: tune unified particle system after visual review"
```
