import Link from "next/link";
import type { Metadata } from "next";

interface Props {
  params: Promise<{ token: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { token } = await params;
  const challenger = decodeURIComponent(token.split("-").slice(0, -1).join(" ")) || "Someone";
  return {
    title: `${challenger} has challenged you — Moon I Win`,
    description: `${challenger} has sent you a challenge. Click to find out what Moon I Win is and how to play.`,
    openGraph: {
      title: `${challenger} has challenged you to Moon I Win!`,
      description: "Click to find out what it is — and whether you're brave enough to play.",
    },
  };
}

export default async function ChallengeLandingPage({ params }: Props) {
  const { token } = await params;
  const challenger = decodeURIComponent(token.split("-").slice(0, -1).join(" ")) || "Someone";

  return (
    <main className="min-h-screen bg-[#030712] flex flex-col items-center justify-center px-6 text-center">
      {/* Stars background */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        {Array.from({ length: 100 }).map((_, i) => (
          <div
            key={i}
            className="absolute rounded-full bg-white"
            style={{
              width: Math.random() * 2 + 0.5 + "px",
              height: Math.random() * 2 + 0.5 + "px",
              top: Math.random() * 100 + "%",
              left: Math.random() * 100 + "%",
              opacity: Math.random() * 0.6 + 0.1,
            }}
          />
        ))}
      </div>

      <div className="relative z-10 max-w-xl">
        <div className="text-8xl mb-6">🌕</div>

        <p className="text-xs font-mono uppercase tracking-[0.3em] text-amber-300/60 mb-4">
          You&apos;ve been challenged
        </p>

        <h1 className="text-5xl sm:text-6xl font-black text-amber-100 leading-tight mb-6">
          <span className="text-amber-400">{challenger}</span>{" "}
          wants to play Moon I Win with you.
        </h1>

        <p className="text-white/50 text-lg leading-relaxed mb-10">
          Moon I Win is the world&apos;s oldest daily game. The rules are simple.
          The glory is real. You&apos;ve been officially invited to join the game.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            href="/rules"
            className="px-8 py-4 bg-amber-400 text-black font-black text-lg rounded-full hover:bg-amber-300 transition-all hover:scale-105 hover:shadow-[0_0_40px_rgba(251,191,36,0.4)]"
          >
            Learn the Rules →
          </Link>
          <Link
            href="/challenge"
            className="px-8 py-4 border border-white/20 text-white/70 font-semibold text-lg rounded-full hover:border-amber-400/40 hover:text-amber-300 transition-all"
          >
            Challenge Someone Else
          </Link>
        </div>

        <p className="mt-12 text-white/20 text-sm">
          <span className="font-mono">mooniwin.com</span>
        </p>
      </div>
    </main>
  );
}
