import type { Metadata } from "next";
import { Geist, Geist_Mono, DM_Sans, DM_Serif_Display } from "next/font/google";
import InlineScript from "@/components/InlineScript";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Landing page only — see the design-language tokens in globals.css.
const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
});

const dmSerifDisplay = DM_Serif_Display({
  variable: "--font-dm-serif",
  subsets: ["latin"],
  weight: "400",
});

export const metadata: Metadata = {
  title: "Humify - AI Text Humanizer",
  description:
    "Make AI-generated text sound naturally human. Choose your writing style and get instant rewrites.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${dmSans.variable} ${dmSerifDisplay.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        {/*
          Runs synchronously during parsing, so the stored theme is on <html> before the first
          paint. ThemeToggle's effect would only run after hydration, which flashes. Same
          precedence as ThemeToggle: stored choice wins, otherwise the OS preference.
        */}
        <InlineScript
          html={`(function(){try{var t=localStorage.getItem("theme");var d=t?t==="dark":window.matchMedia("(prefers-color-scheme: dark)").matches;document.documentElement.classList.toggle("dark",d)}catch(e){}})()`}
        />
      </head>
      <body className="min-h-full font-sans text-zinc-900 dark:text-zinc-50">{children}</body>
    </html>
  );
}
