"use client";

import { Canvas } from "@react-three/fiber";
import { useState, useCallback, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import SceneContent from "./cinematic/SceneContent";
import { resetTimeline } from "./cinematic/timeline";

const navLinks = [
  { href: "/rules", label: "rules" },
  { href: "/play", label: "play" },
  { href: "/win", label: "declare win" },
  { href: "/challenge", label: "challenge" },
];

const crawlLines = [
  "moon, i win is a game that has been",
  "passed down through the centuries",
  "in order to settle a never ending question:",
  "",
  "who saw the moon first today?",
  "",
  "the rules are simple.",
  "",
  "1. be outside",
  "",
  "2. be within shouting distance",
  "",
  "3. say \"moon, i win!\"",
  "",
  "4. enjoy your victory for the day",
  "",
  "other things to note:",
  "",
  "fake moon sightings are punishable",
  "by death (you are disqualified for the day).",
  "",
  "everyone in your group must be outside.",
  "",
  "tricking someone to come outside",
  "is very much encouraged.",
  "",
  "if you must text someone the moon, so be it!",
  "",
  "enjoy yourselves, and good luck.",
  "",
  "i love you all to the moon and back.",
];

export default function CinematicScene() {
  const [showNav, setShowNav] = useState(false);
  const cursorRef = useRef<HTMLDivElement>(null);
  const shootingStarContainer = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (cursorRef.current) {
        cursorRef.current.style.transform = `translate(${e.clientX}px, ${e.clientY}px)`;
      }
    };
    window.addEventListener("mousemove", onMove);
    return () => window.removeEventListener("mousemove", onMove);
  }, []);

  // Shooting stars
  useEffect(() => {
    const container = shootingStarContainer.current;
    if (!container) return;

    const spawnStar = () => {
      const star = document.createElement("div");
      const size = 10 + Math.random() * 12;
      // Pick a random edge: 0=top, 1=right, 2=bottom, 3=left
      // Angles in screen coords: 0=right, 90=down, 180=left, 270=up
      const edge = Math.floor(Math.random() * 4);
      let startX: number, startY: number, angle: number;
      if (edge === 0) {        // top edge, fire downward
        startX = Math.random() * 100;
        startY = -5;
        angle = 60 + Math.random() * 60;   // 60-120 (down-ish)
      } else if (edge === 1) { // right edge, fire left
        startX = 105;
        startY = Math.random() * 100;
        angle = 150 + Math.random() * 60;  // 150-210 (left-ish)
      } else if (edge === 2) { // bottom edge, fire upward
        startX = Math.random() * 100;
        startY = 105;
        angle = 240 + Math.random() * 60;  // 240-300 (up-ish)
      } else {                 // left edge, fire right
        startX = -5;
        startY = Math.random() * 100;
        angle = -30 + Math.random() * 60;  // -30 to 30 (right-ish)
      }
      const duration = 1.5 + Math.random() * 1.5;

      // Compute travel in pixels
      const rad = (angle * Math.PI) / 180;
      const dist = Math.max(window.innerWidth, window.innerHeight) * 1.5;
      const travelX = Math.cos(rad) * dist;
      const travelY = Math.sin(rad) * dist;

      star.textContent = Math.random() < 0.1 ? "🍞" : "⭐";
      star.style.cssText = `
        position: absolute;
        left: ${startX}%;
        top: ${startY}%;
        font-size: ${size}px;
        pointer-events: none;
        filter: brightness(2);
        z-index: 4;
      `;
      container.appendChild(star);

      const anim = star.animate([
        { opacity: 0, transform: "translate(0, 0)" },
        { opacity: 0.9, transform: `translate(${travelX * 0.1}px, ${travelY * 0.1}px)`, offset: 0.1 },
        { opacity: 0.7, transform: `translate(${travelX * 0.8}px, ${travelY * 0.8}px)`, offset: 0.8 },
        { opacity: 0, transform: `translate(${travelX}px, ${travelY}px)` },
      ], { duration: duration * 1000, easing: "linear", fill: "forwards" });

      anim.onfinish = () => star.remove();
    };

    // Spawn at random intervals (3-8 seconds)
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

  return (
    <div className="relative w-screen h-dvh bg-black overflow-hidden cursor-none">
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
      <div ref={shootingStarContainer} className="absolute inset-0 overflow-hidden pointer-events-none z-[4]" />

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
              className="absolute max-w-xl px-6 sm:px-8 overflow-hidden left-1/2 sm:left-[58%] lg:left-[65%]"
              style={{
                width: "100%",
                top: 0,
                bottom: 0,
                transform: "translateX(-50%)",
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
                className="text-left animate-crawl"
              >
                {/* Duplicate content for seamless loop */}
                {[0, 1].map((copy) => (
                  <div key={copy} className="pb-[30vh]">
                    {crawlLines.map((line, i) => (
                      <p
                        key={i}
                        className={`text-white/50 text-sm sm:text-base lg:text-lg leading-relaxed ${line === "" ? "h-4 sm:h-6" : ""}`}
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
              <Link
                href="/"
                className="text-sm sm:text-base font-medium text-white hover:text-white/80 transition-colors"
              >
                moon, i win
              </Link>
              {/* Nav links hidden for now */}
            </nav>
          </motion.header>
        )}
      </AnimatePresence>

      {/* Replay button */}
      <AnimatePresence>
        {showNav && (
          <motion.button
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.4 }}
            whileHover={{ opacity: 0.9 }}
            transition={{ duration: 0.5 }}
            onClick={handleReplay}
            className="absolute bottom-6 left-1/2 -translate-x-1/2 sm:left-auto sm:translate-x-0 sm:right-8 sm:bottom-8 z-20 text-white/40 hover:text-white transition-colors text-xl cursor-pointer"
            aria-label="Replay animation"
          >
            ↻
          </motion.button>
        )}
      </AnimatePresence>

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
