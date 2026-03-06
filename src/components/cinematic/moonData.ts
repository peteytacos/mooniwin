// src/components/cinematic/moonData.ts
// Generates dot positions for a stippled moon sphere outline.
// Uses Fibonacci sphere sampling, weighted toward the rim (where surface
// normals are perpendicular to the camera view direction).

/**
 * Generate moon dot positions as a Float32Array of [x, y, z] triples.
 * Points are on a sphere surface, biased toward the visible rim.
 *
 * @param radius - Sphere radius
 * @param count - Number of candidate points to sample
 * @param rimBias - 0-1, higher = more points concentrated at rim
 * @param centerX - Moon center X
 * @param centerY - Moon final Y position
 * @param centerZ - Moon center Z
 * @returns Float32Array of length count * 3
 */
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

  // Camera looks down -Z, so view direction is (0, 0, -1) in local space.
  // Dot product of normal with view = normal.z
  // Rim = where abs(normal.z) is small

  let written = 0;
  let candidate = 0;
  const totalCandidates = count * 4; // oversample then filter

  // Seeded random for deterministic rejection sampling
  let seed = 12345;
  const rand = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };

  while (written < count && candidate < totalCandidates) {
    // Fibonacci sphere point
    const y = 1 - (candidate / (totalCandidates - 1)) * 2; // -1 to 1
    const radiusAtY = Math.sqrt(1 - y * y);
    const theta = goldenAngle * candidate;
    const x = Math.cos(theta) * radiusAtY;
    const z = Math.sin(theta) * radiusAtY;

    // Rim weighting: abs(z) is dot product with camera direction
    // Keep point with probability based on how close to rim it is
    const rimness = 1 - Math.abs(z); // 1 at rim, 0 at center/back
    const keepProbability = (1 - rimBias) + rimBias * rimness;

    if (rand() < keepProbability) {
      positions[written * 3] = x * radius + centerX;
      positions[written * 3 + 1] = y * radius + centerY;
      positions[written * 3 + 2] = z * radius + centerZ;
      written++;
    }

    candidate++;
  }

  // Fill any remaining with rim points if we ran out of candidates
  while (written < count) {
    const theta = rand() * Math.PI * 2;
    const x = Math.cos(theta);
    const y = Math.sin(theta);
    positions[written * 3] = x * radius + centerX;
    positions[written * 3 + 1] = y * radius + centerY;
    positions[written * 3 + 2] = centerZ; // exactly on rim
    written++;
  }

  return positions;
}
