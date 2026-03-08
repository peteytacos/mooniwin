"use client";

import { Canvas } from "@react-three/fiber";
import { useState, useCallback, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import SceneContent from "./cinematic/SceneContent";
import ClaimWinModal from "./ClaimWinModal";
import { resetTimeline } from "./cinematic/timeline";
import { ripples } from "./cinematic/ripples";
import { shootingStars } from "./cinematic/shootingStars";

const crawlLines = [
  "moon, i win is a game that has been",
  "passed down through the centuries",
  "in order to settle a never ending question:",
  "",
  "who saw the moon first today?",
  "",
  "the rules are simple",
  "",
  "be outside",
  "",
  "be within shouting distance",
  "",
  "point at the moon and say \"moon, i win!\"",
  "",
  "enjoy your victory for the day",
  "",
  "other things to note:",
  "",
  "fake moon sightings are punishable",
  "by death (you are disqualified for the day)",
  "",
  "everyone in your group must be outside",
  "",
  "tricking someone to come outside",
  "is very much encouraged",
  "",
  "if you must text someone the moon, so be it!",
  "",
  "enjoy yourselves, and good luck",
];

// Project the moon's 3D bounds to screen-space pixel rect
function useMoonScreenRect() {
  const [rect, setRect] = useState({ width: 0, centerX: 0, isNarrow: false });

  useEffect(() => {
    const compute = () => {
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const aspect = vw / vh;
      const isNarrow = vw < 1130;

      if (isNarrow) {
        // Center text between figures (left) and moon (right)
        setRect({ width: Math.min(280, vw * 0.28), centerX: vw / 2, isNarrow: true });
        return;
      }

      const baseFov = 50;
      const fov = aspect < 1 ? baseFov + (1 - aspect) * 30 : baseFov;
      const moonRadius = 3.8;
      const moonX = 2;
      const cameraZ = 10;
      const moonZ = -8;
      const dist = cameraZ - moonZ; // 18

      const halfFovRad = (fov / 2) * (Math.PI / 180);
      const visibleHeight = 2 * dist * Math.tan(halfFovRad);
      const visibleWidth = visibleHeight * aspect;

      const moonDiameter = moonRadius * 2;
      const width = (moonDiameter / visibleWidth) * vw;
      // moonX=0 maps to screen center (vw/2), positive = right
      const centerX = (moonX / visibleWidth) * vw + vw / 2;

      setRect({ width, centerX, isNarrow: false });
    };

    compute();
    window.addEventListener("resize", compute);
    return () => window.removeEventListener("resize", compute);
  }, []);

  return rect;
}

interface Stats {
  winsToday: number;
  totalWins: number;
  totalVisits: number;
}

export default function CinematicScene() {
  const [showNav, setShowNav] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showClaimModal, setShowClaimModal] = useState(false);
  const [stats, setStats] = useState<Stats | null>(null);
  const cursorRef = useRef<HTMLDivElement>(null);
  const shootingStarContainer = useRef<HTMLDivElement>(null);
  const spawnToasterRef = useRef<(() => void) | null>(null);
  const spawnMoonBurstRef = useRef<(() => void) | null>(null);
  const moonRect = useMoonScreenRect();

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (cursorRef.current) {
        cursorRef.current.style.transform = `translate(${e.clientX}px, ${e.clientY}px)`;
      }
    };
    window.addEventListener("mousemove", onMove);
    return () => window.removeEventListener("mousemove", onMove);
  }, []);

  // Fire-and-forget visit beacon on mount
  useEffect(() => {
    fetch("/api/visit", { method: "POST" }).catch(() => {});
  }, []);

  // Fetch stats when nav appears
  useEffect(() => {
    if (!showNav) return;
    fetch("/api/stats")
      .then((r) => r.json())
      .then(setStats)
      .catch(() => {});
  }, [showNav]);

  // Shooting stars
  useEffect(() => {
    const container = shootingStarContainer.current;
    if (!container) return;

    let starCount = 0;

    const spawnToaster = () => {
      const startX = 105;
      const startY = 10 + Math.random() * 80;
      const angle = 160 + Math.random() * 40;
      const duration = 4 + Math.random() * 3;

      const rad = (angle * Math.PI) / 180;
      const dist = Math.max(window.innerWidth, window.innerHeight) * 1.5;
      const travelX = Math.cos(rad) * dist;
      const travelY = Math.sin(rad) * dist;

      shootingStars.add(startX, startY, travelX, travelY, duration);

      const el = document.createElement("img");
      (el as HTMLImageElement).src = "/toaster.png";
      el.style.cssText = `
        position: absolute;
        left: ${startX}%;
        top: ${startY}%;
        width: 60px;
        height: 60px;
        pointer-events: none;
        z-index: 1;
      `;
      container.appendChild(el);

      const anim = el.animate([
        { opacity: 0, transform: "translate(0, 0)" },
        { opacity: 0.9, transform: `translate(${travelX * 0.1}px, ${travelY * 0.1}px)`, offset: 0.1 },
        { opacity: 0.7, transform: `translate(${travelX * 0.8}px, ${travelY * 0.8}px)`, offset: 0.8 },
        { opacity: 0, transform: `translate(${travelX}px, ${travelY}px)` },
      ], { duration: duration * 1000, easing: "linear", fill: "forwards" });

      anim.onfinish = () => el.remove();
    };
    spawnToasterRef.current = spawnToaster;

    const spawnMoonBurst = () => {
      const count = 60;
      for (let i = 0; i < count; i++) {
        const el = document.createElement("div");
        // Random edge start
        const edge = Math.floor(Math.random() * 4);
        let startX: number, startY: number;
        if (edge === 0) { startX = Math.random() * 100; startY = -10; }
        else if (edge === 1) { startX = 110; startY = Math.random() * 100; }
        else if (edge === 2) { startX = Math.random() * 100; startY = 110; }
        else { startX = -10; startY = Math.random() * 100; }
        // Travel across to opposite side
        const angle = Math.random() * 360;
        const rad = (angle * Math.PI) / 180;
        const dist = Math.max(window.innerWidth, window.innerHeight) * 2;
        const travelX = Math.cos(rad) * dist;
        const travelY = Math.sin(rad) * dist;
        const duration = 8000 + Math.random() * 7000;
        const delay = Math.random() * 3000;

        el.textContent = "🌕";
        el.style.cssText = `
          position: absolute;
          left: ${startX}%;
          top: ${startY}%;
          font-size: 50px;
          line-height: 1;
          pointer-events: none;
          z-index: 1;
        `;
        container.appendChild(el);

        const anim = el.animate([
          { opacity: 0, transform: "translate(0, 0)" },
          { opacity: 0.8, transform: `translate(${travelX * 0.1}px, ${travelY * 0.1}px)`, offset: 0.1 },
          { opacity: 0.6, transform: `translate(${travelX * 0.8}px, ${travelY * 0.8}px)`, offset: 0.85 },
          { opacity: 0, transform: `translate(${travelX}px, ${travelY}px)` },
        ], { duration, delay, easing: "linear", fill: "forwards" });

        anim.onfinish = () => el.remove();
      }
    };
    spawnMoonBurstRef.current = spawnMoonBurst;

    const randomEdge = () => {
      const edge = Math.floor(Math.random() * 4);
      let startX: number, startY: number, angle: number;
      if (edge === 0) {
        startX = Math.random() * 100;
        startY = -5;
        angle = 60 + Math.random() * 60;
      } else if (edge === 1) {
        startX = 105;
        startY = Math.random() * 100;
        angle = 150 + Math.random() * 60;
      } else if (edge === 2) {
        startX = Math.random() * 100;
        startY = 105;
        angle = 240 + Math.random() * 60;
      } else {
        startX = -5;
        startY = Math.random() * 100;
        angle = -30 + Math.random() * 60;
      }
      return { startX, startY, angle };
    };

    const spawnStar = () => {
      starCount++;
      if (starCount % 10 === 0) {
        spawnToaster();
        return;
      }

      const { startX, startY, angle } = randomEdge();
      const duration = 1.5 + Math.random() * 1.5;

      const rad = (angle * Math.PI) / 180;
      const dist = Math.max(window.innerWidth, window.innerHeight) * 1.5;
      const travelX = Math.cos(rad) * dist;
      const travelY = Math.sin(rad) * dist;

      shootingStars.add(startX, startY, travelX, travelY, duration);

      const el = document.createElement("div");
      const size = 10 + Math.random() * 12;
      el.textContent = Math.random() < 0.1 ? "🍞" : "⭐";
      el.style.cssText = `
        position: absolute;
        left: ${startX}%;
        top: ${startY}%;
        font-size: ${size}px;
        pointer-events: none;
        filter: brightness(2);
        z-index: 1;
      `;
      container.appendChild(el);

      const anim = el.animate([
        { opacity: 0, transform: "translate(0, 0)" },
        { opacity: 0.9, transform: `translate(${travelX * 0.1}px, ${travelY * 0.1}px)`, offset: 0.1 },
        { opacity: 0.7, transform: `translate(${travelX * 0.8}px, ${travelY * 0.8}px)`, offset: 0.8 },
        { opacity: 0, transform: `translate(${travelX}px, ${travelY}px)` },
      ], { duration: duration * 1000, easing: "linear", fill: "forwards" });

      anim.onfinish = () => el.remove();
    };

    // Spawn at random intervals (1.5-4 seconds)
    const scheduleNext = () => {
      const delay = 1500 + Math.random() * 2500;
      return setTimeout(() => {
        spawnStar();
        timerId = scheduleNext();
      }, delay);
    };

    let timerId = scheduleNext();
    return () => clearTimeout(timerId);
  }, []);

  const handleNavReady = useCallback(() => {
    setShowNav(true);
  }, []);

  const handleReplay = useCallback(() => {
    setShowNav(false);
    resetTimeline();
  }, []);

  const handleClick = useCallback((e: React.MouseEvent) => {
    const ndcX = (e.clientX / window.innerWidth) * 2 - 1;
    const ndcY = -(e.clientY / window.innerHeight) * 2 + 1;
    ripples.add(ndcX, ndcY);
    spawnToasterRef.current?.();
  }, []);

  const handleChallenge = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();
    spawnMoonBurstRef.current?.();
    const url = window.location.origin + "/";
    if (navigator.share) {
      try {
        await navigator.share({ url });
        return;
      } catch {
        /* user cancelled */
      }
    }
    // Fallback: copy link to clipboard
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, []);

  return (
    <div className="relative w-screen h-dvh bg-black overflow-hidden cursor-none" onClick={handleClick}>
      <Canvas
        camera={{ position: [0, 0, 10], fov: 50 }}
        gl={{ antialias: true, alpha: false }}
        dpr={[1, 2]}
        style={{ position: "absolute", inset: 0 }}
      >
        <color attach="background" args={["#000000"]} />
        <SceneContent onNavReady={handleNavReady} />
      </Canvas>

      {/* Shooting stars container */}
      <div ref={shootingStarContainer} className="absolute inset-0 overflow-hidden pointer-events-none z-[1]" />

      {/* Star Wars crawl — positioned under the moon, fades into it */}
      <AnimatePresence>
        {showNav && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1, delay: 0 }}
            className="absolute inset-0 z-10 pointer-events-none"
          >
            {/* Container centered horizontally under the moon — responsive */}
            <div
              className="absolute overflow-hidden"
              style={{
                width: moonRect.width > 0 ? moonRect.width : undefined,
                left: moonRect.centerX > 0 ? moonRect.centerX : "50%",
                transform: "translateX(-50%)",
                top: 0,
                bottom: 0,
              }}
            >
              {/* Top mask: fade below moon. Bottom mask: cut at feet. Responsive via CSS vars */}
              <div
                className="w-full h-full"
                style={{
                  maskImage: "linear-gradient(to bottom, transparent 0%, transparent calc(52% + 20px), white calc(52% + 40px), white 84%, transparent 84%)",
                  WebkitMaskImage: "linear-gradient(to bottom, transparent 0%, transparent calc(52% + 20px), white calc(52% + 40px), white 84%, transparent 84%)",
                }}
              >
              <div
                className="text-center animate-crawl"
              >
                {/* Duplicate content for seamless loop */}
                {[0, 1].map((copy) => (
                  <div key={copy} className="pb-[30vh]">
                    {crawlLines.map((line, i) => (
                      <p
                        key={i}
                        className={`font-bold text-white text-lg sm:text-xl lg:text-2xl leading-relaxed ${line === "" ? "h-8 sm:h-12" : ""}`}
                      >
                        {line}
                      </p>
                    ))}
                  </div>
                ))}
              </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Nav overlay */}
      <AnimatePresence>
        {showNav && (
          <motion.header
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1 }}
            className="absolute top-0 left-0 right-0 z-10 pointer-events-none"
          >
            <nav className="mx-auto max-w-sm sm:max-w-xl md:max-w-3xl lg:max-w-5xl xl:max-w-7xl px-4 sm:px-6 py-4 sm:py-6 flex items-center justify-between pointer-events-auto">
              <button
                onClick={(e) => { e.stopPropagation(); window.location.reload(); }}
                className="text-sm sm:text-base font-medium text-white hover:text-white/80 transition-colors cursor-none"
              >
                moon, i win!
              </button>
              <div className="flex items-center gap-6">
                <button
                  onClick={handleChallenge}
                  className="text-sm sm:text-base font-medium text-white hover:text-white/80 transition-colors cursor-none text-center min-w-[140px]"
                >
                  {copied ? "link copied!" : "challenge someone"}
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); setShowClaimModal(true); }}
                  className="text-sm sm:text-base font-medium text-white hover:text-white/80 transition-colors cursor-none"
                >
                  claim your win
                </button>
              </div>
            </nav>
          </motion.header>
        )}
      </AnimatePresence>

      {/* Stats footer */}
      <AnimatePresence>
        {showNav && stats && (
          <motion.footer
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1.5, delay: 0.5 }}
            className="absolute bottom-0 left-0 right-0 z-10 flex justify-center pb-3 pointer-events-none"
          >
            <p className="text-white/25 text-xs tracking-widest select-none">
              {stats.winsToday.toLocaleString()} wins today
              &nbsp;&middot;&nbsp;
              {stats.totalWins.toLocaleString()} total wins
              &nbsp;&middot;&nbsp;
              {stats.totalVisits.toLocaleString()} total visits
            </p>
          </motion.footer>
        )}
      </AnimatePresence>

      <ClaimWinModal isOpen={showClaimModal} onClose={() => setShowClaimModal(false)} />

      {/* Custom cursor ring */}
      <div
        ref={cursorRef}
        className="pointer-events-none fixed top-0 left-0 z-50 -translate-x-1/2 -translate-y-1/2 hidden sm:flex items-center justify-center"
        style={{
          width: 64,
          height: 64,
          borderRadius: "50%",
          border: "1px solid rgba(255, 255, 255, 0.3)",
          fontSize: 24,
          filter: "grayscale(1) brightness(0.8)",
        }}
      >
        🌕
      </div>
    </div>
  );
}
