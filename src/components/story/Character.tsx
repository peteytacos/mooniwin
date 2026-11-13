"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { toon, rng } from "./toon";
import { denim, canvasCloth, knit } from "./textures";
import { story, samplePose, makeSampledPose, clamp, type SampledPose } from "./state";
import type { Pose, ArmPose } from "./chapters";

export interface Look {
  coat: string;
  coatTrim: string;
  trousers: string;
  skin: string;
  hair: string;
  scarf: string;
  hat?: "beanie" | "bun" | "hood";
  iris?: string;
  hatColor?: string;
  robe?: boolean; // long robe down to the ground (ancients)
  child?: boolean; // a kid: soft features, no stubble, bigger head for their size
  staff?: boolean;
  scale?: number;
}


const DIRS: Record<Exclude<ArmPose, "point">, (side: number, time: number) => THREE.Vector3> = {
  rest: (s) => new THREE.Vector3(s * 0.22, -1, 0.06),
  up: (s) => new THREE.Vector3(s * 0.5, 1, 0.12),
  wave: (s, t) => new THREE.Vector3(s * (0.75 + 0.3 * Math.sin(t * 9)), 0.85, 0.2),
  phone: (s) => new THREE.Vector3(s * 0.15, -0.2, 1),
};

const Z = new THREE.Vector3(0, 0, 1);
const tmpV = new THREE.Vector3();
const tmpDir = new THREE.Vector3();

// Real fabric: woven maps tinted by the outfit colour.
const fabricCache = new Map<string, THREE.MeshPhysicalMaterial>();
function fabric(color: string, kind: "denim" | "canvas" | "knit", rx = 3, ry = 3) {
  const key = color + kind;
  let m = fabricCache.get(key);
  if (!m) {
    const src = kind === "denim" ? denim() : kind === "knit" ? knit() : canvasCloth();
    const map = src.map.clone();
    const bump = src.bump.clone();
    map.repeat.set(rx, ry);
    bump.repeat.set(rx, ry);
    map.needsUpdate = bump.needsUpdate = true;
    m = new THREE.MeshPhysicalMaterial({
      color,
      map,
      bumpMap: bump,
      bumpScale: kind === "knit" ? 2.5 : 1,
      roughness: 0.95,
      sheen: 0.8,
      sheenRoughness: 0.7,
      sheenColor: new THREE.Color(color).lerp(new THREE.Color("#ffffff"), 0.3),
    });
    fabricCache.set(key, m);
  }
  return m;
}

/** Hair with volume: a cap whose surface is lifted into soft clumps. */
function hairGeometry(r: number, coverage: number, seed: number) {
  const g = new THREE.SphereGeometry(r, 40, 24, 0, Math.PI * 2, 0, Math.PI * coverage);
  const p = g.attributes.position as THREE.BufferAttribute;
  const rand = rng(seed);
  const ph = [rand() * 9, rand() * 9, rand() * 9];
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const n = Math.sin(v.x * 90 + ph[0]) * Math.sin(v.y * 70 + ph[1]) * Math.sin(v.z * 80 + ph[2]);
    v.multiplyScalar(1 + 0.06 + n * 0.035);
    p.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals();
  return g;
}

// ── Sculpted head ──────────────────────────────────────────────────────────
// A dense sphere pushed and pulled into a face: skull, jaw, sockets, brow,
// cheekbones, nose, lips, chin. Skin tone, brows and lip colour are baked into
// vertex colours so they sit flush on the skin (no floating stickers).
const g2 = (x: number, y: number, cx: number, cy: number, s: number) =>
  Math.exp(-((x - cx) ** 2 + (y - cy) ** 2) / s);
export const EYE = { x: 0.03, y: 0.014, r: 0.0118 };
type HeadGeo = THREE.BufferGeometry & { userData: { eyeZ: number } };
const headCache = new Map<string, HeadGeo>();
const ax0 = Math.abs;
function headGeometry(skin: string, hair: string, femme: boolean, child = false): HeadGeo {
  const key = skin + hair + femme + child;
  const hit = headCache.get(key);
  if (hit) return hit;
  const g = new THREE.SphereGeometry(0.1, 192, 144) as unknown as HeadGeo;
  const p = g.attributes.position as THREE.BufferAttribute;
  const cols = new Float32Array(p.count * 3);
  const base = new THREE.Color(skin);
  const lip = new THREE.Color(skin).lerp(new THREE.Color(femme ? "#a8505a" : "#9a5a52"), femme ? 0.5 : 0.35);
  const blush = new THREE.Color(skin).lerp(new THREE.Color("#d9776a"), 0.22);
  const shadow = new THREE.Color(skin).multiplyScalar(0.86);
  const brow = new THREE.Color(hair).multiplyScalar(0.55).lerp(new THREE.Color(skin).multiplyScalar(0.5), 0.2);
  const stubble = new THREE.Color(skin).lerp(new THREE.Color(hair), 0.18);
  const c = new THREE.Color();
  const v = new THREE.Vector3();
  const n = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    n.copy(v).normalize();
    let { x, y, z } = v;
    // skull: taller, narrower, fuller at the back
    y *= 1.12;
    x *= 0.87;
    if (z < 0) z *= 1.06;
    // jaw + chin: a gentle taper below the cheekbones (not a wedge)
    if (y < -0.015) {
      const k = Math.min(1, (-y - 0.015) / 0.095);
      const kk = k * k * (3 - 2 * k);
      x *= 1 - kk * (femme || child ? 0.3 : 0.22);
      z = z * (1 - kk * 0.14) + (z > 0 ? kk * 0.004 : 0);
    }
    const front = THREE.MathUtils.smoothstep(n.z, 0.15, 0.6);
    let d = 0;
    // soft eye sockets + brow ridge
    d -= 0.0055 * (g2(x, y, EYE.x, EYE.y, 0.0003) + g2(x, y, -EYE.x, EYE.y, 0.0003));
    d += (femme || child ? 0.002 : 0.0035) * Math.exp(-((y - 0.036) ** 2) / 0.00012) * Math.exp(-(x * x) / 0.0028);
    // cheekbones + soft cheeks
    d += 0.004 * (g2(x, y, 0.046, -0.01, 0.0005) + g2(x, y, -0.046, -0.01, 0.0005));
    // nose: a straight bridge into a rounded tip, with nostril wings
    const bridge = Math.exp(-(x * x) / (femme || child ? 0.00014 : 0.00018));
    const t = THREE.MathUtils.clamp((0.026 - y) / 0.046, 0, 1);
    const below = y < -0.02 ? Math.exp(-((y + 0.02) ** 2) / 0.00003) : 1;
    d += bridge * (0.003 + t * t * (child ? 0.009 : femme ? 0.012 : 0.015)) * below * (1 - THREE.MathUtils.smoothstep(y, 0.018, 0.03));
    d += (femme || child ? 0.0052 : 0.0065) * g2(x, y, 0, -0.016, 0.00007);
    d += 0.0045 * (g2(x, y, 0.012, -0.02, 0.00006) + g2(x, y, -0.012, -0.02, 0.00006));
    // lips + philtrum + mouth line + chin
    const lipW = Math.exp(-(x * x) / 0.0003);
    d += lipW * (0.003 * Math.exp(-((y + 0.041) ** 2) / 0.00002) + 0.005 * Math.exp(-((y + 0.051) ** 2) / 0.000025));
    d -= lipW * 0.0022 * Math.exp(-((y + 0.0465) ** 2) / 0.000003);
    d += 0.005 * g2(x, y, 0, -0.08, 0.0004);
    d -= 0.0015 * g2(x, y, 0, -0.064, 0.00008);
    v.set(x, y, z).addScaledVector(n, d * front);
    p.setXYZ(i, v.x, v.y, v.z);

    // skin tone: rosier cheeks + lips, slightly deeper around the sockets
    c.copy(base);
    const cheek = front * (g2(x, y, 0.045, -0.025, 0.0006) + g2(x, y, -0.045, -0.025, 0.0006));
    c.lerp(blush, Math.min(1, cheek));
    if (!femme && !child) {
      // faint shadow of stubble along the jaw and upper lip
      const jaw = front * THREE.MathUtils.smoothstep(-y, 0.035, 0.06) * (1 - Math.exp(-((y + 0.046) ** 2) / 0.00006) * lipW);
      c.lerp(stubble, Math.min(1, jaw));
    }
    // lips: crisp shapes with a cupid's bow, a darker parting line
    const ss = THREE.MathUtils.smoothstep;
    const bow = 0.0012 * Math.exp(-((ax0(x) - 0.006) ** 2) / 0.00002);
    const upperLip = (1 - ss(Math.abs(x), 0.016, 0.022)) * ss(y, -0.0468, -0.0462) * (1 - ss(y, -0.0395 + bow, -0.0385 + bow));
    const lowerLip = (1 - ss(Math.abs(x), 0.013, 0.019)) * ss(y, -0.0565, -0.0545) * (1 - ss(y, -0.0472, -0.0466));
    c.lerp(lip, Math.min(1, front * Math.max(upperLip, lowerLip * 0.9) * 1.3));
    c.lerp(shadow.clone().multiplyScalar(0.62), front * (1 - ss(Math.abs(x), 0.017, 0.023)) * Math.exp(-((y + 0.0466) ** 2) / 0.0000016) * 0.9);
    const sock = front * (g2(x, y, EYE.x, EYE.y + 0.004, 0.00025) + g2(x, y, -EYE.x, EYE.y + 0.004, 0.00025));
    c.lerp(shadow, Math.min(0.4, sock));
    // eyebrows: arched, thicker toward the nose, tapering outward
    const ax = ax0(x);
    if (ax > 0.008 && ax < 0.054) {
      const u = (ax - 0.008) / 0.046;
      const archY = 0.029 + Math.sin(u * Math.PI * 0.85) * 0.005 - u * 0.002;
      const half = (femme || child ? 0.0032 : 0.0046) * (1 - u * 0.5);
      const m = 1 - THREE.MathUtils.smoothstep(Math.abs(y - archY), half * 0.5, half * 1.25);
      const edge = THREE.MathUtils.smoothstep(u, 0, 0.12) * (1 - THREE.MathUtils.smoothstep(u, 0.85, 1));
      c.lerp(brow, Math.min(1, front * m * edge * 1.1));
    }
    cols[i * 3] = c.r;
    cols[i * 3 + 1] = c.g;
    cols[i * 3 + 2] = c.b;
  }
  g.setAttribute("color", new THREE.BufferAttribute(cols, 3));
  g.computeVertexNormals();
  // where the skin sits at the eye, so the eyeball can be seated in the socket
  const probe = new THREE.Mesh(g);
  const ray = new THREE.Raycaster(new THREE.Vector3(EYE.x, EYE.y, 1), new THREE.Vector3(0, 0, -1));
  g.userData.eyeZ = ray.intersectObject(probe)[0]?.point.z ?? 0.085;
  headCache.set(key, g);
  return g;
}
const headSkin = new THREE.MeshPhysicalMaterial({
  vertexColors: true,
  roughness: 0.55,
  clearcoat: 0.08,
  clearcoatRoughness: 0.6,
  sheen: 0.45,
  sheenRoughness: 0.5,
  sheenColor: new THREE.Color("#ffb4a0"),
});

// Eyeball texture in sphere-UV space: the iris sits at u=0.25 (facing +Z).
const eyeCache = new Map<string, THREE.MeshPhysicalMaterial>();
function eyeMaterial(iris: string) {
  const hit = eyeCache.get(iris);
  if (hit) return hit;
  const W = 512;
  const H = 256;
  const cv = document.createElement("canvas");
  cv.width = W;
  cv.height = H;
  const ctx = cv.getContext("2d")!;
  ctx.fillStyle = "#e6ddd3";
  ctx.fillRect(0, 0, W, H);
  // warmer, slightly pink toward the corners
  const cx = W * 0.25;
  const cy = H * 0.5;
  const sc = ctx.createRadialGradient(cx, cy, 20, cx, cy, 130);
  sc.addColorStop(0, "rgba(0,0,0,0)");
  sc.addColorStop(1, "rgba(190,120,110,0.45)");
  ctx.fillStyle = sc;
  ctx.fillRect(0, 0, W, H);
  const R = 36; // ≈ 25° iris
  const col = new THREE.Color(iris);
  const hex = (k: number) => "#" + col.clone().multiplyScalar(k).getHexString();
  const ig = ctx.createRadialGradient(cx, cy, 4, cx, cy, R);
  ig.addColorStop(0, hex(1.6));
  ig.addColorStop(0.55, hex(1.1));
  ig.addColorStop(0.88, hex(0.7));
  ig.addColorStop(1, hex(0.25));
  ctx.fillStyle = ig;
  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, Math.PI * 2);
  ctx.fill();
  // iris fibres
  const r = rng(iris.length * 31 + 7);
  ctx.lineWidth = 1;
  for (let k = 0; k < 140; k++) {
    const a = r() * Math.PI * 2;
    ctx.strokeStyle = r() > 0.5 ? `rgba(255,240,210,${0.08 + r() * 0.12})` : `rgba(0,0,0,${0.1 + r() * 0.15})`;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * 11, cy + Math.sin(a) * 11);
    ctx.lineTo(cx + Math.cos(a) * (R - 3), cy + Math.sin(a) * (R - 3));
    ctx.stroke();
  }
  ctx.fillStyle = "#070605";
  ctx.beginPath();
  ctx.arc(cx, cy, 12, 0, Math.PI * 2);
  ctx.fill();
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  const m = new THREE.MeshPhysicalMaterial({ map: tex, roughness: 0.25, clearcoat: 1, clearcoatRoughness: 0.03 });
  eyeCache.set(iris, m);
  return m;
}
const lashMat = new THREE.MeshStandardMaterial({ color: "#1a120d", roughness: 0.8 });
const EYE_GEO = new THREE.SphereGeometry(EYE.r, 40, 28);
// lids: shells slightly larger than the eyeball, leaving an almond opening
const LID_R = EYE.r * 1.07;
const UP = 0.5; // upper lid edge, radians above the eye's centre
const LO = 0.52; // lower lid edge, radians below
const LID_UP = new THREE.SphereGeometry(LID_R, 32, 12, 0, Math.PI * 2, 0, Math.PI / 2 - UP);
const LID_LO = new THREE.SphereGeometry(LID_R, 32, 8, 0, Math.PI * 2, Math.PI / 2 + LO, Math.PI / 2 - LO);
const LASH_UP = new THREE.TorusGeometry(LID_R * Math.cos(UP), 0.0006, 6, 40);
const LASH_LO = new THREE.TorusGeometry(LID_R * Math.cos(LO), 0.00035, 5, 40);

function Eye({ side, iris, skin, z }: { side: 1 | -1; iris: string; skin: string; z: number }) {
  const lid = toon(skin, "skin");
  return (
    // seated so ~half the eyeball shows through the socket; a slight outward gaze
    <group position={[side * EYE.x, EYE.y, z - EYE.r * 0.5]} rotation={[0, side * 0.06, 0]}>
      <mesh geometry={EYE_GEO} material={eyeMaterial(iris)} rotation={[0, -side * 0.06, 0]} />
      <group rotation={[0.03, 0, side * -0.05]}>
        <mesh geometry={LID_UP} material={lid} />
        <mesh geometry={LASH_UP} material={lashMat} position={[0, LID_R * Math.sin(UP), 0]} rotation={[Math.PI / 2, 0, 0]} />
        <mesh geometry={LID_LO} material={lid} />
        <mesh geometry={LASH_LO} material={lashMat} position={[0, -LID_R * Math.sin(LO), 0]} rotation={[Math.PI / 2, 0, 0]} />
      </group>
    </group>
  );
}

// ── Phone: white body, screen showing a message with a moon photo ─────────
const phoneBody = new THREE.MeshPhysicalMaterial({ color: "#f4f3ef", roughness: 0.35, clearcoat: 0.8, clearcoatRoughness: 0.2 });
let screenMat: THREE.MeshBasicMaterial | null = null;
function phoneScreen() {
  if (screenMat) return screenMat;
  const W = 256;
  const H = 540;
  const cv = document.createElement("canvas");
  cv.width = W;
  cv.height = H;
  const c = cv.getContext("2d")!;
  c.fillStyle = "#f7f7f9";
  c.fillRect(0, 0, W, H);
  // header
  c.fillStyle = "#e9e9ee";
  c.fillRect(0, 0, W, 70);
  c.fillStyle = "#c9a26a";
  c.beginPath();
  c.arc(W / 2, 30, 16, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = "#222";
  c.font = "600 15px sans-serif";
  c.textAlign = "center";
  c.fillText("Otto", W / 2, 62);
  // photo bubble: night sky with the moon
  const px = 70, py = 120, pw = 170, ph = 200;
  const sky = c.createLinearGradient(0, py, 0, py + ph);
  sky.addColorStop(0, "#0d1730");
  sky.addColorStop(1, "#2a3a62");
  c.save();
  c.beginPath();
  c.roundRect(px, py, pw, ph, 18);
  c.clip();
  c.fillStyle = sky;
  c.fillRect(px, py, pw, ph);
  const glow = c.createRadialGradient(px + 105, py + 70, 10, px + 105, py + 70, 70);
  glow.addColorStop(0, "rgba(255,250,230,0.55)");
  glow.addColorStop(1, "rgba(255,250,230,0)");
  c.fillStyle = glow;
  c.fillRect(px, py, pw, ph);
  c.fillStyle = "#fbf6e6";
  c.beginPath();
  c.arc(px + 105, py + 70, 26, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = "rgba(150,140,120,0.35)";
  for (const [dx, dy, r] of [[-8, -6, 6], [7, 8, 5], [10, -10, 3.5]]) {
    c.beginPath();
    c.arc(px + 105 + dx, py + 70 + dy, r, 0, Math.PI * 2);
    c.fill();
  }
  c.fillStyle = "#0b0f1c";
  c.fillRect(px, py + ph - 40, pw, 40);
  c.restore();
  // message bubble
  c.fillStyle = "#2f7cf6";
  c.beginPath();
  c.roundRect(96, 340, 144, 46, 22);
  c.fill();
  c.fillStyle = "#fff";
  c.font = "600 19px sans-serif";
  c.fillText("moon i win", 168, 370);
  c.fillStyle = "#9a9aa2";
  c.font = "12px sans-serif";
  c.fillText("Delivered", 200, 404);
  // input bar
  c.fillStyle = "#e9e9ee";
  c.beginPath();
  c.roundRect(16, H - 56, W - 32, 36, 18);
  c.fill();
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  screenMat = new THREE.MeshBasicMaterial({ map: tex, toneMapped: false, color: new THREE.Color(1.15, 1.15, 1.15) });
  return screenMat;
}

// Shared body geometry (realistic adult proportions, ~1.78m tall).
const lathe = (pts: [number, number][], seg = 36) =>
  new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), seg);
const GEO = {
  jacket: lathe([[0, 0.84], [0.17, 0.84], [0.178, 0.95], [0.166, 1.08], [0.182, 1.25], [0.2, 1.37], [0.192, 1.44], [0.125, 1.49], [0.055, 1.515]]),
  robe: lathe([[0, 0.03], [0.3, 0.03], [0.27, 0.45], [0.215, 0.95], [0.2, 1.36], [0.19, 1.44], [0.125, 1.49], [0.055, 1.515]]),
  pelvis: new THREE.SphereGeometry(0.16, 20, 14),
  thigh: new THREE.CapsuleGeometry(0.07, 0.32, 6, 14),
  shin: new THREE.CapsuleGeometry(0.056, 0.34, 6, 14),
  shoe: new THREE.CapsuleGeometry(0.048, 0.15, 6, 12),
  upper: new THREE.CapsuleGeometry(0.05, 0.22, 6, 12),
  fore: new THREE.CapsuleGeometry(0.043, 0.2, 6, 12),
  hand: new THREE.SphereGeometry(0.043, 14, 10),
  neck: new THREE.CylinderGeometry(0.054, 0.06, 0.12, 18),
  ear: new THREE.SphereGeometry(0.022, 10, 8),
  hairCap: hairGeometry(0.106, 0.6, 7),
  hairLong: hairGeometry(0.108, 0.53, 9),
  beanie: new THREE.SphereGeometry(0.118, 28, 14, 0, Math.PI * 2, 0, Math.PI * 0.5),
  hood: new THREE.SphereGeometry(0.135, 24, 16, 0, Math.PI * 2, 0, Math.PI * 0.62),
};

// ── Hands: palm, two-segment fingers, thumb. Curl is driven per frame. ──
export type FingerRig = { index: THREE.Group[]; rest: THREE.Group[]; thumb: THREE.Group | null };
const FINGER = new THREE.CapsuleGeometry(0.0072, 0.022, 4, 8);
const FINGER_TIP = new THREE.CapsuleGeometry(0.0066, 0.016, 4, 8);
function Hand({ side, skin }: { side: 1 | -1; skin: string }) {
  const m = toon(skin, "skin");
  // palm faces the body (local -side·X); fingers run along +Z
  const fingers = [0.022, 0.0075, -0.0075, -0.021];
  const lengths = [1.0, 1.08, 1.0, 0.82];
  return (
    <group position={[0, 0, 0.275]}>
      <mesh position={[0, 0, 0.032]} scale={[0.34, 0.92, 1.05]} material={m}>
        <sphereGeometry args={[0.04, 20, 14]} />
      </mesh>
      {fingers.map((y, i) => (
        <group
          key={i}
          position={[0, y, 0.07]}
          name={i === 0 ? `index${side}` : `finger${side}_${i}`}
        >
          <mesh geometry={FINGER} position={[0, 0, 0.016 * lengths[i]]} rotation={[Math.PI / 2, 0, 0]} scale={[1, lengths[i], 1]} material={m} />
          <group position={[0, 0, 0.032 * lengths[i]]} name="tip">
            <mesh geometry={FINGER_TIP} position={[0, 0, 0.012]} rotation={[Math.PI / 2, 0, 0]} scale={[0.95, lengths[i], 0.95]} material={m} />
          </group>
        </group>
      ))}
      <group
        position={[-side * 0.008, 0.03, 0.022]}
        rotation={[0.5, -side * 0.6, 0]}
      >
        <mesh geometry={FINGER} position={[0, 0, 0.018]} rotation={[Math.PI / 2, 0, 0]} scale={[1.2, 1.05, 1.2]} material={m} />
      </group>
    </group>
  );
}

function Arm({
  side,
  look,
  armRef,
  elbowRef,
  children,
}: {
  side: 1 | -1;
  look: Look;
  armRef: React.RefObject<THREE.Group | null>;
  elbowRef: React.RefObject<THREE.Group | null>;
  children?: React.ReactNode;
}) {
  return (
    <group ref={armRef} position={[side * 0.205, 1.42, 0]}>
      <mesh geometry={GEO.upper} position={[0, 0, 0.15]} rotation={[Math.PI / 2, 0, 0]} material={fabric(look.coat, "canvas", 1, 1)} />
      <group ref={elbowRef} position={[0, 0, 0.285]}>
        <mesh geometry={GEO.fore} position={[0, 0, 0.125]} rotation={[Math.PI / 2, 0, 0]} material={fabric(look.coat, "canvas", 1, 1)} />
        <Hand side={side} skin={look.skin} />
        {children}
      </group>
    </group>
  );
}

function Head({ look }: { look: Look }) {
  const geo = headGeometry(look.skin, look.hair, look.hat === "bun", look.child);
  return (
    <>
      <mesh geometry={geo} material={headSkin} />
      {[1, -1].map((side) => (
        <group key={side}>
          <Eye side={side as 1 | -1} iris={look.iris ?? "#5a3b24"} skin={look.skin} z={geo.userData.eyeZ} />
          <mesh geometry={GEO.ear} position={[side * 0.086, 0.0, -0.006]} scale={[0.42, 1.0, 0.75]} material={toon(look.skin, "skin")} />
        </group>
      ))}
      {look.hat !== "hood" && look.hat !== "beanie" && (
        // hairline sits high on the forehead and drops to the nape at the back
        <mesh
          geometry={look.hat === "bun" ? GEO.hairLong : GEO.hairCap}
          position={[0, 0.006, -0.008]}
          rotation={[-0.62, 0, 0]}
          scale={[0.91, 1.04, 1]}
          material={toon(look.hair)}
        />
      )}
    </>
  );
}

export default function Character({
  look,
  track,
  still,
}: {
  look: Look;
  track?: Pose[];
  still?: { x: number; y: number; z: number; rot: number; point?: THREE.Vector3; sway?: number; lookUp?: number };
}) {
  const root = useRef<THREE.Group>(null);
  const bob = useRef<THREE.Group>(null);
  const head = useRef<THREE.Group>(null);
  const legL = useRef<THREE.Group>(null);
  const legR = useRef<THREE.Group>(null);
  const armL = useRef<THREE.Group>(null);
  const armR = useRef<THREE.Group>(null);
  const elbowL = useRef<THREE.Group>(null);
  const elbowR = useRef<THREE.Group>(null);
  const rig = useRef<FingerRig>({ index: [], rest: [], thumb: null });
  const phone = useRef<THREE.Group>(null);
  const poseRef = useRef<SampledPose>(makeSampledPose());
  const scale = look.scale ?? 1;

  useFrame(() => {
    const r = root.current;
    if (!r) return;
    const pose = poseRef.current;
    const time = story.time;

    if (track) {
      samplePose(track, story.t, pose);
    } else if (still) {
      pose.x = still.x;
      pose.z = still.z;
      pose.rot = still.rot + Math.sin(time * 0.5 + still.x) * (still.sway ?? 0);
      pose.speed = 0;
      pose.visible = true;
      for (const k of Object.keys(pose.armR) as ArmPose[]) {
        pose.armR[k] = 0;
        pose.armL[k] = 0;
      }
      if (still.point) {
        pose.armR.point = 1;
        pose.target.copy(still.point);
      } else pose.armR.rest = 1;
      pose.armL.rest = 1;
    }

    r.visible = pose.visible;
    if (!pose.visible) return;
    r.position.set(pose.x, still ? still.y : 0, pose.z);
    r.rotation.y = pose.rot;
    r.updateMatrixWorld();

    const stride = Math.sin(time * 10);
    const sp = pose.speed;
    if (bob.current) {
      bob.current.position.y = Math.abs(stride) * 0.05 * sp + Math.sin(time * 1.6) * 0.004;
      // idle weight shift (contrapposto) instead of standing ramrod straight
      bob.current.rotation.z = Math.sin(time * 0.45 + pose.x) * 0.018 * (1 - sp);
    }
    if (legL.current) legL.current.rotation.x = stride * 0.7 * sp;
    if (legR.current) legR.current.rotation.x = -stride * 0.7 * sp;

    // arms: blend direction vectors per pose weight
    const aim = (grp: THREE.Group | null, side: number, weights: Record<ArmPose, number>) => {
      if (!grp) return;
      tmpDir.set(0, 0, 0);
      for (const k of Object.keys(weights) as ArmPose[]) {
        const w = weights[k];
        if (w <= 0.001) continue;
        if (k === "point") {
          tmpV.copy(pose.target);
          r.worldToLocal(tmpV);
          tmpV.sub(grp.position).normalize();
          tmpDir.addScaledVector(tmpV, w);
        } else {
          tmpDir.addScaledVector(DIRS[k](side, time).normalize(), w);
        }
      }
      // while walking, swing arms
      tmpDir.z += -side * Math.sin(time * 10) * 0.5 * sp * weights.rest;
      if (tmpDir.lengthSq() < 1e-4) tmpDir.set(side * 0.2, -1, 0);
      grp.quaternion.setFromUnitVectors(Z, tmpDir.normalize());
    };
    aim(armL.current, 1, pose.armL);
    aim(armR.current, -1, pose.armR);

    // elbows: relaxed bend at rest, straight when pointing, sharp for phone / wave
    const BEND: Record<ArmPose, number> = { rest: 0.32, point: 0.04, up: 0.22, wave: 1.05, phone: 1.75 };
    const bend = (grp: THREE.Group | null, w: Record<ArmPose, number>) => {
      if (!grp) return;
      let b = 0;
      for (const k of Object.keys(w) as ArmPose[]) b += BEND[k] * w[k];
      grp.rotation.x = -b;
    };
    bend(elbowL.current, pose.armL);
    bend(elbowR.current, pose.armR);

    // fingers: relaxed curl, open for wave/cheer, grip for phone, index out to point
    const CURL: Record<ArmPose, number> = { rest: 0.55, point: 1.35, up: 0.15, wave: 0.1, phone: 1.15 };
    const curlFor = (w: Record<ArmPose, number>, indexFinger: boolean) => {
      let c = 0;
      for (const k of Object.keys(w) as ArmPose[]) c += (indexFinger && k === "point" ? 0.05 : CURL[k]) * w[k];
      return c;
    };
    const setCurl = (g: THREE.Group | undefined, c: number, side: number) => {
      if (!g) return;
      // curl toward the palm (local -side·X): rotate about local Y
      g.rotation.y = -side * c * 0.85;
      const tip = g.children[1] as THREE.Object3D | undefined;
      if (tip) tip.rotation.y = -side * c * 0.9;
    };
    const R = rig.current;
    if (!R.index.length) {
      r.traverse((o) => {
        if (o.name === "index1") R.index[0] = o as THREE.Group;
        else if (o.name === "index-1") R.index[1] = o as THREE.Group;
        else if (o.name.startsWith("finger")) {
          const [sd, n] = o.name.slice(6).split("_").map(Number);
          R.rest[(sd === 1 ? 0 : 3) + n - 1] = o as THREE.Group;
        }
      });
    }
    setCurl(R.index[0], curlFor(pose.armL, true), 1);
    setCurl(R.index[1], curlFor(pose.armR, true), -1);
    for (let k = 0; k < 6; k++) {
      const left = k < 3;
      setCurl(R.rest[k], curlFor(left ? pose.armL : pose.armR, false) + k * 0.04, left ? 1 : -1);
    }

    if (head.current) {
      const lookUp = pose.armR.point + pose.armR.phone * 0.8 + pose.armL.up * 0.4 + pose.armR.up * 0.3 + (still?.lookUp ?? 0);
      head.current.rotation.x = -0.35 * clamp(lookUp);
      head.current.rotation.z = 0.04 + Math.sin(time * 0.7 + pose.z) * 0.025;
      head.current.rotation.y = Math.sin(time * 0.31 + pose.x) * 0.08 * (1 - lookUp);
    }
    if (phone.current) {
      const s = clamp(pose.armR.phone * 1.6 - 0.4);
      phone.current.scale.setScalar(Math.max(0.0001, s));
    }

  });

  const dark = "#141216";
  return (
    <group ref={root} scale={scale}>
      <group ref={bob}>
        {/* legs: thigh, shin, shoe */}
        {[1, -1].map((s) => (
          <group key={s} ref={s === 1 ? legL : legR} position={[s * 0.095, 0.93, 0]}>
            <mesh geometry={GEO.thigh} position={[0, -0.2, 0]} material={fabric(look.trousers, "denim", 2, 3)} />
            <mesh geometry={GEO.shin} position={[0, -0.6, 0.005]} material={fabric(look.trousers, "denim", 2, 3)} />
            <mesh geometry={GEO.shoe} position={[0, -0.875, 0.05]} rotation={[Math.PI / 2, 0, 0]} scale={[1.05, 1, 0.8]} material={toon(dark, "paint")} />
          </group>
        ))}
        <mesh geometry={GEO.pelvis} position={[0, 0.94, 0]} scale={[1.05, 0.62, 0.72]} material={fabric(look.trousers, "denim", 2, 3)} />

        {/* jacket / robe, flattened front-to-back like a real torso */}
        <mesh geometry={look.robe ? GEO.robe : GEO.jacket} scale={[1, 1, 0.66]} material={fabric(look.coat, "canvas", 4, 3)} />
        {!look.robe && (
          <>
            <mesh position={[0, 0.85, 0]} rotation={[Math.PI / 2, 0, 0]} scale={[1, 0.66, 1]} material={toon(look.coatTrim)}>
              <torusGeometry args={[0.172, 0.014, 6, 36]} />
            </mesh>
            {/* zip line + pockets */}
            <mesh position={[0, 1.15, 0.116]} material={toon(dark, "metal")}>
              <boxGeometry args={[0.008, 0.6, 0.006]} />
            </mesh>
            {[1, -1].map((s) => (
              <mesh key={s} position={[s * 0.095, 0.98, 0.112]} rotation={[0, s * 0.25, 0]} material={toon(look.coatTrim)}>
                <boxGeometry args={[0.08, 0.012, 0.008]} />
              </mesh>
            ))}
          </>
        )}

        {/* scarf */}
        <mesh position={[0, 1.49, 0]} rotation={[Math.PI / 2, 0, 0]} scale={[1, 0.8, 1]} material={fabric(look.scarf, "knit", 4, 2)}>
          <torusGeometry args={[0.078, 0.036, 10, 24]} />
        </mesh>
        <mesh position={[0.05, 1.36, 0.1]} rotation={[0.15, 0, 0.12]} material={fabric(look.scarf, "knit", 4, 2)}>
          <boxGeometry args={[0.07, 0.24, 0.025]} />
        </mesh>

        <Arm side={1} look={look} armRef={armL} elbowRef={elbowL} />
        <Arm side={-1} look={look} armRef={armR} elbowRef={elbowR}>
          <group ref={phone} position={[0, 0.05, 0.36]} rotation={[-1.2, 0, 0]}>
            {/* white phone; the lit screen (a photo of the moon being sent) faces whoever holds it */}
            <mesh material={phoneBody}>
              <boxGeometry args={[0.078, 0.158, 0.009]} />
            </mesh>
            <mesh position={[0, 0, 0.0052]} material={phoneScreen()}>
              <planeGeometry args={[0.07, 0.148]} />
            </mesh>
          </group>
        </Arm>

        {look.staff && (
          <mesh position={[-0.32, 0.95, 0.18]} rotation={[0.05, 0, 0.05]} material={toon("#5b3a26", "wood")}>
            <cylinderGeometry args={[0.022, 0.028, 1.9, 8]} />
          </mesh>
        )}

        <mesh geometry={GEO.neck} position={[0, 1.535, 0.006]} material={toon(look.skin, "skin")} />

        {/* head */}
        <group ref={head} position={[0, 1.64, 0.014]} scale={look.child ? 1.14 : 1}>
          <Head look={look} />
          {look.hat === "beanie" && (
            <group position={[0, 0.032, -0.008]} rotation={[-0.22, 0, 0.06]}>
              <mesh geometry={GEO.beanie} scale={[0.96, 1.06, 1]} material={fabric(look.hatColor ?? "#d33", "knit", 6, 3)} />
              <mesh rotation={[Math.PI / 2, 0, 0]} material={fabric(look.hatColor ?? "#d33", "knit", 6, 3)}>
                <torusGeometry args={[0.112, 0.018, 8, 32]} />
              </mesh>
            </group>
          )}
          {look.hat === "bun" && (
            <>
              {/* bun sitting on the crown-back of the hair, and hair down to the nape
                  (back half only, hugging the skull) */}
              <mesh position={[0, 0.082, -0.104]} scale={[1, 0.9, 0.9]} material={toon(look.hair)}>
                <sphereGeometry args={[0.042, 18, 14]} />
              </mesh>
              <mesh position={[0, 0.004, -0.01]} scale={[0.92, 1.1, 1.04]} material={toon(look.hair)}>
                <sphereGeometry args={[0.104, 28, 14, Math.PI, Math.PI, Math.PI * 0.4, Math.PI * 0.38]} />
              </mesh>
            </>
          )}
          {look.hat === "hood" && (
            <mesh geometry={GEO.hood} position={[0, 0.0, -0.02]} rotation={[-0.5, 0, 0]} material={fabric(look.hatColor ?? look.coat, "canvas", 3, 3)} />
          )}
        </group>
      </group>
    </group>
  );
}
