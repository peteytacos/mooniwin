const MAX_STARS = 4;

export const shootingStars = {
  // Start position in screen pixels
  startXPx: new Float32Array(MAX_STARS),
  startYPx: new Float32Array(MAX_STARS),
  // Travel in pixels
  travelX: new Float32Array(MAX_STARS),
  travelY: new Float32Array(MAX_STARS),
  // Timing
  duration: new Float32Array(MAX_STARS), // seconds
  elapsed: new Float32Array(MAX_STARS).fill(-1), // -1 = inactive
  nextSlot: 0,

  add(
    startXPercent: number,
    startYPercent: number,
    travelX: number,
    travelY: number,
    duration: number,
  ) {
    const i = this.nextSlot;
    this.startXPx[i] = (startXPercent / 100) * window.innerWidth;
    this.startYPx[i] = (startYPercent / 100) * window.innerHeight;
    this.travelX[i] = travelX;
    this.travelY[i] = travelY;
    this.duration[i] = duration;
    this.elapsed[i] = 0;
    this.nextSlot = (i + 1) % MAX_STARS;
  },

  /** Returns NDC [x, y] or null if inactive/expired */
  getNDC(i: number): [number, number] | null {
    if (this.elapsed[i] < 0) return null;
    const t = this.elapsed[i] / this.duration[i];
    if (t > 1) return null;
    const px = this.startXPx[i] + this.travelX[i] * t;
    const py = this.startYPx[i] + this.travelY[i] * t;
    const ndcX = (px / window.innerWidth) * 2 - 1;
    const ndcY = -(py / window.innerHeight) * 2 + 1;
    return [ndcX, ndcY];
  },
};
