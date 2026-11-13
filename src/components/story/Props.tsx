"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useTexture } from "@react-three/drei";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { toon, groundHeight, HILL, rng, DRIVE, DRIVE_RUNS } from "./toon";
import { plaster, roofTiles, planks, stone, gravel, repeat } from "./textures";
import { story, presence, clamp, smooth, live } from "./state";
import { chapterIndex, DOOR_OPEN, LANTERN_POS } from "./chapters";
import Character, { type Look } from "./Character";


type Kind = "cloth" | "wood" | "stone" | "paint" | "metal";

function Box({ p, s, color, kind = "paint", mat }: { p: [number, number, number]; s: [number, number, number]; color?: string; kind?: Kind; mat?: THREE.Material }) {
  return (
    <mesh position={p} material={mat ?? toon(color ?? "#888", kind)}>
      <boxGeometry args={s} />
    </mesh>
  );
}

/** Textured PBR surface; repeat is in texture tiles per material. */
function surface(tex: { map: THREE.Texture; bump: THREE.Texture }, rx: number, ry: number, opts: THREE.MeshStandardMaterialParameters = {}) {
  const t = repeat(tex, rx, ry);
  return new THREE.MeshStandardMaterial({ map: t.map, bumpMap: t.bump, bumpScale: 1.2, roughness: 0.92, ...opts });
}

// ── Cottage ────────────────────────────────────────────────────────────────
// Footprint x: -9.5..-4.5, z: -5..-1. Door x: -8.3..-7.1. Window x: -6.3..-5.1, y: 1..2.
function Cottage() {
  const door = useRef<THREE.Group>(null);
  const smoke = useRef<THREE.Group>(null);
  const m = useMemo(() => {
    const wall = surface(plaster(), 1.4, 1.2);
    const wallSide = surface(plaster(), 2.2, 1.6);
    const timber = surface(planks(), 0.25, 1.5, { roughness: 0.85 });
    const beam = surface(planks(), 3, 0.15, { roughness: 0.85 });
    const roof = surface(roofTiles(), 3, 2.2, { roughness: 0.8, bumpScale: 2 });
    const doorM = surface(planks(), 1, 1.4, { color: "#6a7a7a", roughness: 0.8 });
    const shutter = surface(planks(), 0.6, 1, { color: "#5a7060", roughness: 0.8 });
    const stoneM = surface(stone(), 3, 0.4, { roughness: 0.95, bumpScale: 2 });
    const chimney = surface(stone(), 0.6, 1.4, { roughness: 0.95, bumpScale: 2 });
    const fence = surface(planks(), 0.2, 1, { color: "#9a8a7a" });
    const glass = new THREE.MeshPhysicalMaterial({ color: "#ffd9a0", roughness: 0.08, metalness: 0, transparent: true, opacity: 0.18, clearcoat: 1 });
    const iron = new THREE.MeshStandardMaterial({ color: "#1d1d20", roughness: 0.5, metalness: 0.8 });
    return { wall, wallSide, timber, beam, roof, doorM, shutter, stoneM, chimney, fence, glass, iron };
  }, []);

  // roof slabs: two tiled planes with real thickness, overhanging the walls
  const pitch = Math.atan2(1.75, 2.5);
  const slab = Math.hypot(2.5, 1.75) + 0.8;

  useFrame(() => {
    const t = story.t;
    let open = 0;
    for (const [a, b] of DOOR_OPEN) {
      const o = clamp((t - a) / 0.12) * clamp((b - t) / 0.12);
      open = Math.max(open, o);
    }
    if (door.current) door.current.rotation.y = -smooth(open) * 1.9;
    if (smoke.current) {
      smoke.current.children.forEach((c, i) => {
        const k = (story.time * 0.12 + i / smoke.current!.children.length) % 1;
        c.position.set(Math.sin(k * 5 + i) * 0.3 + k * 1.6, k * 4.2, Math.cos(k * 4 + i) * 0.2);
        c.scale.setScalar(0.25 + k * 1.1);
        ((c as THREE.Mesh).material as THREE.MeshStandardMaterial).opacity = Math.sin(k * Math.PI) * 0.22;
      });
    }
  });

  return (
    <group>
      {/* warm interior glimpsed through the door and window */}
      <Interior />
      <pointLight position={[-7, 2.0, -2.4]} color="#ffae5a" intensity={10} distance={9} decay={1.6} />

      {/* stone plinth */}
      {/* stone footing under the walls only; the floor inside is at ground level so
          people walk in and out without sinking through it */}
      <Box p={[-8.975, 0.17, -1.05]} s={[1.35, 0.34, 0.4]} mat={m.stoneM} />
      <Box p={[-5.725, 0.17, -1.05]} s={[2.75, 0.34, 0.4]} mat={m.stoneM} />
      <Box p={[-7, 0.17, -4.95]} s={[5.3, 0.34, 0.4]} mat={m.stoneM} />
      <Box p={[-9.45, 0.17, -3]} s={[0.4, 0.34, 3.5]} mat={m.stoneM} />
      <Box p={[-4.55, 0.17, -3]} s={[0.4, 0.34, 3.5]} mat={m.stoneM} />
      <Box p={[-7.7, 0.01, -1.05]} s={[1.2, 0.02, 0.4]} mat={m.stoneM} />

      {/* front wall pieces around the door + window (z -1.1) */}
      <Box p={[-8.9, 1.65, -1.1]} s={[1.2, 2.7, 0.24]} mat={m.wall} />
      <Box p={[-7.7, 2.65, -1.1]} s={[1.2, 0.7, 0.24]} mat={m.wall} />
      <Box p={[-6.7, 1.65, -1.1]} s={[0.8, 2.7, 0.24]} mat={m.wall} />
      <Box p={[-5.7, 0.67, -1.1]} s={[1.2, 0.66, 0.24]} mat={m.wall} />
      <Box p={[-5.7, 2.5, -1.1]} s={[1.2, 1.0, 0.24]} mat={m.wall} />
      <Box p={[-4.8, 1.65, -1.1]} s={[0.6, 2.7, 0.24]} mat={m.wall} />
      {/* side + back walls */}
      {/* back wall, with a window toward the moon (x -6.2..-5.2, y 1.6..2.8) */}
      <Box p={[-7.85, 1.65, -4.9]} s={[3.3, 2.7, 0.24]} mat={m.wallSide} />
      <Box p={[-4.85, 1.65, -4.9]} s={[0.7, 2.7, 0.24]} mat={m.wallSide} />
      <Box p={[-5.7, 0.95, -4.9]} s={[1.0, 1.3, 0.24]} mat={m.wallSide} />
      <Box p={[-5.7, 2.9, -4.9]} s={[1.0, 0.2, 0.24]} mat={m.wallSide} />
      <Box p={[-5.7, 1.56, -5.08]} s={[1.25, 0.08, 0.24]} mat={m.timber} />

      <Box p={[-9.4, 1.65, -3]} s={[0.24, 2.7, 4]} mat={m.wallSide} />
      <Box p={[-4.6, 1.65, -3]} s={[0.24, 2.7, 4]} mat={m.wallSide} />
      {/* gable triangles */}
      {[-0.98, -5.02].map((z) => (
        <mesh key={z} position={[-7, 3.0, z]} material={m.wall}>
          <extrudeGeometry
            args={[
              new THREE.Shape([new THREE.Vector2(-2.5, 0), new THREE.Vector2(2.5, 0), new THREE.Vector2(0, 1.75)]),
              { depth: 0.2, bevelEnabled: false },
            ]}
          />
        </mesh>
      ))}

      {/* timber framing */}
      {[-9.46, -4.54].map((x) => (
        <Box key={x} p={[x, 1.65, -0.96]} s={[0.18, 2.75, 0.14]} mat={m.timber} />
      ))}
      <Box p={[-7, 3.02, -0.95]} s={[5.2, 0.18, 0.16]} mat={m.beam} />
      <Box p={[-7.7, 2.32, -0.95]} s={[1.5, 0.14, 0.14]} mat={m.beam} />
      {/* windows: a slim trim around the outside edge only, no mullions across the view */}
      <WindowTrim x0={-6.3} x1={-5.1} y0={1.0} y1={2.0} z={-0.955} mat={m.timber} />
      <WindowTrim x0={-6.2} x1={-5.2} y0={1.6} y1={2.8} z={-5.045} mat={m.timber} />
      <Box p={[-5.7, 0.97, -0.9]} s={[1.5, 0.08, 0.32]} mat={m.timber} />
      <mesh position={[-5.7, 1.5, -1.06]} material={m.glass}>
        <planeGeometry args={[1.2, 1.0]} />
      </mesh>
      {/* shutters, flung open */}
      <Box p={[-6.75, 1.5, -0.9]} s={[0.55, 1.05, 0.05]} mat={m.shutter} />
      <Box p={[-4.68, 1.5, -0.9]} s={[0.15, 1.05, 0.05]} mat={m.shutter} />
      {/* flower box */}
      <Box p={[-5.7, 0.84, -0.78]} s={[1.3, 0.2, 0.26]} mat={m.timber} />
      {Array.from({ length: 14 }).map((_, i) => (
        <mesh key={i} position={[-6.25 + i * 0.085, 1.0 + (i % 3) * 0.03, -0.76 + ((i * 7) % 3) * 0.04]} material={toon(["#8a2a3a", "#c9a23a", "#b0502a", "#d8d0e0", "#3a5a2a"][i % 5], "cloth")}>
          <sphereGeometry args={[0.055, 10, 8]} />
        </mesh>
      ))}

      {/* door on its hinge, iron strap hinges */}
      <group ref={door} position={[-8.3, 0.02, -1.02]}>
        <Box p={[0.6, 1.13, 0]} s={[1.2, 2.26, 0.08]} mat={m.doorM} />
        {[0.6, 1.8].map((y) => (
          <Box key={y} p={[0.4, y, 0.05]} s={[0.7, 0.05, 0.015]} mat={m.iron} />
        ))}
        <mesh position={[1.05, 1.1, 0.07]} material={toon("#9a7a3a", "metal")}>
          <torusGeometry args={[0.05, 0.012, 8, 16]} />
        </mesh>
      </group>
      {/* step + porch lamp */}
      <Box p={[-7.7, 0.025, -0.6]} s={[1.6, 0.05, 0.7]} mat={m.stoneM} />
      <group position={[-7.0, 2.45, -0.88]}>
        <mesh material={m.iron}>
          <boxGeometry args={[0.14, 0.2, 0.14]} />
        </mesh>
        <mesh>
          <sphereGeometry args={[0.05, 10, 8]} />
          <meshBasicMaterial color={new THREE.Color("#ffc070").multiplyScalar(5)} />
        </mesh>
        <pointLight color="#ffb060" intensity={3} distance={5} decay={1.8} />
      </group>

      {/* roof: tiled slabs with overhang + ridge */}
      {[1, -1].map((side) => (
        <mesh
          key={side}
          material={m.roof}
          position={[-7 + side * 1.32, 3.0 + 0.875 + 0.12, -3]}
          rotation={[0, 0, -side * pitch]}
        >
          <boxGeometry args={[slab, 0.12, 4.8]} />
        </mesh>
      ))}
      <mesh position={[-7, 4.86, -3]} rotation={[Math.PI / 2, 0, 0]} material={m.roof}>
        <cylinderGeometry args={[0.1, 0.1, 4.85, 12]} />
      </mesh>
      {/* chimney + smoke */}
      <Box p={[-5.6, 4.7, -3.8]} s={[0.6, 2.0, 0.6]} mat={m.chimney} />
      <Box p={[-5.6, 5.75, -3.8]} s={[0.74, 0.1, 0.74]} mat={m.stoneM} />
      <group ref={smoke} position={[-5.6, 5.9, -3.8]}>
        {Array.from({ length: 9 }).map((_, i) => (
          <mesh key={i}>
            <sphereGeometry args={[0.5, 14, 10]} />
            <meshStandardMaterial color="#9a9aa6" transparent opacity={0} depthWrite={false} roughness={1} />
          </mesh>
        ))}
      </group>

      {/* split-rail fence */}
      {Array.from({ length: 9 }).map((_, i) => (
        <mesh key={i} position={[-3.6, 0.45, -4.6 + i * 0.5]} rotation={[0, i, (i % 2 ? 1 : -1) * 0.03]} material={m.fence}>
          <cylinderGeometry args={[0.045, 0.055, 0.9, 7]} />
        </mesh>
      ))}
      {[0.35, 0.7].map((y) => (
        <mesh key={y} position={[-3.6, y, -2.6]} rotation={[Math.PI / 2, 0, 0]} material={m.fence}>
          <cylinderGeometry args={[0.03, 0.03, 4.2, 6]} />
        </mesh>
      ))}
    </group>
  );
}

/** Thin frame around a window opening (outer face of the wall). */
function WindowTrim({ x0, x1, y0, y1, z, mat }: { x0: number; x1: number; y0: number; y1: number; z: number; mat: THREE.Material }) {
  const t = 0.045;
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, w = x1 - x0 + t * 2, h = y1 - y0;
  return (
    <>
      <Box p={[cx, y1 + t / 2, z]} s={[w, t, 0.05]} mat={mat} />
      <Box p={[cx, y0 - t / 2, z]} s={[w, t, 0.05]} mat={mat} />
      <Box p={[x0 - t / 2, cy, z]} s={[t, h, 0.05]} mat={mat} />
      <Box p={[x1 + t / 2, cy, z]} s={[t, h, 0.05]} mat={mat} />
    </>
  );
}

/** Warm-lit room behind the walls; open where the back window is so the sky shows through. */
// inset a few cm from the walls' inner faces (x -9.28 / -4.72, z -4.78) so no two
// surfaces share a plane and z-fight; the floor sits just above the ground
const ROOM = { x0: -9.24, x1: -4.76, y0: 0.03, y1: 2.96, z0: -4.74, z1: -1.24 };
const WIN = { x0: -6.2, x1: -5.2, y0: 1.6, y1: 2.8 };
function Interior() {
  const geo = useMemo(() => {
    const { x0, x1, y0, y1, z0, z1 } = ROOM;
    const w = x1 - x0, h = y1 - y0, d = z1 - z0;
    const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, cz = (z0 + z1) / 2;
    const parts: THREE.BufferGeometry[] = [];
    const put = (g: THREE.BufferGeometry, rx: number, ry: number, x: number, y: number, z: number) => {
      g.rotateX(rx);
      g.rotateY(ry);
      g.translate(x, y, z);
      parts.push(g);
    };
    put(new THREE.PlaneGeometry(w, d), -Math.PI / 2, 0, cx, y0, cz); // floor
    put(new THREE.PlaneGeometry(w, d), Math.PI / 2, 0, cx, y1, cz); // ceiling
    put(new THREE.PlaneGeometry(d, h), 0, Math.PI / 2, x0, cy, cz); // left
    put(new THREE.PlaneGeometry(d, h), 0, -Math.PI / 2, x1, cy, cz); // right
    // back wall with the window cut out (faces +z, into the room)
    const shape = new THREE.Shape([
      new THREE.Vector2(x0, y0),
      new THREE.Vector2(x1, y0),
      new THREE.Vector2(x1, y1),
      new THREE.Vector2(x0, y1),
    ]);
    shape.holes.push(
      new THREE.Path([
        new THREE.Vector2(WIN.x0, WIN.y0),
        new THREE.Vector2(WIN.x0, WIN.y1),
        new THREE.Vector2(WIN.x1, WIN.y1),
        new THREE.Vector2(WIN.x1, WIN.y0),
      ])
    );
    put(new THREE.ShapeGeometry(shape), 0, 0, 0, 0, z0);
    const merged = mergeGeometries(parts.map((g) => g.toNonIndexed()));
    parts.forEach((g) => g.dispose());
    return merged;
  }, []);
  return (
    <mesh geometry={geo}>
      <meshStandardMaterial color="#6a4a32" emissive="#ff9a40" emissiveIntensity={0.55} roughness={1} />
    </mesh>
  );
}

/** Gravel turning circle by the street lamp, with a footpath to the door and a lane out. */
function Driveway() {
  const mat = useMemo(() => {
    const g = repeat(gravel(), 1, 1);
    return new THREE.MeshStandardMaterial({
      map: g.map,
      bumpMap: g.bump,
      bumpScale: 2,
      roughness: 0.95,
      color: "#cfc6b6",
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    });
  }, []);
  const geo = useMemo(() => {
    const parts: THREE.BufferGeometry[] = [];
    const ring = new THREE.RingGeometry(DRIVE.r0, DRIVE.r1, 96, 1);
    ring.rotateX(-Math.PI / 2);
    ring.translate(DRIVE.cx, 0.02, DRIVE.cz);
    parts.push(ring);
    DRIVE_RUNS.forEach(([x0, z0, x1, z1, w], i) => {
      const len = Math.hypot(x1 - x0, z1 - z0);
      const g = new THREE.PlaneGeometry(w, len);
      g.rotateX(-Math.PI / 2);
      g.rotateY(Math.atan2(x1 - x0, z1 - z0));
      g.translate((x0 + x1) / 2, 0.021 + i * 0.001, (z0 + z1) / 2);
      parts.push(g);
    });
    const merged = mergeGeometries(parts.map((g) => g.toNonIndexed()));
    // world-space UVs so the gravel tiles evenly everywhere (~1.6m per tile)
    const pos = merged.attributes.position as THREE.BufferAttribute;
    const uv = merged.attributes.uv as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) uv.setXY(i, pos.getX(i) / 1.6, pos.getZ(i) / 1.6);
    parts.forEach((g) => g.dispose());
    return merged;
  }, []);
  return <mesh geometry={geo} material={mat} receiveShadow />;
}

/** Irregular weathered monolith instead of a box. */
function rockGeometry(w: number, h: number, d: number, seed: number) {
  const g = new THREE.BoxGeometry(w, h, d, 6, 12, 4);
  const p = g.attributes.position as THREE.BufferAttribute;
  const rand = rng(seed);
  const ph = [rand() * 10, rand() * 10, rand() * 10];
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const ty = v.y / h + 0.5;
    // taper toward the top, round the edges, add lumpy erosion
    const taper = 1 - ty * 0.28;
    const n = Math.sin(v.y * 3.1 + ph[0]) * 0.05 + Math.sin(v.x * 7 + v.y * 5 + ph[1]) * 0.03 + Math.cos(v.z * 9 + v.y * 4 + ph[2]) * 0.025;
    v.x *= taper * (1 + n);
    v.z *= taper * (1 + n);
    const ex = Math.abs(v.x) / (w / 2), ez = Math.abs(v.z) / (d / 2);
    const corner = Math.max(0, ex + ez - 1.2);
    v.x *= 1 - corner * 0.25;
    v.z *= 1 - corner * 0.25;
    if (ty > 0.9) v.y -= (ex * 0.15 + ez * 0.1) * h * 0.08;
    p.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals();
  return g;
}

// ── Standing stones + the ancients who started it all ──────────────────────
const elders: Look[] = [
  { coat: "#5a2a22", coatTrim: "#8a6a3a", trousers: "#3a2a2a", skin: "#d9a07a", hair: "#2a1d1a", scarf: "#8a6a3a", hat: "hood", robe: true, staff: true },
  { coat: "#24283a", coatTrim: "#6a5a3a", trousers: "#2a2a3a", skin: "#c48a68", hair: "#ddd", scarf: "#6a6a7a", hat: "hood", robe: true },
  { coat: "#4a4228", coatTrim: "#6a6a5a", trousers: "#2a2a2a", skin: "#e0b48c", hair: "#5a3a1a", scarf: "#3a5a4a", hat: "hood", robe: true, scale: 0.85 },
  { coat: "#3a2a34", coatTrim: "#7a5a3a", trousers: "#2a2a2a", skin: "#b8805e", hair: "#1a1a1a", scarf: "#8a5a3a", hat: "hood", robe: true, staff: true },
];

const FIRE = { x: HILL.x + 0.2, z: HILL.z + 1.5 };
/** The hand-made moon of the "centuries" scene: a dreamlike, storybook prop. */
// hovers close beside the elders (dream logic), so the pointing arm reads across the frame
export const DREAM_MOON = { x: 18.9, y: 6.9, z: -25.6, r: 0.95 };

function DreamMoon() {
  const ref = useRef<THREE.Group>(null);
  const centuries = chapterIndex("centuries");
  const { disc, halo } = useMemo(() => {
    // a hand-made moon: a slightly uneven painted disc with soft brush strokes,
    // daubed craters and a light charcoal outline
    const S = 512;
    const cv = document.createElement("canvas");
    cv.width = cv.height = S;
    const c = cv.getContext("2d")!;
    const rand = rng(17);
    const ph = [rand() * 6, rand() * 6, rand() * 6];
    const edge = new Path2D();
    for (let i = 0; i <= 64; i++) {
      const a = (i / 64) * Math.PI * 2;
      const wob = Math.sin(a * 3 + ph[0]) * 0.018 + Math.sin(a * 5 + ph[1]) * 0.01 + Math.sin(a * 11 + ph[2]) * 0.005 + (rand() - 0.5) * 0.008;
      const r = S * 0.42 * (1 + wob);
      const x = S / 2 + Math.cos(a) * r;
      const y = S / 2 + Math.sin(a) * r * 0.97;
      if (i) edge.lineTo(x, y);
      else edge.moveTo(x, y);
    }
    edge.closePath();
    c.fillStyle = "#efe2bd";
    c.fill(edge);
    c.save();
    c.clip(edge);
    // visible brush strokes in two directions
    c.lineCap = "round";
    for (let i = 0; i < 110; i++) {
      const x = rand() * S, y = rand() * S, a = rand() < 0.6 ? -0.5 + rand() * 0.3 : 0.9 + rand() * 0.3;
      const len = 40 + rand() * 120;
      c.strokeStyle = rand() < 0.5 ? `rgba(255,248,220,${0.15 + rand() * 0.2})` : `rgba(196,176,128,${0.1 + rand() * 0.12})`;
      c.lineWidth = 6 + rand() * 14;
      c.beginPath();
      c.moveTo(x, y);
      c.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len);
      c.stroke();
    }
    // lopsided painted craters with scribbled rims
    for (const [x, y, r] of [[0.36, 0.36, 0.1], [0.62, 0.3, 0.065], [0.55, 0.62, 0.12], [0.3, 0.66, 0.055], [0.72, 0.52, 0.045], [0.45, 0.48, 0.03]]) {
      c.fillStyle = "rgba(170,148,105,0.55)";
      c.beginPath();
      c.ellipse(x * S, y * S, r * S, r * S * (0.75 + rand() * 0.2), rand() * 3, 0, Math.PI * 2);
      c.fill();
      c.strokeStyle = "rgba(110,90,62,0.35)";
      c.lineWidth = 2;
      for (let k = 0; k < 2; k++) {
        c.beginPath();
        c.ellipse(x * S + (rand() - 0.5) * 4, y * S + (rand() - 0.5) * 4, r * S * (1 + (rand() - 0.5) * 0.12), r * S * 0.8, rand() * 3, rand(), rand() + 5.2);
        c.stroke();
      }
    }
    c.restore();
    // thick, uneven charcoal outline (drawn twice, slightly off)
    c.strokeStyle = "rgba(80,64,44,0.45)";
    c.lineJoin = "round";
    c.lineWidth = 5;
    c.stroke(edge);
    c.save();
    c.translate(3, -2);
    c.strokeStyle = "rgba(80,64,44,0.18)";
    c.lineWidth = 3;
    c.stroke(edge);
    c.restore();
    const discTex = new THREE.CanvasTexture(cv);
    discTex.colorSpace = THREE.SRGBColorSpace;
    const hc = document.createElement("canvas");
    hc.width = hc.height = 128;
    const h = hc.getContext("2d")!;
    const hg = h.createRadialGradient(64, 64, 10, 64, 64, 64);
    hg.addColorStop(0, "rgba(255,240,200,0.35)");
    hg.addColorStop(0.45, "rgba(255,230,180,0.18)");
    hg.addColorStop(1, "rgba(255,230,180,0)");
    h.fillStyle = hg;
    h.fillRect(0, 0, 128, 128);
    const haloTex = new THREE.CanvasTexture(hc);
    return {
      disc: new THREE.MeshBasicMaterial({ map: discTex, transparent: true, toneMapped: false, fog: false, depthWrite: false, color: new THREE.Color(1.15, 1.1, 1.0) }),
      halo: new THREE.MeshBasicMaterial({ map: haloTex, transparent: true, toneMapped: false, fog: false, depthWrite: false, blending: THREE.AdditiveBlending }),
    };
  }, []);
  useFrame(({ camera }) => {
    const g = ref.current;
    if (!g) return;
    const p = presence(story.t, centuries, 0.75);
    g.visible = p > 0.01;
    if (!g.visible) return;
    // floats gently, always facing the viewer
    g.position.set(DREAM_MOON.x, DREAM_MOON.y + Math.sin(story.time * 0.6) * 0.1, DREAM_MOON.z);
    g.quaternion.copy(camera.quaternion);
    g.rotateZ(Math.sin(story.time * 0.35) * 0.06);
    for (const m of g.children) ((m as THREE.Mesh).material as THREE.MeshBasicMaterial).opacity = p;
  });
  return (
    <group ref={ref} visible={false}>
      <mesh material={halo} scale={DREAM_MOON.r * 4.2} renderOrder={1}>
        <planeGeometry />
      </mesh>
      <mesh material={disc} scale={DREAM_MOON.r * 2} renderOrder={2}>
        <planeGeometry />
      </mesh>
    </group>
  );
}

function Hilltop() {
  const stones = useMemo(() => {
    return Array.from({ length: 7 }).map((_, i) => {
      const a = (i / 7) * Math.PI * 2 + 0.3;
      const x = HILL.x + Math.cos(a) * 4.2;
      const z = HILL.z + Math.sin(a) * 4.2;
      const h = 2.2 + ((i * 37) % 10) / 10;
      return { x, z, y: groundHeight(x, z) + h / 2 - 0.3, h, rot: a };
    });
  }, []);
  // gathered round the fire: two warm their hands, one points at the moon,
  // one just gazes up at it
  const people = useMemo(() => {
    const face = (x: number, z: number, tx: number, tz: number) => Math.atan2(tx - x, tz - z);
    const spots: { dx: number; dz: number; to: "fire" | "moon"; point?: boolean; lookUp?: number }[] = [
      { dx: -1.4, dz: 2.6, to: "fire" },
      { dx: 0.6, dz: -0.4, to: "moon", point: true },
      { dx: 1.9, dz: 2.1, to: "moon", lookUp: 0.9 },
      { dx: -1.0, dz: 0.1, to: "fire" },
    ];
    return spots.map(({ dx, dz, to, point, lookUp }) => {
      const x = HILL.x + dx;
      const z = HILL.z + dz;
      const [tx, tz] = to === "fire" ? [FIRE.x, FIRE.z] : [DREAM_MOON.x, DREAM_MOON.z];
      return { x, z, y: groundHeight(x, z), rot: face(x, z, tx, tz), point, lookUp };
    });
  }, []);
  const pointAt = useMemo(() => new THREE.Vector3(DREAM_MOON.x, DREAM_MOON.y, DREAM_MOON.z), []);
  const stoneMat = useMemo(() => surface(stone(), 1, 2, { roughness: 0.95, bumpScale: 3 }), []);

  return (
    <group>
      {stones.map((s, i) => (
        <mesh key={i} position={[s.x, s.y, s.z]} rotation={[0.03, s.rot, (i % 2 ? 1 : -1) * 0.05]} geometry={rockGeometry(1.0, s.h, 0.6, i + 3)} material={stoneMat}>
        </mesh>
      ))}
      {/* the carved moon — the oldest scorecard */}
      <mesh position={[stones[2].x, stones[2].y + 0.4, stones[2].z]} rotation={[0, stones[2].rot + Math.PI / 2, 0]}>
        <circleGeometry args={[0.28, 20]} />
        <meshBasicMaterial color="#d8d0b8" side={THREE.DoubleSide} />
      </mesh>
      {people.map(({ point, ...p }, i) => (
        <Character key={i} look={elders[i]} still={{ ...p, point: point ? pointAt : undefined, sway: 0.06 }} />
      ))}
      <Bonfire x={FIRE.x} z={FIRE.z} />
      <DreamMoon />
    </group>
  );
}

/** Particle flame: soft additive licks rising and cooling, embers, smooth flicker. */
function Bonfire({ x, z }: { x: number; z: number }) {
  const y = groundHeight(x, z);
  const pts = useRef<THREE.Points>(null);
  const light = useRef<THREE.PointLight>(null);
  const COUNT = 90;
  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    const rand = rng(404);
    const seed = new Float32Array(COUNT * 4);
    for (let i = 0; i < seed.length; i++) seed[i] = rand();
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(COUNT * 3), 3));
    g.setAttribute("aSeed", new THREE.BufferAttribute(seed, 4));
    return g;
  }, []);
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        uniforms: { uTime: { value: 0 }, uPR: { value: 1 } },
        vertexShader: /* glsl */ `
          attribute vec4 aSeed; uniform float uTime, uPR;
          varying float vLife; varying float vEmber;
          void main() {
            float ember = step(0.86, aSeed.w);
            float speed = mix(0.9, 0.35, ember);
            float life = fract(uTime * speed * (0.8 + aSeed.x * 0.5) + aSeed.y);
            float rise = life * mix(0.9, 2.6, ember);
            float ang = aSeed.z * 6.2831;
            float r = (1.0 - life) * 0.22 * (0.4 + aSeed.x) + ember * life * 0.4;
            vec3 p = vec3(cos(ang) * r + sin(uTime * 3.0 + aSeed.y * 20.0) * 0.04 * life, rise, sin(ang) * r);
            vec4 mv = modelViewMatrix * vec4(p, 1.0);
            float size = mix(mix(55.0, 10.0, life), 4.0, ember);
            gl_PointSize = size * uPR / -mv.z;
            vLife = life; vEmber = ember;
            gl_Position = projectionMatrix * mv;
          }
        `,
        fragmentShader: /* glsl */ `
          varying float vLife; varying float vEmber;
          void main() {
            float d = length(gl_PointCoord - 0.5) * 2.0;
            float a = smoothstep(1.0, 0.0, d);
            vec3 hot = vec3(1.0, 0.85, 0.55), mid = vec3(1.0, 0.45, 0.12), cool = vec3(0.55, 0.12, 0.04);
            vec3 col = mix(hot, mid, smoothstep(0.0, 0.45, vLife));
            col = mix(col, cool, smoothstep(0.45, 1.0, vLife));
            float fade = (1.0 - vLife) * smoothstep(0.0, 0.08, vLife);
            float bright = mix(2.2, 6.0, vEmber);
            gl_FragColor = vec4(col * a * a * fade * bright * mix(0.55, 1.0, vEmber), 1.0);
          }
        `,
      }),
    []
  );
  useFrame(({ gl }) => {
    const t = story.time;
    if (pts.current) {
      const u = (pts.current.material as THREE.ShaderMaterial).uniforms;
      u.uTime.value = t;
      u.uPR.value = gl.getPixelRatio();
    }
    // layered sines ≈ smooth noise, no strobing
    if (light.current) light.current.intensity = 7 + Math.sin(t * 7.3) * 0.8 + Math.sin(t * 13.1 + 1.3) * 0.5 + Math.sin(t * 3.1) * 0.6;
  });
  return (
    <group position={[x, y, z]}>
      {[0, 1, 2, 3].map((i) => (
        <mesh key={i} position={[0, 0.07, 0]} rotation={[0, (i * Math.PI) / 4 + 0.3, Math.PI / 2 - 0.25]} material={toon("#2a1e18", "wood")}>
          <cylinderGeometry args={[0.05, 0.065, 0.85, 8]} />
        </mesh>
      ))}
      {/* glowing coal bed */}
      <mesh position={[0, 0.03, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.28, 20]} />
        <meshBasicMaterial color={new THREE.Color("#ff5a1a").multiplyScalar(2.5)} />
      </mesh>
      {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
        <mesh key={`r${i}`} position={[Math.cos(i * 0.785) * 0.42, 0.06, Math.sin(i * 0.785) * 0.42]} material={toon("#55524c", "stone")}>
          <dodecahedronGeometry args={[0.09, 0]} />
        </mesh>
      ))}
      <points ref={pts} geometry={geo} material={mat} frustumCulled={false} position={[0, 0.05, 0]} />
      <pointLight ref={light} position={[0, 0.7, 0]} color="#ff8a3a" distance={10} decay={1.5} />
    </group>
  );
}

// ── The decoy: a lantern that looks a LOT like a moon ──────────────────────
function Lantern() {
  const glow = useRef<THREE.MeshBasicMaterial>(null);
  const light = useRef<THREE.PointLight>(null);
  const fake = chapterIndex("fake");
  const [x, y, z] = LANTERN_POS;
  useFrame(() => {
    const p = presence(story.t, fake, 0.8);
    const flicker = 0.92 + Math.sin(story.time * 13) * 0.04 + Math.sin(story.time * 7.3) * 0.04;
    // only switches on once it's properly dark (off through golden hour and sunset)
    const dark = 1 - smooth(clamp((live.sun - 0.04) / 0.16));
    // unlit: a dim smoky glass globe, not a glowing white blob
    const b = 0.09 + ((3 + 3 * p) * flicker - 0.09) * dark;
    if (glow.current) glow.current.color.setRGB(b, b * 0.92 + (1 - dark) * 0.005, b * 0.66 + (1 - dark) * 0.035);
    if (light.current) light.current.intensity = (2 + p * 7) * flicker * dark;
  });
  return (
    <group>
      <Box p={[x + 0.55, 1.4, z]} s={[0.12, 2.8, 0.12]} color="#1e1e22" kind="metal" />
      <Box p={[x + 0.3, 2.78, z]} s={[0.6, 0.08, 0.08]} color="#1e1e22" kind="metal" />
      <mesh position={[x, y, z]}>
        <sphereGeometry args={[0.26, 20, 16]} />
        <meshBasicMaterial ref={glow} toneMapped={false} />
      </mesh>
      <pointLight ref={light} position={[x, y - 0.2, z]} color="#ffd88a" distance={8} decay={1.4} />
    </group>
  );
}

// ── Shout rings travelling between hero and friend ─────────────────────────
function ShoutRings() {
  const group = useRef<THREE.Group>(null);
  const shout = chapterIndex("shouting");
  const from = useMemo(() => new THREE.Vector3(-2.0, 1.6, 1.6), []);
  const to = useMemo(() => new THREE.Vector3(4.4, 1.6, -0.2), []);
  useFrame(() => {
    const g = group.current;
    if (!g) return;
    const p = presence(story.t, shout, 0.45);
    g.visible = p > 0.01;
    g.children.forEach((c, i) => {
      const k = (story.time * 0.6 + i / 3) % 1;
      c.position.lerpVectors(from, to, k);
      c.lookAt(to);
      c.scale.setScalar(0.3 + k * 1.4);
      ((c as THREE.Mesh).material as THREE.MeshBasicMaterial).opacity = Math.sin(k * Math.PI) * p;
    });
  });
  return (
    <group ref={group}>
      {[0, 1, 2].map((i) => (
        <mesh key={i}>
          <torusGeometry args={[0.5, 0.035, 6, 32]} />
          <meshBasicMaterial color="#fff6d8" transparent depthWrite={false} />
        </mesh>
      ))}
    </group>
  );
}

// ── Easter egg: a toaster crossing the night sky ───────────────────────────
export const toasterTrigger = { at: -999 };

function Toaster() {
  // 128×128 power-of-two copy without colour-profile chunks: iOS mis-samples the
  // mipmaps of the original odd-sized PNG and the bottom renders black.
  const tex = useTexture("/toaster-sky.png", (t) => {
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
  });
  const ref = useRef<THREE.Sprite>(null);
  const pathRef = useRef({ start: new THREE.Vector3(), end: new THREE.Vector3() });
  const lastStart = useRef(-999);
  useFrame(({ camera }) => {
    const path = pathRef.current;
    const s = ref.current;
    if (!s) return;
    const now = story.time;
    // auto launch every ~24s, or when requested by a click
    const auto = Math.floor(now / 24);
    const startedAt = Math.max(toasterTrigger.at, auto * 24 + 12);
    if (startedAt !== lastStart.current && now >= startedAt) {
      lastStart.current = startedAt;
      const fwd = new THREE.Vector3();
      camera.getWorldDirection(fwd);
      const right = new THREE.Vector3().crossVectors(fwd, camera.up).normalize();
      const center = camera.position.clone().addScaledVector(fwd, 70);
      center.y = Math.max(center.y + 14, 22);
      path.start.copy(center).addScaledVector(right, 70).add(new THREE.Vector3(0, 6, 0));
      path.end.copy(center).addScaledVector(right, -70).add(new THREE.Vector3(0, -4, 0));
    }
    const k = (now - lastStart.current) / 6;
    s.visible = k >= 0 && k <= 1;
    if (s.visible) {
      s.position.lerpVectors(path.start, path.end, k);
      s.material.rotation = Math.sin(now * 3) * 0.3;
    }
  });
  return (
    <sprite ref={ref} scale={[5, 5, 1]} visible={false}>
      <spriteMaterial map={tex} toneMapped={false} fog={false} />
    </sprite>
  );
}

export default function Props() {
  return (
    <>
      <Cottage />
      <Hilltop />
      <Lantern />
      <Driveway />
      <ShoutRings />
      <Toaster />
    </>
  );
}
