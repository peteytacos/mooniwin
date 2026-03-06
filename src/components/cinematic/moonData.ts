// src/components/cinematic/moonData.ts
// Generates dot positions for a full 3D moon sphere.

export function generateMoonDots(
  radius: number,
  count: number,
  rimBias: number,
  centerX: number,
  centerY: number,
  centerZ: number,
): Float32Array {
  const positions = new Float32Array(count * 3);
  const goldenAngle = Math.PI * (3 - Math.sqrt(5));

  // Generate exactly `count` points on a Fibonacci sphere
  for (let i = 0; i < count; i++) {
    const y = 1 - (i / (count - 1)) * 2; // 1 to -1 (full sphere)
    const radiusAtY = Math.sqrt(1 - y * y);
    const theta = goldenAngle * i;
    const x = Math.cos(theta) * radiusAtY;
    const z = Math.sin(theta) * radiusAtY;

    positions[i * 3] = x * radius + centerX;
    positions[i * 3 + 1] = y * radius + centerY;
    positions[i * 3 + 2] = z * radius + centerZ;
  }

  return positions;
}
