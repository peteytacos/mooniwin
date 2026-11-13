"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { live, story, moonWorld } from "./state";
import { rng } from "./toon";

const NOISE = /* glsl */ `
  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123); }
  float hash3(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453123); }
  float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
  }
  float fbm(vec2 p) {
    float v = 0.0, a = 0.5;
    mat2 r = mat2(0.8, -0.6, 0.6, 0.8);
    for (int i = 0; i < 6; i++) { v += a * noise(p); p = r * p * 2.02 + vec2(1.7, 9.2); a *= 0.5; }
    return v;
  }
`;

export const SUN_AZ = 0.5;
export const MOON_AZ = -0.1;

export function dirFromAngles(az: number, elDeg: number, out = new THREE.Vector3()) {
  const el = THREE.MathUtils.degToRad(elDeg);
  return out.set(Math.sin(az) * Math.cos(el), Math.sin(el), -Math.cos(az) * Math.cos(el));
}

export const sunDir = new THREE.Vector3();
export const moonDir = new THREE.Vector3();

// ── Atmosphere ─────────────────────────────────────────────────────────────
function SkyDome() {
  const ref = useRef<THREE.Mesh>(null);
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        side: THREE.BackSide,
        depthWrite: false,
        depthTest: false,
        fog: false,
        uniforms: {
          uZenith: { value: new THREE.Color() },
          uMid: { value: new THREE.Color() },
          uHorizon: { value: new THREE.Color() },
          uCloud: { value: new THREE.Color() },
          uCloudShadow: { value: new THREE.Color() },
          uSunDir: { value: new THREE.Vector3() },
          uMoonDir: { value: new THREE.Vector3() },
          uSun: { value: 0 },
          uStars: { value: 0 },
          uMoonGlow: { value: 0 },
          uTime: { value: 0 },
        },
        vertexShader: /* glsl */ `
          varying vec3 vDir;
          void main() {
            vDir = normalize(position);
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: /* glsl */ `
          uniform vec3 uZenith, uMid, uHorizon, uCloud, uCloudShadow, uSunDir, uMoonDir;
          uniform float uSun, uStars, uMoonGlow, uTime;
          varying vec3 vDir;
          ${NOISE}
          void main() {
            vec3 d = normalize(vDir);
            float h = d.y;
            // uniforms arrive in linear space (THREE.Color handles sRGB conversion)
            float t1 = 1.0 - exp(-max(h, 0.0) * 9.0);
            float t2 = 1.0 - exp(-max(h, 0.0) * 2.6);
            vec3 col = mix(uHorizon, uMid, t1);
            col = mix(col, uZenith, t2);
            if (h < 0.0) col = uHorizon * (0.75 + 0.25 * exp(h * 6.0));

            // Mie forward scattering around the sun + warm horizon band
            float sd = max(dot(d, uSunDir), 0.0);
            vec3 sunCol = vec3(1.0, 0.55, 0.25);
            col += sunCol * (pow(sd, 4.0) * 0.35 + pow(sd, 32.0) * 1.2 + pow(sd, 700.0) * 6.0) * uSun;
            float horizonBand = exp(-abs(h) * 14.0);
            col += sunCol * horizonBand * pow(sd, 1.5) * 0.35 * uSun;
            col += vec3(1.0, 0.8, 0.55) * smoothstep(0.99955, 0.9998, sd) * 40.0 * uSun;

            // moon halo
            float md = max(dot(d, uMoonDir), 0.0);
            col += vec3(0.45, 0.55, 0.8) * (pow(md, 10.0) * 0.05 + pow(md, 200.0) * 0.45) * uMoonGlow;

            // stars with colour temperature and twinkle
            vec3 sp = d * 380.0;
            vec3 cell = floor(sp);
            float r = hash3(cell);
            vec3 off = vec3(hash3(cell + 3.1), hash3(cell + 7.7), hash3(cell + 1.3)) - 0.5;
            float dist = length(fract(sp) - 0.5 - off * 0.7);
            float star = smoothstep(0.1, 0.0, dist) * step(0.993, r);
            float tw = 0.65 + 0.35 * sin(uTime * (1.0 + r * 5.0) + r * 60.0);
            vec3 starCol = mix(vec3(0.75, 0.85, 1.0), vec3(1.0, 0.85, 0.7), fract(r * 37.0));
            float band = exp(-pow(dot(d, normalize(vec3(0.3, 0.6, 0.75))), 2.0) * 18.0);
            float milky = fbm(d.xz * 6.0 / (h + 0.4)) * band;
            col += (starCol * star * tw * 2.5 + vec3(0.4, 0.45, 0.6) * milky * 0.04) * uStars * smoothstep(0.02, 0.3, h);

            // soft volumetric-looking clouds lit by the sun (or moon at night)
            if (h > 0.0) {
              vec2 uv = d.xz / (h + 0.09) * 0.9 + vec2(uTime * 0.004, uTime * 0.0015);
              float n = fbm(uv * 0.8);
              float detail = fbm(uv * 3.1 + 4.0);
              float cover = smoothstep(0.5, 0.8, n * 0.8 + detail * 0.35) * smoothstep(0.0, 0.06, h) * (1.0 - smoothstep(0.35, 0.75, h));
              vec3 lightDir = normalize(mix(uMoonDir, uSunDir, uSun));
              vec2 toLight = normalize(lightDir.xz + 1e-4);
              float n2 = fbm((uv + toLight * 0.12) * 0.8);
              float lit = clamp(0.5 + (n - n2) * 4.0, 0.0, 1.0);
              float silver = pow(max(dot(d, lightDir), 0.0), 8.0) * (1.0 - cover) * 3.0;
              vec3 cc = mix(uCloudShadow, uCloud, lit);
              cc += uCloud * silver * (uSun + uMoonGlow * 0.3);
              col = mix(col, cc, cover * 0.9);
            }
            gl_FragColor = vec4(col, 1.0);
          }
        `,
      }),
    []
  );

  useFrame(({ camera }) => {
    const mesh = ref.current;
    if (!mesh) return;
    const u = (mesh.material as THREE.ShaderMaterial).uniforms;
    u.uZenith.value.copy(live.zenith);
    u.uMid.value.copy(live.mid);
    u.uHorizon.value.copy(live.horizon);
    u.uCloud.value.copy(live.cloud);
    u.uCloudShadow.value.copy(live.cloudShadow);
    u.uSunDir.value.copy(sunDir);
    u.uMoonDir.value.copy(moonDir);
    u.uSun.value = live.sun;
    u.uStars.value = live.stars;
    u.uMoonGlow.value = live.moonGlow;
    u.uTime.value = story.time;
    mesh.position.copy(camera.position);
  });

  return (
    <mesh ref={ref} material={mat} renderOrder={-10} frustumCulled={false}>
      <sphereGeometry args={[500, 64, 32]} />
    </mesh>
  );
}

// ── Moon: procedural maria + craters, HDR so it blooms ─────────────────────
const MOON_DIST = 360;
const MOON_R = 15;

function Moon() {
  const group = useRef<THREE.Group>(null);
  const body = useRef<THREE.Mesh>(null);
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        fog: false,
        uniforms: { uGlow: { value: 0 }, uSky: { value: new THREE.Color() } },
        vertexShader: /* glsl */ `
          varying vec3 vP; varying vec3 vN; varying vec3 vV;
          void main() {
            vP = position; vN = normalize(normalMatrix * normal);
            vec4 mv = modelViewMatrix * vec4(position, 1.0);
            vV = normalize(-mv.xyz);
            gl_Position = projectionMatrix * mv;
          }
        `,
        fragmentShader: /* glsl */ `
          uniform float uGlow; uniform vec3 uSky;
          varying vec3 vP; varying vec3 vN; varying vec3 vV;
          ${NOISE}
          float crater(vec2 p, float scale) {
            vec2 c = floor(p * scale);
            vec2 f = fract(p * scale) - 0.5;
            float r = hash(c);
            vec2 o = (vec2(hash(c + 1.3), hash(c + 7.1)) - 0.5) * 0.5;
            float d = length(f - o) / (0.15 + 0.25 * r);
            float bowl = smoothstep(1.0, 0.6, d) * 0.5;
            float rim = smoothstep(0.75, 1.0, d) * smoothstep(1.25, 1.0, d);
            return step(0.55, r) * (rim * 0.35 - bowl);
          }
          void main() {
            vec3 p = normalize(vP);
            vec2 q = p.xy * 1.6 + p.z * 0.7;
            float maria = smoothstep(0.42, 0.62, fbm(q * 1.2 + 2.0));
            float c = crater(q, 6.0) + crater(q + 3.3, 13.0) * 0.6 + crater(q + 7.7, 27.0) * 0.4;
            float grain = fbm(q * 18.0) * 0.12;
            vec3 high = vec3(0.92, 0.9, 0.86);
            vec3 low = vec3(0.52, 0.53, 0.56);
            vec3 col = mix(high, low, maria * 0.75) * (0.92 + c * 0.6 + grain);
            float mu = max(dot(vN, vV), 0.0);
            col *= 0.55 + 0.45 * pow(mu, 0.35);
            col = pow(col, vec3(2.2));
            // daytime: a pale, ghostly gibbous moon. Smooth (no crater grit), the sky
            // showing through its seas, a soft shadow edge where the sunlit side ends.
            float seas = smoothstep(0.38, 0.68, fbm(q * 1.0 + 2.0));
            vec3 L = normalize(vec3(0.82, 0.22, 0.52));
            float lit = smoothstep(-0.12, 0.28, dot(p, L));
            float limb = smoothstep(0.0, 0.18, mu);
            float veil = 0.68 * (1.0 - seas * 0.55) * mix(0.1, 1.0, lit) * limb;
            vec3 day = mix(uSky, vec3(0.97, 0.98, 1.02), veil);
            // night is unchanged: full and bright, blooming
            col = mix(day, col * 5.0, uGlow);
            gl_FragColor = vec4(col, 1.0);
          }
        `,
      }),
    []
  );

  useFrame(({ camera }) => {
    dirFromAngles(MOON_AZ, live.moonElevation, moonDir);
    moonWorld.copy(moonDir).multiplyScalar(MOON_DIST).add(camera.position);
    if (body.current) {
      const u = (body.current.material as THREE.ShaderMaterial).uniforms;
      u.uGlow.value = live.moonGlow;
      u.uSky.value.copy(live.mid);
    }
    if (group.current) {
      group.current.position.copy(moonWorld);
      group.current.lookAt(camera.position);
    }
  });

  return (
    <group ref={group}>
      <mesh ref={body} material={mat} renderOrder={-4}>
        <sphereGeometry args={[MOON_R, 64, 48]} />
      </mesh>
    </group>
  );
}

// ── Mountain ranges with aerial perspective ────────────────────────────────
const LAYERS = [
  { r: 75, h: 13, seed: 3, haze: 0.2 },
  { r: 115, h: 24, seed: 7, haze: 0.4 },
  { r: 165, h: 36, seed: 11, haze: 0.58 },
  { r: 230, h: 52, seed: 19, haze: 0.74 },
];

function ridgeGeometry(r: number, h: number, seed: number) {
  const rand = rng(seed);
  const seg = 720;
  const ph = Array.from({ length: 8 }, () => rand() * Math.PI * 2);
  const pos: number[] = [];
  const hgt: number[] = [];
  const idx: number[] = [];
  for (let i = 0; i <= seg; i++) {
    const a = (i / seg) * Math.PI * 2;
    let y =
      0.45 +
      0.25 * Math.sin(a * 3 + ph[0]) +
      0.15 * Math.sin(a * 7 + ph[1]) +
      0.12 * (1 - Math.abs(Math.sin(a * 11 + ph[2]))) +
      0.06 * Math.sin(a * 23 + ph[3]) +
      0.035 * (1 - Math.abs(Math.sin(a * 53 + ph[4]))) +
      0.018 * Math.sin(a * 131 + ph[5]) +
      0.009 * Math.sin(a * 277 + ph[6]);
    const toMoon = Math.abs(Math.atan2(Math.sin(a - (Math.PI - MOON_AZ)), Math.cos(a - (Math.PI - MOON_AZ))));
    y *= 0.55 + 0.45 * THREE.MathUtils.smoothstep(toMoon, 0.05, 0.5);
    const x = Math.sin(a) * r;
    const z = Math.cos(a) * r;
    pos.push(x, y * h, z, x, -8, z);
    hgt.push(1, 0);
    if (i < seg) {
      const k = i * 2;
      idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("aTop", new THREE.Float32BufferAttribute(hgt, 1));
  g.setIndex(idx);
  return g;
}

const dark = new THREE.Color();

function Mountains() {
  const geos = useMemo(() => LAYERS.map((l) => ridgeGeometry(l.r, l.h, l.seed)), []);
  const mats = useMemo(
    () =>
      LAYERS.map(
        () =>
          new THREE.ShaderMaterial({
            side: THREE.DoubleSide,
            fog: false,
            uniforms: {
              uTop: { value: new THREE.Color() },
              uMist: { value: new THREE.Color() },
              uRim: { value: new THREE.Color() },
            },
            vertexShader: /* glsl */ `
              attribute float aTop; varying float vTop; varying float vY; varying vec3 vW;
              void main(){ vTop = aTop; vY = position.y; vW = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }
            `,
            fragmentShader: /* glsl */ `
              uniform vec3 uTop, uMist, uRim; varying float vTop; varying float vY; varying vec3 vW;
              ${NOISE}
              void main(){
                float tex = fbm(vec2(atan(vW.x, vW.z) * 140.0, vY * 0.7)) - 0.5;
                vec3 col = mix(uMist, uTop * (1.0 + tex * 0.5), smoothstep(0.0, 0.8, vTop));
                col += uRim * smoothstep(0.985, 1.0, vTop) * 0.15;
                float m = smoothstep(5.0, -3.0, vY);
                col = mix(col, uMist, m * 0.85);
                gl_FragColor = vec4(col, 1.0);
              }
            `,
          })
      ),
    []
  );
  const group = useRef<THREE.Group>(null);

  useFrame(() => {
    const g = group.current;
    if (!g) return;
    LAYERS.forEach((l, i) => {
      const u = ((g.children[i] as THREE.Mesh).material as THREE.ShaderMaterial).uniforms;
      dark.copy(live.grassBase).multiplyScalar(0.5).lerp(live.zenith, 0.3);
      u.uTop.value.copy(dark).lerp(live.horizon, l.haze * 0.8).lerp(live.mid, l.haze * 0.2);
      u.uMist.value.copy(live.horizon).lerp(live.mid, 0.2 + l.haze * 0.1);
      u.uRim.value.copy(live.key);
    });
  });

  return (
    <group ref={group}>
      {LAYERS.map((l, i) => (
        <mesh key={i} geometry={geos[i]} material={mats[i]} frustumCulled={false} />
      ))}
    </group>
  );
}

export default function SkyWorld() {
  return (
    <>
      <SkyDome />
      <Moon />
      <Mountains />
    </>
  );
}
