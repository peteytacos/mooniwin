"use client";

import { Canvas } from "@react-three/fiber";
import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import * as THREE from "three";
import World from "./World";
import ClaimWinModal from "../ClaimWinModal";
import { chapters, CHAPTER_COUNT, chapterIndex, cues, SPEAKER, type Cue } from "./chapters";
import { story, headAnchors } from "./state";
import { toasterTrigger } from "./Props";
import { player, locate, TOTAL, voStart, cueStart, toggle, restart, rewind, next, prev, seekChapter, currentChapter, starts } from "./timeline";
import { sound } from "./audio";

// Native cursor: never lags or disappears. A small glowing moon.
const MOON_CURSOR = `url("data:image/svg+xml,${encodeURIComponent(
  `<svg xmlns='http://www.w3.org/2000/svg' width='32' height='32' viewBox='0 0 32 32'><defs><radialGradient id='g' cx='40%' cy='38%' r='65%'><stop offset='0' stop-color='#fffaf0'/><stop offset='0.7' stop-color='#e9e2d0'/><stop offset='1' stop-color='#bdb6a6'/></radialGradient></defs><circle cx='16' cy='16' r='13' fill='rgba(255,240,210,0.18)'/><circle cx='16' cy='16' r='9.5' fill='url(#g)' stroke='rgba(0,0,0,0.35)' stroke-width='0.75'/><circle cx='13' cy='13' r='2' fill='#cfc8b6'/><circle cx='19.5' cy='18' r='2.6' fill='#d4cdbb'/><circle cx='14' cy='20' r='1.2' fill='#cbc4b2'/></svg>`
)}") 16 16, auto`;

interface View {
  playing: boolean;
  ended: boolean;
  started: boolean;
  chapter: number;
  local: number;
  progress: number;
  active: number | null;
  cue: Cue | null;
}

function useView(): View {
  const [view, setView] = useState<View>({
    playing: false,
    ended: false,
    started: false,
    chapter: 0,
    local: 0,
    progress: 0,
    active: 0,
    cue: null,
  });
  useEffect(() => {
    let raf = 0;
    let last = "";
    const loop = () => {
      raf = requestAnimationFrame(loop);
      const { i, local } = locate(player.playhead);
      const chapter = currentChapter();
      const t = story.t;
      // captions arrive with the narrator's voice, not after the camera lands
      const active = player.seek ? null : i === 0 || local >= voStart(i) - 0.2 ? i : null;
      const cue = player.seek
        ? null
        : (cues.find((c) => c.chapter === chapters[i].id && local >= cueStart(c) && local < cueStart(c) + c.dur) ?? null);
      const progress = Math.min(1, t / (CHAPTER_COUNT - 1));
      const key = [player.playing, player.ended, player.started, chapter, Math.floor(local * 4), active, cue?.text, Math.round(progress * 200)].join("|");
      if (key !== last) {
        last = key;
        setView({
          playing: player.playing,
          ended: player.ended,
          started: player.started,
          chapter,
          local,
          progress,
          active,
          cue,
        });
      }
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);
  return view;
}

// ── Pieces ─────────────────────────────────────────────────────────────────
function Caption({ index }: { index: number }) {
  const c = chapters[index];
  if (!c.lines.length && !c.big) return null;
  const align = c.align ?? "left";
  const pos =
    align === "center"
      ? "left-1/2 -translate-x-1/2 w-[min(90vw,760px)] items-center text-center"
      : align === "right"
        ? "right-5 sm:right-14 items-end text-right"
        : "left-5 sm:left-14 items-start text-left";
  return (
    <motion.div
      className={`absolute top-[86px] sm:top-[110px] flex flex-col gap-3 max-w-[min(90vw,620px)] ${pos}`}
      initial={{ opacity: 0, y: 12, filter: "blur(6px)" }}
      animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      exit={{ opacity: 0, y: -8, filter: "blur(4px)", transition: { duration: 0.4 } }}
      transition={{ duration: 0.9, ease: [0.2, 0.7, 0.2, 1] }}
    >
      {c.kicker && <span className="cine-kicker">{c.kicker}</span>}
      {c.lines.length > 0 && (
        <div className="cine-caption">
          {c.lines.map((l, i) => (
            <p key={i}>{l}</p>
          ))}
        </div>
      )}
      {c.big && (
        <motion.h2
          className="cine-big"
          initial={{ opacity: 0, y: 10, filter: "blur(8px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          transition={{ delay: 1.6, duration: 1.6, ease: [0.2, 0.7, 0.2, 1] }}
        >
          {c.big}
        </motion.h2>
      )}
    </motion.div>
  );
}

function Logo({ size = "lg" }: { size?: "lg" | "sm" }) {
  return (
    <span className={size === "lg" ? "logo logo-lg" : "logo logo-sm"}>
      moon i win
    </span>
  );
}

function TitleCard({ onPlay, started }: { onPlay: () => void; started: boolean }) {
  return (
    <motion.div
      className="absolute inset-x-0 top-[17vh] flex flex-col items-center text-center px-6"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.8 } }}
      transition={{ duration: 1.6 }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 1.04 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.2, duration: 2.2, ease: [0.2, 0.7, 0.2, 1] }}
      >
        <Logo />
      </motion.div>
      {!started && (
        <motion.div
          className="mt-[16vh] flex flex-col items-center gap-4 pointer-events-auto"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.4, duration: 1 }}
        >
          <button
            onClick={(e) => {
              e.stopPropagation();
              onPlay();
            }}
            className="play-big"
            aria-label="Play the film"
          >
            <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden>
              <path d="M7 4.5v15l13-7.5z" fill="currentColor" />
            </svg>
            <span>Play</span>
          </button>
          <span className="text-white/60 text-xs sm:text-sm tracking-[0.2em] uppercase">
            or press space
          </span>
        </motion.div>
      )}
    </motion.div>
  );
}

/** A spoken line, floating just above the speaker's head (bottom-centre when they're off screen). */
function Subtitle({ cue }: { cue: Cue | null }) {
  const box = useRef<HTMLDivElement>(null);
  const who = cue?.who;
  useEffect(() => {
    if (!who) return;
    let raf = 0;
    const place = () => {
      raf = requestAnimationFrame(place);
      const el = box.current;
      if (!el) return;
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const w = el.offsetWidth;
      const h = el.offsetHeight;
      const a = headAnchors[who];
      let x = vw / 2;
      let y = vh - (vw < 640 ? 112 : 124) - h;
      if (a.ok) {
        x = a.x;
        y = a.y - h - 18;
      }
      x = Math.min(vw - 12 - w / 2, Math.max(12 + w / 2, x));
      y = Math.min(vh - 120 - h, Math.max(vw < 640 ? 76 : 92, y));
      el.style.transform = `translate3d(${(x - w / 2).toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
    };
    place();
    return () => cancelAnimationFrame(raf);
  }, [who]);
  return (
    <div ref={box} className="absolute left-0 top-0 w-max pointer-events-none will-change-transform">
      <AnimatePresence mode="wait">
        {cue && (
          <motion.p
            key={cue.text + cue.chapter}
            className="subtitle subtitle-bubble"
            initial={{ opacity: 0, y: 6, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.2 } }}
            transition={{ duration: 0.25 }}
          >
            <span className="subtitle-who">{SPEAKER[cue.who]}</span>
            {cue.text}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}

function Disqualified() {
  return (
    <motion.div
      className="absolute left-1/2 top-[60%] -translate-x-1/2 -translate-y-1/2 pointer-events-none"
      initial={{ scale: 1.08, opacity: 0, rotate: -3 }}
      animate={{ scale: 1, opacity: 1, rotate: -3 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5, ease: [0.2, 0.7, 0.2, 1] }}
    >
      <div className="stamp">
        disqualified
        <small>that&apos;s a streetlight. try again tomorrow.</small>
      </div>
    </motion.div>
  );
}

function PhoneText() {
  return (
    <motion.div
      className="absolute right-4 sm:right-16 bottom-[130px] sm:bottom-[150px] pointer-events-none"
      initial={{ y: 80, opacity: 0, rotate: 3 }}
      animate={{ y: 0, opacity: 1, rotate: 2 }}
      exit={{ y: 60, opacity: 0, transition: { duration: 0.4 } }}
      transition={{ type: "spring", stiffness: 120, damping: 20 }}
    >
      <div className="phone">
        <div className="phone-header">
          <span className="phone-avatar">O</span>Otto
        </div>
        <div className="phone-msg phone-out phone-photo">
          <div className="phone-moon" />
        </div>
        <motion.div className="phone-msg phone-out" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.2 }}>
          moon i win
        </motion.div>
        <motion.div className="phone-msg phone-in" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 2.6 }}>
          ugh. fine. well played
        </motion.div>
      </div>
    </motion.div>
  );
}

/** A real-looking moon that waxes from a sliver to full as the film plays. */
function GrowingMoon({ progress }: { progress: number }) {
  const p = Math.max(0.04, Math.min(1, progress));
  const size = 34 + p * 22;
  const r = 50;
  const rx = r * Math.abs(1 - 2 * p);
  const sweep = p < 0.5 ? 0 : 1;
  const lit = `M50 0 A50 50 0 0 1 50 100 A${rx.toFixed(2)} 50 0 0 ${sweep} 50 0 Z`;
  return (
    <div
      className="growing-moon"
      style={{ width: size, height: size, filter: `drop-shadow(0 0 ${4 + p * 18}px rgba(220,230,255,${0.15 + p * 0.45}))` }}
      role="img"
      aria-label={`Story progress ${Math.round(p * 100)}%`}
    >
      <svg viewBox="0 0 100 100" width="100%" height="100%">
        <defs>
          <radialGradient id="mlit" cx="42%" cy="40%" r="70%">
            <stop offset="0" stopColor="#fbf8f0" />
            <stop offset="0.65" stopColor="#ddd6c6" />
            <stop offset="1" stopColor="#a9a396" />
          </radialGradient>
          <clipPath id="mclip">
            <path d={lit} />
          </clipPath>
        </defs>
        <circle cx="50" cy="50" r="49" fill="#141824" stroke="rgba(255,255,255,0.14)" strokeWidth="1.5" />
        <g clipPath="url(#mclip)">
          <circle cx="50" cy="50" r="50" fill="url(#mlit)" />
          <ellipse cx="38" cy="36" rx="14" ry="10" fill="#b9b2a2" opacity="0.55" />
          <ellipse cx="60" cy="58" rx="17" ry="12" fill="#b4ad9d" opacity="0.5" />
          <ellipse cx="42" cy="66" rx="8" ry="6" fill="#bdb6a6" opacity="0.5" />
          <circle cx="70" cy="30" r="4" fill="#c9c2b2" />
          <circle cx="28" cy="56" r="3" fill="#c6bfaf" />
          <circle cx="62" cy="80" r="5" fill="#c4bdad" />
          <circle cx="80" cy="54" r="2.5" fill="#cbc4b4" />
        </g>
      </svg>
    </div>
  );
}

type IconName = "play" | "pause" | "restart" | "rewind" | "prev" | "next" | "sound" | "muted";
function Icon({ name }: { name: IconName }) {
  const stroke = { fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  // counter-clockwise arrow: the arc and its head share an endpoint at (3, 8)
  const ccw = "M3 12a9 9 0 1 0 2.64-6.36L3 8";
  const paths: Record<IconName, React.ReactNode> = {
    play: <path d="M7 4.5v15l13-7.5z" fill="currentColor" />,
    pause: <path d="M6.5 4.5h4v15h-4zM13.5 4.5h4v15h-4z" fill="currentColor" />,
    restart: (
      <>
        <path d={ccw} {...stroke} />
        <path d="M3 3v5h5" {...stroke} />
      </>
    ),
    rewind: (
      <>
        <path d={ccw} {...stroke} strokeWidth={1.8} />
        <path d="M3 3v5h5" {...stroke} strokeWidth={1.8} />
        <text x="12.5" y="15.6" fontSize="8.5" fontWeight="700" textAnchor="middle" fill="currentColor" fontFamily="system-ui, sans-serif">
          5
        </text>
      </>
    ),
    prev: <path d="M15 18l-6-6 6-6" {...stroke} strokeWidth={2.2} />,
    next: <path d="M9 18l6-6-6-6" {...stroke} strokeWidth={2.2} />,
    sound: <path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4zM15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11" {...stroke} strokeWidth={1.8} />,
    muted: <path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4zM16 9.5l5 5M21 9.5l-5 5" {...stroke} strokeWidth={1.8} />,
  };

  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden>
      {paths[name]}
    </svg>
  );
}

function Controls({ view, muted, onPlay, onMute }: { view: View; muted: boolean; onPlay: () => void; onMute: () => void }) {
  const c = chapters[view.chapter];
  const label = c.kicker ?? (c.id === "title" ? "opening" : (c.lines[0] ?? ""));
  const stop = (fn: () => void) => (e: React.MouseEvent) => {
    e.stopPropagation();
    fn();
  };
  return (
    <div className="absolute inset-x-0 bottom-0 pointer-events-none">
      <div className="mx-auto max-w-5xl px-3 sm:px-6 pb-4 sm:pb-6">
        <div className="rail pointer-events-auto" onClick={(e) => e.stopPropagation()}>
          {chapters.map((ch, i) => {
            const len = (starts[i + 1] ?? TOTAL) - starts[i];
            return (
              <button
                key={ch.id}
                className={`rail-seg ${i < view.chapter ? "is-past" : ""} ${i === view.chapter ? "is-now" : ""}`}
                style={{ flexGrow: len }}
                onClick={() => seekChapter(i)}
                aria-label={`chapter ${i + 1}`}
              >
                {i === view.chapter && <span className="rail-fill" style={{ width: `${Math.min(100, (view.local / len) * 100)}%` }} />}
              </button>
            );
          })}
        </div>
        <div className="mt-3 flex items-center gap-1.5 sm:gap-3 pointer-events-auto">
          <button className="ctl" onClick={stop(() => rewind(5))} aria-label="Rewind 5 seconds" title="rewind 5s (shift + ←)">
            <Icon name="rewind" />
          </button>
          <button className="ctl ctl-main" onClick={stop(onPlay)} aria-label={view.ended ? "Restart" : view.playing ? "Pause" : "Play"} title="space">
            <Icon name={view.ended ? "restart" : view.playing ? "pause" : "play"} />
          </button>
          <button className="ctl" onClick={stop(prev)} aria-label="Previous chapter" title="←">
            <Icon name="prev" />
          </button>
          <button className="ctl" onClick={stop(next)} aria-label="Next chapter" title="→">
            <Icon name="next" />
          </button>
          <div className="ml-1 sm:ml-2 min-w-0 flex-1 text-white/75 text-xs sm:text-sm tracking-wide truncate">
            <span className="tabular-nums text-white/45 mr-2">
              {String(view.chapter + 1).padStart(2, "0")} / {CHAPTER_COUNT}
            </span>
            <span className="hidden sm:inline">{label}</span>
          </div>
          <button className="ctl" onClick={stop(onMute)} aria-label={muted ? "Unmute" : "Mute"} title="m">
            <Icon name={muted ? "muted" : "sound"} />
          </button>
          <GrowingMoon progress={view.progress} />
        </div>
      </div>
    </div>
  );
}

/** "link copied" confirmation, shown right beside the button that was pressed. */
function CopiedToast({ show, className = "" }: { show: boolean; className?: string }) {
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          key="copied"
          className={`toast ${className}`}
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.2 }}
          role="status"
        >
          mooniwin.com copied to clipboard
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function Finale({ onChallenge, onClaim, copied }: { onChallenge: (e: React.MouseEvent) => void; onClaim: () => void; copied: boolean }) {
  return (
    <motion.div
      className="absolute left-0 right-0 sm:right-auto sm:left-14 top-[230px] sm:top-[250px] flex flex-col sm:flex-row items-center sm:items-start gap-3 px-5 sm:px-0 pointer-events-auto"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 10 }}
      transition={{ delay: 1, duration: 1 }}
    >
      <div className="relative">
        <button onClick={onChallenge} className="cta cta-primary">
          challenge someone
        </button>
        <CopiedToast show={copied} className="absolute left-1/2 -translate-x-1/2 top-full mt-2" />
      </div>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onClaim();
        }}
        className="cta"
      >
        claim your win
      </button>
    </motion.div>
  );
}

// ── Main ───────────────────────────────────────────────────────────────────
export default function StoryExperience() {
  const view = useView();
  const [copied, setCopied] = useState<null | "nav" | "cta">(null);
  const [claimOpen, setClaimOpen] = useState(false);
  const [muted, setMuted] = useState(() => sound.muted);
  const [lite] = useState(() => window.matchMedia("(max-width: 768px), (pointer: coarse)").matches);
  const claimRef = useRef(false);

  useEffect(() => {
    claimRef.current = claimOpen;
  }, [claimOpen]);
  useEffect(() => sound.subscribe(setMuted), []);

  const startPlayback = useCallback(() => {
    void sound.init();
    toggle();
  }, []);

  useEffect(() => {
    const html = document.documentElement;
    html.style.setProperty("--moon-cursor", MOON_CURSOR);
    // deep link to a scene: /?c=6 opens chapter 7 with the camera already there
    const c = Number(new URLSearchParams(window.location.search).get("c"));
    if (Number.isInteger(c) && c > 0 && c < CHAPTER_COUNT) {
      // optional &s=seconds into the scene (e.g. to land on a spoken line)
      const sec = Number(new URLSearchParams(window.location.search).get("s"));
      player.playhead = starts[c] + (sec > 0 ? sec : Math.max(voStart(c), 3.2));
      player.started = true;
    }
    const prevOverflow = html.style.overflow;
    html.style.overflow = "hidden";

    const onKey = (e: KeyboardEvent) => {
      if (claimRef.current) return;
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (e.code === "Space" || e.key === "k") {
        e.preventDefault();
        void sound.init();
        toggle();
      } else if ((e.key === "ArrowLeft" && e.shiftKey) || e.key === "j") {
        e.preventDefault();
        rewind(5);
      } else if (["ArrowRight", "ArrowDown", "PageDown"].includes(e.key)) {
        e.preventDefault();
        next();
      } else if (["ArrowLeft", "ArrowUp", "PageUp"].includes(e.key)) {
        e.preventDefault();
        prev();
      } else if (e.key === "r") {
        void sound.init();
        restart();
      } else if (e.key === "m") {
        sound.toggleMuted();
      }
    };
    const onMove = (e: PointerEvent) => {
      story.pointer.set((e.clientX / window.innerWidth) * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointermove", onMove);
    return () => {
      html.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointermove", onMove);
    };
  }, []);

  const handleChallenge = useCallback(async (e: React.MouseEvent, from: "nav" | "cta" = "nav") => {
    e.stopPropagation();
    toasterTrigger.at = story.time;
    try {
      await navigator.clipboard.writeText("https://mooniwin.com/");
    } catch {
      /* clipboard blocked: still tell them where to send people */
    }
    setCopied(from);
    setTimeout(() => setCopied(null), 2600);
  }, []);

  const onMute = useCallback(() => sound.toggleMuted(), []);
  const fakeIdx = chapterIndex("fake");
  const textIdx = chapterIndex("text");
  const isFinale = view.active === CHAPTER_COUNT - 1;
  const settled = view.active === view.chapter;
  const phoneAt = 1.0;

  return (
    <div
      className="story-root fixed inset-0 bg-[#05070f] select-none"
      onClick={() => {
        // tap anywhere on the film to play / pause (controls stop propagation)
        if (claimRef.current) return;
        void sound.init();
        toggle();
      }}
    >
      <Canvas
        shadows="percentage"
        dpr={lite ? [1, 2] : [1, 2.5]}
        camera={{ position: [0, 3, 24], fov: 44, near: 0.1, far: 1200 }}
        gl={{ antialias: false, powerPreference: "high-performance", toneMapping: THREE.NoToneMapping }}
      >
        <World lite={lite} />
      </Canvas>

      <div className="letterbox letterbox-bottom" aria-hidden />

      <div className="absolute inset-0 z-10 pointer-events-none">
        <AnimatePresence>
          {view.active === 0 && <TitleCard key="title" onPlay={startPlayback} started={view.started} />}
          {view.active !== null && view.active > 0 && <Caption key={view.active} index={view.active} />}
        </AnimatePresence>
        <AnimatePresence>{settled && view.chapter === fakeIdx && view.local > 2.0 && <Disqualified key="dq" />}</AnimatePresence>
        <AnimatePresence>{settled && view.chapter === textIdx && view.local > phoneAt && <PhoneText key="phone" />}</AnimatePresence>
        <AnimatePresence>
          {isFinale && <Finale key="finale" onChallenge={(e) => handleChallenge(e, "cta")} onClaim={() => setClaimOpen(true)} copied={copied === "cta"} />}
        </AnimatePresence>
        <Subtitle cue={view.cue} />
        <Controls view={view} muted={muted} onPlay={startPlayback} onMute={onMute} />
      </div>

      <header className="absolute top-0 inset-x-0 z-20">
        <nav className="mx-auto max-w-7xl px-4 sm:px-8 py-4 sm:py-5 flex items-center justify-between">
          <button
            onClick={(e) => {
              e.stopPropagation();
              void sound.init();
              restart();
            }}
            aria-label="moon i win: back to the start"
          >
            <Logo size="sm" />
          </button>
          <div className="relative flex items-center gap-2 sm:gap-3">
            <button onClick={(e) => handleChallenge(e, "nav")} className="nav-btn">
              challenge someone
            </button>
            <CopiedToast show={copied === "nav"} className="absolute right-0 top-full mt-2" />
            <button
              onClick={(e) => {
                e.stopPropagation();
                setClaimOpen(true);
              }}
              className="nav-btn nav-btn-solid"
            >
              claim your win
            </button>
          </div>
        </nav>
      </header>

      <section className="sr-only">
        <h1>moon i win!</h1>
        {chapters
          .flatMap((c) => [...c.lines, ...(c.big ? [c.big] : [])])
          .map((l, i) => (
            <p key={i}>{l}</p>
          ))}
      </section>

      <ClaimWinModal isOpen={claimOpen} onClose={() => setClaimOpen(false)} />
    </div>
  );
}
