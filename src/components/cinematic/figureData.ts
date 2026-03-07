// src/components/cinematic/figureData.ts
// Generates human silhouette point positions using geometric primitives.

export interface FigureData {
  standingPositions: Float32Array;
  pointingPositions: Float32Array;
  scatterPositions: Float32Array;
  count: number;
}

// Seeded PRNG (mulberry32)
function mulberry32(seed: number): () => number {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Sample points inside an ellipse centered at (cx, cy) with radii (rx, ry)
function sampleEllipse(
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  count: number,
  rand: () => number,
): [number, number][] {
  const points: [number, number][] = [];
  while (points.length < count) {
    const x = cx + (rand() * 2 - 1) * rx;
    const y = cy + (rand() * 2 - 1) * ry;
    const dx = (x - cx) / rx;
    const dy = (y - cy) / ry;
    if (dx * dx + dy * dy <= 1) {
      points.push([x, y]);
    }
  }
  return points;
}

// Sample points inside a rectangle centered at (cx, cy) with half-width hw and half-height hh
function sampleRect(
  cx: number,
  cy: number,
  hw: number,
  hh: number,
  count: number,
  rand: () => number,
): [number, number][] {
  const points: [number, number][] = [];
  for (let i = 0; i < count; i++) {
    const x = cx + (rand() * 2 - 1) * hw;
    const y = cy + (rand() * 2 - 1) * hh;
    points.push([x, y]);
  }
  return points;
}

// Sample points inside a trapezoid (wider at top, narrower at bottom)
function sampleTrapezoid(
  cx: number,
  cy: number,
  topHalfWidth: number,
  bottomHalfWidth: number,
  halfHeight: number,
  count: number,
  rand: () => number,
): [number, number][] {
  const points: [number, number][] = [];
  for (let i = 0; i < count; i++) {
    const t = rand(); // 0=bottom, 1=top
    const y = cy - halfHeight + t * halfHeight * 2;
    const hw = bottomHalfWidth + (topHalfWidth - bottomHalfWidth) * t;
    const x = cx + (rand() * 2 - 1) * hw;
    points.push([x, y]);
  }
  return points;
}

// Sample points along a line from (x1, y1) to (x2, y2) with tapered width
function sampleLine(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  widthStart: number,
  widthEnd: number,
  count: number,
  rand: () => number,
): [number, number][] {
  const points: [number, number][] = [];
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.sqrt(dx * dx + dy * dy);
  const nx = -dy / len;
  const ny = dx / len;

  for (let i = 0; i < count; i++) {
    const t = rand();
    const width = widthStart + (widthEnd - widthStart) * t;
    const spread = (rand() * 2 - 1) * width * 0.5;
    const x = x1 + dx * t + nx * spread;
    const y = y1 + dy * t + ny * spread;
    points.push([x, y]);
  }
  return points;
}

export function generateFigure(
  offsetX: number,
  offsetY: number,
  scale: number,
  hasPointing: boolean,
  seed: number,
): FigureData {
  const rand = mulberry32(seed);

  // Body part point counts (total = 755)
  const HEAD_COUNT = 85;
  const NECK_COUNT = 20;
  const SHOULDER_COUNT = 30;
  const TORSO_COUNT = 220;
  const HIP_COUNT = 20;
  const LEFT_ARM_COUNT = 65;
  const RIGHT_ARM_COUNT = 65;
  const LEFT_LEG_COUNT = 100;
  const RIGHT_LEG_COUNT = 100;
  const LEFT_FOOT_COUNT = 25;
  const RIGHT_FOOT_COUNT = 25;
  const TOTAL =
    HEAD_COUNT + NECK_COUNT + SHOULDER_COUNT + TORSO_COUNT + HIP_COUNT +
    LEFT_ARM_COUNT + RIGHT_ARM_COUNT +
    LEFT_LEG_COUNT + RIGHT_LEG_COUNT +
    LEFT_FOOT_COUNT + RIGHT_FOOT_COUNT;

  // ---- Standing pose (local coords, centered at 0,0 at feet) ----

  // Head: ellipse at (0, 1.5), slightly wider
  const head = sampleEllipse(0, 1.50, 0.13, 0.15, HEAD_COUNT, rand);

  // Neck: connecting head to shoulders
  const neck = sampleRect(0, 1.33, 0.05, 0.04, NECK_COUNT, rand);

  // Shoulders: wide horizontal bar
  const shoulders = sampleEllipse(0, 1.26, 0.22, 0.04, SHOULDER_COUNT, rand);

  // Torso: trapezoid wider at shoulders, narrower at waist
  const torso = sampleTrapezoid(0, 0.95, 0.19, 0.12, 0.30, TORSO_COUNT, rand);

  // Hips: wider area at base of torso
  const hips = sampleEllipse(0, 0.62, 0.15, 0.05, HIP_COUNT, rand);

  // Left arm: from shoulder down, tapers slightly
  const leftArmStanding = sampleLine(
    -0.20, 1.24, -0.22, 0.65, 0.08, 0.06, LEFT_ARM_COUNT, rand,
  );

  // Right arm: from shoulder down, tapers slightly
  const rightArmStanding = sampleLine(
    0.20, 1.24, 0.22, 0.65, 0.08, 0.06, RIGHT_ARM_COUNT, rand,
  );

  // Left leg: from hip down, spread out more, tapers
  const leftLeg = sampleLine(
    -0.10, 0.62, -0.14, 0.05, 0.10, 0.07, LEFT_LEG_COUNT, rand,
  );

  // Right leg: from hip down, spread out more, tapers
  const rightLeg = sampleLine(
    0.10, 0.62, 0.14, 0.05, 0.10, 0.07, RIGHT_LEG_COUNT, rand,
  );

  // Left foot: small horizontal ellipse
  const leftFoot = sampleEllipse(-0.14, 0.02, 0.07, 0.03, LEFT_FOOT_COUNT, rand);

  // Right foot: small horizontal ellipse
  const rightFoot = sampleEllipse(0.14, 0.02, 0.07, 0.03, RIGHT_FOOT_COUNT, rand);

  // Assemble standing positions
  const standingLocal: [number, number][] = [
    ...head,
    ...neck,
    ...shoulders,
    ...torso,
    ...hips,
    ...leftArmStanding,
    ...rightArmStanding,
    ...leftLeg,
    ...rightLeg,
    ...leftFoot,
    ...rightFoot,
  ];

  // ---- Pointing pose ----
  let pointingLocal: [number, number][];
  if (hasPointing) {
    const pointRand = mulberry32(seed + 9999);
    // Right arm reaches up and out to point at the moon
    const rightArmPointing = sampleLine(
      0.20, 1.24, 0.50, 1.80, 0.07, 0.05, RIGHT_ARM_COUNT, pointRand,
    );
    pointingLocal = [
      ...head,
      ...neck,
      ...shoulders,
      ...torso,
      ...hips,
      ...leftArmStanding,
      ...rightArmPointing,
      ...leftLeg,
      ...rightLeg,
      ...leftFoot,
      ...rightFoot,
    ];
  } else {
    pointingLocal = standingLocal;
  }

  // ---- Build Float32Arrays with offset and scale applied ----
  const standing = new Float32Array(TOTAL * 3);
  const pointing = new Float32Array(TOTAL * 3);
  const scatter = new Float32Array(TOTAL * 3);

  const scatterRand = mulberry32(seed + 5555);

  for (let i = 0; i < TOTAL; i++) {
    const i3 = i * 3;

    standing[i3] = standingLocal[i][0] * scale + offsetX;
    standing[i3 + 1] = standingLocal[i][1] * scale + offsetY;
    standing[i3 + 2] = (scatterRand() - 0.5) * 0.1;

    pointing[i3] = pointingLocal[i][0] * scale + offsetX;
    pointing[i3 + 1] = pointingLocal[i][1] * scale + offsetY;
    pointing[i3 + 2] = standing[i3 + 2];

    scatter[i3] = offsetX + (scatterRand() * 2 - 1) * 6;
    scatter[i3 + 1] = offsetY + (scatterRand() * 2 - 1) * 4;
    scatter[i3 + 2] = (scatterRand() * 2 - 1) * 2;
  }

  return {
    standingPositions: standing,
    pointingPositions: pointing,
    scatterPositions: scatter,
    count: TOTAL,
  };
}
