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

// Sample points along a line from (x1, y1) to (x2, y2) with some lateral spread
function sampleLine(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  width: number,
  count: number,
  rand: () => number,
): [number, number][] {
  const points: [number, number][] = [];
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.sqrt(dx * dx + dy * dy);
  // Normal direction perpendicular to the line
  const nx = -dy / len;
  const ny = dx / len;

  for (let i = 0; i < count; i++) {
    const t = rand();
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

  // Body part point counts
  const HEAD_COUNT = 90;
  const NECK_COUNT = 25;
  const TORSO_COUNT = 250;
  const LEFT_ARM_COUNT = 75;
  const RIGHT_ARM_COUNT = 75;
  const LEFT_LEG_COUNT = 120;
  const RIGHT_LEG_COUNT = 120;
  const TOTAL =
    HEAD_COUNT +
    NECK_COUNT +
    TORSO_COUNT +
    LEFT_ARM_COUNT +
    RIGHT_ARM_COUNT +
    LEFT_LEG_COUNT +
    RIGHT_LEG_COUNT;

  // ---- Standing pose (local coords, centered at 0,0 at feet) ----

  // Head: circle at (0, 1.45), radius ~0.12
  const head = sampleEllipse(0, 1.45, 0.12, 0.14, HEAD_COUNT, rand);

  // Neck: small rect at (0, 1.3)
  const neck = sampleRect(0, 1.3, 0.04, 0.04, NECK_COUNT, rand);

  // Torso: rect from roughly (0, 0.65) to (0, 1.25), half-width 0.15
  const torso = sampleRect(0, 0.95, 0.15, 0.30, TORSO_COUNT, rand);

  // Left arm at side: line from left shoulder (-0.14, 1.25) down to (-0.16, 0.6)
  const leftArmStanding = sampleLine(
    -0.14, 1.25, -0.16, 0.6, 0.06, LEFT_ARM_COUNT, rand,
  );

  // Right arm at side: line from right shoulder (0.14, 1.25) down to (0.16, 0.6)
  const rightArmStanding = sampleLine(
    0.14, 1.25, 0.16, 0.6, 0.06, RIGHT_ARM_COUNT, rand,
  );

  // Left leg: line from (-0.08, 0.65) down to (-0.10, 0.0)
  const leftLeg = sampleLine(
    -0.08, 0.65, -0.10, 0.0, 0.07, LEFT_LEG_COUNT, rand,
  );

  // Right leg: line from (0.08, 0.65) down to (0.10, 0.0)
  const rightLeg = sampleLine(
    0.08, 0.65, 0.10, 0.0, 0.07, RIGHT_LEG_COUNT, rand,
  );

  // Assemble standing positions
  const standingLocal: [number, number][] = [
    ...head,
    ...neck,
    ...torso,
    ...leftArmStanding,
    ...rightArmStanding,
    ...leftLeg,
    ...rightLeg,
  ];

  // ---- Pointing pose ----
  // Only the right arm differs: goes from shoulder (0.14, 1.25) to (0.45, 1.75) at ~60 degrees
  let pointingLocal: [number, number][];
  if (hasPointing) {
    // Use a new seed branch for the pointing arm so it's deterministic but different
    const pointRand = mulberry32(seed + 9999);
    const rightArmPointing = sampleLine(
      0.14, 1.25, 0.45, 1.75, 0.05, RIGHT_ARM_COUNT, pointRand,
    );
    pointingLocal = [
      ...head,
      ...neck,
      ...torso,
      ...leftArmStanding,
      ...rightArmPointing,
      ...leftLeg,
      ...rightLeg,
    ];
  } else {
    // No pointing difference
    pointingLocal = standingLocal;
  }

  // ---- Build Float32Arrays with offset and scale applied ----
  const standing = new Float32Array(TOTAL * 3);
  const pointing = new Float32Array(TOTAL * 3);
  const scatter = new Float32Array(TOTAL * 3);

  // Scatter PRNG
  const scatterRand = mulberry32(seed + 5555);

  for (let i = 0; i < TOTAL; i++) {
    const i3 = i * 3;

    // Standing
    standing[i3] = standingLocal[i][0] * scale + offsetX;
    standing[i3 + 1] = standingLocal[i][1] * scale + offsetY;
    standing[i3 + 2] = (scatterRand() - 0.5) * 0.1; // slight z spread

    // Pointing
    pointing[i3] = pointingLocal[i][0] * scale + offsetX;
    pointing[i3 + 1] = pointingLocal[i][1] * scale + offsetY;
    pointing[i3 + 2] = standing[i3 + 2]; // same z as standing

    // Scatter: random positions across ~12x8 area centered on offset
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
