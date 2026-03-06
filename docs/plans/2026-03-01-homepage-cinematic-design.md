# Homepage Cinematic Redesign

## Overview

Replace the current marketing-style homepage with an immersive Three.js cinematic intro. Two particle-constructed figures stand on a dark horizon beneath a vast starfield. A moon rises, one figure points at it, and particle text forms "Moon, I win!" near them — then transitions into the centered logo with navigation.

## Scene Composition

- Full-viewport Three.js canvas (`100vw x 100dvh`)
- Deep black background (#030712)
- Cool moonlight palette: silvery-white moon (#e8e4df), blue-tinted particles (#c0d0e0), white stars
- Foreground perspective — two figures seen from slightly behind, small against a vast sky
- No HTML overlays during animation sequence

## Animation Sequence (~7 seconds)

| Phase | Time | Description |
|-------|------|-------------|
| Stars appear | 0–1s | Dark horizon fades in. Stars populate the sky with subtle twinkle. Faint horizon line divides sky/earth. |
| Figures form | 1–3s | Particle clusters swarm from scattered positions, settling into two human silhouettes in the lower-center of frame. |
| Moon rises | 3–5s | Silvery-white moon sphere rises from the horizon with glow + bloom. As it clears the horizon, one figure's arm raises to point. |
| Declaration | 5–6s | Small particle text forms near the pointing figure: "Moon, I win!" — constellation-like whisper. |
| Logo transition | 6–7s | Particle text floats to center-screen, becoming the full logo. Nav links fade in below. |
| Rest state | 7s+ | Scene holds. Moon drifts, stars twinkle, particles shimmer subtly. |

## Rest State

- "Moon, I win!" logo center-screen, formed from settled particles
- Nav links below logo in horizontal row: Rules, Play, Declare Win, Challenge
- Links fade in with soft opacity animation, cool silver/white palette
- Replay button (circular arrow) bottom-right, subtle at ~40% opacity, brightens on hover
- Mouse parallax on entire scene (subtle camera movement following cursor)
- Particle figures hold form with micro-drift shimmer

## Responsive Design

### Portrait (mobile)
- Camera FOV widens so full scene remains visible
- Figures sit lower (~bottom 20%), slightly larger relative to viewport
- Moon rises higher into available vertical space
- Logo and nav stack vertically in rest state
- Particle count reduced to ~60-70% of desktop for GPU performance
- Replay button moves to bottom-center

### Landscape (desktop/tablet)
- Cinematic wide-angle composition
- Nav links stay horizontal
- Full particle count

### Performance guardrails
- Cap device pixel ratio at 2x
- AdaptiveDpr from drei for auto-downscale on frame drops
- Reduced bloom quality on mobile (fewer mip levels)
- GPU-friendly buffer attribute updates for all particle animations

## Color Palette

| Element | Color | Notes |
|---------|-------|-------|
| Background | #030712 | Deep space black |
| Moon | #e8e4df | Silvery white, emissive |
| Particles (figures) | #c0d0e0 | Cool silver-blue |
| Particles (text) | #c0d0e0 | Same as figures |
| Stars | #ffffff | Slight blue tint on some |
| Nav text | #e2e8f0 | Soft white |
| Replay button | #94a3b8 | Slate, 40% opacity default |

## Technical Approach

- **Particle figures:** Three.js `Points` with `BufferGeometry`. Pre-defined target positions for each silhouette pose. Animated from random scatter to targets using lerp in `useFrame`.
- **Moon:** `Mesh` sphere with `MeshStandardMaterial` (emissive) + bloom post-processing
- **Stars:** `@react-three/drei` Stars component
- **Text particles:** Map "Moon, I win!" glyph outlines to particle target positions. Same particle system morphs from speech position to logo position.
- **Animation timeline:** Elapsed-time state machine in `useFrame` loop
- **Post-processing:** Bloom (intensity ~0.8, threshold ~0.6) + Vignette
- **Camera:** Mouse-following parallax, FOV responsive to aspect ratio

## Footer (deferred)

- Page extends beyond 100dvh by footer height
- On scroll past canvas, 3D scene fades and minimal footer scrolls into view
- Single row of horizontal text links, centered, fade-in animation
- Will implement after cinematic scene is finalized

## Out of Scope

- Changes to other pages (play, rules, win, challenge)
- Sound/audio
- Footer implementation (deferred)
