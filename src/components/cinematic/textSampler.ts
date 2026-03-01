// src/components/cinematic/textSampler.ts

/**
 * Render text to an offscreen canvas and sample filled pixel positions
 * as particle targets. Returns normalized positions centered on origin.
 */
export function sampleTextPositions(
  text: string,
  targetCount: number,
  fontSize: number = 64,
  fontFamily: string = "sans-serif"
): Float32Array {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d")!;

  // Size canvas to fit text
  ctx.font = `bold ${fontSize}px ${fontFamily}`;
  const metrics = ctx.measureText(text);
  const padding = 10;
  canvas.width = Math.ceil(metrics.width) + padding * 2;
  canvas.height = fontSize * 1.5 + padding * 2;

  // Draw text
  ctx.fillStyle = "white";
  ctx.font = `bold ${fontSize}px ${fontFamily}`;
  ctx.textBaseline = "middle";
  ctx.fillText(text, padding, canvas.height / 2);

  // Read pixels
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const filledPixels: [number, number][] = [];

  // Sample every Nth pixel for performance
  const step = Math.max(
    1,
    Math.floor(
      Math.sqrt((canvas.width * canvas.height) / (targetCount * 4))
    )
  );
  for (let y = 0; y < canvas.height; y += step) {
    for (let x = 0; x < canvas.width; x += step) {
      const idx = (y * canvas.width + x) * 4;
      if (imageData.data[idx + 3] > 128) {
        filledPixels.push([x, y]);
      }
    }
  }

  // Downsample to target count
  const selected: [number, number][] = [];
  const stride = Math.max(
    1,
    Math.floor(filledPixels.length / targetCount)
  );
  for (
    let i = 0;
    i < filledPixels.length && selected.length < targetCount;
    i += stride
  ) {
    selected.push(filledPixels[i]);
  }

  // Pad if needed
  while (selected.length < targetCount) {
    selected.push(selected[selected.length - 1] || [0, 0]);
  }

  // Normalize to centered coordinates (-0.5 to 0.5 range for width)
  const positions = new Float32Array(targetCount * 3);
  const w = canvas.width;
  const h = canvas.height;
  for (let i = 0; i < targetCount; i++) {
    const [px, py] = selected[i];
    positions[i * 3] = px / w - 0.5; // -0.5 to 0.5
    positions[i * 3 + 1] = -(py / h - 0.5); // flip Y
    positions[i * 3 + 2] = 0;
  }

  return positions;
}
