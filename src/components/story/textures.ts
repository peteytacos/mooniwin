// Procedural surface textures painted on canvases at load (no downloads).
// Each returns a colour map plus a matching bump map for real surface relief.
import * as THREE from "three";
import { rng } from "./toon";

type Painter = (ctx: CanvasRenderingContext2D, bump: CanvasRenderingContext2D, size: number, rand: () => number) => void;

const cache = new Map<string, { map: THREE.CanvasTexture; bump: THREE.CanvasTexture }>();

function make(key: string, size: number, paint: Painter, seed = 1) {
  const hit = cache.get(key);
  if (hit) return hit;
  const c = document.createElement("canvas");
  const b = document.createElement("canvas");
  c.width = c.height = b.width = b.height = size;
  const ctx = c.getContext("2d")!;
  const bctx = b.getContext("2d")!;
  paint(ctx, bctx, size, rng(seed));
  const map = new THREE.CanvasTexture(c);
  map.colorSpace = THREE.SRGBColorSpace;
  const bump = new THREE.CanvasTexture(b);
  for (const t of [map, bump]) {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = 16;
  }
  const out = { map, bump };
  cache.set(key, out);
  return out;
}

function speckle(ctx: CanvasRenderingContext2D, size: number, rand: () => number, n: number, color: () => string, r: [number, number]) {
  for (let i = 0; i < n; i++) {
    ctx.fillStyle = color();
    const rr = r[0] + rand() * (r[1] - r[0]);
    ctx.beginPath();
    ctx.arc(rand() * size, rand() * size, rr, 0, Math.PI * 2);
    ctx.fill();
  }
}

/** Lime plaster with blotchy weathering and hairline cracks. */
export const plaster = () =>
  make("plaster", 1024, (ctx, bump, s, rand) => {
    ctx.fillStyle = "#d9cdb6";
    ctx.fillRect(0, 0, s, s);
    bump.fillStyle = "#808080";
    bump.fillRect(0, 0, s, s);
    speckle(ctx, s, rand, 3600, () => `rgba(${120 + rand() * 60},${105 + rand() * 50},${80 + rand() * 40},${0.04 + rand() * 0.06})`, [8, 40]);
    speckle(bump, s, rand, 24000, () => `rgba(${rand() < 0.5 ? 0 : 255},${rand() < 0.5 ? 0 : 255},${rand() < 0.5 ? 0 : 255},0.08)`, [0.5, 2.5]);
    // damp staining near the bottom
    const g = ctx.createLinearGradient(0, s * 0.7, 0, s);
    g.addColorStop(0, "rgba(70,60,45,0)");
    g.addColorStop(1, "rgba(70,60,45,0.25)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, s, s);
    ctx.strokeStyle = "rgba(60,50,40,0.35)";
    bump.strokeStyle = "rgba(0,0,0,0.6)";
    for (let i = 0; i < 6; i++) {
      let x = rand() * s, y = rand() * s;
      ctx.beginPath();
      bump.beginPath();
      ctx.moveTo(x, y);
      bump.moveTo(x, y);
      for (let k = 0; k < 8; k++) {
        x += (rand() - 0.5) * 30;
        y += rand() * 18;
        ctx.lineTo(x, y);
        bump.lineTo(x, y);
      }
      ctx.lineWidth = bump.lineWidth = 0.8;
      ctx.stroke();
      bump.stroke();
    }
  }, 11);

/** Overlapping clay roof tiles. */
export const roofTiles = () =>
  make("roof", 1024, (ctx, bump, s, rand) => {
    const rows = 16, cols = 10;
    const h = s / rows, w = s / cols;
    ctx.fillStyle = "#4a2018";
    ctx.fillRect(0, 0, s, s);
    bump.fillStyle = "#000";
    bump.fillRect(0, 0, s, s);
    for (let r = 0; r < rows; r++) {
      const off = r % 2 ? w / 2 : 0;
      for (let c = -1; c <= cols; c++) {
        const x = c * w + off, y = r * h;
        const tone = 0.75 + rand() * 0.4;
        ctx.fillStyle = `rgb(${Math.floor(150 * tone)},${Math.floor(62 * tone)},${Math.floor(40 * tone)})`;
        ctx.beginPath();
        ctx.roundRect(x + 1.5, y, w - 3, h * 1.15, [0, 0, w * 0.45, w * 0.45]);
        ctx.fill();
        const g = bump.createLinearGradient(0, y, 0, y + h * 1.15);
        g.addColorStop(0, "#333");
        g.addColorStop(1, "#fff");
        bump.fillStyle = g;
        bump.beginPath();
        bump.roundRect(x + 1.5, y, w - 3, h * 1.15, [0, 0, w * 0.45, w * 0.45]);
        bump.fill();
        // lichen + soot
        if (rand() < 0.25) {
          ctx.fillStyle = `rgba(${90 + rand() * 40},${100 + rand() * 30},60,0.35)`;
          ctx.beginPath();
          ctx.arc(x + rand() * w, y + rand() * h, 2 + rand() * 5, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
  }, 21);

/** Weathered vertical wood planks. */
export const planks = () =>
  make("planks", 256, (ctx, bump, s, rand) => {
    const n = 5;
    const w = s / n;
    for (let i = 0; i < n; i++) {
      const tone = 0.8 + rand() * 0.3;
      ctx.fillStyle = `rgb(${Math.floor(70 * tone)},${Math.floor(52 * tone)},${Math.floor(38 * tone)})`;
      ctx.fillRect(i * w, 0, w, s);
      bump.fillStyle = "#999";
      bump.fillRect(i * w, 0, w, s);
      for (let k = 0; k < 40; k++) {
        const x = i * w + rand() * w;
        ctx.strokeStyle = `rgba(30,20,14,${0.1 + rand() * 0.2})`;
        bump.strokeStyle = `rgba(0,0,0,${0.2 + rand() * 0.3})`;
        ctx.lineWidth = bump.lineWidth = 0.5 + rand();
        ctx.beginPath();
        bump.beginPath();
        ctx.moveTo(x, 0);
        bump.moveTo(x, 0);
        const bend = (rand() - 0.5) * 6;
        ctx.bezierCurveTo(x + bend, s * 0.3, x - bend, s * 0.7, x, s);
        bump.bezierCurveTo(x + bend, s * 0.3, x - bend, s * 0.7, x, s);
        ctx.stroke();
        bump.stroke();
      }
      bump.fillStyle = "#000";
      bump.fillRect(i * w, 0, 2, s);
      ctx.fillStyle = "rgba(15,10,6,0.8)";
      ctx.fillRect(i * w, 0, 2, s);
    }
  }, 31);

/** Granite / weathered standing stone. */
export const stone = () =>
  make("stone", 1024, (ctx, bump, s, rand) => {
    ctx.fillStyle = "#77736c";
    ctx.fillRect(0, 0, s, s);
    bump.fillStyle = "#808080";
    bump.fillRect(0, 0, s, s);
    speckle(ctx, s, rand, 5600, () => {
      const v = 70 + rand() * 80;
      return `rgba(${v},${v - 3},${v - 8},0.25)`;
    }, [2, 30]);
    speckle(ctx, s, rand, 1200, () => `rgba(${100 + rand() * 40},${120 + rand() * 30},70,${0.15 + rand() * 0.2})`, [4, 22]);
    speckle(bump, s, rand, 20000, () => (rand() < 0.5 ? "rgba(0,0,0,0.12)" : "rgba(255,255,255,0.12)"), [1, 10]);
  }, 41);

/** Rough bark. */
export const bark = () =>
  make("bark", 256, (ctx, bump, s, rand) => {
    ctx.fillStyle = "#3b2b22";
    ctx.fillRect(0, 0, s, s);
    bump.fillStyle = "#777";
    bump.fillRect(0, 0, s, s);
    for (let i = 0; i < 70; i++) {
      const x = rand() * s;
      const w = 2 + rand() * 6;
      ctx.fillStyle = `rgba(20,14,10,${0.3 + rand() * 0.4})`;
      ctx.fillRect(x, 0, w * 0.4, s);
      bump.fillStyle = "rgba(0,0,0,0.6)";
      bump.fillRect(x, 0, w * 0.4, s);
      ctx.fillStyle = `rgba(90,70,55,${0.2 + rand() * 0.2})`;
      ctx.fillRect(x + w * 0.5, 0, w * 0.5, s);
    }
  }, 51);

/** Alpha-tested foliage card: a drooping conifer branch with needles. */
export const needles = () =>
  make("needles", 256, (ctx, bump, s, rand) => {
    ctx.clearRect(0, 0, s, s);
    bump.fillStyle = "#808080";
    bump.fillRect(0, 0, s, s);
    // central twig from left edge to right, drooping
    const twig = (x0: number, y0: number, len: number, ang: number, depth: number) => {
      const steps = 28;
      let x = x0, y = y0;
      for (let k = 0; k < steps; k++) {
        const t = k / steps;
        const a = ang + t * 0.35;
        const nx = x + Math.cos(a) * (len / steps);
        const ny = y + Math.sin(a) * (len / steps);
        ctx.strokeStyle = "rgba(60,45,30,1)";
        ctx.lineWidth = 2.2 * (1 - t) + 0.5;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(nx, ny);
        ctx.stroke();
        // needles both sides
        for (const sgn of [-1, 1]) {
          const na = a + sgn * (0.9 + rand() * 0.4);
          const nl = (13 + rand() * 9) * (1 - t * 0.4);
          const g = 70 + rand() * 50;
          ctx.strokeStyle = `rgb(${25 + rand() * 20},${g},${35 + rand() * 20})`;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(nx, ny);
          ctx.lineTo(nx + Math.cos(na) * nl, ny + Math.sin(na) * nl);
          ctx.stroke();
        }
        if (depth > 0 && k % 7 === 3) twig(nx, ny, len * 0.45, a + (rand() < 0.5 ? -0.7 : 0.7), depth - 1);
        x = nx;
        y = ny;
      }
    };
    for (let i = 0; i < 7; i++) twig(2 + rand() * 20, s * (0.18 + i * 0.1), s * (0.7 + rand() * 0.3), -0.25 + rand() * 0.5, 2);
  }, 61);

/** Alpha-tested foliage card: a cluster of broad leaves. */
export const leaves = () =>
  make("leaves", 256, (ctx, bump, s, rand) => {
    ctx.clearRect(0, 0, s, s);
    bump.fillStyle = "#808080";
    bump.fillRect(0, 0, s, s);
    for (let i = 0; i < 420; i++) {
      const a = rand() * Math.PI * 2;
      const r = Math.sqrt(rand()) * s * 0.46;
      const x = s / 2 + Math.cos(a) * r;
      const y = s / 2 + Math.sin(a) * r;
      const l = 10 + rand() * 10;
      const g = 80 + rand() * 70;
      ctx.fillStyle = `rgb(${40 + rand() * 40},${g},${30 + rand() * 25})`;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(rand() * Math.PI * 2);
      ctx.beginPath();
      ctx.ellipse(0, 0, l, l * 0.45, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }, 71);

/** Ground detail: grass/earth mottling for the terrain. */
export const earth = () =>
  make("earth", 1024, (ctx, bump, s, rand) => {
    ctx.fillStyle = "#808070";
    ctx.fillRect(0, 0, s, s);
    bump.fillStyle = "#808080";
    bump.fillRect(0, 0, s, s);
    speckle(ctx, s, rand, 10000, () => {
      const v = rand();
      return v < 0.5 ? `rgba(90,110,60,0.18)` : `rgba(120,100,70,0.16)`;
    }, [2, 18]);
    speckle(bump, s, rand, 28000, () => (rand() < 0.5 ? "rgba(0,0,0,0.15)" : "rgba(255,255,255,0.15)"), [0.5, 3]);
  }, 81);

/** Pale crushed-stone gravel with tyre-worn darker patches. */
export const gravel = () =>
  make("gravel", 1024, (ctx, bump, s, rand) => {
    ctx.fillStyle = "#9a9284";
    ctx.fillRect(0, 0, s, s);
    bump.fillStyle = "#808080";
    bump.fillRect(0, 0, s, s);
    speckle(ctx, s, rand, 900, () => `rgba(70,62,52,${0.05 + rand() * 0.08})`, [20, 60]);
    speckle(ctx, s, rand, 26000, () => {
      const v = 120 + rand() * 110;
      return `rgba(${v},${v * 0.95},${v * 0.86},0.85)`;
    }, [1, 3.2]);
    speckle(ctx, s, rand, 6000, () => `rgba(40,36,30,0.5)`, [0.8, 2]);
    speckle(bump, s, rand, 30000, () => (rand() < 0.5 ? "rgba(0,0,0,0.35)" : "rgba(255,255,255,0.35)"), [1, 3]);
  }, 91);

export function repeat<T extends { map: THREE.Texture; bump: THREE.Texture }>(t: T, x: number, y: number): T {
  // clone so each surface can tile differently while sharing the image
  const map = t.map.clone();
  const bump = t.bump.clone();
  map.repeat.set(x, y);
  bump.repeat.set(x, y);
  map.needsUpdate = bump.needsUpdate = true;
  return { ...t, map, bump };
}

/** Neutral twill weave (denim-like); tint with material colour. */
export const denim = () =>
  make("denim", 256, (ctx, bump, s, rand) => {
    ctx.fillStyle = "#c8ccd4";
    ctx.fillRect(0, 0, s, s);
    bump.fillStyle = "#808080";
    bump.fillRect(0, 0, s, s);
    // diagonal twill lines
    for (let i = -s; i < s * 2; i += 3) {
      const v = 160 + rand() * 60;
      ctx.strokeStyle = `rgba(${v},${v + 5},${v + 15},0.55)`;
      bump.strokeStyle = rand() < 0.5 ? "rgba(255,255,255,0.35)" : "rgba(0,0,0,0.35)";
      ctx.lineWidth = bump.lineWidth = 1.3;
      ctx.beginPath();
      bump.beginPath();
      ctx.moveTo(i, 0);
      bump.moveTo(i, 0);
      ctx.lineTo(i + s, s);
      bump.lineTo(i + s, s);
      ctx.stroke();
      bump.stroke();
    }
    speckle(ctx, s, rand, 500, () => `rgba(255,255,255,${0.04 + rand() * 0.08})`, [1, 4]);
  }, 91);

/** Neutral plain-weave canvas for jackets. */
export const canvasCloth = () =>
  make("canvas", 256, (ctx, bump, s, rand) => {
    ctx.fillStyle = "#d0d0d0";
    ctx.fillRect(0, 0, s, s);
    bump.fillStyle = "#808080";
    bump.fillRect(0, 0, s, s);
    for (let y = 0; y < s; y += 2) {
      const v = 190 + rand() * 40;
      ctx.fillStyle = `rgba(${v},${v},${v},0.5)`;
      ctx.fillRect(0, y, s, 1);
      bump.fillStyle = `rgba(255,255,255,${0.15 + rand() * 0.1})`;
      bump.fillRect(0, y, s, 1);
    }
    for (let x = 0; x < s; x += 2) {
      bump.fillStyle = `rgba(0,0,0,${0.12 + rand() * 0.1})`;
      bump.fillRect(x, 0, 1, s);
    }
    speckle(ctx, s, rand, 300, () => `rgba(90,90,90,${0.05 + rand() * 0.06})`, [2, 10]);
  }, 101);

/** Ribbed knit for beanies and scarves. */
export const knit = () =>
  make("knit", 128, (ctx, bump, s, rand) => {
    ctx.fillStyle = "#d6d6d6";
    ctx.fillRect(0, 0, s, s);
    bump.fillStyle = "#000";
    bump.fillRect(0, 0, s, s);
    const w = 8;
    for (let x = 0; x < s; x += w) {
      for (let y = 0; y < s; y += 6) {
        const v = 200 + rand() * 40;
        ctx.fillStyle = `rgb(${v},${v},${v})`;
        ctx.beginPath();
        ctx.ellipse(x + w / 2, y + 3, w * 0.42, 3.4, 0, 0, Math.PI * 2);
        ctx.fill();
        const g = bump.createRadialGradient(x + w / 2, y + 3, 0, x + w / 2, y + 3, w * 0.5);
        g.addColorStop(0, "#fff");
        g.addColorStop(1, "#000");
        bump.fillStyle = g;
        bump.beginPath();
        bump.ellipse(x + w / 2, y + 3, w * 0.45, 3.5, 0, 0, Math.PI * 2);
        bump.fill();
      }
    }
  }, 111);
