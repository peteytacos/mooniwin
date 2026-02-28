import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import "./globals.css";

export const metadata: Metadata = {
  title: "Moon I Win — The World's Daily Moon Game",
  description:
    "Be the first in your group to spot the moon and shout 'Moon I Win!' The world's oldest daily competition. Free. Everywhere. For everyone.",
  keywords: ["moon", "game", "outdoor game", "moon i win", "daily game", "fun game"],
  authors: [{ name: "Moon I Win" }],
  openGraph: {
    title: "Moon I Win — The World's Daily Moon Game",
    description:
      "Be the first in your group to spot the moon and shout 'Moon I Win!' The world's oldest daily competition.",
    url: "https://mooniwin.com",
    siteName: "Moon I Win",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Moon I Win — The World's Daily Moon Game",
    description:
      "Be the first in your group to spot the moon and shout 'Moon I Win!' Free. Outside. For everyone.",
  },
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Moon I Win",
  },
};

export const viewport: Viewport = {
  themeColor: "#030712",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${GeistSans.variable} ${GeistMono.variable} antialiased bg-[#030712] text-white`}
      >
        {children}
      </body>
    </html>
  );
}
