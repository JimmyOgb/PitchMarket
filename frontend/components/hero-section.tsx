"use client";

import { ArrowRight, BarChart3, CircleDot, Trophy } from "lucide-react";
import { motion } from "framer-motion";

const highlights = [
  { label: "Open markets", value: "24", icon: BarChart3 },
  { label: "Fixtures today", value: "12", icon: Trophy },
];

const players = [
  { className: "left-[17%] top-[28%]", color: "bg-lime" },
  { className: "left-[28%] top-[67%]", color: "bg-lime" },
  { className: "left-[42%] top-[40%]", color: "bg-lime" },
  { className: "right-[23%] top-[30%]", color: "bg-sky-300" },
  { className: "right-[34%] top-[69%]", color: "bg-sky-300" },
  { className: "right-[46%] top-[53%]", color: "bg-sky-300" },
];

const probabilityChips = [
  { label: "ARS", value: "54%", className: "-left-3 top-[16%]" },
  { label: "DRAW", value: "22%", className: "-right-3 top-[39%]" },
  { label: "LIV", value: "24%", className: "left-[8%] -bottom-3" },
];

export function HeroSection() {
  return (
    <section
      className="surface-grid relative border-b border-white/10 px-5 pb-20 pt-36 sm:px-8 sm:pb-24 sm:pt-44 lg:px-10"
      id="top"
    >
      <div
        className="absolute -right-32 top-16 size-96 rounded-full bg-lime/10 blur-3xl"
        aria-hidden="true"
      />
      <div className="relative mx-auto grid max-w-7xl items-center gap-16 lg:grid-cols-[1.1fr_0.9fr]">
        <div>
          <div className="mb-4 flex flex-col items-start gap-2">
            <span className="inline-flex items-center gap-2 rounded-full border border-lime/25 bg-lime/10 px-3 py-1.5 text-xs font-bold text-lime">
              <span aria-hidden="true">⚡</span>
              Powered by GenLayer
            </span>
            <p className="text-sm font-medium text-white/55 sm:text-base">
              The AI-native football prediction market.
            </p>
          </div>
          <div className="mb-6 inline-flex items-center gap-2 rounded-md border border-lime/20 bg-lime/10 px-3 py-1.5 text-xs font-bold uppercase text-lime">
            <motion.span
              animate={{ opacity: [1, 0.35, 1] }}
              className="size-1.5 rounded-full bg-lime"
              transition={{ duration: 1.8, repeat: Infinity }}
            />
            Matchday markets are open
          </div>
          <h1 className="max-w-4xl text-balance text-5xl font-black leading-[0.98] tracking-[-0.045em] sm:text-6xl lg:text-7xl">
            Football moves fast. <span className="text-lime">Stay ahead.</span>
          </h1>
          <p className="mt-6 max-w-xl text-base leading-7 text-white/55 sm:text-lg">
            Today’s football, priced by the crowd. Follow every fixture and see
            where the market stands.
          </p>
          <div className="mt-9 flex flex-col gap-3 sm:flex-row">
            <a
              className="flex items-center justify-center gap-2 rounded-md bg-lime px-5 py-3.5 text-sm font-bold text-ink transition hover:bg-white"
              href="#matches"
            >
              View today’s matches
              <ArrowRight className="size-4" />
            </a>
            <a
              className="flex items-center justify-center rounded-md border border-white/15 bg-white/5 px-5 py-3.5 text-sm font-bold transition hover:border-white/30 hover:bg-white/10"
              href="#markets"
            >
              Browse open markets
            </a>
          </div>
          <div className="mt-12 flex flex-wrap gap-8">
            {highlights.map(({ label, value, icon: Icon }) => (
              <div className="flex items-center gap-3" key={label}>
                <span className="flex size-10 items-center justify-center rounded-md border border-white/10 bg-white/5 text-lime">
                  <Icon className="size-4" />
                </span>
                <div>
                  <p className="text-lg font-black">{value}</p>
                  <p className="text-xs text-white/40">{label}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="relative mx-auto w-full max-w-lg lg:ml-auto">
          <div
            className="absolute -inset-6 border border-lime/10"
            aria-hidden="true"
          />
          {probabilityChips.map((chip, index) => (
            <motion.div
              animate={{ y: [0, index % 2 ? -7 : 7, 0] }}
              className={`absolute z-20 rounded-md border border-lime/25 bg-ink/90 px-2.5 py-1.5 shadow-glow backdrop-blur ${chip.className}`}
              key={chip.label}
              transition={{ duration: 3 + index, repeat: Infinity, ease: "easeInOut" }}
            >
              <span className="text-[9px] font-bold text-white/40">{chip.label}</span>
              <span className="ml-2 text-xs font-black text-lime">{chip.value}</span>
            </motion.div>
          ))}
          <div className="relative aspect-[4/3] overflow-hidden rounded-md border border-white/15 bg-[#10291b] p-5 shadow-glow sm:p-7">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(193,255,0,0.08),transparent_48%)]" />
            <div className="relative flex h-full items-center justify-center border-2 border-white/25">
              <div className="absolute inset-x-0 top-1/2 border-t-2 border-white/25" />
              <motion.div
                animate={{ scale: [1, 1.08, 1], opacity: [0.65, 1, 0.65] }}
                className="absolute left-1/2 top-1/2 size-24 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-lime/60 shadow-[0_0_28px_rgba(193,255,0,0.22)] sm:size-32"
                transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
              />
              <div className="absolute left-1/2 top-1/2 size-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-lime" />
              <div className="absolute inset-x-[30%] top-0 h-[18%] border-x-2 border-b-2 border-white/25" />
              <div className="absolute inset-x-[30%] bottom-0 h-[18%] border-x-2 border-t-2 border-white/25" />
              {players.map((player, index) => (
                <motion.span
                  animate={{ y: [0, index % 2 ? -5 : 5, 0], scale: [1, 1.12, 1] }}
                  className={`absolute z-10 size-2.5 rounded-full ${player.color} shadow-[0_0_12px_currentColor]` + ` ${player.className}`}
                  key={`${player.className}-${player.color}`}
                  transition={{ duration: 2.2 + index * 0.15, repeat: Infinity, ease: "easeInOut" }}
                />
              ))}
              <motion.span
                animate={{ left: ["10%", "82%", "10%"], rotate: [0, 720] }}
                className="absolute z-20 size-3 rounded-full bg-white shadow-[0_0_14px_rgba(255,255,255,0.85)]"
                style={{ top: "48%" }}
                transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
              />
              <CircleDot
                className="relative z-10 size-20 text-lime/25 sm:size-28"
                strokeWidth={1.2}
              />
            </div>
            <motion.div
              animate={{ opacity: [0.8, 1, 0.8] }}
              className="absolute left-8 top-8 rounded-md border border-white/15 bg-ink/90 px-3 py-2 backdrop-blur sm:left-11 sm:top-11"
              transition={{ duration: 2, repeat: Infinity }}
            >
              <p className="text-[10px] font-bold uppercase text-white/40">Live now</p>
              <p className="mt-1 text-sm font-black">ARS 2 — 1 LIV</p>
              <p className="mt-1 flex items-center gap-1 text-[10px] font-bold text-lime">
                <span className="size-1 rounded-full bg-lime" />
                <motion.span
                  animate={{ opacity: [1, 0.45, 1] }}
                  transition={{ duration: 1.4, repeat: Infinity }}
                >
                  <span>67:24</span>
                </motion.span>
              </p>
            </motion.div>
            <div className="absolute bottom-8 right-8 w-32 rounded-md border border-white/15 bg-ink/90 px-3 py-2 backdrop-blur sm:bottom-11 sm:right-11">
              <div className="flex items-center justify-between text-[10px] font-bold uppercase text-white/40">
                <span>Possession</span>
                <span className="text-lime">54%</span>
              </div>
              <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/10">
                <motion.div
                  animate={{ width: ["54%", "61%", "54%"] }}
                  className="h-full rounded-full bg-lime shadow-[0_0_10px_rgba(193,255,0,0.8)]"
                  transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                />
              </div>
              <div className="mt-1 flex justify-between text-[9px] text-white/35">
                <span>ARS</span>
                <span>LIV 46%</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
