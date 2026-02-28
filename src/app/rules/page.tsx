"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import Nav from "@/components/Nav";

const rules = [
  {
    number: "01",
    title: "Get Outside",
    body: "You must be physically outside. No exceptions. Standing in a doorway doesn't count.",
    icon: "🚪",
  },
  {
    number: "02",
    title: "Be Within Shouting Distance",
    body: "You and your group must be close enough to hear each other shout. No remote play via earpiece.",
    icon: "📢",
  },
  {
    number: "03",
    title: "Spot the Moon First",
    body: "Scan the sky. The moment you see the moon, point directly at it and shout your declaration.",
    icon: "🌕",
  },
  {
    number: "04",
    title: "Declare Your Victory",
    body: "Point at the moon and shout \"Moon I Win!\" loud enough for your group to hear. Both the point and the declaration are required.",
    icon: "🗣️",
  },
  {
    number: "05",
    title: "No Fake Sightings",
    body: "Pointing at anything other than the actual moon — a light, a reflection, the sun — disqualifies you until tomorrow. Accuracy is honor.",
    icon: "🚫",
  },
  {
    number: "06",
    title: "Tricks Are Encouraged",
    body: "Getting someone to come outside through any means necessary is part of the game. Tell them there's a spider, a shooting star, anything. The trick is the play.",
    icon: "🎭",
  },
  {
    number: "07",
    title: "Remote Play via Photo",
    body: "Can't be together in person? Text a photo of the moon to your group. First to send a verifiable moon photo wins for the day.",
    icon: "📸",
  },
];

export default function RulesPage() {
  return (
    <main className="min-h-screen bg-[#030712]">
      <Nav />

      {/* Starfield background */}
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
              opacity: Math.random() * 0.6 + 0.1,
            }}
          />
        ))}
      </div>

      <div className="relative z-10 max-w-2xl mx-auto px-6 pt-32 pb-24">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="text-center mb-20"
        >
          <p className="text-xs font-mono uppercase tracking-[0.3em] text-amber-300/60 mb-4">
            The Official Rules
          </p>
          <h1 className="text-6xl sm:text-7xl font-black text-amber-100 leading-none mb-6">
            How to Play
          </h1>
          <p className="text-white/50 text-lg leading-relaxed">
            Seven rules. Passed down through the centuries. Memorize them.
          </p>
        </motion.div>

        {/* Rules */}
        <div className="space-y-6">
          {rules.map((rule, i) => (
            <motion.div
              key={rule.number}
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ duration: 0.6, delay: i * 0.05 }}
              className="group relative flex gap-6 p-6 rounded-2xl border border-white/5 bg-white/[0.02] hover:border-amber-400/20 hover:bg-amber-400/[0.03] transition-all duration-300"
            >
              {/* Number */}
              <div className="flex-shrink-0">
                <span className="font-mono text-4xl font-black text-amber-400/20 group-hover:text-amber-400/40 transition-colors leading-none">
                  {rule.number}
                </span>
              </div>
              {/* Content */}
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-2xl">{rule.icon}</span>
                  <h2 className="text-xl font-bold text-amber-100">{rule.title}</h2>
                </div>
                <p className="text-white/55 leading-relaxed">{rule.body}</p>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Summary card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7 }}
          className="mt-16 p-8 rounded-3xl border border-amber-400/20 bg-amber-400/5 text-center"
        >
          <div className="text-5xl mb-4">🌕</div>
          <h2 className="text-2xl font-black text-amber-200 mb-3">
            That&apos;s it. Go win.
          </h2>
          <p className="text-white/50 mb-8">
            The moon rises every day. So does the competition.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/challenge"
              className="px-8 py-4 bg-amber-400 text-black font-bold rounded-full hover:bg-amber-300 transition-all duration-300 hover:scale-105"
            >
              Challenge Someone →
            </Link>
            <Link
              href="/play"
              className="px-8 py-4 border border-white/20 text-white/70 font-semibold rounded-full hover:border-amber-400/40 hover:text-amber-300 transition-all duration-300"
            >
              Check Moon Tracker
            </Link>
          </div>
        </motion.div>
      </div>
    </main>
  );
}
