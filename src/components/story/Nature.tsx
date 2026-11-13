"use client";

import { useLayoutEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { live, story, presence, samplePose, makeSampledPose } from "./state";
import { chapterIndex, heroPoses } from "./chapters";
import { rng, groundHeight, HILL, onDriveway } from "./toon";
import { needles, leaves, bark, earth } from "./textures";
import { sunDir, moonDir } from "./Sky";
import { MOON_AZ } from "./Sky";

const lightV = new THREE.Vector3();

const FOG_GLSL_PARS = /* glsl */ `
  uniform vec3 fogColor; uniform float fogDensity;
`;

// Areas to keep clear of trees/grass.
const COTTAGE = { x0: -10.2, x1: -3.8, z0: -5.6, z1: -0.4 };
function inCottage(x: number, z: number, pad = 0) {
  return x > COTTAGE.x0 - pad && x < COTTAGE.x1 + pad && z > COTTAGE.z0 - pad && z < COTTAGE.z1 + pad;
}

// ── Ground ─────────────────────────────────────────────────────────────────
function Ground() {
  const geo = useMemo(() => {
    const g = new THREE.PlaneGeometry(520, 520, 300, 300);
    g.rotateX(-Math.PI / 2);
    const p = g.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < p.count; i++) p.setY(i, groundHeight(p.getX(i), p.getZ(i)));
    g.computeVertexNormals();
    // patchy grass / dry earth variation baked into vertex colours
    const rand = rng(5);
    const cols: number[] = [];
    const c = new THREE.Color();
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), z = p.getZ(i);
      const n = Math.sin(x * 0.21 + Math.sin(z * 0.17) * 2) * Math.cos(z * 0.19 - x * 0.07) * 0.5 + 0.5;
      c.setRGB(0.78 + n * 0.3 + rand() * 0.08, 0.82 + n * 0.22 + rand() * 0.06, 0.7 + rand() * 0.06);
      cols.push(c.r, c.g, c.b);
    }
    g.setAttribute("color", new THREE.Float32BufferAttribute(cols, 3));
    return g;
  }, []);
  const mat = useMemo(() => {
    const e = earth();
    const map = e.map.clone();
    const bump = e.bump.clone();
    map.repeat.set(90, 90);
    bump.repeat.set(90, 90);
    map.needsUpdate = bump.needsUpdate = true;
    return new THREE.MeshStandardMaterial({ color: "#3c4a22", roughness: 1, vertexColors: true, map, bumpMap: bump, bumpScale: 1.5 });
  }, []);
  const ref = useRef<THREE.Mesh>(null);
  useFrame(() => {
    if (ref.current) (ref.current.material as THREE.MeshStandardMaterial).color.copy(live.grassBase).lerp(live.grassTip, 0.25);
  });
  return <mesh ref={ref} geometry={geo} material={mat} />;
}

// ── Grass ──────────────────────────────────────────────────────────────────
function Grass({ count }: { count: number }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const blade = useMemo(() => {
    // tapered 4-segment blade, uv.y = 0 at root → 1 at tip
    const w = 0.045;
    const pos: number[] = [];
    const uv: number[] = [];
    const idx: number[] = [];
    const seg = 5;
    for (let i = 0; i <= seg; i++) {
      const t = i / seg;
      const half = (w / 2) * (1 - t * 0.95);
      // slight curl so blades catch light differently
      pos.push(-half, t, t * t * 0.08, half, t, t * t * 0.08);
      uv.push(0, t, 1, t);
      if (i < seg) {
        const k = i * 2;
        idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx);
    return g;
  }, []);

  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        side: THREE.DoubleSide,
        uniforms: {
          uTime: { value: 0 },
          uBase: { value: new THREE.Color() },
          uTip: { value: new THREE.Color() },
          uKey: { value: new THREE.Color() },
          uSky: { value: new THREE.Color() },
          uLightDir: { value: new THREE.Vector3(0, 1, 0) },
          fogColor: { value: new THREE.Color() },
          fogDensity: { value: 0.008 },
        },
        vertexShader: /* glsl */ `
          uniform float uTime;
          varying float vT; varying float vShade; varying float vDist; varying vec3 vWorld; varying vec3 vNormal;
          void main() {
            vT = uv.y;
            vNormal = normalize(mat3(modelMatrix * instanceMatrix) * vec3(0.0, 0.35, 1.0));
            vec4 world = modelMatrix * instanceMatrix * vec4(position, 1.0);
            vec3 root = (modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
            float gust = sin(uTime * 0.8 + root.x * 0.07 - root.z * 0.05) * 0.5 + 0.5;
            float sway = sin(uTime * 1.9 + root.x * 0.45 + root.z * 0.3) * 0.18 + gust * 0.35;
            float bend = uv.y * uv.y;
            world.x += sway * bend * 0.55;
            world.z += sway * bend * 0.25;
            world.y -= bend * gust * 0.08;
            vShade = fract(sin(dot(root.xz, vec2(12.9898, 78.233))) * 43758.5453);
            vWorld = world.xyz;
            vec4 mv = viewMatrix * world;
            vDist = -mv.z;
            gl_Position = projectionMatrix * mv;
          }
        `,
        fragmentShader: /* glsl */ `
          uniform vec3 uBase, uTip, uKey, uSky, uLightDir;
          ${FOG_GLSL_PARS}
          varying float vT; varying float vShade; varying float vDist; varying vec3 vWorld; varying vec3 vNormal;
          void main() {
            vec3 albedo = mix(uBase, uTip, smoothstep(0.0, 1.0, vT));
            // per-blade variation: some dry, some lush
            albedo *= 0.75 + 0.5 * vShade;
            albedo = mix(albedo, albedo * vec3(1.25, 1.1, 0.7), step(0.86, vShade) * vT);
            vec3 N = normalize(vNormal);
            if (!gl_FrontFacing) N = -N;
            vec3 L = normalize(uLightDir);
            vec3 V = normalize(cameraPosition - vWorld);
            float wrap = clamp((dot(N, L) + 0.6) / 1.6, 0.0, 1.0);
            float ao = mix(0.25, 1.0, vT);
            float trans = pow(clamp(dot(V, -L), 0.0, 1.0), 3.0) * vT * vT;
            vec3 H = normalize(L + V);
            float spec = pow(max(dot(N, H), 0.0), 40.0) * 0.15 * vT;
            vec3 col = albedo * (uKey * wrap * ao + uSky * ao * 0.9) + uKey * albedo * trans * 1.6 + uKey * spec;
            float f = 1.0 - exp(-fogDensity * fogDensity * vDist * vDist);
            col = mix(col, fogColor, f);
            gl_FragColor = vec4(col, 1.0);
          }
        `,
      }),
    []
  );

  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const rand = rng(42);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const s = new THREE.Vector3();
    const p = new THREE.Vector3();
    const e = new THREE.Euler();
    let n = 0;
    let guard = 0;
    while (n < count && guard++ < count * 4) {
      // denser near the meadow
      const r = Math.pow(rand(), 0.75) * 46;
      const a = rand() * Math.PI * 2;
      const x = Math.cos(a) * r;
      const z = Math.sin(a) * r * 0.85 - 2;
      if (inCottage(x, z, 0.1) || onDriveway(x, z, -0.08)) continue;
      const h = 0.25 + rand() * 0.5;
      p.set(x, groundHeight(x, z) - 0.02, z);
      e.set((rand() - 0.5) * 0.4, rand() * Math.PI, (rand() - 0.5) * 0.4);
      q.setFromEuler(e);
      s.set(0.8 + rand() * 0.8, h, 1);
      m.compose(p, q, s);
      mesh.setMatrixAt(n++, m);
    }
    mesh.count = n;
    mesh.instanceMatrix.needsUpdate = true;
  }, [count]);

  useFrame(({ scene }) => {
    if (!ref.current) return;
    const u = (ref.current.material as THREE.ShaderMaterial).uniforms;
    u.uTime.value = story.time;
    u.uBase.value.copy(live.grassBase);
    u.uTip.value.copy(live.grassTip);
    u.uKey.value.copy(live.key).multiplyScalar(live.keyIntensity * 0.4);
    u.uSky.value.copy(live.zenith).lerp(live.ambient, 0.6).multiplyScalar(live.ambientIntensity * 1.8);
    lightV.copy(sunDir).lerp(moonDir, 1 - live.sun).normalize();
    lightV.y = Math.max(lightV.y, 0.16);
    u.uLightDir.value.copy(lightV);
    const fog = scene.fog as THREE.FogExp2 | null;
    if (fog) {
      u.fogColor.value.copy(fog.color);
      u.fogDensity.value = fog.density;
    }
  });

  return <instancedMesh ref={ref} args={[blade, mat, count]} frustumCulled={false} />;
}

// ── Forest ─────────────────────────────────────────────────────────────────
function angleDiff(a: number, b: number) {
  return Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));
}

function Forest({ cedars, broadleaf }: { cedars: number; broadleaf: number }) {
  const trunkRef = useRef<THREE.InstancedMesh>(null);
  const crownRef = useRef<THREE.InstancedMesh>(null);
  const blobRef = useRef<THREE.InstancedMesh>(null);
  const blobTrunkRef = useRef<THREE.InstancedMesh>(null);
  const coreRef = useRef<THREE.InstancedMesh>(null);
  const blobCoreRef = useRef<THREE.InstancedMesh>(null);

  // Conifer: drooping branch cards in whorls up a bark trunk (how games do foliage).
  const crownGeo = useMemo(() => {
    const rand = rng(31);
    const cards: THREE.BufferGeometry[] = [];
    const tiers = 18;
    for (let k = 0; k < tiers; k++) {
      const t = k / (tiers - 1);
      const y = 1.2 + t * 6.8;
      const len = 2.4 * (1 - t) + 0.5;
      const n = 12 - Math.floor(t * 5);
      for (let j = 0; j < n; j++) {
        const a = (j / n) * Math.PI * 2 + k * 0.7 + rand() * 0.4;
        const g = new THREE.PlaneGeometry(len, len * 0.62, 3, 1);
        g.translate(len / 2, 0, 0);
        // droop: bend the outer verts down
        const p = g.attributes.position as THREE.BufferAttribute;
        for (let v = 0; v < p.count; v++) {
          const x = p.getX(v);
          p.setY(v, p.getY(v) - (x / len) * (x / len) * len * 0.35);
        }
        g.rotateX(Math.PI / 2 + (rand() - 0.5) * 0.5);
        g.rotateZ(-0.25 - rand() * 0.2);
        g.rotateY(a);
        g.translate(0, y, 0);
        // foliage normals: outward + up, so the crown shades like a volume
        const nrm = g.attributes.normal as THREE.BufferAttribute;
        const pp = g.attributes.position as THREE.BufferAttribute;
        const v3 = new THREE.Vector3();
        for (let v = 0; v < nrm.count; v++) {
          v3.set(pp.getX(v), 0, pp.getZ(v)).normalize();
          v3.y = 0.7;
          v3.normalize();
          nrm.setXYZ(v, v3.x, v3.y, v3.z);
        }
        cards.push(g);
      }
    }
    return mergeGeometries(cards)!;
  }, []);
  // dark inner mass so the crown never looks see-through
  const coreGeo = useMemo(() => {
    const g = new THREE.ConeGeometry(1.55, 7.2, 14, 6);
    const p = g.attributes.position as THREE.BufferAttribute;
    const rand = rng(77);
    for (let i = 0; i < p.count; i++) {
      const k = 0.8 + rand() * 0.25;
      p.setX(i, p.getX(i) * k);
      p.setZ(i, p.getZ(i) * k);
    }
    g.computeVertexNormals();
    g.translate(0, 4.6, 0);
    return g;
  }, []);
  const blobCoreGeo = useMemo(() => {
    const parts = [
      [0, 3.0, 0, 1.15],
      [0.8, 2.6, 0.3, 0.8],
      [-0.75, 2.7, -0.2, 0.85],
      [0.1, 3.7, -0.2, 0.8],
    ].map(([x, y, z, r]) => {
      const g = new THREE.IcosahedronGeometry(r, 2);
      g.translate(x, y, z);
      return g;
    });
    return mergeGeometries(parts)!;
  }, []);
  const trunkGeo = useMemo(() => {
    const g = new THREE.CylinderGeometry(0.07, 0.3, 8.2, 9);
    g.translate(0, 4.0, 0);
    return g;
  }, []);
  // Broadleaf: leaf-cluster cards scattered over a few lobes.
  const blobGeo = useMemo(() => {
    const rand = rng(17);
    const cards: THREE.BufferGeometry[] = [];
    const lobes = [
      [0, 3.0, 0, 1.4],
      [0.9, 2.6, 0.3, 1.0],
      [-0.85, 2.7, -0.2, 1.05],
      [0.1, 3.8, -0.2, 1.0],
    ];
    for (const [cx, cy, cz, r] of lobes) {
      for (let i = 0; i < 46; i++) {
        const u = rand() * Math.PI * 2;
        const v = Math.acos(2 * rand() - 1);
        const rr = r * (0.55 + rand() * 0.45);
        const dir = new THREE.Vector3(Math.sin(v) * Math.cos(u), Math.cos(v), Math.sin(v) * Math.sin(u));
        const size = 0.9 + rand() * 0.5;
        const g = new THREE.PlaneGeometry(size, size);
        g.rotateZ(rand() * Math.PI * 2);
        g.lookAt(dir);
        g.translate(cx + dir.x * rr, cy + dir.y * rr, cz + dir.z * rr);
        const nrm = g.attributes.normal as THREE.BufferAttribute;
        const outward = dir.clone().add(new THREE.Vector3(0, 0.5, 0)).normalize();
        for (let k = 0; k < nrm.count; k++) nrm.setXYZ(k, outward.x, outward.y, outward.z);
        cards.push(g);
      }
    }
    return mergeGeometries(cards)!;
  }, []);
  const blobTrunkGeo = useMemo(() => {
    const g = new THREE.CylinderGeometry(0.1, 0.22, 3.0, 8);
    g.translate(0, 1.5, 0);
    return g;
  }, []);

  useLayoutEffect(() => {
    const rand = rng(7);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const s = new THREE.Vector3();
    const p = new THREE.Vector3();
    const up = new THREE.Vector3(0, 1, 0);
    const col = new THREE.Color();
    const greens = ["#8fa890", "#9ab59a", "#a8b898", "#86a08e", "#b0bf9c"];
    const moonAngle = Math.atan2(Math.sin(MOON_AZ), -Math.cos(MOON_AZ));

    let n = 0;
    let guard = 0;
    while (n < cedars && guard++ < cedars * 20) {
      const r = 20 + Math.pow(rand(), 0.8) * 46;
      const a = rand() * Math.PI * 2;
      const x = Math.cos(a) * r;
      const z = Math.sin(a) * r;
      if (z > 6 && Math.abs(x) < 22) continue; // the camera's side of the valley
      if (angleDiff(Math.atan2(x, z), moonAngle) < 0.32 && r > 18) continue; // keep the moon visible
      if (Math.hypot(x - HILL.x, z - HILL.z) < HILL.r + 2) continue;
      if (Math.hypot(x - 6, z + 13) < 6) continue; // sightline to the hill
      const sc = 0.9 + rand() * 1.1;
      p.set(x, groundHeight(x, z) - 0.2, z);
      q.setFromAxisAngle(up, rand() * Math.PI * 2);
      s.set(sc, sc * (0.9 + rand() * 0.5), sc);
      m.compose(p, q, s);
      trunkRef.current!.setMatrixAt(n, m);
      coreRef.current!.setMatrixAt(n, m);
      crownRef.current!.setMatrixAt(n, m);
      crownRef.current!.setColorAt(n, col.set(greens[Math.floor(rand() * greens.length)]));
      n++;
    }
    // Unused slots get a zero matrix (outline meshes share the full instance count).
    const zero = new THREE.Matrix4().makeScale(0, 0, 0);
    for (let i = n; i < cedars; i++) {
      trunkRef.current!.setMatrixAt(i, zero);
      coreRef.current!.setMatrixAt(i, zero);
      crownRef.current!.setMatrixAt(i, zero);
      crownRef.current!.setColorAt(i, col);
    }

    let b = 0;
    guard = 0;
    while (b < broadleaf && guard++ < broadleaf * 40) {
      const r = 13 + rand() * 12;
      const a = rand() * Math.PI * 2;
      const x = Math.cos(a) * r;
      const z = Math.sin(a) * r * 0.9 - 2;
      if (z > 4) continue;
      if (inCottage(x, z, 2.5)) continue;
      if (angleDiff(Math.atan2(x, z), moonAngle) < 0.4) continue;
      if (Math.hypot(x - 6, z + 13) < 5) continue;
      const sc = 0.8 + rand() * 0.7;
      p.set(x, groundHeight(x, z) - 0.1, z);
      q.setFromAxisAngle(up, rand() * Math.PI * 2);
      s.set(sc, sc, sc);
      m.compose(p, q, s);
      blobRef.current!.setMatrixAt(b, m);
      blobTrunkRef.current!.setMatrixAt(b, m);
      blobCoreRef.current!.setMatrixAt(b, m);
      blobRef.current!.setColorAt(b, col.set(["#c8d4a8", "#d4d8a0", "#b8cca0", "#e0dca8"][b % 4]));
      b++;
    }
    for (let i = b; i < broadleaf; i++) {
      blobRef.current!.setMatrixAt(i, zero);
      blobTrunkRef.current!.setMatrixAt(i, zero);
      blobCoreRef.current!.setMatrixAt(i, zero);
      blobRef.current!.setColorAt(i, col);
    }
    for (const r of [trunkRef, crownRef, blobRef, blobTrunkRef, coreRef, blobCoreRef]) {
      r.current!.instanceMatrix.needsUpdate = true;
      if (r.current!.instanceColor) r.current!.instanceColor.needsUpdate = true;
    }
  }, [cedars, broadleaf]);

  const coreMat = useMemo(() => new THREE.MeshStandardMaterial({ color: "#16241a", roughness: 1 }), []);
  const blobCoreMat = useMemo(() => new THREE.MeshStandardMaterial({ color: "#26361c", roughness: 1 }), []);
  const { crownMat, blobMat, barkMat, crownDepth, blobDepth } = useMemo(() => {
    const nd = needles();
    const lf = leaves();
    const bk = bark();
    const card = (map: THREE.Texture) =>
      new THREE.MeshStandardMaterial({ map, alphaTest: 0.42, side: THREE.DoubleSide, roughness: 0.9 });
    // alpha-cut shadows so foliage casts dappled, not square, shadows
    const depth = (map: THREE.Texture) =>
      new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map, alphaTest: 0.42, side: THREE.DoubleSide });
    const barkMap = bk.map.clone();
    barkMap.repeat.set(1, 4);
    barkMap.needsUpdate = true;
    return {
      crownMat: card(nd.map),
      blobMat: card(lf.map),
      barkMat: new THREE.MeshStandardMaterial({ map: barkMap, bumpMap: bk.bump, bumpScale: 2, roughness: 0.95 }),
      crownDepth: depth(nd.map),
      blobDepth: depth(lf.map),
    };
  }, []);

  return (
    <group>
      <instancedMesh ref={trunkRef} args={[trunkGeo, barkMat, cedars]} frustumCulled={false} />
      <instancedMesh ref={coreRef} args={[coreGeo, coreMat, cedars]} frustumCulled={false} />
      <instancedMesh ref={blobCoreRef} args={[blobCoreGeo, blobCoreMat, broadleaf]} frustumCulled={false} />
      <instancedMesh ref={crownRef} args={[crownGeo, crownMat, cedars]} frustumCulled={false} customDepthMaterial={crownDepth} />
      <instancedMesh ref={blobTrunkRef} args={[blobTrunkGeo, barkMat, broadleaf]} frustumCulled={false} />
      <instancedMesh ref={blobRef} args={[blobGeo, blobMat, broadleaf]} frustumCulled={false} customDepthMaterial={blobDepth} />
    </group>
  );
}

// ── Moon-moths: drifting glow spirits that swarm the winner ────────────────
const spiritHero = makeSampledPose();

function Spirits({ count }: { count: number }) {
  const ref = useRef<THREE.Points>(null);
  const geo = useMemo(() => {
    const rand = rng(99);
    const g = new THREE.BufferGeometry();
    const seeds = new Float32Array(count * 4);
    for (let i = 0; i < count * 4; i++) seeds[i] = rand();
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(count * 3), 3));
    g.setAttribute("aSeed", new THREE.BufferAttribute(seeds, 4));
    return g;
  }, [count]);
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        uniforms: {
          uTime: { value: 0 },
          uSwirl: { value: 0 },
          uBright: { value: 0 },
          uCenter: { value: new THREE.Vector3() },
          uPR: { value: 1 },
        },
        vertexShader: /* glsl */ `
          attribute vec4 aSeed;
          uniform float uTime, uSwirl, uPR; uniform vec3 uCenter;
          varying float vFlick; varying float vHue;
          void main() {
            vec4 s = aSeed;
            vec3 base = vec3(s.x * 44.0 - 22.0, 0.3 + s.y * 4.0, s.z * 30.0 - 20.0);
            base += vec3(sin(uTime * 0.3 + s.w * 20.0) * 1.5, sin(uTime * 0.7 + s.x * 9.0) * 0.5, cos(uTime * 0.25 + s.y * 12.0) * 1.5);
            float a = uTime * (0.7 + s.w * 0.9) + s.x * 6.2831;
            float r = 0.7 + s.y * 2.2;
            vec3 orbit = uCenter + vec3(cos(a) * r, 0.2 + s.z * 3.0 + sin(uTime + s.w * 6.0) * 0.3, sin(a) * r);
            float w = smoothstep(0.0, 1.0, clamp(uSwirl * 1.6 - s.w * 0.6, 0.0, 1.0));
            vec3 p = mix(base, orbit, w);
            vec4 mv = modelViewMatrix * vec4(p, 1.0);
            gl_PointSize = (3.0 + s.w * 5.0) * uPR * (12.0 / -mv.z);
            vFlick = 0.55 + 0.45 * sin(uTime * (2.0 + s.z * 3.0) + s.x * 40.0);
            vHue = s.y;
            gl_Position = projectionMatrix * mv;
          }
        `,
        fragmentShader: /* glsl */ `
          uniform float uBright; varying float vFlick; varying float vHue;
          void main() {
            float d = length(gl_PointCoord - 0.5) * 2.0;
            float a = smoothstep(1.0, 0.0, d);
            float core = smoothstep(0.35, 0.0, d);
            vec3 col = mix(vec3(0.85, 1.0, 0.45), vec3(1.0, 0.8, 0.35), vHue) * 2.5;
            gl_FragColor = vec4((col * a * 0.6 + core * 0.9) * vFlick * uBright, 1.0);
          }
        `,
      }),
    []
  );
  const victory = chapterIndex("victory");
  const luck = chapterIndex("luck");
  useFrame(({ gl }) => {
    if (!ref.current) return;
    const hero = spiritHero;
    samplePose(heroPoses, story.t, hero);
    const u = (ref.current.material as THREE.ShaderMaterial).uniforms;
    u.uTime.value = story.time;
    u.uPR.value = gl.getPixelRatio();
    u.uSwirl.value = Math.max(presence(story.t, victory, 0.7), presence(story.t, luck, 0.6) * 0.6);
    u.uBright.value = live.spirits;
    u.uCenter.value.set(hero.x, 0.4, hero.z);
  });
  return <points ref={ref} geometry={geo} material={mat} frustumCulled={false} />;
}

export default function Nature({ lite }: { lite: boolean }) {
  return (
    <>
      <Ground />
      <Grass count={lite ? 40000 : 140000} />
      <Forest cedars={lite ? 180 : 320} broadleaf={lite ? 18 : 30} />
      <Spirits count={lite ? 90 : 180} />
    </>
  );
}
