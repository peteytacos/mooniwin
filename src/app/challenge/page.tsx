"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Nav from "@/components/Nav";

export default function ChallengePage() {
  const [name, setName] = useState("");
  const [link, setLink] = useState("");
  const [copied, setCopied] = useState(false);

  const generate = () => {
    const slug = encodeURIComponent(name.trim() || "Someone");
    const token = Math.random().toString(36).slice(2, 8);
    const url = `${window.location.origin}/c/${slug}-${token}`;
    setLink(url);
  };

  const copy = async () => {
    await navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const share = async () => {
    if (navigator.share) {
      await navigator.share({
        title: "Moon I Win — You've Been Challenged!",
        text: `${name || "Someone"} has challenged you to Moon I Win! Click to find out what it is:`,
        url: link,
      });
    } else {
      copy();
    }
  };

  return (
    <main className="min-h-screen bg-[#030712]">
      <Nav />

      {/* Stars */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        {Array.from({ length: 90 }).map((_, i) => (
          <div
            key={i}
            className="absolute rounded-full bg-white"
            style={{
              width: Math.random() * 2 + 1 + "px",
              height: Math.random() * 2 + 1 + "px",
              top: Math.random() * 100 + "%",
              left: Math.random() * 100 + "%",
              opacity: Math.random() * 0.6 + 0.1,
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
            Trick &amp; Challenge
          </p>
          <h1 className="text-5xl sm:text-6xl font-black text-amber-100 mb-4">
            Rope Someone In
          </h1>
          <p className="text-white/50 leading-relaxed max-w-sm mx-auto">
            Generate a challenge link. Send it to a friend. They click it,
            learn the rules, and suddenly they&apos;re playing.
          </p>
        </motion.div>

        <AnimatePresence mode="wait">
          {!link ? (
            <motion.div
              key="form"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-4"
            >
              <div className="p-6 rounded-3xl border border-white/5 bg-white/[0.02] text-center">
                <div className="text-5xl mb-3">🎭</div>
                <p className="text-white/50 text-sm leading-relaxed">
                  The beauty of Moon I Win is in the trick. Send this link
                  under any pretense — &quot;check this out&quot;, &quot;look at this funny
                  thing&quot;, anything. They&apos;ll click it and find the rules waiting
                  for them.
                </p>
              </div>

              <input
                type="text"
                placeholder="Your name (so they know who challenged them)"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={40}
                className="w-full px-6 py-4 rounded-2xl bg-white/5 border border-white/10 text-white placeholder-white/30 text-lg focus:outline-none focus:border-amber-400/50 transition-colors"
                onKeyDown={(e) => e.key === "Enter" && generate()}
              />

              <button
                onClick={generate}
                className="w-full py-5 bg-amber-400 text-black font-black text-xl rounded-2xl hover:bg-amber-300 transition-all hover:scale-[1.02] hover:shadow-[0_0_40px_rgba(251,191,36,0.4)]"
              >
                🎯 Generate Challenge Link
              </button>
            </motion.div>
          ) : (
            <motion.div
              key="result"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="space-y-4"
            >
              <div className="p-6 rounded-3xl border border-amber-400/20 bg-amber-400/5 text-center">
                <div className="text-4xl mb-3">🌕</div>
                <p className="text-amber-200 font-bold text-lg mb-1">
                  Challenge link ready!
                </p>
                <p className="text-white/40 text-sm">
                  Send this to your unsuspecting target.
                </p>
              </div>

              {/* Link display */}
              <div className="flex items-center gap-2 p-4 rounded-2xl border border-white/10 bg-white/[0.02]">
                <span className="flex-1 font-mono text-xs text-amber-300/70 truncate">
                  {link}
                </span>
              </div>

              <button
                onClick={share}
                className="w-full py-5 bg-amber-400 text-black font-black text-xl rounded-2xl hover:bg-amber-300 transition-all hover:scale-[1.02] hover:shadow-[0_0_40px_rgba(251,191,36,0.4)]"
              >
                📤 Send the Challenge
              </button>
              <button
                onClick={copy}
                className="w-full py-4 border border-white/20 text-white/70 font-semibold text-lg rounded-2xl hover:border-amber-400/40 hover:text-amber-300 transition-all"
              >
                {copied ? "✓ Copied!" : "📋 Copy Link"}
              </button>
              <button
                onClick={() => setLink("")}
                className="w-full py-3 text-white/30 text-sm hover:text-white/50 transition-colors"
              >
                ← Challenge someone else
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* How it works */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mt-16 space-y-3"
        >
          <p className="text-xs text-white/30 uppercase tracking-widest text-center font-mono mb-6">
            How it works
          </p>
          {[
            { step: "1", text: "You generate a challenge link with your name" },
            { step: "2", text: "You send it to a friend under any pretense" },
            { step: "3", text: "They click it and discover Moon I Win" },
            { step: "4", text: "Now they're in your group. Game on." },
          ].map(({ step, text }) => (
            <div key={step} className="flex items-center gap-4 p-4 rounded-xl border border-white/5">
              <span className="w-8 h-8 rounded-full bg-amber-400/10 text-amber-400 font-bold text-sm flex items-center justify-center flex-shrink-0">
                {step}
              </span>
              <span className="text-white/60 text-sm">{text}</span>
            </div>
          ))}
        </motion.div>
      </div>
    </main>
  );
}
