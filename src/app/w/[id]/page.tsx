import { list } from "@vercel/blob";
import { Metadata } from "next";
import { redirect } from "next/navigation";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  if (!/^[a-zA-Z0-9]+$/.test(id)) return { title: "Moon, I win!" };
  const { blobs } = await list({ prefix: `wins/${id}`, limit: 1 });
  const imageUrl = blobs[0]?.url;

  if (!imageUrl) return { title: "Moon, I win!" };

  return {
    title: "Moon, I win!",
    description: "Better luck tomorrow!",
    openGraph: {
      title: "Moon, I win!",
      description: "Better luck tomorrow!",
      url: `https://mooniwin.com/w/${id}`,
      siteName: "moon, i win!",
      images: [{ url: imageUrl, width: 1080, height: 1350 }],
    },
    twitter: {
      card: "summary_large_image",
      title: "Moon, I win!",
      description: "Better luck tomorrow!",
      images: [imageUrl],
    },
  };
}

export default async function WinPage({ params }: Props) {
  const { id } = await params;
  if (!/^[a-zA-Z0-9]+$/.test(id)) redirect("/");
  const { blobs } = await list({ prefix: `wins/${id}`, limit: 1 });

  if (!blobs[0]) redirect("/");

  return (
    <div className="min-h-dvh bg-black flex flex-col items-center justify-center p-4 cursor-none">
      <img
        src={blobs[0].url}
        alt="Moon, I win!"
        className="max-w-sm w-full rounded-xl"
      />
      <a
        href="/"
        className="mt-8 text-white/30 hover:text-white/70 text-sm font-medium transition-colors"
      >
        play moon, i win!
      </a>
    </div>
  );
}
