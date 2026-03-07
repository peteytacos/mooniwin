const MAX_RIPPLES = 4;

export const ripples = {
  ndcX: new Float32Array(MAX_RIPPLES),
  ndcY: new Float32Array(MAX_RIPPLES),
  times: new Float32Array(MAX_RIPPLES).fill(-1),
  nextSlot: 0,

  add(ndcX: number, ndcY: number) {
    const i = this.nextSlot;
    this.ndcX[i] = ndcX;
    this.ndcY[i] = ndcY;
    this.times[i] = 0;
    this.nextSlot = (i + 1) % MAX_RIPPLES;
  },
};
