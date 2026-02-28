"use client";

import { useState, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Nav from "@/components/Nav";

const PHASES = ["🌑", "🌒", "🌓", "🌔", "🌕", "🌖", "🌗", "🌘"];

function getTodayMoonEmoji(): string {
  // Simple phase approximation for the card
  const knownNew = new Date("2024-01-11").getTime();
  const cycle = 29.53 * 24 * 60 * 60 * 1000;
  const phase = ((Date.now() - knownNew) % cycle) / cycle;
  return PHASES[Math.floor(phase * 8)];
}

export default function WinPage() {
  const [name, setName] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const moonEmoji = getTodayMoonEmoji();

  const generateCard = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = 1080;
    canvas.height = 1080;

    // Background — deep space gradient
    const bg = ctx.createRadialGradient(540, 540, 100, 540, 540, 760);
    bg.addColorStop(0, "#0f172a");
    bg.addColorStop(0.5, "#060d1f");
    bg.addColorStop(1, "#030712");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, 1080, 1080);

    // Stars
    for (let i = 0; i < 200; i++) {
      ctx.beginPath();
      ctx.arc(
        Math.random() * 1080,
        Math.random() * 1080,
        Math.random() * 1.8 + 0.3,
        0,
        Math.PI * 2
      );
      ctx.fillStyle = `rgba(255,255,255,${Math.random() * 0.6 + 0.1})`;
      ctx.fill();
    }

    // Moon glow
    const glow = ctx.createRadialGradient(540, 380, 0, 540, 380, 220);
    glow.addColorStop(0, "rgba(253,230,138,0.25)");
    glow.addColorStop(0.5, "rgba(253,230,138,0.08)");
    glow.addColorStop(1, "rgba(253,230,138,0)");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, 1080, 1080);

    // Moon emoji large
    ctx.font = "200px serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(moonEmoji, 540, 360);

    // "Moon I Win!" title
    ctx.font = "bold 96px sans-serif";
    ctx.fillStyle = "#fde68a";
    ctx.shadowColor = "rgba(253,230,138,0.6)";
    ctx.shadowBlur = 40;
    ctx.fillText("Moon I Win!", 540, 600);
    ctx.shadowBlur = 0;

    // Winner name
    if (name.trim()) {
      ctx.font = "52px sans-serif";
      ctx.fillStyle = "rgba(255,255,255,0.9)";
      ctx.fillText(name.trim() + " wins today", 540, 690);
    }

    // Date
    ctx.font = "32px sans-serif";
    ctx.fillStyle = "rgba(255,255,255,0.4)";
    ctx.fillText(today, 540, 790);

    // URL
    ctx.font = "28px monospace";
    ctx.fillStyle = "rgba(253,230,138,0.4)";
    ctx.fillText("mooniwin.com", 540, 980);

    setSubmitted(true);
  }, [name, moonEmoji, today]);

  const downloadCard = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement("a");
    link.download = "moon-i-win.png";
    link.href = canvas.toDataURL("image/png");
    link.click();
  };

  const shareCard = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.toBlob(async (blob) => {
      if (!blob) return;
      const file = new File([blob], "moon-i-win.png", { type: "image/png" });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          title: "Moon I Win!",
          text: `${name || "I"} won Moon I Win today! Can you beat me tomorrow? mooniwin.com`,
          files: [file],
        });
      } else {
        downloadCard();
      }
    });
  };

  return (
    <main className="min-h-screen bg-[#030712]">
      <Nav />

      {/* Stars */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        {Array.from({ length: 80 }).map((_, i) => (
          <div
            key={i}
            className="absolute rounded-full bg-white"
            style={{
              width: Math.random() * 2 + 1 + "px",
              height: Math.random() * 2 + 1 + "px",
              top: Math.random() * 100 + "%",
              left: Math.random() * 100 + "%",
              opacity: Math.random() * 0.5 + 0.1,
            }}
          />
        ))}
      </div>

      <div className="relative z-10 max-w-lg mx-auto px-6 pt-32 pb-24">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12"
        >
          <p className="text-xs font-mono uppercase tracking-[0.3em] text-amber-300/60 mb-4">
            Victory
          </p>
          <h1 className="text-5xl sm:text-6xl font-black text-amber-100 mb-4">
            Declare Your Win
          </h1>
          <p className="text-white/40">
            Generate a shareable victory card for today&apos;s moon sighting.
          </p>
        </motion.div>

        <AnimatePresence mode="wait">
          {!submitted ? (
            <motion.div
              key="form"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-4"
            >
              {/* Moon preview */}
              <div className="text-center py-8 px-6 rounded-3xl border border-white/5 bg-white/[0.02]">
                <div className="text-8xl mb-4">{moonEmoji}</div>
                <p className="text-white/40 text-sm">{today}</p>
              </div>

              <input
                type="text"
                placeholder="Your name (optional)"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={40}
                className="w-full px-6 py-4 rounded-2xl bg-white/5 border border-white/10 text-white placeholder-white/30 text-lg focus:outline-none focus:border-amber-400/50 transition-colors"
                onKeyDown={(e) => e.key === "Enter" && generateCard()}
              />

              <button
                onClick={generateCard}
                className="w-full py-5 bg-amber-400 text-black font-black text-xl rounded-2xl hover:bg-amber-300 transition-all hover:scale-[1.02] hover:shadow-[0_0_40px_rgba(251,191,36,0.4)]"
              >
                🏆 Generate Victory Card
              </button>
            </motion.div>
          ) : (
            <motion.div
              key="card"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="space-y-4"
            >
              {/* Canvas preview */}
              <div className="rounded-2xl overflow-hidden border border-amber-400/20">
                <canvas
                  ref={canvasRef}
                  className="w-full h-auto"
                  style={{ display: "block" }}
                />
              </div>

              <button
                onClick={shareCard}
                className="w-full py-5 bg-amber-400 text-black font-black text-xl rounded-2xl hover:bg-amber-300 transition-all hover:scale-[1.02] hover:shadow-[0_0_40px_rgba(251,191,36,0.4)]"
              >
                📤 Share Your Win
              </button>
              <button
                onClick={downloadCard}
                className="w-full py-4 border border-white/20 text-white/70 font-semibold text-lg rounded-2xl hover:border-amber-400/40 hover:text-amber-300 transition-all"
              >
                ↓ Download Image
              </button>
              <button
                onClick={() => setSubmitted(false)}
                className="w-full py-3 text-white/30 text-sm hover:text-white/50 transition-colors"
              >
                ← Start over
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Hidden canvas for non-submitted state */}
        {!submitted && <canvas ref={canvasRef} className="hidden" />}
      </div>
    </main>
  );
}
