"use client";

import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { generateFigure, type FigureData } from "./figureData";
import { timeline, PHASES, progress, easeOut, easeInOut } from "./timeline";

interface FigurePointsProps {
  figure: FigureData;
  hasPointing: boolean;
}

function FigurePoints({ figure, hasPointing }: FigurePointsProps) {
  const meshRef = useRef<THREE.Points>(null);

  // Create geometry imperatively so we can update positions each frame
  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    // Initialize with scatter positions
    const positions = new Float32Array(figure.count * 3);
    positions.set(figure.scatterPositions);
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    return geo;
  }, [figure]);

  useFrame(() => {
    if (!meshRef.current) return;

    const elapsed = timeline.elapsed;
    const posAttr = geometry.getAttribute("position") as THREE.BufferAttribute;
    const positions = posAttr.array as Float32Array;

    // Phase 1: scatter -> standing (FIGURES_START to FIGURES_END, i.e. 1-3s)
    const formRaw = progress(elapsed, PHASES.FIGURES_START, PHASES.FIGURES_END);
    const formProgress = easeOut(formRaw);

    // Phase 2: standing -> pointing for pointing figure (ARM_START to ARM_END, i.e. 4-5s)
    let armProgress = 0;
    if (hasPointing) {
      const armRaw = progress(elapsed, PHASES.ARM_START, PHASES.ARM_END);
      armProgress = easeInOut(armRaw);
    }

    // Shimmer: subtle micro-drift after figures are formed
    const shimmerActive = elapsed > PHASES.FIGURES_END;

    for (let i = 0; i < figure.count; i++) {
      const i3 = i * 3;

      // Compute the target position (standing blended with pointing)
      const targetX =
        figure.standingPositions[i3] +
        (figure.pointingPositions[i3] - figure.standingPositions[i3]) * armProgress;
      const targetY =
        figure.standingPositions[i3 + 1] +
        (figure.pointingPositions[i3 + 1] - figure.standingPositions[i3 + 1]) * armProgress;
      const targetZ =
        figure.standingPositions[i3 + 2] +
        (figure.pointingPositions[i3 + 2] - figure.standingPositions[i3 + 2]) * armProgress;

      // Lerp from scatter to target
      let x =
        figure.scatterPositions[i3] +
        (targetX - figure.scatterPositions[i3]) * formProgress;
      let y =
        figure.scatterPositions[i3 + 1] +
        (targetY - figure.scatterPositions[i3 + 1]) * formProgress;
      let z =
        figure.scatterPositions[i3 + 2] +
        (targetZ - figure.scatterPositions[i3 + 2]) * formProgress;

      // Add shimmer after formed
      if (shimmerActive) {
        const phase = i * 1.7 + elapsed * 2.0;
        x += Math.sin(phase) * 0.005;
        y += Math.cos(phase * 1.3) * 0.005;
        z += Math.sin(phase * 0.7) * 0.003;
      }

      positions[i3] = x;
      positions[i3 + 1] = y;
      positions[i3 + 2] = z;
    }

    posAttr.needsUpdate = true;
  });

  const material = useMemo(
    () =>
      new THREE.PointsMaterial({
        color: new THREE.Color("#c0d0e0"),
        size: 0.04,
        transparent: true,
        opacity: 0.9,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        sizeAttenuation: true,
      }),
    [],
  );

  return (
    <points ref={meshRef} geometry={geometry} material={material} frustumCulled={false} />
  );
}

export default function ParticleFigures() {
  // Generate figure data once
  const figures = useMemo(() => {
    const figure1 = generateFigure(-0.7, -3.2, 1.8, false, 42);
    const figure2 = generateFigure(0.7, -3.2, 1.8, true, 137);
    return { figure1, figure2 };
  }, []);

  return (
    <group>
      <FigurePoints figure={figures.figure1} hasPointing={false} />
      <FigurePoints figure={figures.figure2} hasPointing={true} />
    </group>
  );
}
