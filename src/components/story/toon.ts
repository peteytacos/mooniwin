import * as THREE from "three";

// Three-step cel ramp: deep shadow, mid, lit. Nearest filtering = hard bands.
let ramp: THREE.DataTexture | null = null;
export function toonRamp() {
  if (ramp) return ramp;
  const data = new Uint8Array([70, 70, 70, 255, 160, 160, 160, 255, 255, 255, 255, 255]);
  ramp = new THREE.DataTexture(data, 3, 1, THREE.RGBAFormat);
  ramp.minFilter = THREE.NearestFilter;
  ramp.magFilter = THREE.NearestFilter;
  ramp.generateMipmaps = false;
  ramp.needsUpdate = true;
  return ramp;
}

// Physically based surfaces. `toon()` kept as the name for history; it now
// returns a shared PBR material. Fabric gets sheen, skin a soft clearcoat.
const cache = new Map<string, THREE.MeshStandardMaterial>();
export function toon(color: string, kind: "cloth" | "skin" | "wood" | "stone" | "paint" | "metal" = "cloth") {
  const key = color + kind;
  let m = cache.get(key);
  if (!m) {
    if (kind === "cloth") {
      m = new THREE.MeshPhysicalMaterial({ color, roughness: 0.92, sheen: 1, sheenRoughness: 0.6, sheenColor: new THREE.Color(color).lerp(new THREE.Color("#ffffff"), 0.4) });
    } else if (kind === "skin") {
      m = new THREE.MeshPhysicalMaterial({ color, roughness: 0.55, clearcoat: 0.15, clearcoatRoughness: 0.6, sheen: 0.4, sheenColor: new THREE.Color("#ffb59a") });
    } else if (kind === "metal") {
      m = new THREE.MeshStandardMaterial({ color, roughness: 0.4, metalness: 0.85 });
    } else if (kind === "paint") {
      m = new THREE.MeshStandardMaterial({ color, roughness: 0.6 });
    } else {
      m = new THREE.MeshStandardMaterial({ color, roughness: kind === "stone" ? 0.95 : 0.85 });
    }
    cache.set(key, m);
  }
  return m;
}

export const INK = "#1b1226";

// Deterministic PRNG so the world is identical on every load.
export function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Terrain height. Meadow (|x|<12, |z|<9) stays flat so characters stand on y=0.
export const HILL = { x: 15, z: -24, r: 11, h: 4.2 };
export function groundHeight(x: number, z: number) {
  const d = Math.hypot(x - HILL.x, z - HILL.z) / HILL.r;
  const hill = d < 1 ? HILL.h * (0.5 + 0.5 * Math.cos(Math.PI * d)) : 0;
  const meadow = Math.max(Math.abs(x) / 12, Math.abs(z) / 9);
  const roll = THREE.MathUtils.smoothstep(meadow, 1, 2.2);
  const undulate =
    (Math.sin(x * 0.11) * Math.cos(z * 0.09) * 1.6 + Math.sin(x * 0.05 + z * 0.07) * 1.2) * roll;
  return hill + undulate;
}
