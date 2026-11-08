// The story of "moon, i win!" — one chapter per scroll "page".
// The caption text is the original crawl script, verbatim, split into beats.

export type Vec3 = [number, number, number];

export interface Palette {
  zenith: string;
  mid: string;
  horizon: string;
  cloud: string;
  cloudShadow: string;
  sun: number; // sun glow strength 0..1
  stars: number; // star visibility 0..1
  key: string; // key light color
  keyIntensity: number;
  ambient: string;
  ambientIntensity: number;
  grassTip: string;
  grassBase: string;
  moonGlow: number; // 0..1
  moonElevation: number; // degrees above horizon
  spirits: number; // 0..1 brightness of the glowing moon-moths
}

export interface Chapter {
  id: string;
  kicker?: string; // small label above caption ("rule no. 1")
  lines: string[]; // script lines (verbatim)
  big?: string; // optional big hero line
  align?: "left" | "right" | "center";
  camera: { pos: Vec3; look: Vec3; fov?: number };
  palette: Palette;
}

// ── Palettes (real-world light: golden hour → blue hour → moonlit night) ───
const goldenHour: Palette = {
  zenith: "#2c4a7c",
  mid: "#b77a74",
  horizon: "#ffb36a",
  cloud: "#ffc99a",
  cloudShadow: "#6a4a62",
  sun: 1,
  stars: 0,
  key: "#ffb877",
  keyIntensity: 4.6,
  ambient: "#8a90b8",
  ambientIntensity: 0.65,
  grassTip: "#c9b765",
  grassBase: "#3c4a22",
  moonGlow: 0.1,
  moonElevation: -4,
  spirits: 0,
};

const sunset: Palette = {
  zenith: "#1d3462",
  mid: "#8a5a7a",
  horizon: "#ff8a52",
  cloud: "#ff9f78",
  cloudShadow: "#4a3352",
  sun: 0.65,
  stars: 0.05,
  key: "#ff9a62",
  keyIntensity: 3.8,
  ambient: "#7a7fb8",
  ambientIntensity: 0.75,
  grassTip: "#a3a058",
  grassBase: "#2c3a20",
  moonGlow: 0.25,
  moonElevation: 7,
  spirits: 0,
};

const blueHour: Palette = {
  zenith: "#1a2c58",
  mid: "#3e5a92",
  horizon: "#d9957a",
  cloud: "#8a7f9a",
  cloudShadow: "#232a48",
  sun: 0.18,
  stars: 0.3,
  key: "#a9b8e6",
  keyIntensity: 3.0,
  ambient: "#6a7ab8",
  ambientIntensity: 0.95,
  grassTip: "#86a06a",
  grassBase: "#26382a",
  moonGlow: 0.45,
  moonElevation: 2,
  spirits: 0.15,
};

const moonrise: Palette = {
  zenith: "#0a1430",
  mid: "#1c3366",
  horizon: "#3f5f8e",
  cloud: "#7c8aa6",
  cloudShadow: "#141c30",
  sun: 0,
  stars: 1,
  key: "#c4d4f5",
  keyIntensity: 3.4,
  ambient: "#4a62a0",
  ambientIntensity: 1.05,
  grassTip: "#7a9a80",
  grassBase: "#1e322c",
  moonGlow: 1,
  moonElevation: 16,
  spirits: 0.9,
};

const moonlit: Palette = { ...moonrise, horizon: "#3a5886", moonElevation: 22, spirits: 0.6 };
const lanternNight: Palette = { ...moonlit, moonGlow: 0.7, moonElevation: 24, spirits: 0.3 };
const finale: Palette = {
  ...moonrise,
  zenith: "#0c1434",
  mid: "#283670",
  horizon: "#86607e",
  cloud: "#9a8aa8",
  cloudShadow: "#1a1a34",
  moonElevation: 14,
  spirits: 1,
};

// ── Chapters ────────────────────────────────────────────────────────────────
export const chapters: Chapter[] = [
  {
    id: "title",
    lines: [],
    align: "center",
    camera: { pos: [0, 3.2, 24], look: [0, 4, -30] },
    palette: goldenHour,
  },
  {
    id: "centuries",
    lines: ["moon i win is a game that's been", "passed down through the centuries,"],
    align: "left",
    camera: { pos: [7.5, 2.6, -8.5], look: [15, 5.2, -24] },
    palette: goldenHour,
  },
  {
    id: "question",
    lines: ["to settle one never-ending question:"],
    big: "who saw the moon first today?",
    align: "center",
    camera: { pos: [2, 1.6, 9], look: [-2, 14, -60] },
    palette: sunset,
  },
  {
    id: "simple",
    lines: ["the rules are simple"],
    align: "center",
    camera: { pos: [-1, 9, 16], look: [-3, 1, -2] },
    palette: sunset,
  },
  {
    id: "outside",
    kicker: "rule no. 1",
    lines: ["be outside."],
    align: "right",
    camera: { pos: [-4.2, 1.7, 5.5], look: [-6.4, 1.4, -1] },
    palette: blueHour,
  },
  {
    id: "shouting",
    kicker: "rule no. 2",
    lines: ["stay within shouting distance."],
    align: "left",
    camera: { pos: [1.2, 2.2, 10], look: [1.2, 1.4, 0] },
    palette: blueHour,
  },
  {
    id: "point",
    kicker: "rule no. 3",
    lines: ['then point at the moon and say "moon i win!"'],
    align: "left",
    camera: { pos: [1.6, 0.8, 7.4], look: [-5, 7, -40], fov: 55 },
    palette: moonrise,
  },
  {
    id: "victory",
    kicker: "rule no. 4",
    lines: ["and enjoy your victory", "for the rest of the day."],
    align: "right",
    camera: { pos: [0.6, 1.8, 6.4], look: [-0.6, 1.6, 1.5] },
    palette: moonlit,
  },
  {
    id: "fake",
    kicker: "a few more things",
    lines: ["fake moon sightings don't count.", "call one and you're out for the day."],
    align: "left",
    camera: { pos: [1, 1.5, 9.5], look: [4.4, 1.8, 3.5] },
    palette: lanternNight,
  },
  {
    id: "everyone",
    lines: ["everyone in your group", "has to be outside."],
    align: "right",
    camera: { pos: [-6.4, 1.7, 4.8], look: [-5.2, 1.3, -1.2] },
    palette: moonlit,
  },
  {
    id: "trick",
    lines: ["tricking someone to come outside", "is very much encouraged."],
    align: "left",
    camera: { pos: [-2.6, 2.4, 7.5], look: [-6.5, 1.1, -0.5] },
    palette: moonlit,
  },
  {
    id: "text",
    lines: ["and if you must text someone", "a photo of the moon, that's allowed."],
    align: "left",
    camera: { pos: [2.6, 1.4, 6.0], look: [-1, 6, -40] },
    palette: moonlit,
  },
  {
    id: "luck",
    lines: ["enjoy yourselves, and good luck."],
    align: "left",
    camera: { pos: [0, 8.5, 25], look: [0, 6, -40] },
    palette: finale,
  },
];

export const CHAPTER_COUNT = chapters.length;

export function chapterIndex(id: string) {
  return chapters.findIndex((c) => c.id === id);
}

// ── Character choreography ─────────────────────────────────────────────────
// Each character has keyframes on the chapter axis. Positions are on the
// ground plane (x, z). Arms: 0 = relaxed, point = aim at `target`, up = cheer.
export type ArmPose = "rest" | "point" | "up" | "wave" | "phone";
export interface Pose {
  at: number; // chapter index
  x: number;
  z: number;
  rot: number; // facing (radians, 0 = +z / toward camera)
  armR?: ArmPose;
  armL?: ArmPose;
  target?: Vec3; // what the pointing arm aims at
  visible?: boolean;
}

export const MOON_TARGET: Vec3 = [-30, 120, -300];
export const LANTERN_POS: Vec3 = [5.4, 2.55, 3.4];

const C = (id: string) => chapterIndex(id);

export const heroPoses: Pose[] = [
  { at: 0, x: -7.7, z: -2.6, rot: 0, visible: false },
  { at: C("simple"), x: -7.7, z: -2.6, rot: 0, visible: false },
  { at: C("simple") + 0.4, x: -7.7, z: -1.6, rot: 0.2, visible: true },
  { at: C("outside"), x: -6.6, z: 0.6, rot: 0.6 },
  { at: C("shouting"), x: -2.2, z: 1.6, rot: 1.35, armL: "wave" },
  { at: C("point"), x: -1.2, z: 2.2, rot: Math.PI - 0.6, armR: "point", armL: "rest", target: MOON_TARGET },
  { at: C("victory"), x: -0.8, z: 2.0, rot: 0.25, armR: "up", armL: "up" },
  { at: C("fake"), x: 2.4, z: 3.8, rot: 1.6, armR: "point", target: LANTERN_POS },
  { at: C("everyone"), x: -3.7, z: 0.5, rot: -2.0, armR: "rest" },
  { at: C("trick"), x: -4.4, z: 1.8, rot: -2.2, armR: "wave", armL: "rest" },
  { at: C("text"), x: 0.6, z: 3.0, rot: Math.PI - 0.1, armR: "phone", armL: "rest" },
  { at: C("luck"), x: 0.0, z: 2.0, rot: 0.2, armR: "wave", armL: "rest" },
];

export const friendPoses: Pose[] = [
  { at: 0, x: 4.4, z: -0.4, rot: -1.4, visible: false },
  { at: C("simple") + 0.2, x: 4.4, z: -0.4, rot: -1.4, visible: false },
  { at: C("outside"), x: 4.4, z: -0.4, rot: -1.4, visible: true },
  { at: C("shouting"), x: 4.6, z: -0.2, rot: -1.6, armR: "rest" },
  { at: C("point"), x: 4.2, z: 0.4, rot: -2.2, armR: "rest" },
  { at: C("victory"), x: 1.0, z: 1.2, rot: -0.6, armL: "rest" },
  { at: C("fake"), x: 0.0, z: 4.6, rot: 1.2 },
  // wanders back indoors and ends up peering through the window
  { at: C("fake") + 0.45, x: -7.7, z: 0.6, rot: Math.PI },
  { at: C("fake") + 0.75, x: -7.7, z: -2.4, rot: Math.PI },
  { at: C("everyone"), x: -5.7, z: -1.75, rot: 0, armR: "point", target: MOON_TARGET },
  { at: C("trick") - 0.4, x: -7.7, z: -2.4, rot: 0.1 },
  { at: C("trick"), x: -7.5, z: 0.5, rot: 0.5, armR: "up", armL: "up" },
  // back inside (they're the one being texted)
  { at: C("trick") + 0.5, x: -7.7, z: 0.4, rot: Math.PI },
  { at: C("text") - 0.2, x: -7.7, z: -2.6, rot: Math.PI },
  { at: C("text") + 0.3, x: -7.7, z: -2.6, rot: 0 },
  { at: C("luck") - 0.25, x: -7.6, z: 0.6, rot: 0.6 },
  { at: C("luck"), x: 1.4, z: 1.6, rot: -0.2, armL: "wave" },
];

// When the cottage door swings open (chapter ranges).
export const DOOR_OPEN: [number, number][] = [
  [C("simple") + 0.15, C("outside") + 0.35],
  [C("fake") + 0.3, C("fake") + 0.85],
  [C("trick") - 0.55, C("text") - 0.1],
  [C("text") + 0.35, C("luck") - 0.05],
];

// Spoken lines, shown as film subtitles. `at` is seconds into the chapter.
export interface Cue {
  chapter: string;
  who: "hero" | "friend";
  /** seconds after the narration for this chapter ends (negative = before it starts, see `at`) */
  after?: number;
  /** absolute seconds into the chapter (for lines spoken before the narrator) */
  at?: number;
  dur: number;
  text: string;
}

export const cues: Cue[] = [
  { chapter: "shouting", who: "hero", after: 0.2, dur: 1.8, text: "Hey! Can you hear me?" },
  { chapter: "shouting", who: "friend", after: 2.1, dur: 1.4, text: "...Yes?!" },
  { chapter: "point", who: "hero", after: 0.25, dur: 2.2, text: "MOON I WIN!" },
  { chapter: "victory", who: "friend", after: 0.3, dur: 1.9, text: "...Well played." },
  { chapter: "fake", who: "hero", at: 0.3, dur: 1.7, text: "Moon I win!" },
  { chapter: "everyone", who: "friend", after: 0.2, dur: 2.0, text: "I can see it from in here!" },
  { chapter: "everyone", who: "hero", after: 2.3, dur: 1.5, text: "Doesn't count." },
  { chapter: "trick", who: "hero", at: 0.2, dur: 1.8, text: "There's a deer in the garden!" },
  { chapter: "trick", who: "friend", at: 2.1, dur: 1.1, text: "Where?!" },
  { chapter: "trick", who: "hero", after: 0.25, dur: 1.8, text: "Moon I win." },
];

export const SPEAKER = { hero: "Alex", friend: "Sam" } as const;
