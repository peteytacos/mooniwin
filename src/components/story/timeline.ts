// The film's clock. The story plays like a video (play / pause / rewind /
// restart); scrolling, arrows and swipes just seek between chapters.
import { chapters, CHAPTER_COUNT, cues, type Cue } from "./chapters";
import { story, clamp } from "./state";
import voDurations from "./vo-durations.json";

/** Seconds the camera spends travelling into a chapter. */
export const TRANS = 3.0;

// Narration length per chapter — written by scripts/generate-voiceover.mjs.
export const VO: Record<string, number> = voDurations;

// Narration starts while the camera is still travelling, so the voice carries
// the cut like one continuous sentence. A few beats let dialogue go first.
const VO_START: Record<string, number> = { title: 1.4, fake: 2.2, trick: 2.3 };
// Breath after each line. Tiny where the sentence runs on into the next shot.
const TAIL: Record<string, number> = { title: 1.8, centuries: 0.1, question: 0.8, simple: 0.35, luck: 3.5 };
// Extra hold for beats without dialogue (the phone needs a moment to read).
const EXTRA: Record<string, number> = { text: 2.4 };

export function voStart(i: number) {
  return VO_START[chapters[i].id] ?? 0.7;
}

/** When a dialogue line starts, in seconds into its chapter. */
export function cueStart(c: Cue) {
  const i = chapters.findIndex((ch) => ch.id === c.chapter);
  return c.at ?? voStart(i) + (VO[c.chapter] ?? 3) + (c.after ?? 0);
}

export const durations = chapters.map((c, i) => {
  const narration = voStart(i) + (VO[c.id] ?? 3) + (TAIL[c.id] ?? 0.6) + (EXTRA[c.id] ?? 0);
  const lastLine = Math.max(0, ...cues.filter((q) => q.chapter === c.id).map((q) => cueStart(q) + q.dur + 0.5));
  const d = Math.max(narration, lastLine);
  return i === 0 ? d : Math.max(d, TRANS + 0.6);
});
export const starts = durations.reduce<number[]>((acc, d, i) => {
  acc.push(i === 0 ? 0 : acc[i - 1] + durations[i - 1]);
  return acc;
}, []);
export const TOTAL = starts[CHAPTER_COUNT - 1] + durations[CHAPTER_COUNT - 1];

export const player = {
  playhead: 0,
  playing: false,
  ended: false,
  started: false, // has the viewer pressed play at least once
  seek: null as null | { from: number; to: number; start: number; dur: number },
};

/** Chapter index + seconds into it for a playhead time. */
export function locate(p: number) {
  let i = 0;
  while (i < CHAPTER_COUNT - 1 && p >= starts[i + 1]) i++;
  return { i, local: p - starts[i] };
}

/** Story position (chapter float) for a playhead time. */
export function chapterAt(p: number) {
  const { i, local } = locate(p);
  if (i === 0) return 0;
  return i - 1 + clamp(local / TRANS);
}

const easeInOut = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);

/** Advance the clock; call once per animation frame. */
export function tick(dt: number, now: number) {
  const s = player.seek;
  if (s) {
    const k = clamp((now - s.start) / s.dur);
    story.t = s.from + (s.to - s.from) * easeInOut(k);
    story.seeking = true;
    if (k >= 1) {
      player.seek = null;
      story.seeking = false;
      player.playhead = s.to === 0 ? 0 : starts[s.to] + Math.min(TRANS, voStart(s.to));
    }
    return;
  }
  story.seeking = false;
  if (player.playing) {
    player.playhead += dt;
    if (player.playhead >= TOTAL) {
      player.playhead = TOTAL;
      player.playing = false;
      player.ended = true;
    }
  }
  story.t = chapterAt(player.playhead);
}

// ── Controls ───────────────────────────────────────────────────────────────
export function play() {
  if (player.ended || player.playhead >= TOTAL - 0.05) restart();
  player.playing = true;
  player.started = true;
  player.ended = false;
}
export function pause() {
  player.playing = false;
}
export function toggle() {
  if (player.playing) pause();
  else play();
}
export function restart() {
  player.seek = null;
  player.playhead = 0;
  player.ended = false;
  story.t = 0;
}
export function rewind(seconds = 5) {
  player.seek = null;
  player.ended = false;
  player.playhead = Math.max(0, player.playhead - seconds);
}

/** Glide the camera to chapter i, then park the playhead there. */
export function seekChapter(i: number) {
  const to = Math.max(0, Math.min(CHAPTER_COUNT - 1, i));
  const from = story.t;
  if (Math.abs(to - from) < 0.01 && !player.seek) return;
  player.ended = false;
  player.seek = { from, to, start: performance.now() / 1000, dur: 1.6 + Math.min(Math.abs(to - from), 6) * 0.25 };
}
export function currentChapter() {
  return player.seek ? player.seek.to : locate(player.playhead).i;
}
export function next() {
  seekChapter(currentChapter() + 1);
}
export function prev() {
  seekChapter(currentChapter() - 1);
}
