"use client";

import { Suspense, useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import {
  EffectComposer,
  Bloom,
  Vignette,
  Noise,
  ChromaticAberration,
  ToneMapping,
  HueSaturation,
  BrightnessContrast,
} from "@react-three/postprocessing";
import { BlendFunction, ToneMappingMode } from "postprocessing";
import * as THREE from "three";
import { chapters, heroPoses, friendPoses } from "./chapters";
import { story, live, updatePalette, segment, samplePose, makeSampledPose, clamp } from "./state";
import { tick } from "./timeline";
import SkyWorld, { sunDir, moonDir, dirFromAngles, SUN_AZ } from "./Sky";
import Nature from "./Nature";
import Props from "./Props";
import Character, { type Look } from "./Character";

const heroLook: Look = {
  coat: "#b8862e",
  coatTrim: "#d9cdb4",
  trousers: "#262f45",
  skin: "#d4a185",
  hair: "#3a2418",
  scarf: "#7a2420",
  hat: "beanie",
  hatColor: "#6e221d",
};

const friendLook: Look = {
  coat: "#2c5244",
  coatTrim: "#cfc6b6",
  trousers: "#34303f",
  skin: "#b07e62",
  hair: "#7a3a1c",
  scarf: "#b8923e",
  hat: "bun",
};

const lookAt = new THREE.Vector3();
const smoothPointer = new THREE.Vector2();
const lightDir = new THREE.Vector3();
const heroNow = makeSampledPose();
const heroHead = new THREE.Vector3();
const back = new THREE.Vector3();
const offset = new THREE.Vector2(0.0007, 0.0005);

function Director() {
  const curves = useMemo(() => {
    const pos = new THREE.CatmullRomCurve3(
      chapters.map((c) => new THREE.Vector3(...c.camera.pos)),
      false,
      "centripetal"
    );
    const look = new THREE.CatmullRomCurve3(
      chapters.map((c) => new THREE.Vector3(...c.camera.look)),
      false,
      "centripetal"
    );
    return { pos, look };
  }, []);

  useFrame(({ camera, size, scene }, delta) => {
    const dt = Math.min(delta, 0.05);
    story.time += dt;
    tick(dt, performance.now() / 1000);
    updatePalette(story.t);

    // Seeking across chapters glides linearly; playback eases into each shot.
    let u: number;
    if (story.seeking) u = clamp(story.t / (chapters.length - 1));
    else {
      const { i, f } = segment(story.t);
      u = (i + f) / (chapters.length - 1);
    }
    curves.pos.getPoint(u, camera.position);
    curves.look.getPoint(u, lookAt);

    const portrait = clamp((1 - size.width / size.height) / 0.5);
    if (portrait > 0) {
      samplePose(heroPoses, story.t, heroNow);
      if (heroNow.visible) {
        heroHead.set(heroNow.x, 1.3, heroNow.z);
        lookAt.lerp(heroHead, 0.7 * portrait);
      }
      back.subVectors(camera.position, lookAt);
      back.y = 0;
      back.normalize();
      camera.position.addScaledVector(back, 4 * portrait);
    }

    // handheld camera: slow drift + micro shake + pointer parallax
    smoothPointer.lerp(story.pointer, 1 - Math.exp(-dt * 2));
    const tt = story.time;
    camera.position.x += smoothPointer.x * 0.25 + Math.sin(tt * 0.31) * 0.05 + Math.sin(tt * 1.7) * 0.006;
    camera.position.y += smoothPointer.y * 0.12 + Math.sin(tt * 0.43) * 0.035 + Math.sin(tt * 2.3) * 0.005;
    camera.lookAt(lookAt);
    camera.rotateZ(Math.sin(tt * 0.27) * 0.004);

    const cam = camera as THREE.PerspectiveCamera;
    const { i, f } = segment(story.t);
    const fa = chapters[i].camera.fov ?? 44;
    const fb = chapters[i + 1].camera.fov ?? 44;
    const aspect = size.width / size.height;
    cam.fov = fa + (fb - fa) * f + (aspect < 1 ? (1 - aspect) * 24 : 0);
    cam.updateProjectionMatrix();

    dirFromAngles(SUN_AZ, -6 + live.sun * 9, sunDir);
    const fog = scene.fog as THREE.FogExp2;
    fog.color.copy(live.horizon).lerp(live.mid, 0.35);
    fog.density = 0.0075 + (1 - live.sun) * 0.002;
  });
  return null;
}

function Lights({ lite }: { lite: boolean }) {
  const key = useRef<THREE.DirectionalLight>(null);
  const hemi = useRef<THREE.HemisphereLight>(null);
  const fill = useRef<THREE.DirectionalLight>(null);
  const { scene, camera } = useThree();

  useEffect(() => {
    const k = key.current;
    if (!k) return;
    scene.add(k.target);
    const sc = k.shadow.camera as THREE.OrthographicCamera;
    Object.assign(sc, { left: -24, right: 24, top: 24, bottom: -24, near: 1, far: 160 });
    sc.updateProjectionMatrix();
    Object.assign(k.shadow, { bias: -0.0004, normalBias: 0.03, radius: 4 });
    return () => {
      scene.remove(k.target);
    };
  }, [scene]);

  useFrame(() => {
    const k = key.current;
    if (k) {
      lightDir.copy(sunDir).lerp(moonDir, 1 - live.sun).normalize();
      lightDir.y = Math.max(lightDir.y, 0.16);
      k.position.copy(lightDir).normalize().multiplyScalar(70);
      k.color.copy(live.key);
      k.intensity = live.keyIntensity;
    }
    // soft fill from above the camera keeps subjects readable at night
    const fl = fill.current;
    if (fl) {
      fl.position.copy(camera.position);
      fl.position.y += 2.5;
      fl.target.position.copy(lookAt);
      fl.target.updateMatrixWorld();
      fl.color.copy(live.key).lerp(live.ambient, 0.4);
      fl.intensity = 0.6 + (1 - live.sun) * 0.9;
    }
    const h = hemi.current;
    if (h) {
      h.color.copy(live.zenith).lerp(live.ambient, 0.5);
      h.groundColor.copy(live.grassBase).multiplyScalar(0.6);
      h.intensity = live.ambientIntensity * 2.6;
    }
  });
  return (
    <>
      <directionalLight ref={key} castShadow shadow-mapSize={lite ? [1024, 1024] : [2048, 2048]} />
      <hemisphereLight ref={hemi} />
      <directionalLight ref={fill} />
    </>
  );
}

/** Regular meshes cast and receive shadows (custom shader layers excluded). */
function ShadowSetup() {
  const { scene } = useThree();
  useEffect(() => {
    const apply = () =>
      scene.traverse((o) => {
        const m = o as THREE.Mesh;
        if (!m.isMesh || m.material instanceof THREE.ShaderMaterial) return;
        const mat = m.material as THREE.Material;
        if (mat.transparent || mat instanceof THREE.MeshBasicMaterial) return;
        m.castShadow = true;
        m.receiveShadow = true;
      });
    apply();
    const id = setTimeout(apply, 1500);
    return () => clearTimeout(id);
  }, [scene]);
  return null;
}

export default function World({ lite }: { lite: boolean }) {
  return (
    <>
      <fogExp2 attach="fog" args={["#c08a70", 0.008]} />
      <Director />
      <Lights lite={lite} />
      <SkyWorld />
      <Nature lite={lite} />
      <Suspense fallback={null}>
        <Props />
      </Suspense>
      <Character look={heroLook} track={heroPoses} />
      <Character look={friendLook} track={friendPoses} />
      <ShadowSetup />
      <EffectComposer multisampling={lite ? 0 : 4}>
        <Bloom intensity={0.75} luminanceThreshold={1.0} luminanceSmoothing={0.3} mipmapBlur radius={0.8} />
        <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
        <HueSaturation saturation={0.1} />
        <BrightnessContrast brightness={0.03} contrast={0.08} />
        <ChromaticAberration offset={offset} radialModulation modulationOffset={0.35} />
        <Noise opacity={0.06} blendFunction={BlendFunction.OVERLAY} premultiply />
        <Vignette eskil={false} offset={0.22} darkness={0.6} />
      </EffectComposer>
    </>
  );
}
