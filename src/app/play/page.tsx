"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import Nav from "@/components/Nav";
import { getMoonInfo, formatTime, formatCountdown, type MoonInfo } from "@/lib/moon";

function MoonDial({ phase }: { phase: number }) {
  // Draw a simple crescent/full moon SVG based on phase
  const angle = phase * Math.PI * 2;
  const isWaxing = phase < 0.5;
  const normalizedPhase = isWaxing ? phase * 2 : (phase - 0.5) * 2;

  return (
    <div className="relative w-40 h-40 mx-auto">
      <svg viewBox="0 0 100 100" className="w-full h-full">
        <defs>
          <radialGradient id="moonGrad" cx="40%" cy="35%" r="55%">
            <stop offset="0%" stopColor="#fef3c7" />
            <stop offset="60%" stopColor="#fde68a" />
            <stop offset="100%" stopColor="#d97706" />
          </radialGradient>
        </defs>
        {/* Moon glow */}
        <circle cx="50" cy="50" r="36" fill="rgba(253,230,138,0.08)" />
        <circle cx="50" cy="50" r="32" fill="rgba(253,230,138,0.05)" />
        {/* Moon body */}
        <circle cx="50" cy="50" r="28" fill="url(#moonGrad)" opacity="0.95" />
        {/* Shadow overlay for phase */}
        {phase > 0.05 && phase < 0.95 && (
          <ellipse
            cx={isWaxing ? 50 + normalizedPhase * 28 : 50 - (1 - normalizedPhase) * 28}
            cy="50"
            rx={28 * Math.abs(Math.cos(angle))}
            ry="28"
            fill="#030712"
            opacity="0.85"
          />
        )}
        {phase < 0.05 && (
          <circle cx="50" cy="50" r="28" fill="#030712" opacity="0.9" />
        )}
      </svg>
      {/* Glow ring */}
      <div className="absolute inset-0 rounded-full moon-glow pointer-events-none" />
    </div>
  );
}

export default function PlayPage() {
  const [moonInfo, setMoonInfo] = useState<MoonInfo | null>(null);
  const [countdown, setCountdown] = useState("");
  const [locationStatus, setLocationStatus] = useState<"idle" | "loading" | "ok" | "denied">("idle");
  const [manualLat, setManualLat] = useState("");
  const [manualLon, setManualLon] = useState("");
  const [showManual, setShowManual] = useState(false);

  const loadMoon = useCallback((lat: number, lon: number) => {
    const info = getMoonInfo(lat, lon);
    setMoonInfo(info);
  }, []);

  useEffect(() => {
    setLocationStatus("loading");
    navigator.geolocation?.getCurrentPosition(
      (pos) => {
        setLocationStatus("ok");
        loadMoon(pos.coords.latitude, pos.coords.longitude);
      },
      () => {
        setLocationStatus("denied");
        setShowManual(true);
      }
    );
  }, [loadMoon]);

  // Countdown ticker
  useEffect(() => {
    if (!moonInfo) return;
    const target = moonInfo.isUpNow ? moonInfo.set : moonInfo.nextRise;
    if (!target) return;
    const tick = () => setCountdown(formatCountdown(target));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [moonInfo]);

  const handleManual = () => {
    const lat = parseFloat(manualLat);
    const lon = parseFloat(manualLon);
    if (!isNaN(lat) && !isNaN(lon)) {
      loadMoon(lat, lon);
      setLocationStatus("ok");
      setShowManual(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#030712]">
      <Nav />

      {/* Stars */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        {Array.from({ length: 100 }).map((_, i) => (
          <div
            key={i}
            className="absolute rounded-full bg-white"
            style={{
              width: Math.random() * 2 + 1 + "px",
              height: Math.random() * 2 + 1 + "px",
              top: Math.random() * 100 + "%",
              left: Math.random() * 100 + "%",
              opacity: Math.random() * 0.7 + 0.1,
            }}
          />
        ))}
      </div>

      <div className="relative z-10 max-w-xl mx-auto px-6 pt-32 pb-24">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12"
        >
          <p className="text-xs font-mono uppercase tracking-[0.3em] text-amber-300/60 mb-4">
            Moon Tracker
          </p>
          <h1 className="text-5xl sm:text-6xl font-black text-amber-100 mb-4">
            Is the Moon Up?
          </h1>
          <p className="text-white/40">Your local moon status, right now.</p>
        </motion.div>

        {/* Location loading */}
        <AnimatePresence>
          {locationStatus === "loading" && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="text-center text-white/40 py-8"
            >
              <div className="w-8 h-8 border-2 border-amber-400/30 border-t-amber-400 rounded-full animate-spin mx-auto mb-4" />
              Finding your location…
            </motion.div>
          )}
        </AnimatePresence>

        {/* Manual input */}
        {showManual && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8 p-6 rounded-2xl border border-white/10 bg-white/[0.02]"
          >
            <p className="text-white/60 text-sm mb-4">
              Location access was denied. Enter coordinates manually:
            </p>
            <div className="flex gap-3 mb-4">
              <input
                type="number"
                placeholder="Latitude"
                value={manualLat}
                onChange={(e) => setManualLat(e.target.value)}
                className="flex-1 px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/30 text-sm focus:outline-none focus:border-amber-400/50"
              />
              <input
                type="number"
                placeholder="Longitude"
                value={manualLon}
                onChange={(e) => setManualLon(e.target.value)}
                className="flex-1 px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/30 text-sm focus:outline-none focus:border-amber-400/50"
              />
            </div>
            <button
              onClick={handleManual}
              className="w-full py-2 bg-amber-400 text-black font-bold rounded-xl hover:bg-amber-300 transition-colors"
            >
              Calculate
            </button>
          </motion.div>
        )}

        {/* Moon status card */}
        {moonInfo && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6 }}
            className="space-y-4"
          >
            {/* Main status */}
            <div className={`p-8 rounded-3xl border text-center ${
              moonInfo.isUpNow
                ? "border-amber-400/30 bg-amber-400/5"
                : "border-white/10 bg-white/[0.02]"
            }`}>
              <MoonDial phase={moonInfo.phase} />
              <div className="mt-6">
                <div className={`text-5xl font-black mb-2 ${
                  moonInfo.isUpNow ? "text-amber-400" : "text-white/40"
                }`}>
                  {moonInfo.isUpNow ? "🌕 Moon is UP!" : "Moon is down"}
                </div>
                {moonInfo.isUpNow ? (
                  <p className="text-amber-200/70 text-lg">
                    Get outside and spot it before anyone else!
                  </p>
                ) : (
                  <p className="text-white/40 text-lg">
                    Rises in <span className="text-amber-300 font-bold">{countdown}</span>
                  </p>
                )}
              </div>
            </div>

            {/* Stats grid */}
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: "Phase", value: `${moonInfo.phaseEmoji} ${moonInfo.phaseName}` },
                { label: "Illumination", value: `${moonInfo.illumination}%` },
                { label: "Moonrise", value: formatTime(moonInfo.rise) },
                { label: "Moonset", value: formatTime(moonInfo.set) },
              ].map(({ label, value }) => (
                <div
                  key={label}
                  className="p-4 rounded-2xl border border-white/5 bg-white/[0.02] text-center"
                >
                  <div className="text-xs text-white/40 uppercase tracking-wider mb-1">{label}</div>
                  <div className="text-lg font-bold text-amber-100">{value}</div>
                </div>
              ))}
            </div>

            {/* Countdown if up */}
            {moonInfo.isUpNow && moonInfo.set && (
              <div className="p-4 rounded-2xl border border-white/5 bg-white/[0.02] text-center">
                <div className="text-xs text-white/40 uppercase tracking-wider mb-1">Sets in</div>
                <div className="text-2xl font-bold text-amber-300">{countdown}</div>
              </div>
            )}

            {/* CTA */}
            {moonInfo.isUpNow && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
              >
                <Link
                  href="/win"
                  className="block w-full py-5 bg-amber-400 text-black font-black text-xl text-center rounded-2xl hover:bg-amber-300 transition-all hover:scale-[1.02] hover:shadow-[0_0_40px_rgba(251,191,36,0.4)]"
                >
                  🏆 Declare Your Win!
                </Link>
              </motion.div>
            )}
          </motion.div>
        )}
      </div>
    </main>
  );
}
