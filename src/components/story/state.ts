import * as THREE from "three";
import { chapters, CHAPTER_COUNT, MOON_TARGET, type Palette, type Pose, type ArmPose } from "./chapters";

// Mutable, frame-shared story state (kept outside React to avoid re-renders).
export const story = {
  target: 0, // chapter position requested by scroll (float)
  t: 0, // smoothed chapter position (float)
  time: 0,
  seeking: false,
  pointer: new THREE.Vector2(),
};

/** Where the moon actually is this frame (updated by <Moon />). */
export const moonWorld = new THREE.Vector3(...MOON_TARGET);

export const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
export const smooth = (t: number) => t * t * (3 - 2 * t);
export const smoother = (t: number) => t * t * t * (t * (t * 6 - 15) + 10);

/** How "present" chapter `i` is at story position t (1 at the chapter, 0 when ±span away). */
export function presence(t: number, i: number, span = 0.5) {
  return clamp(1 - Math.abs(t - i) / span);
}

/** Splits t into a segment with an eased fraction that dwells on keyframes. */
export function segment(t: number) {
  const tt = clamp(t, 0, CHAPTER_COUNT - 1);
  const i = Math.min(Math.floor(tt), CHAPTER_COUNT - 2);
  const f = smooth(clamp(tt - i));
  return { i, f };
}

// ── Palette blending ────────────────────────────────────────────────────────
export interface LivePalette {
  zenith: THREE.Color;
  mid: THREE.Color;
  horizon: THREE.Color;
  cloud: THREE.Color;
  cloudShadow: THREE.Color;
  key: THREE.Color;
  ambient: THREE.Color;
  grassTip: THREE.Color;
  grassBase: THREE.Color;
  sun: number;
  stars: number;
  keyIntensity: number;
  ambientIntensity: number;
  moonGlow: number;
  moonElevation: number;
  spirits: number;
}

const colorKeys = [
  "zenith",
  "mid",
  "horizon",
  "cloud",
  "cloudShadow",
  "key",
  "ambient",
  "grassTip",
  "grassBase",
] as const;
const numKeys = [
  "sun",
  "stars",
  "keyIntensity",
  "ambientIntensity",
  "moonGlow",
  "moonElevation",
  "spirits",
] as const;

const parsed = chapters.map((c) => {
  const out: Record<string, THREE.Color | number> = {};
  for (const k of colorKeys) out[k] = new THREE.Color(c.palette[k]);
  for (const k of numKeys) out[k] = c.palette[k];
  return out;
});

export const live: LivePalette = {
  zenith: new THREE.Color(),
  mid: new THREE.Color(),
  horizon: new THREE.Color(),
  cloud: new THREE.Color(),
  cloudShadow: new THREE.Color(),
  key: new THREE.Color(),
  ambient: new THREE.Color(),
  grassTip: new THREE.Color(),
  grassBase: new THREE.Color(),
  sun: 0,
  stars: 0,
  keyIntensity: 0,
  ambientIntensity: 0,
  moonGlow: 0,
  moonElevation: 0,
  spirits: 0,
};

/** Updates `live` for the current story position. Call once per frame. */
export function updatePalette(t: number) {
  const tt = clamp(t, 0, CHAPTER_COUNT - 1);
  const i = Math.min(Math.floor(tt), CHAPTER_COUNT - 2);
  const f = smooth(clamp(tt - i));
  const a = parsed[i];
  const b = parsed[i + 1];
  for (const k of colorKeys) {
    (live[k] as THREE.Color).copy(a[k] as THREE.Color).lerp(b[k] as THREE.Color, f);
  }
  for (const k of numKeys) {
    (live as unknown as Record<string, number>)[k] =
      (a[k] as number) * (1 - f) + (b[k] as number) * f;
  }
}

export type { Palette };

// ── Pose sampling ───────────────────────────────────────────────────────────
export interface SampledPose {
  x: number;
  z: number;
  rot: number;
  speed: number; // 0..1 how much they're walking
  visible: boolean;
  armR: Record<ArmPose, number>;
  armL: Record<ArmPose, number>;
  target: THREE.Vector3;
}

const emptyArm = (): Record<ArmPose, number> => ({ rest: 0, point: 0, up: 0, wave: 0, phone: 0 });

function lerpAngle(a: number, b: number, f: number) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * f;
}

/** Samples a pose track at time t; fills `out`. Poses inherit unspecified fields. */
export function samplePose(track: Pose[], t: number, out: SampledPose) {
  // Arms default to "rest" on every keyframe; `visible` and `target` inherit.
  let k = 0;
  while (k < track.length - 1 && track[k + 1].at <= t) k++;
  const a = track[k];
  const b = track[Math.min(k + 1, track.length - 1)];
  const span = Math.max(1e-4, b.at - a.at);
  const raw = a === b ? 0 : clamp((t - a.at) / span);
  const f = smoother(raw);

  const resolved = (idx: number) => {
    let visible = true;
    let target = track[0].target;
    for (let j = 0; j <= idx; j++) {
      const p = track[j];
      if (p.visible !== undefined) visible = p.visible;
      if (p.target) target = p.target;
    }
    const armR: ArmPose = track[idx].armR ?? "rest";
    const armL: ArmPose = track[idx].armL ?? "rest";
    return { armR, armL, visible, target };
  };
  const ra = resolved(k);
  const rb = resolved(Math.min(k + 1, track.length - 1));

  out.x = a.x + (b.x - a.x) * f;
  out.z = a.z + (b.z - a.z) * f;
  out.rot = lerpAngle(a.rot, b.rot, f);
  const dist = Math.hypot(b.x - a.x, b.z - a.z);
  // walking speed peaks mid-transition
  out.speed = dist > 0.3 ? Math.sin(raw * Math.PI) * clamp(dist / 2) : 0;
  out.visible = raw < 0.5 ? ra.visible : rb.visible;

  out.armR = out.armR ?? emptyArm();
  out.armL = out.armL ?? emptyArm();
  for (const key of Object.keys(out.armR) as ArmPose[]) {
    out.armR[key] = (ra.armR === key ? 1 - f : 0) + (rb.armR === key ? f : 0);
    out.armL[key] = (ra.armL === key ? 1 - f : 0) + (rb.armL === key ? f : 0);
  }
  const tg = (f < 0.5 ? ra.target : rb.target) ?? MOON_TARGET;
  if (tg === MOON_TARGET) out.target.copy(moonWorld);
  else out.target.set(tg[0], tg[1], tg[2]);
}

export function makeSampledPose(): SampledPose {
  return {
    x: 0,
    z: 0,
    rot: 0,
    speed: 0,
    visible: true,
    armR: emptyArm(),
    armL: emptyArm(),
    target: new THREE.Vector3(),
  };
}
