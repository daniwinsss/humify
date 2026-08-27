"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { saveDraft } from "@/lib/draft";

/**
 * Landing page — direction 1a ("centered input focus") from the Humify wireframes.
 *
 * This page is the source of the app-wide design language (DM Serif Display / DM Sans, cream +
 * clay + olive); /app and /settings reach the same palette through the ramp overrides in
 * globals.css. It reads the named brand tokens directly rather than through those aliases.
 *
 * Light-only in both app themes — see `.landing` in globals.css. The design doc specifies no
 * dark variant for this page.
 */

const STEPS = [
  { n: 1, title: "Paste text", body: "Drop in your AI-generated content" },
  { n: 2, title: "Analyze", body: "We detect robotic patterns" },
  { n: 3, title: "Rewrite", body: "Natural phrasing replaces stiff text" },
  { n: 4, title: "Copy & use", body: "Your text, now human-sounding" },
];

export default function Landing() {
  const router = useRouter();
  const [text, setText] = useState("");

  function handleHumanize() {
    if (text.trim()) saveDraft(text);
    router.push("/app");
  }

  return (
    <div className="landing min-h-screen bg-white font-dm">
      <header className="flex items-center justify-between border-b border-black/6 px-6 py-4 sm:px-8">
        <span className="font-display text-lg tracking-[-0.02em]">Humify</span>
        <nav className="flex items-center gap-4 text-xs font-medium text-[#8a857c] sm:gap-5">
          <a href="#how-it-works" className="transition-colors hover:text-ink">
            How it works
          </a>
          <Link href="/app" className="hidden transition-colors hover:text-ink sm:inline">
            Documents
          </Link>
          <Link href="/login" className="transition-colors hover:text-ink">
            Log in
          </Link>
          <Link
            href="/register"
            className="rounded-lg bg-ink px-4 py-2 text-[11px] font-semibold text-white transition-opacity hover:opacity-85"
          >
            Get started
          </Link>
        </nav>
      </header>

      <section className="px-6 pb-10 pt-14 text-center sm:px-8 sm:pt-16">
        <span className="inline-block rounded-full bg-clay/8 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-clay">
          AI Text Converter
        </span>
        <h1 className="mx-auto mt-4 max-w-xl font-display text-4xl leading-[1.15] tracking-[-0.02em] sm:text-5xl">
          Make AI text
          <br />
          sound human
        </h1>
        <p className="mx-auto mt-3 max-w-sm text-[13px] leading-relaxed text-[#79746b]">
          Paste your AI-generated text and get natural, human-sounding copy in seconds.
        </p>

        <div className="mx-auto mt-6 max-w-xl text-left">
          <label htmlFor="hero-text" className="sr-only">
            Paste your AI text
          </label>
          <textarea
            id="hero-text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Paste your AI text here..."
            rows={4}
            className="w-full resize-y rounded-[10px] border border-sand-deep bg-parchment p-4 text-[13px] text-ink placeholder-[#a39e95] transition-colors focus:border-clay focus:outline-none focus:ring-2 focus:ring-clay/20"
          />
          <button
            onClick={handleHumanize}
            className="mt-3.5 w-full rounded-lg bg-clay px-6 py-3 text-[13px] font-semibold tracking-[-0.01em] text-white transition-opacity hover:opacity-90"
          >
            Humanize →
          </button>
          <p className="mt-3.5 text-center text-[11px] font-medium text-[#a39e95]">
            Free to use · Sign up in seconds
          </p>
        </div>
      </section>

      <hr className="border-none border-t border-black/6" />

      <section id="how-it-works" className="scroll-mt-8 px-6 py-10 text-center sm:px-8">
        <h2 className="mb-5 font-display text-xl tracking-[-0.01em]">How it works</h2>
        <div className="mx-auto grid max-w-2xl grid-cols-1 gap-4 sm:grid-cols-2">
          {STEPS.map((step) => (
            <div key={step.n} className="rounded-[10px] bg-parchment p-4">
              <div className="mx-auto mb-2.5 flex h-[30px] w-[30px] items-center justify-center rounded-full bg-ink text-[13px] font-semibold text-white">
                {step.n}
              </div>
              <div className="text-[13px] font-semibold">{step.title}</div>
              <div className="mt-1 text-[11px] text-[#8f8a81]">{step.body}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-parchment px-6 py-7 text-center sm:px-8">
        <div className="text-[13px] font-semibold">Ready to humanize?</div>
        <p className="mt-1 text-[11px] text-[#8f8a81]">Scroll up and paste your text ↑</p>
      </section>
    </div>
  );
}
