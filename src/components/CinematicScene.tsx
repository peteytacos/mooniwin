"use client";

import { Canvas } from "@react-three/fiber";
import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import SceneContent from "./cinematic/SceneContent";
import { resetTimeline } from "./cinematic/timeline";

const navLinks = [
  { href: "/rules", label: "Rules" },
  { href: "/play", label: "Play" },
  { href: "/win", label: "Declare Win" },
  { href: "/challenge", label: "Challenge" },
];

export default function CinematicScene() {
  const [showNav, setShowNav] = useState(false);

  const handleNavReady = useCallback(() => {
    setShowNav(true);
  }, []);

  const handleReplay = useCallback(() => {
    setShowNav(false);
    resetTimeline();
  }, []);

  return (
    <div className="relative w-screen h-dvh bg-black">
      <Canvas
        camera={{ position: [0, 0, 10], fov: 50 }}
        gl={{ antialias: true, alpha: false }}
        dpr={[1, 2]}
        style={{ position: "absolute", inset: 0 }}
      >
        <color attach="background" args={["#000000"]} />
        <SceneContent onNavReady={handleNavReady} />
      </Canvas>

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
                Moon I Win
              </Link>
              <div className="flex items-center gap-4 sm:gap-6">
                {navLinks.map(({ href, label }, i) => (
                  <motion.div
                    key={href}
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.1, duration: 0.5 }}
                  >
                    <Link
                      href={href}
                      className="text-xs sm:text-sm font-medium text-white/70 hover:text-white transition-colors"
                    >
                      {label}
                    </Link>
                  </motion.div>
                ))}
              </div>
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
    </div>
  );
}
