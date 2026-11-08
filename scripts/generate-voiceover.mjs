#!/usr/bin/env node
// Renders the narration into public/audio/vo/<chapter-id>.mp3 and records each
// clip's length in src/components/story/vo-durations.json (the film's timeline
// reads it, so re-recording never breaks sync).
//
// Providers — pick with env vars:
//   KOKORO_DIR [+ KOKORO_PYTHON, KOKORO_VOICE]   free, local, offline neural TTS (default
//                                                when KOKORO_DIR is set). Setup:
//                                                  uv venv --python 3.12 .venv && uv pip install kokoro-onnx soundfile
//                                                  download kokoro-v1.0.onnx + voices-v1.0.bin from
//                                                  github.com/thewh1teagle/kokoro-onnx/releases (model-files-v1.0)
//   OPENAI_API_KEY [+ OPENAI_TTS_VOICE]          gpt-4o-mini-tts, delivery steered by NARRATOR_STYLE
//   ELEVENLABS_API_KEY [+ ELEVENLABS_VOICE_ID]   hosted, most natural
//   (none)                                       macOS `say` placeholder
//
// Usage: node scripts/generate-voiceover.mjs [chapterId ...]
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, readFileSync, existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(root, "public/audio/vo");
const DURATIONS = join(root, "src/components/story/vo-durations.json");

const NARRATOR_STYLE =
  "Deep, warm, unhurried American baritone. Smooth and confident with a dry, knowing wit — " +
  "a 1960s Madison Avenue narrator letting you in on something wonderful. Relaxed legato phrasing, " +
  "sentences flow into one another; slight smile in the voice; never shouty, never robotic.";

// Lines are written to be read as one continuous story.
const LINES = {
  title: "Moon I Win.",
  centuries: "Moon I Win is a game that's been passed down through the centuries,",
  question: "to settle one never-ending question: who saw the moon first today?",
  simple: "The rules are simple.",
  outside: "Be outside.",
  shouting: "Stay within shouting distance of each other.",
  point: "Then point at the moon, and say: Moon I Win!",
  victory: "And enjoy your victory, for the rest of the day.",
  fake: "A few more things. Fake moon sightings don't count. Call one, and you're out for the day.",
  everyone: "Everyone in your group has to be outside.",
  trick: "Tricking someone to come outside is very much encouraged.",
  text: "And if you must text someone a photo of the moon... that's allowed.",
  luck: "Enjoy yourselves, and good luck.",
};

const only = process.argv.slice(2);
const ids = only.length ? only : Object.keys(LINES);
const tmp = mkdtempSync(join(tmpdir(), "vo-"));

async function elevenlabs(text, file) {
  const voice = process.env.ELEVENLABS_VOICE_ID || "pNInz6obpgDQGcFmaJgB"; // "Adam": deep American narrator
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voice}?output_format=mp3_44100_128`, {
    method: "POST",
    headers: { "xi-api-key": process.env.ELEVENLABS_API_KEY, "content-type": "application/json" },
    body: JSON.stringify({
      text,
      model_id: "eleven_multilingual_v2",
      voice_settings: { stability: 0.42, similarity_boost: 0.8, style: 0.35, use_speaker_boost: true },
    }),
  });
  if (!res.ok) throw new Error(`ElevenLabs ${res.status}: ${await res.text()}`);
  writeFileSync(file, Buffer.from(await res.arrayBuffer()));
}

async function openai(text, file) {
  const res = await fetch("https://api.openai.com/v1/audio/speech", {
    method: "POST",
    headers: { authorization: `Bearer ${process.env.OPENAI_API_KEY}`, "content-type": "application/json" },
    body: JSON.stringify({
      model: "gpt-4o-mini-tts",
      voice: process.env.OPENAI_TTS_VOICE || "onyx",
      input: text,
      instructions: NARRATOR_STYLE,
      response_format: "mp3",
    }),
  });
  if (!res.ok) throw new Error(`OpenAI ${res.status}: ${await res.text()}`);
  writeFileSync(file, Buffer.from(await res.arrayBuffer()));
}

function kokoro(text, file) {
  const wav = file.replace(/\.\w+$/, ".wav");
  const py = process.env.KOKORO_PYTHON || join(process.env.KOKORO_DIR, ".venv/bin/python");
  // Michael (natural, warm) blended with Fenrir (deeper, grittier); a touch slow.
  const voice = process.env.KOKORO_VOICE || "am_michael:0.65,am_fenrir:0.35";
  execFileSync(py, [join(root, "scripts/kokoro_tts.py"), process.env.KOKORO_DIR, wav, voice, process.env.KOKORO_SPEED || "0.9", text], {
    stdio: ["ignore", "ignore", "inherit"],
  });
  return wav;
}

function macSay(text, file) {
  const aiff = file.replace(/\.\w+$/, ".aiff");
  execFileSync("say", ["-v", process.env.VOICE || "Daniel", "-r", "150", "-o", aiff, text]);
  return aiff;
}

const provider = process.env.KOKORO_DIR
  ? "kokoro"
  : process.env.OPENAI_API_KEY
    ? "openai"
    : process.env.ELEVENLABS_API_KEY
      ? "elevenlabs"
      : "say";
console.log(`voiceover provider: ${provider}`);

const durations = existsSync(DURATIONS) ? JSON.parse(readFileSync(DURATIONS, "utf8")) : {};
for (const id of ids) {
  const text = LINES[id];
  if (!text) throw new Error(`unknown chapter ${id}`);
  let raw = join(tmp, `${id}.mp3`);
  if (provider === "elevenlabs") await elevenlabs(text, raw);
  else if (provider === "openai") await openai(text, raw);
  else if (provider === "kokoro") raw = kokoro(text, raw);
  else raw = macSay(text, raw);
  const out = join(OUT, `${id}.mp3`);
  // light broadcast polish: warmth, presence, a touch of room, loudness
  execFileSync("ffmpeg", [
    "-loglevel", "error", "-y", "-i", raw,
    "-af", (provider === "kokoro" ? "asetrate=24000*0.945,aresample=44100,atempo=1.058," : "") + "highpass=f=60,equalizer=f=160:t=q:w=1:g=2.5,equalizer=f=3800:t=q:w=1.4:g=1.5,aecho=0.8:0.4:35|70:0.08|0.05,loudnorm=I=-16:TP=-1.5",
    "-ac", "1", "-ar", "44100", "-b:a", "128k", out,
  ]);
  const d = parseFloat(
    execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", out]).toString()
  );
  durations[id] = Math.round(d * 100) / 100;
  console.log(`✓ ${id} (${durations[id]}s)`);
}
writeFileSync(DURATIONS, JSON.stringify(durations, null, 2) + "\n");
rmSync(tmp, { recursive: true, force: true });
