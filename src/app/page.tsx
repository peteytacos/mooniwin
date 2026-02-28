"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { motion } from "framer-motion";
import Nav from "@/components/Nav";

const MoonScene = dynamic(() => import("@/components/MoonScene"), { ssr: false });

export default function Home() {
  return (
    <main className="relative bg-[#030712] overflow-hidden">
      {/* 3D Scene — full viewport hero */}
      <div className="relative min-h-screen">
        <div className="absolute inset-0">
          <MoonScene />
        </div>

        <Nav />

        {/* Hero content */}
        <div className="relative z-10 flex flex-col items-center justify-center min-h-screen px-6 text-center">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1.2, ease: "easeOut" }}
            className="max-w-3xl"
          >
            <motion.p
              initial={{ opacity: 0, letterSpacing: "0.5em" }}
              animate={{ opacity: 0.6, letterSpacing: "0.3em" }}
              transition={{ duration: 1.5, delay: 0.2 }}
              className="text-xs font-mono uppercase text-amber-300/60 mb-6 tracking-[0.3em]"
            >
              The World&apos;s Oldest Daily Game
            </motion.p>

            <motion.h1
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 1, delay: 0.4 }}
              className="text-7xl sm:text-9xl font-black tracking-tight text-glow text-amber-100 leading-none mb-6"
            >
              Moon<br />
              <span className="text-amber-400">I Win.</span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 1, delay: 0.8 }}
              className="text-lg sm:text-xl text-white/60 max-w-xl mx-auto leading-relaxed mb-10"
            >
              Every day. Everywhere on Earth. First one to spot the moon and
              shout it wins. Simple. Timeless. Glorious.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 1, delay: 1.1 }}
              className="flex flex-col sm:flex-row items-center gap-4 justify-center"
            >
              <Link
                href="/rules"
                className="group px-8 py-4 bg-amber-400 text-black font-bold text-lg rounded-full hover:bg-amber-300 transition-all duration-300 hover:scale-105 hover:shadow-[0_0_40px_rgba(251,191,36,0.4)]"
              >
                Learn the Rules
                <span className="inline-block ml-2 group-hover:translate-x-1 transition-transform">→</span>
              </Link>
              <Link
                href="/challenge"
                className="px-8 py-4 border border-white/20 text-white/80 font-semibold text-lg rounded-full hover:border-amber-400/50 hover:text-amber-300 hover:bg-amber-400/5 transition-all duration-300"
              >
                Challenge Someone
              </Link>
            </motion.div>
          </motion.div>

          {/* Scroll indicator */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.4 }}
            transition={{ delay: 2, duration: 1 }}
            className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2"
          >
            <span className="text-xs text-white/40 tracking-widest uppercase font-mono">Scroll</span>
            <motion.div
              animate={{ y: [0, 8, 0] }}
              transition={{ repeat: Infinity, duration: 1.5 }}
              className="w-px h-8 bg-gradient-to-b from-white/30 to-transparent"
            />
          </motion.div>
        </div>
      </div>

      {/* Feature strip */}
      <div className="relative z-10 border-t border-white/5 px-6 py-16">
        <div className="max-w-4xl mx-auto grid grid-cols-1 sm:grid-cols-3 gap-8 text-center">
          {[
            { icon: "🌍", title: "Played Everywhere", desc: "From backyards to rooftops, in every country on Earth." },
            { icon: "⚡", title: "Zero Equipment", desc: "Just you, your crew, and the night sky. No app required." },
            { icon: "🏆", title: "Daily Victory", desc: "A new winner every single day. Bragging rights until sunrise." },
          ].map(({ icon, title, desc }) => (
            <motion.div
              key={title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.7 }}
              className="flex flex-col items-center gap-3"
            >
              <span className="text-4xl">{icon}</span>
              <h3 className="text-lg font-bold text-amber-200">{title}</h3>
              <p className="text-sm text-white/50 leading-relaxed">{desc}</p>
            </motion.div>
          ))}
        </div>
      </div>

      {/* CTA Banner */}
      <div className="relative z-10 border-t border-white/5 px-6 py-20 text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          <h2 className="text-4xl sm:text-5xl font-black text-amber-100 mb-4">
            Ready to play?
          </h2>
          <p className="text-white/50 mb-8 text-lg">Get someone outside. Look up. Win.</p>
          <Link
            href="/challenge"
            className="inline-block px-10 py-5 bg-amber-400 text-black font-black text-xl rounded-full hover:bg-amber-300 transition-all duration-300 hover:scale-105 hover:shadow-[0_0_60px_rgba(251,191,36,0.5)]"
          >
            Send a Challenge →
          </Link>
        </motion.div>
      </div>
    </main>
  );
}
