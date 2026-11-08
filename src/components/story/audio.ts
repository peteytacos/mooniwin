// Sound for the film: an original procedural score (Web Audio) plus narration
// that follows the playhead, so pause / rewind / seek all stay in sync.
import { chapters } from "./chapters";
import { player, locate, voStart } from "./timeline";

const MUTE_KEY = "mooniwin-muted";

// Musical intensity per chapter (0..1) — opens the filter, adds pulse.
const INTENSITY: Record<string, number> = {
  title: 0.35,
  centuries: 0.4,
  question: 0.55,
  simple: 0.5,
  outside: 0.5,
  shouting: 0.6,
  point: 1,
  victory: 0.95,
  fake: 0.45,
  everyone: 0.55,
  trick: 0.65,
  text: 0.6,
  luck: 0.9,
};

type Listener = (muted: boolean) => void;

class Sound {
  ctx: AudioContext | null = null;
  master!: GainNode;
  music!: GainNode;
  vo!: GainNode;
  filter!: BiquadFilterNode;
  reverb!: ConvolverNode;
  pulse!: GainNode;
  muted = false;
  buffers = new Map<string, AudioBuffer>();
  current: { id: string; src: AudioBufferSourceNode; t0: number; offset: number } | null = null;
  listeners = new Set<Listener>();
  private nextChordTime = 0;
  private chordIdx = 0;
  private timer: ReturnType<typeof setInterval> | null = null;
  private raf = 0;

  constructor() {
    if (typeof window !== "undefined") {
      try {
        this.muted = window.localStorage.getItem(MUTE_KEY) === "1";
      } catch {
        /* storage unavailable */
      }
    }
  }

  /** Must be called from a user gesture (click / key). Safe to call repeatedly. */
  async init() {
    if (this.ctx) {
      if (this.ctx.state === "suspended") await this.ctx.resume();
      return;
    }
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    this.ctx = ctx;

    this.master = ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 1;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.ratio.value = 3;
    this.master.connect(comp).connect(ctx.destination);

    this.reverb = ctx.createConvolver();
    this.reverb.buffer = this.impulse(4.5, 2.4);
    const wet = ctx.createGain();
    wet.gain.value = 0.55;
    this.reverb.connect(wet).connect(this.master);

    this.music = ctx.createGain();
    this.music.gain.value = 0;
    this.filter = ctx.createBiquadFilter();
    this.filter.type = "lowpass";
    this.filter.frequency.value = 900;
    this.filter.Q.value = 0.4;
    this.filter.connect(this.music);
    this.music.connect(this.master);
    this.music.connect(this.reverb);

    this.pulse = ctx.createGain();
    this.pulse.gain.value = 0;
    this.pulse.connect(this.music);

    this.vo = ctx.createGain();
    this.vo.gain.value = 1;
    const voVerb = ctx.createGain();
    voVerb.gain.value = 0.12;
    this.vo.connect(this.master);
    this.vo.connect(voVerb).connect(this.reverb);

    this.music.gain.setTargetAtTime(0.5, ctx.currentTime, 2.5);
    this.nextChordTime = ctx.currentTime + 0.1;
    this.timer = setInterval(() => this.schedule(), 200);
    this.schedule();
    this.loop();

    // load narration
    await Promise.all(
      chapters.map(async (c) => {
        try {
          const res = await fetch(`/audio/vo/${c.id}.mp3`);
          if (!res.ok) return;
          const buf = await ctx.decodeAudioData(await res.arrayBuffer());
          this.buffers.set(c.id, buf);
        } catch {
          /* missing narration file is fine */
        }
      })
    );
  }

  setMuted(m: boolean) {
    this.muted = m;
    try {
      window.localStorage.setItem(MUTE_KEY, m ? "1" : "0");
    } catch {
      /* ignore */
    }
    if (this.ctx) this.master.gain.setTargetAtTime(m ? 0 : 1, this.ctx.currentTime, 0.15);
    this.listeners.forEach((l) => l(m));
  }
  toggleMuted() {
    this.setMuted(!this.muted);
    if (!this.muted) void this.init();
  }
  subscribe(l: Listener) {
    this.listeners.add(l);
    return () => {
      this.listeners.delete(l);
    };
  }

  // ── narration sync ───────────────────────────────────────────────────────
  private loop = () => {
    this.raf = requestAnimationFrame(this.loop);
    const ctx = this.ctx;
    if (!ctx) return;
    const { i, local } = locate(player.playhead);
    const id = chapters[i].id;
    const buf = this.buffers.get(id);
    const offset = local - voStart(i);
    const shouldPlay = player.playing && !player.seek && buf && offset >= 0 && offset < buf.duration - 0.05;

    if (shouldPlay && buf) {
      const cur = this.current;
      const expected = cur ? cur.offset + (ctx.currentTime - cur.t0) : -1;
      if (!cur || cur.id !== id || Math.abs(expected - offset) > 0.3) {
        this.stopVo();
        const src = ctx.createBufferSource();
        src.buffer = buf;
        src.connect(this.vo);
        src.start(0, offset);
        this.current = { id, src, t0: ctx.currentTime, offset };
        src.onended = () => {
          if (this.current?.src === src) this.current = null;
        };
      }
    } else if (this.current) {
      this.stopVo();
    }

    // mix: duck under narration, settle when paused
    const intensity = INTENSITY[id] ?? 0.5;
    const t = ctx.currentTime;
    const base = player.playing || player.seek ? 0.5 : 0.22;
    this.music.gain.setTargetAtTime(this.current ? base * 0.45 : base, t, 0.35);
    this.filter.frequency.setTargetAtTime(500 + intensity * intensity * 3800, t, 1.2);
    this.pulse.gain.setTargetAtTime(intensity > 0.85 && player.playing ? 0.9 : 0, t, 0.8);
  };

  private stopVo() {
    if (!this.current) return;
    try {
      this.current.src.stop();
    } catch {
      /* already stopped */
    }
    this.current = null;
  }

  // ── score ────────────────────────────────────────────────────────────────
  // D major cinematic loop: Dmaj9 – Bm11 – Gmaj7#11 – Asus2 (8s each)
  private chords = [
    [38, 50, 57, 61, 64, 66],
    [35, 47, 54, 57, 62, 64],
    [31, 43, 50, 54, 59, 61],
    [33, 45, 52, 57, 59, 64],
  ];

  private schedule() {
    const ctx = this.ctx;
    if (!ctx) return;
    const BAR = 8;
    while (this.nextChordTime < ctx.currentTime + 1.5) {
      const chord = this.chords[this.chordIdx % this.chords.length];
      this.playChord(chord, this.nextChordTime, BAR);
      this.playArp(chord, this.nextChordTime, BAR);
      this.playPulse(this.nextChordTime, BAR);
      this.nextChordTime += BAR;
      this.chordIdx++;
    }
  }

  private freq(midi: number) {
    return 440 * Math.pow(2, (midi - 69) / 12);
  }

  private playChord(notes: number[], t: number, len: number) {
    const ctx = this.ctx!;
    notes.forEach((n, k) => {
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, t);
      const peak = k === 0 ? 0.16 : 0.05;
      g.gain.linearRampToValueAtTime(peak, t + 2.5);
      g.gain.setValueAtTime(peak, t + len - 1.5);
      g.gain.linearRampToValueAtTime(0, t + len + 2.5);
      g.connect(this.filter);
      const types: OscillatorType[] = k === 0 ? ["sine"] : ["sawtooth", "sawtooth", "triangle"];
      types.forEach((type, j) => {
        const o = ctx.createOscillator();
        o.type = type;
        o.frequency.value = this.freq(n);
        o.detune.value = (j - 1) * 7;
        o.connect(g);
        o.start(t);
        o.stop(t + len + 2.6);
      });
    });
  }

  private playArp(notes: number[], t: number, len: number) {
    const ctx = this.ctx!;
    const pattern = [2, 3, 4, 5, 4, 3, 2, 4];
    const step = len / 16;
    for (let s = 0; s < 16; s++) {
      if (s % 2 === 1 && Math.random() < 0.5) continue;
      const n = notes[pattern[s % pattern.length]] + 12;
      const tt = t + s * step;
      const o = ctx.createOscillator();
      o.type = "triangle";
      o.frequency.value = this.freq(n);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, tt);
      g.gain.linearRampToValueAtTime(0.045, tt + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, tt + 1.4);
      o.connect(g).connect(this.filter);
      o.start(tt);
      o.stop(tt + 1.5);
    }
  }

  private playPulse(t: number, len: number) {
    const ctx = this.ctx!;
    const beats = 8;
    for (let b = 0; b < beats; b++) {
      const tt = t + (len / beats) * b;
      const o = ctx.createOscillator();
      o.type = "sine";
      o.frequency.setValueAtTime(110, tt);
      o.frequency.exponentialRampToValueAtTime(42, tt + 0.25);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, tt);
      g.gain.exponentialRampToValueAtTime(b % 2 === 0 ? 0.5 : 0.25, tt + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, tt + 0.45);
      o.connect(g).connect(this.pulse);
      o.start(tt);
      o.stop(tt + 0.5);
    }
  }

  private impulse(seconds: number, decay: number) {
    const ctx = this.ctx!;
    const len = Math.floor(ctx.sampleRate * seconds);
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
    }
    return buf;
  }

  dispose() {
    if (this.timer) clearInterval(this.timer);
    cancelAnimationFrame(this.raf);
    void this.ctx?.close();
    this.ctx = null;
  }
}

export const sound = new Sound();
