import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import "./globals.css";

export const metadata: Metadata = {
  title: "moon, i win!",
  description: "i challenge you to play moon, i win!",
  keywords: ["moon", "game", "outdoor game", "moon i win", "daily game", "fun game"],
  authors: [{ name: "moon, i win!" }],
  openGraph: {
    title: "i challenge you to play moon, i win!",
    description: "i challenge you to play moon, i win!",
    url: "https://mooniwin.com",
    siteName: "moon, i win!",
    type: "website",
    images: [{ url: "/og-image.png", width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "i challenge you to play moon, i win!",
    description: "i challenge you to play moon, i win!",
    images: ["/og-image.png"],
  },
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "moon, i win!",
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
