# Homepage Dots Redesign

**Date:** 2026-03-06
**Status:** Design approved

## Summary

Redesign the homepage to be all-black with white animated dots. Replace the solid moon mesh with a stippled dot sphere outline. Replace the static starfield with a flowing dot field. Remove the particle text logo. Lock navigation to a max-width container with "Moon I Win" text left, links right.

## Core Concept

A unified particle system (~15,000 dots) handles everything: background flow field, moon outline, and figure silhouettes. Single `Points` mesh with a custom shader material. All dots animate — nothing is static.

## Unified Particle System

### Architecture

Single `Points` mesh with custom `ShaderMaterial`. Each particle has buffer attributes:

- `position` (vec3) — current XYZ
- `targetPosition` (vec3) — destination
- `particleType` (float) — 0=field, 1=moon, 2=figureL, 3=figureR
- `speed` (float) — individual flow speed multiplier
- `phase` (float) — random noise offset

### Particle Budget

- ~12,000 field particles (flowing background)
- ~2,000 moon outline particles (dense stippled sphere)
- ~500 figure particles (both silhouettes)
- Mobile: scaled to ~8,000 total

### Shader

**Vertex shader:**
- Field particles: displaced by 3D simplex noise (`uTime` uniform), toroidal edge wrapping
- Moon/figure particles: lerp toward `targetPosition`, subtle noise drift once arrived
- Size attenuation by Z depth

**Fragment shader:**
- Circle point with soft edge falloff (smooth dot shape)
- White color, varying opacity

## Moon — Stippled Sphere Outline

Replace solid sphere mesh with ~2,000 dots sampled on sphere surface. Higher density at edges (where `abs(dot(normal, cameraDir)) < threshold`) — concentrates dots at the visible rim. Small percentage of interior points for texture.

**Animation:** During MOON_START→MOON_END, field particles transition type to `moon` and lerp to moon target positions. Moon rises from below. Post-formation: subtle breathing drift via noise. Bloom post-processing makes the cluster glow naturally.

## Flowing Dot Field

Replace drei `Stars` with 12,000 flowing particles. 3D simplex noise sampled per particle per frame in vertex shader. Time-varying (`uTime`) for smooth organic currents. Toroidal wrapping at viewport edges. Particles distributed Z range -20 to 5 with size attenuation.

## Figures

Same silhouette generation as existing `figureData.ts`. Same pose transitions (scatter → standing → pointing). Particles assigned types 2/3 and converge from the field during FIGURES_START. Subtle shimmer drift after formation.

## Navigation

Fixed top, max-width container:
- Mobile: full-width with padding
- sm: 640px
- md: 768px
- lg: 1024px
- xl: 1280px

"Moon I Win" text left, nav links (Rules, Play, Declare Win, Challenge) right. White on transparent. Fade-in at NAV_START.

## Timeline

| Phase | Time | Event |
|-------|------|-------|
| FIELD_START | 0s | Flowing dot field fades in |
| FIGURES_START | 1s | Field dots converge into silhouettes |
| FIGURES_END | 3s | Silhouettes formed |
| MOON_START | 3s | Field dots converge into moon outline, rising |
| MOON_END | 5s | Moon formed |
| ARM_START | 4s | Pointing arm raises |
| ARM_END | 5s | Arm complete |
| NAV_START | 5.5s | Nav fades in |
| DONE | 6.5s | Animation complete, field continues flowing |

## Color & Style

- Background: `#000000` (true black)
- All dots: `#ffffff` (white), varying opacity
- Nav text: white
- Post-processing: bloom (subtle dot cluster glow), light vignette

## Removed Elements

- `ParticleText.tsx` — logo particle text
- `RisingMoon.tsx` — solid sphere mesh
- drei `Stars` — static starfield
- Glow mesh around moon
