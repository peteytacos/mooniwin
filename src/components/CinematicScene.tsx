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
    <div className="relative w-screen h-dvh bg-[#030712]">
      <Canvas
        camera={{ position: [0, 0, 10], fov: 50 }}
        gl={{ antialias: true, alpha: false }}
        dpr={[1, 2]}
        style={{ position: "absolute", inset: 0 }}
      >
        <color attach="background" args={["#030712"]} />
        <SceneContent onNavReady={handleNavReady} />
      </Canvas>

      {/* Nav overlay */}
      <AnimatePresence>
        {showNav && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1 }}
            className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none z-10"
          >
            <nav className="flex flex-col sm:flex-row items-center gap-4 sm:gap-8 mt-24 pointer-events-auto">
              {navLinks.map(({ href, label }, i) => (
                <motion.div
                  key={href}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.1, duration: 0.5 }}
                >
                  <Link
                    href={href}
                    className="text-sm sm:text-base font-medium text-slate-300/80 hover:text-white transition-colors"
                  >
                    {label}
                  </Link>
                </motion.div>
              ))}
            </nav>
          </motion.div>
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
            className="absolute bottom-6 right-6 sm:bottom-8 sm:right-8 z-20 text-slate-400 hover:text-white transition-colors text-xl cursor-pointer"
            aria-label="Replay animation"
          >
            ↻
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}
