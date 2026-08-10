"use client";

import {
  CalendarDays,
  CheckCircle2,
  CircleAlert,
  LoaderCircle,
  MapPin,
  Radio,
} from "lucide-react";
import { useEffect, useState } from "react";

import { TeamMark } from "@/components/team-mark";
import { createMarket, type MarketOutcome } from "@/services/market";
import type { Match } from "@/types/home";

type MatchCardProps = {
  match: Match;
  variant?: "default" | "compact";
};

type ToastState = {
  message: string;
  type: "success" | "error";
};

export function MatchCard({ match, variant = "default" }: MatchCardProps) {
  const [isCreating, setIsCreating] = useState(false);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [creatorOutcome, setCreatorOutcome] = useState<MarketOutcome>(0);

  useEffect(() => {
    if (!toast) return;

    const timeout = window.setTimeout(() => setToast(null), 5000);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  async function handleCreateMarket() {
    if (!match.fixtureId || !match.kickoffTime) {
      setToast({
        type: "error",
        message: "This fixture is missing contract market data.",
      });
      return;
    }

    setIsCreating(true);
    setToast(null);

    try {
      await createMarket(
        match.homeTeam.name,
        match.awayTeam.name,
        match.kickoffTime,
        match.fixtureId,
        creatorOutcome,
      );
      setToast({
        type: "success",
        message: "Market creation submitted successfully.",
      });
    } catch (error: unknown) {
      setToast({
        type: "error",
        message:
          error instanceof Error
            ? error.message
            : "Market creation could not be submitted.",
      });
    } finally {
      setIsCreating(false);
    }
  }

  if (variant === "compact") {
    return (
      <article className="group flex flex-col gap-5 border-b border-white/10 py-6 first:pt-0 last:border-0 last:pb-0 sm:flex-row sm:items-center">
        <div className="w-36 shrink-0">
          <p className="text-sm font-bold text-white">{match.dateLabel}</p>
          <p className="mt-1 text-sm text-white/45">{match.time}</p>
        </div>
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <TeamMark team={match.homeTeam} size="sm" />
          <span className="truncate font-semibold">{match.homeTeam.name}</span>
          <span className="mx-1 text-xs text-white/35">VS</span>
          <TeamMark team={match.awayTeam} size="sm" />
          <span className="truncate font-semibold">{match.awayTeam.name}</span>
        </div>
        <div className="flex items-center gap-2 text-sm text-white/40 sm:w-48 sm:justify-end">
          <MapPin className="size-4 shrink-0" />
          <span className="truncate">{match.venue}</span>
        </div>
      </article>
    );
  }

  return (
    <article className="group rounded-md border border-white/10 bg-panel p-5 transition duration-300 hover:-translate-y-1 hover:border-lime/35 sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase text-white/40">
            {match.competition}
          </p>
          <p className="mt-1 text-sm text-white/70">{match.time}</p>
        </div>
        <span
          className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-bold ${match.status === "Live" ? "bg-red-500/15 text-red-400" : "bg-white/5 text-white/50"}`}
        >
          {match.status === "Live" ? (
            <Radio className="size-3.5" />
          ) : (
            <CalendarDays className="size-3.5" />
          )}
          {match.status}
        </span>
      </div>

      <div className="my-8 flex items-center justify-between gap-3">
        <div className="flex min-w-0 flex-1 flex-col items-center gap-3 text-center">
          <TeamMark team={match.homeTeam} />
          <p className="truncate text-sm font-bold sm:text-base">
            {match.homeTeam.name}
          </p>
        </div>
        <div className="shrink-0 text-center">
          <p className="text-[10px] font-bold uppercase text-white/30">
            {match.score ? "Score" : "Kick off"}
          </p>
          <p className="mt-1 text-lg font-black text-white">
            {match.score ?? match.time}
          </p>
          {match.status === "Live" ? (
            <p className="mt-1 text-xs font-bold text-red-400">
              {match.minute !== undefined ? `${match.minute}'` : "Live"}
            </p>
          ) : null}
        </div>
        <div className="flex min-w-0 flex-1 flex-col items-center gap-3 text-center">
          <TeamMark team={match.awayTeam} />
          <p className="truncate text-sm font-bold sm:text-base">
            {match.awayTeam.name}
          </p>
        </div>
      </div>

      <div className="flex items-center justify-center gap-2 border-t border-white/10 pt-4 text-xs text-white/40">
        <MapPin className="size-3.5" />
        {match.venue}
      </div>

      <fieldset className="mt-4">
        <legend className="text-xs font-bold uppercase text-white/40">
          Your prediction
        </legend>
        <div className="mt-2 grid grid-cols-3 gap-2">
          {(
            [
              [0, "Home"],
              [1, "Draw"],
              [2, "Away"],
            ] as const
          ).map(([outcome, label]) => (
            <label
              className={`cursor-pointer rounded-md border px-2 py-2 text-center text-xs font-bold transition ${creatorOutcome === outcome ? "border-lime bg-lime/10 text-lime" : "border-white/10 bg-white/5 text-white/55 hover:border-white/25"}`}
              key={label}
            >
              {label}
              <input
                checked={creatorOutcome === outcome}
                className="sr-only"
                name={`creator-outcome-${match.id}`}
                onChange={() => setCreatorOutcome(outcome)}
                type="radio"
              />
            </label>
          ))}
        </div>
      </fieldset>

      <button
        className="mt-4 flex w-full items-center justify-center gap-2 rounded-md bg-lime px-4 py-2.5 text-sm font-bold text-ink transition hover:bg-lime/90 disabled:cursor-not-allowed disabled:opacity-60"
        disabled={isCreating}
        onClick={handleCreateMarket}
        type="button"
      >
        {isCreating && <LoaderCircle className="size-4 animate-spin" />}
        {isCreating ? "Creating market..." : "Create Market"}
      </button>

      {toast && (
        <div
          aria-live="polite"
          className={`fixed right-5 top-5 z-50 flex max-w-sm items-start gap-3 rounded-md border px-4 py-3 text-sm shadow-xl ${
            toast.type === "success"
              ? "border-lime/35 bg-ink text-white"
              : "border-red-400/35 bg-ink text-white"
          }`}
          role={toast.type === "error" ? "alert" : "status"}
        >
          {toast.type === "success" ? (
            <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-lime" />
          ) : (
            <CircleAlert className="mt-0.5 size-4 shrink-0 text-red-400" />
          )}
          <span>{toast.message}</span>
        </div>
      )}
    </article>
  );
}
