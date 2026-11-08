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
  hatColor?: string;
  robe?: boolean; // long robe down to the ground (ancients)
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
  neck: new THREE.CylinderGeometry(0.046, 0.052, 0.12, 14),
  cranium: new THREE.SphereGeometry(0.104, 28, 20),
  jaw: new THREE.SphereGeometry(0.084, 24, 16),
  nose: new THREE.ConeGeometry(0.017, 0.045, 10),
  ear: new THREE.SphereGeometry(0.022, 10, 8),
  eye: new THREE.SphereGeometry(0.0115, 10, 8),
  hairCap: hairGeometry(0.106, 0.58, 7),
  hairLong: hairGeometry(0.108, 0.8, 9),
  beanie: new THREE.SphereGeometry(0.118, 28, 14, 0, Math.PI * 2, 0, Math.PI * 0.5),
  hood: new THREE.SphereGeometry(0.135, 24, 16, 0, Math.PI * 2, 0, Math.PI * 0.62),
};

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
        <mesh geometry={GEO.hand} position={[0, 0, 0.3]} scale={[0.75, 1.05, 1.2]} material={toon(look.skin, "skin")} />
        {children}
      </group>
    </group>
  );
}

export default function Character({
  look,
  track,
  still,
}: {
  look: Look;
  track?: Pose[];
  still?: { x: number; y: number; z: number; rot: number; point?: THREE.Vector3; sway?: number };
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

    if (head.current) {
      const lookUp = pose.armR.point + pose.armR.phone * 0.8 + pose.armL.up * 0.4 + pose.armR.up * 0.3;
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
            <mesh material={toon("#1a1a22", "metal")}>
              <boxGeometry args={[0.075, 0.15, 0.009]} />
            </mesh>
            <mesh position={[0, 0, -0.006]} rotation={[0, Math.PI, 0]}>
              <planeGeometry args={[0.066, 0.135]} />
              <meshBasicMaterial color={new THREE.Color("#bfe6ff").multiplyScalar(2)} />
            </mesh>
          </group>
        </Arm>

        {look.staff && (
          <mesh position={[-0.32, 0.95, 0.18]} rotation={[0.05, 0, 0.05]} material={toon("#5b3a26", "wood")}>
            <cylinderGeometry args={[0.022, 0.028, 1.9, 8]} />
          </mesh>
        )}

        <mesh geometry={GEO.neck} position={[0, 1.55, 0.005]} material={toon(look.skin, "skin")} />

        {/* head */}
        <group ref={head} position={[0, 1.67, 0.01]}>
          <mesh geometry={GEO.cranium} position={[0, 0.02, -0.005]} scale={[0.9, 1.04, 1]} material={toon(look.skin, "skin")} />
          <mesh geometry={GEO.jaw} position={[0, -0.042, 0.016]} scale={[0.84, 0.82, 0.92]} material={toon(look.skin, "skin")} />
          <mesh geometry={GEO.nose} position={[0, -0.01, 0.098]} rotation={[Math.PI / 2 - 0.3, 0, 0]} material={toon(look.skin, "skin")} />
          {[1, -1].map((s) => (
            <group key={s}>
              <mesh geometry={GEO.ear} position={[s * 0.093, -0.002, -0.004]} scale={[0.45, 1, 0.8]} material={toon(look.skin, "skin")} />
              <mesh geometry={GEO.eye} position={[s * 0.033, 0.014, 0.085]} material={toon("#18120e", "metal")} />
              <mesh position={[s * 0.034, 0.038, 0.088]} rotation={[0, 0, s * -0.12]} material={toon(look.hair)}>
                <boxGeometry args={[0.03, 0.006, 0.008]} />
              </mesh>
            </group>
          ))}
          <mesh position={[0, -0.058, 0.084]} material={toon("#8a4a40", "skin")}>
            <boxGeometry args={[0.032, 0.005, 0.006]} />
          </mesh>
          {look.hat !== "hood" && (
            <mesh geometry={look.hat === "bun" ? GEO.hairLong : GEO.hairCap} position={[0, 0.03, -0.012]} rotation={[-0.42, 0, 0]} material={toon(look.hair)} />
          )}
          {look.hat === "beanie" && (
            <group position={[0, 0.045, -0.008]} rotation={[-0.22, 0, 0.06]}>
              <mesh geometry={GEO.beanie} scale={[0.96, 1.06, 1]} material={fabric(look.hatColor ?? "#d33", "knit", 6, 3)} />
              <mesh rotation={[Math.PI / 2, 0, 0]} material={fabric(look.hatColor ?? "#d33", "knit", 6, 3)}>
                <torusGeometry args={[0.112, 0.018, 8, 32]} />
              </mesh>
            </group>
          )}
          {look.hat === "bun" && (
            <>
              <mesh position={[0, 0.1, -0.075]} material={toon(look.hair)}>
                <sphereGeometry args={[0.048, 14, 12]} />
              </mesh>
              <mesh position={[0, 0.0, -0.06]} scale={[1.02, 1.0, 1.0]} material={toon(look.hair)}>
                <sphereGeometry args={[0.106, 24, 16, 0, Math.PI * 2, Math.PI * 0.35, Math.PI * 0.45]} />
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
