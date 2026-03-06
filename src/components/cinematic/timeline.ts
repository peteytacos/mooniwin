// src/components/cinematic/timeline.ts

export const timeline = {
  elapsed: 0,
  playing: true,
};

export function resetTimeline() {
  timeline.elapsed = 0;
  timeline.playing = true;
}

// Phase boundaries (seconds)
export const PHASES = {
  FIELD_START: 0,
  FIGURES_START: 0,    // everything together
  FIGURES_END: 4,
  MOON_START: 0,       // everything together
  MOON_END: 3,
  ARM_START: 3.5,
  ARM_END: 5,
  NAV_START: 5,
  DONE: 6.5,
};

/** Returns 0->1 progress for a value within a range, clamped */
export function progress(elapsed: number, start: number, end: number): number {
  if (elapsed < start) return 0;
  if (elapsed > end) return 1;
  return (elapsed - start) / (end - start);
}

/** Ease-out cubic */
export function easeOut(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

/** Ease-in-out cubic */
export function easeInOut(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}
