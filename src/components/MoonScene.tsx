"use client";

import { useRef, useMemo } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Stars, useTexture, Float } from "@react-three/drei";
import { EffectComposer, Bloom, Vignette } from "@react-three/postprocessing";
import * as THREE from "three";

function Moon() {
  const meshRef = useRef<THREE.Mesh>(null);
  const { viewport, mouse } = useThree();

  useFrame((state) => {
    if (!meshRef.current) return;
    // Slow auto-rotation
    meshRef.current.rotation.y += 0.0008;
    // Subtle mouse parallax
    meshRef.current.position.x = THREE.MathUtils.lerp(
      meshRef.current.position.x,
      (mouse.x * viewport.width) / 12,
      0.03
    );
    meshRef.current.position.y = THREE.MathUtils.lerp(
      meshRef.current.position.y,
      (mouse.y * viewport.height) / 12,
      0.03
    );
  });

  // Procedural moon-like material — creamy white with subtle variation
  const moonMaterial = useMemo(() => {
    return new THREE.MeshStandardMaterial({
      color: new THREE.Color(0xf5f0e8),
      roughness: 0.92,
      metalness: 0.04,
    });
  }, []);

  return (
    <Float speed={0.4} rotationIntensity={0.05} floatIntensity={0.3}>
      <mesh ref={meshRef} material={moonMaterial}>
        <sphereGeometry args={[2.2, 64, 64]} />
      </mesh>
      {/* Glow halo */}
      <mesh>
        <sphereGeometry args={[2.45, 32, 32]} />
        <meshBasicMaterial
          color={new THREE.Color(0xfde68a)}
          transparent
          opacity={0.04}
          side={THREE.BackSide}
        />
      </mesh>
    </Float>
  );
}

function Nebula() {
  const points = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    const count = 300;
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 40;
      positions[i * 3 + 1] = (Math.random() - 0.5) * 40;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 20 - 10;
      const t = Math.random();
      colors[i * 3] = 0.2 + t * 0.3;
      colors[i * 3 + 1] = 0.1 + t * 0.15;
      colors[i * 3 + 2] = 0.4 + t * 0.4;
    }
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    return geo;
  }, []);

  return (
    <points geometry={points}>
      <pointsMaterial size={0.12} vertexColors transparent opacity={0.4} sizeAttenuation />
    </points>
  );
}

function AmbientLight() {
  return (
    <>
      <ambientLight intensity={0.03} />
      <directionalLight position={[5, 3, 5]} intensity={1.4} color="#fff8e7" />
      <pointLight position={[-8, -4, -8]} intensity={0.3} color="#4c1d95" />
    </>
  );
}

export default function MoonScene() {
  return (
    <Canvas
      camera={{ position: [0, 0, 7], fov: 50 }}
      gl={{ antialias: true, alpha: true }}
      style={{ position: "absolute", inset: 0 }}
    >
      <AmbientLight />
      <Moon />
      <Stars radius={120} depth={60} count={6000} factor={5} fade speed={0.5} />
      <Nebula />
      <EffectComposer>
        <Bloom
          intensity={0.8}
          luminanceThreshold={0.6}
          luminanceSmoothing={0.9}
          mipmapBlur
        />
        <Vignette eskil={false} offset={0.2} darkness={0.7} />
      </EffectComposer>
    </Canvas>
  );
}
