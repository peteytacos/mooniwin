import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import "./globals.css";

export const metadata: Metadata = {
  title: "moon, i win",
  keywords: ["moon", "game", "outdoor game", "moon i win", "daily game", "fun game"],
  authors: [{ name: "moon, i win" }],
  openGraph: {
    title: "moon, i win",
    url: "https://mooniwin.com",
    siteName: "moon, i win",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "moon, i win",
  },
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "moon, i win",
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
