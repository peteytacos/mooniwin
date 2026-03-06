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

// Responsive layout
const SCREEN_W = typeof window !== "undefined" ? window.innerWidth : 1440;
const IS_MOBILE = SCREEN_W < 768;
const IS_TABLET = SCREEN_W >= 768 && SCREEN_W < 1024;

// Counts
const FIELD_COUNT = IS_MOBILE ? 3000 : 5000;
const MOON_COUNT = IS_MOBILE ? 6000 : 12000;
const FIGURE_COUNT = 755; // per figure, matching figureData.ts
const TOTAL = FIELD_COUNT + MOON_COUNT + FIGURE_COUNT * 2;

// Moon position — responsive
const MOON_X = IS_MOBILE ? 0 : IS_TABLET ? 1.0 : 2;
const MOON_START_Y = -16;
const MOON_END_Y = IS_MOBILE ? 2.8 : IS_TABLET ? 3.0 : 3.5;
const MOON_Z = -8;
const MOON_RADIUS = IS_MOBILE ? 2.2 : IS_TABLET ? 3.0 : 3.8;

// Figure positions — responsive
const FIG_SCALE = IS_MOBILE ? 1.2 : IS_TABLET ? 1.5 : 1.8;
const FIG_Y = IS_MOBILE ? -2.5 : IS_TABLET ? -2.8 : -3.2;
const FIG1_X = IS_MOBILE ? -1.6 : IS_TABLET ? -2.8 : -4.0;
const FIG2_X = IS_MOBILE ? -0.4 : IS_TABLET ? -1.5 : -2.6;

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
uniform float uMoonRotation;    // Y-axis rotation angle (radians)
uniform float uSpreadProgress;  // 0=all at origin, 1=at final positions
uniform vec3 uMoonCenter;       // moon center (x, 0, z)
uniform vec3 uMouseWorld;       // mouse position in world space

varying float vOpacity;
varying float vType;

// All dots originate from bottom-right corner
const vec3 ORIGIN = vec3(14.0, -10.0, -5.0);

// Viewport bounds for wrapping
const float WRAP_X = 18.0;
const float WRAP_Y = 12.0;
const float WRAP_Z_MIN = -20.0;
const float WRAP_Z_MAX = 5.0;

void main() {
  vType = particleType;
  vec3 finalPos;

  if (particleType < 0.5) {
    // === FIELD PARTICLE ===
    vec3 pos = basePosition;
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

    finalPos = pos;
    vOpacity = uFieldFade * (0.15 + 0.2 * (1.0 + snoise(pos * 0.5 + uTime * 0.1)) * 0.5);
  }
  else if (particleType < 1.5) {
    // === MOON PARTICLE ===
    float lx = targetPosition.x - uMoonCenter.x;
    float lz = targetPosition.z - uMoonCenter.z;
    float cosR = cos(uMoonRotation);
    float sinR = sin(uMoonRotation);
    float rx = lx * cosR + lz * sinR;
    float rz = -lx * sinR + lz * cosR;
    vec3 rotated = vec3(rx + uMoonCenter.x, targetPosition.y, rz + uMoonCenter.z);

    vec3 moonTarget = rotated;
    moonTarget.y += uMoonRiseY;

    finalPos = moonTarget;

    // Circular craters — distributed across entire sphere surface
    // Normalize dot position to unit sphere for distance calculations
    vec3 norm = normalize(targetPosition - uMoonCenter);

    // Large maria — front, back, sides, top, bottom
    float surface = 1.0;
    surface -= 0.45 * (1.0 - smoothstep(0.0, 0.05, distance(norm, vec3( 0.3,  0.5,  0.81)) - 0.3));
    surface -= 0.4  * (1.0 - smoothstep(0.0, 0.05, distance(norm, vec3(-0.4, -0.3,  0.87)) - 0.25));
    surface -= 0.35 * (1.0 - smoothstep(0.0, 0.05, distance(norm, vec3( 0.5, -0.5,  0.71)) - 0.2));
    surface -= 0.45 * (1.0 - smoothstep(0.0, 0.05, distance(norm, vec3(-0.3,  0.4, -0.86)) - 0.28));
    surface -= 0.4  * (1.0 - smoothstep(0.0, 0.05, distance(norm, vec3( 0.5, -0.2, -0.84)) - 0.22));
    surface -= 0.35 * (1.0 - smoothstep(0.0, 0.05, distance(norm, vec3(-0.6,  0.1, -0.79)) - 0.2));

    // Medium craters — all around the sphere
    surface -= 0.5  * (1.0 - smoothstep(0.0, 0.03, distance(norm, vec3(-0.7,  0.5,  0.51)) - 0.12));
    surface -= 0.5  * (1.0 - smoothstep(0.0, 0.03, distance(norm, vec3( 0.7, -0.1,  0.71)) - 0.1));
    surface -= 0.45 * (1.0 - smoothstep(0.0, 0.03, distance(norm, vec3(-0.1,  0.8,  0.59)) - 0.1));
    surface -= 0.45 * (1.0 - smoothstep(0.0, 0.03, distance(norm, vec3( 0.1, -0.8,  0.59)) - 0.09));
    surface -= 0.4  * (1.0 - smoothstep(0.0, 0.03, distance(norm, vec3(-0.6, -0.6,  0.53)) - 0.08));
    // Back side medium
    surface -= 0.5  * (1.0 - smoothstep(0.0, 0.03, distance(norm, vec3( 0.6,  0.4, -0.69)) - 0.11));
    surface -= 0.5  * (1.0 - smoothstep(0.0, 0.03, distance(norm, vec3(-0.5, -0.5, -0.71)) - 0.1));
    surface -= 0.45 * (1.0 - smoothstep(0.0, 0.03, distance(norm, vec3( 0.2,  0.7, -0.68)) - 0.09));
    surface -= 0.45 * (1.0 - smoothstep(0.0, 0.03, distance(norm, vec3(-0.3, -0.8, -0.51)) - 0.08));
    // Sides (z near 0)
    surface -= 0.5  * (1.0 - smoothstep(0.0, 0.03, distance(norm, vec3( 0.95, 0.2,  0.24)) - 0.1));
    surface -= 0.45 * (1.0 - smoothstep(0.0, 0.03, distance(norm, vec3(-0.93, 0.3,  0.20)) - 0.09));
    surface -= 0.45 * (1.0 - smoothstep(0.0, 0.03, distance(norm, vec3( 0.90,-0.4, -0.17)) - 0.08));
    surface -= 0.4  * (1.0 - smoothstep(0.0, 0.03, distance(norm, vec3(-0.88,-0.3, -0.37)) - 0.08));

    // Small craters — front
    surface -= 0.55 * (1.0 - smoothstep(0.0, 0.02, distance(norm, vec3( 0.8,  0.4,  0.45)) - 0.06));
    surface -= 0.55 * (1.0 - smoothstep(0.0, 0.02, distance(norm, vec3(-0.3,  0.2,  0.93)) - 0.05));
    surface -= 0.5  * (1.0 - smoothstep(0.0, 0.02, distance(norm, vec3( 0.0, -0.4,  0.92)) - 0.05));
    surface -= 0.5  * (1.0 - smoothstep(0.0, 0.02, distance(norm, vec3(-0.8,  0.1,  0.59)) - 0.05));
    surface -= 0.5  * (1.0 - smoothstep(0.0, 0.02, distance(norm, vec3( 0.4,  0.8,  0.45)) - 0.04));
    surface -= 0.45 * (1.0 - smoothstep(0.0, 0.02, distance(norm, vec3(-0.5,  0.7,  0.51)) - 0.04));
    surface -= 0.45 * (1.0 - smoothstep(0.0, 0.02, distance(norm, vec3( 0.6,  0.0,  0.80)) - 0.04));
    // Small craters — back
    surface -= 0.55 * (1.0 - smoothstep(0.0, 0.02, distance(norm, vec3(-0.7,  0.3, -0.65)) - 0.06));
    surface -= 0.5  * (1.0 - smoothstep(0.0, 0.02, distance(norm, vec3( 0.4, -0.6, -0.69)) - 0.05));
    surface -= 0.5  * (1.0 - smoothstep(0.0, 0.02, distance(norm, vec3( 0.1,  0.5, -0.86)) - 0.05));
    surface -= 0.5  * (1.0 - smoothstep(0.0, 0.02, distance(norm, vec3(-0.6, -0.2, -0.77)) - 0.05));
    surface -= 0.45 * (1.0 - smoothstep(0.0, 0.02, distance(norm, vec3( 0.7,  0.6, -0.38)) - 0.04));
    surface -= 0.45 * (1.0 - smoothstep(0.0, 0.02, distance(norm, vec3(-0.2, -0.9, -0.38)) - 0.04));
    surface -= 0.45 * (1.0 - smoothstep(0.0, 0.02, distance(norm, vec3( 0.8, -0.3, -0.52)) - 0.04));

    // Tiny craters — front hemisphere
    surface -= 0.4  * (1.0 - smoothstep(0.0, 0.015, distance(norm, vec3( 0.2, -0.2,  0.96)) - 0.03));
    surface -= 0.4  * (1.0 - smoothstep(0.0, 0.015, distance(norm, vec3(-0.6,  0.3,  0.74)) - 0.03));
    surface -= 0.4  * (1.0 - smoothstep(0.0, 0.015, distance(norm, vec3( 0.5,  0.3,  0.81)) - 0.03));
    surface -= 0.4  * (1.0 - smoothstep(0.0, 0.015, distance(norm, vec3(-0.2, -0.7,  0.68)) - 0.03));
    surface -= 0.35 * (1.0 - smoothstep(0.0, 0.015, distance(norm, vec3( 0.3,  0.6,  0.74)) - 0.025));
    surface -= 0.35 * (1.0 - smoothstep(0.0, 0.015, distance(norm, vec3(-0.4, -0.5,  0.76)) - 0.025));
    surface -= 0.35 * (1.0 - smoothstep(0.0, 0.015, distance(norm, vec3( 0.7, -0.5,  0.51)) - 0.025));
    surface -= 0.35 * (1.0 - smoothstep(0.0, 0.015, distance(norm, vec3(-0.7, -0.2,  0.68)) - 0.025));
    // Tiny craters — back hemisphere
    surface -= 0.4  * (1.0 - smoothstep(0.0, 0.015, distance(norm, vec3(-0.1,  0.3, -0.95)) - 0.03));
    surface -= 0.4  * (1.0 - smoothstep(0.0, 0.015, distance(norm, vec3( 0.5, -0.4, -0.76)) - 0.03));
    surface -= 0.4  * (1.0 - smoothstep(0.0, 0.015, distance(norm, vec3(-0.4,  0.6, -0.69)) - 0.03));
    surface -= 0.4  * (1.0 - smoothstep(0.0, 0.015, distance(norm, vec3( 0.3, -0.7, -0.65)) - 0.03));
    surface -= 0.35 * (1.0 - smoothstep(0.0, 0.015, distance(norm, vec3(-0.6,  0.5, -0.62)) - 0.025));
    surface -= 0.35 * (1.0 - smoothstep(0.0, 0.015, distance(norm, vec3( 0.7,  0.2, -0.68)) - 0.025));
    surface -= 0.35 * (1.0 - smoothstep(0.0, 0.015, distance(norm, vec3(-0.8, -0.4, -0.45)) - 0.025));
    surface -= 0.35 * (1.0 - smoothstep(0.0, 0.015, distance(norm, vec3( 0.2,  0.8, -0.56)) - 0.025));
    // Tiny craters — sides
    surface -= 0.35 * (1.0 - smoothstep(0.0, 0.015, distance(norm, vec3( 0.96, 0.1,  0.26)) - 0.025));
    surface -= 0.35 * (1.0 - smoothstep(0.0, 0.015, distance(norm, vec3(-0.94, 0.2, -0.27)) - 0.025));
    surface -= 0.35 * (1.0 - smoothstep(0.0, 0.015, distance(norm, vec3( 0.92,-0.3,  0.25)) - 0.025));
    surface -= 0.35 * (1.0 - smoothstep(0.0, 0.015, distance(norm, vec3(-0.91,-0.4, -0.10)) - 0.025));

    // Micro craters — scattered everywhere
    surface -= 0.3 * (1.0 - smoothstep(0.0, 0.01, distance(norm, vec3( 0.1,  0.3,  0.95)) - 0.02));
    surface -= 0.3 * (1.0 - smoothstep(0.0, 0.01, distance(norm, vec3(-0.1, -0.1,  0.99)) - 0.02));
    surface -= 0.3 * (1.0 - smoothstep(0.0, 0.01, distance(norm, vec3( 0.9,  0.1,  0.42)) - 0.02));
    surface -= 0.3 * (1.0 - smoothstep(0.0, 0.01, distance(norm, vec3(-0.9,  0.3,  0.31)) - 0.02));
    surface -= 0.3 * (1.0 - smoothstep(0.0, 0.01, distance(norm, vec3( 0.2,  0.9,  0.38)) - 0.02));
    surface -= 0.3 * (1.0 - smoothstep(0.0, 0.01, distance(norm, vec3(-0.3,  0.9,  0.31)) - 0.02));
    surface -= 0.3 * (1.0 - smoothstep(0.0, 0.01, distance(norm, vec3( 0.1, -0.2, -0.97)) - 0.02));
    surface -= 0.3 * (1.0 - smoothstep(0.0, 0.01, distance(norm, vec3(-0.3,  0.1, -0.95)) - 0.02));
    surface -= 0.3 * (1.0 - smoothstep(0.0, 0.01, distance(norm, vec3( 0.6, -0.3, -0.74)) - 0.02));
    surface -= 0.3 * (1.0 - smoothstep(0.0, 0.01, distance(norm, vec3(-0.7,  0.6, -0.38)) - 0.02));
    surface -= 0.3 * (1.0 - smoothstep(0.0, 0.01, distance(norm, vec3( 0.4,  0.5, -0.76)) - 0.02));
    surface -= 0.3 * (1.0 - smoothstep(0.0, 0.01, distance(norm, vec3(-0.5, -0.7, -0.51)) - 0.02));
    surface -= 0.25 * (1.0 - smoothstep(0.0, 0.01, distance(norm, vec3( 0.6, -0.7,  0.38)) - 0.018));
    surface -= 0.25 * (1.0 - smoothstep(0.0, 0.01, distance(norm, vec3(-0.5,  0.5,  0.71)) - 0.018));
    surface -= 0.25 * (1.0 - smoothstep(0.0, 0.01, distance(norm, vec3( 0.4, -0.8,  0.45)) - 0.015));
    surface -= 0.25 * (1.0 - smoothstep(0.0, 0.01, distance(norm, vec3(-0.8,  0.5,  0.33)) - 0.015));
    surface -= 0.25 * (1.0 - smoothstep(0.0, 0.01, distance(norm, vec3( 0.8, -0.5, -0.33)) - 0.018));
    surface -= 0.25 * (1.0 - smoothstep(0.0, 0.01, distance(norm, vec3(-0.4,  0.8, -0.45)) - 0.015));
    surface -= 0.25 * (1.0 - smoothstep(0.0, 0.01, distance(norm, vec3( 0.3, -0.6, -0.74)) - 0.015));
    surface -= 0.25 * (1.0 - smoothstep(0.0, 0.01, distance(norm, vec3(-0.2,  0.5, -0.84)) - 0.015));

    surface = max(surface, 0.03);
    surface *= smoothstep(-0.3, 0.0, rz);

    vOpacity = uSpreadProgress * surface;
  }
  else if (particleType < 2.5) {
    // === FIGURE LEFT ===
    finalPos = targetPosition;

    if (uFormProgress > 0.95) {
      float shimmer = snoise(vec3(phase * 10.0, uTime * 2.0, 0.0));
      finalPos.x += shimmer * 0.005;
      finalPos.y += snoise(vec3(phase * 10.0 + 50.0, uTime * 2.0, 0.0)) * 0.005;
    }

    vOpacity = uSpreadProgress * 0.9;
  }
  else {
    // === FIGURE RIGHT ===
    finalPos = targetPosition;

    if (uFormProgress > 0.95) {
      float shimmer = snoise(vec3(phase * 10.0, uTime * 2.0, 0.0));
      finalPos.x += shimmer * 0.005;
      finalPos.y += snoise(vec3(phase * 10.0 + 50.0, uTime * 2.0, 0.0)) * 0.005;
    }

    vOpacity = uSpreadProgress * 0.9;
  }

  // All particles spread from bottom-right origin to final position
  // Per-particle stagger for fluid feel
  float stagger = phase * 0.003;
  float spread = clamp((uSpreadProgress - stagger) / (1.0 - stagger), 0.0, 1.0);
  vec3 startPos = ORIGIN + vec3(phase * 0.5 - 25.0, phase * 0.3 - 15.0, 0.0);
  vec3 pos = mix(startPos, finalPos, spread);

  // Swirl: add a spiral displacement that peaks mid-transition and fades at endpoints
  float swirlStrength = spread * (1.0 - spread) * 4.0; // peaks at spread=0.5
  float angle = spread * 3.14159 * 2.0 + phase * 6.0;  // full rotation + per-particle offset
  float swirlRadius = swirlStrength * 3.0;
  pos.x += cos(angle) * swirlRadius;
  pos.y += sin(angle) * swirlRadius * 0.7;

  vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);

  // Mouse scatter in screen space so it works at all depths
  vec4 mouseClip = projectionMatrix * viewMatrix * vec4(uMouseWorld, 1.0);
  vec2 mouseScreen = mouseClip.xy / mouseClip.w;
  vec4 posClip = projectionMatrix * mvPosition;
  vec2 posScreen = posClip.xy / posClip.w;
  float screenDist = distance(posScreen, mouseScreen);
  float scatterRadius = 0.75;
  if (screenDist < scatterRadius) {
    vec2 away = normalize(posScreen - mouseScreen);
    float strength = 1.0 - smoothstep(0.0, scatterRadius, screenDist);
    strength *= strength; // sharper falloff
    // Chaotic offset using noise seeded by particle phase and time
    float noiseAngle = snoise(vec3(phase * 5.0, uTime * 3.0, screenDist * 2.0)) * 6.28;
    float noiseMag = 1.0 + snoise(vec3(phase * 8.0, uTime * 2.0, 0.0)) * 0.7;
    vec2 chaotic = away * noiseMag + vec2(cos(noiseAngle), sin(noiseAngle)) * 0.5;
    float depthScale = -mvPosition.z * 0.005;
    pos.x += chaotic.x * strength * depthScale;
    pos.y += chaotic.y * strength * depthScale;
    mvPosition = modelViewMatrix * vec4(pos, 1.0);
  }

  // Size attenuation by depth, clamped to avoid huge near-camera dots
  float baseSize = particleType < 0.5 ? 0.5 : 0.8;
  gl_PointSize = min(baseSize * (200.0 / -mvPosition.z), 3.0);

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
  const continuousTime = useRef(0);
  const smoothMouse = useRef(new THREE.Vector3(100, 100, 100));
  const { camera, mouse } = useThree();

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
      0, // no rim bias — uniform distribution for full sphere
      MOON_X,
      0, // Y=0, shader applies uMoonRiseY offset
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
    const figure1 = generateFigure(FIG1_X, FIG_Y, FIG_SCALE, false, 42);
    const figure2 = generateFigure(FIG2_X, FIG_Y, FIG_SCALE, true, 137);

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
          uMoonRotation: { value: 0 },
          uSpreadProgress: { value: 0 },
          uMoonCenter: { value: new THREE.Vector3(MOON_X, 0, MOON_Z) },
          uMouseWorld: { value: new THREE.Vector3(100, 100, 100) },
        },
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    [],
  );

  useFrame((_, delta) => {
    if (!materialRef.current) return;
    const t = timeline.elapsed;
    continuousTime.current += delta;
    const mat = materialRef.current;

    // uTime always increments so flow field never stops
    mat.uniforms.uTime.value = continuousTime.current;

    // Mouse -> world space (intersect z=0 plane)
    const mouseNDC = new THREE.Vector3(mouse.x, mouse.y, 0.5);
    mouseNDC.unproject(camera);
    const dir = mouseNDC.sub(camera.position).normalize();
    const t_hit = -camera.position.z / dir.z;
    const target = camera.position.clone().add(dir.clone().multiplyScalar(t_hit));
    smoothMouse.current.lerp(target, 0.15);
    mat.uniforms.uMouseWorld.value.copy(smoothMouse.current);

    // Field fade in (0-1s)
    mat.uniforms.uFieldFade.value = Math.min(1, t / 1.0);

    // Stars/moon spread faster (0-3s), figures use their own formProgress (0-4s)
    mat.uniforms.uSpreadProgress.value = easeOut(
      progress(t, PHASES.MOON_START, PHASES.MOON_END),
    );

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

    // Clockwise rotation (negative direction)
    mat.uniforms.uMoonRotation.value = -continuousTime.current * 0.08;

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
