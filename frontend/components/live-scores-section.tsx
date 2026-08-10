/* eslint-disable @next/next/no-img-element */

import { ChevronDown, Radio } from "lucide-react";
import { useEffect, useState } from "react";

import { MatchCard } from "@/components/match-card";
import type { Match } from "@/types/home";

type LiveScoresSectionProps = {
  matches: Match[];
};

const LEAGUE_ORDER = [
  "UEFA Champions League",
  "Premier League",
  "La Liga",
  "Bundesliga",
  "Serie A",
  "Ligue 1",
];

function sortMatches(matches: Match[]): Match[] {
  return [...matches].sort((a, b) => {
    if (a.status === "Live" && b.status === "Live") {
      return (
        (b.minute ?? -1) - (a.minute ?? -1) ||
        (a.kickoffTimestamp ?? Number.MAX_SAFE_INTEGER) -
          (b.kickoffTimestamp ?? Number.MAX_SAFE_INTEGER)
      );
    }
    return (
      (a.kickoffTimestamp ?? Number.MAX_SAFE_INTEGER) -
      (b.kickoffTimestamp ?? Number.MAX_SAFE_INTEGER)
    );
  });
}

function LeagueHeading({ match, count }: { match: Match; count: number }) {
  return (
    <div className="flex items-center gap-3">
      {match.competitionLogo ? (
        <img
          alt=""
          className="size-7 object-contain"
          src={match.competitionLogo}
        />
      ) : (
        <span className="flex size-7 items-center justify-center rounded-full bg-white/10 text-[10px] font-black text-lime">
          {match.competition.slice(0, 2).toUpperCase()}
        </span>
      )}
      <div>
        <h3 className="text-lg font-bold">{match.competition}</h3>
        <p className="text-xs text-white/40">
          {match.competitionCountry ?? "International"} · {count} fixture
          {count === 1 ? "" : "s"}
        </p>
      </div>
    </div>
  );
}

export function LiveScoresSection({ matches }: LiveScoresSectionProps) {
  const liveMatches = sortMatches(
    matches.filter((match) => match.status === "Live"),
  );
  const scheduledMatches = matches.filter((match) => match.status !== "Live");
  const grouped = new Map<string, Match[]>();

  for (const match of sortMatches(scheduledMatches)) {
    const current = grouped.get(match.competition) ?? [];
    current.push(match);
    grouped.set(match.competition, current);
  }

  const orderedLeagues = [
    ...LEAGUE_ORDER.filter((league) => grouped.has(league)),
    ...Array.from(grouped.keys())
      .filter((league) => !LEAGUE_ORDER.includes(league))
      .sort(),
  ];
  const primaryLeagues = orderedLeagues.filter((league) =>
    LEAGUE_ORDER.includes(league),
  );
  const otherLeagues = orderedLeagues.filter(
    (league) => !LEAGUE_ORDER.includes(league),
  );

  useEffect(() => {
    if (process.env.NODE_ENV !== "development") return;

    console.info("[homepage] live scores rendered", {
      received: matches.length,
      live: liveMatches.length,
      upcoming: scheduledMatches.length,
      leagueGroups: orderedLeagues.length,
    });
  }, [matches, liveMatches.length, scheduledMatches.length, orderedLeagues.length]);

  const [expandedLeagues, setExpandedLeagues] = useState<Set<string>>(
    () => new Set(LEAGUE_ORDER),
  );

  function toggleLeague(league: string) {
    setExpandedLeagues((current) => {
      const next = new Set(current);
      if (next.has(league)) next.delete(league);
      else next.add(league);
      return next;
    });
  }

  function renderLeague(league: string) {
    const leagueMatches = grouped.get(league) ?? [];
    const expanded = expandedLeagues.has(league);
    return (
      <section
        className="rounded-md border border-white/10 bg-panel/40"
        key={league}
      >
        <button
          aria-expanded={expanded}
          className="flex w-full items-center justify-between gap-4 p-4 text-left transition hover:bg-white/5 sm:p-5"
          onClick={() => toggleLeague(league)}
          type="button"
        >
          <LeagueHeading
            match={leagueMatches[0]}
            count={leagueMatches.length}
          />
          <ChevronDown
            className={`size-5 shrink-0 text-white/45 transition-transform duration-300 ${expanded ? "rotate-180" : ""}`}
          />
        </button>
        <div
          className={`grid overflow-hidden px-4 transition-[max-height,opacity,padding] duration-300 sm:px-5 ${expanded ? "max-h-[2400px] gap-4 pb-5 opacity-100" : "max-h-0 gap-0 pb-0 opacity-0"}`}
        >
          {leagueMatches.map((match) => (
            <MatchCard key={match.id} match={match} />
          ))}
        </div>
      </section>
    );
  }

  return (
    <section
      className="border-b border-white/10 px-5 py-16 sm:px-8 sm:py-20 lg:px-10"
      id="matches"
    >
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 flex items-center gap-3 sm:mb-10">
          <span className="flex size-8 items-center justify-center rounded-full bg-red-500/15 text-red-400">
            <Radio className="size-4" />
          </span>
          <div>
            <p className="text-xs font-bold uppercase text-red-400">LIVE NOW</p>
            <h2 className="mt-1 text-2xl font-bold sm:text-3xl">
              Live Matches
            </h2>
            <p className="mt-1 text-xs text-white/40">
              {liveMatches.length} fixture{liveMatches.length === 1 ? "" : "s"}
            </p>
          </div>
        </div>

        {liveMatches.length > 0 ? (
          <div className="mb-12 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {liveMatches.map((match) => (
              <MatchCard key={match.id} match={match} />
            ))}
          </div>
        ) : (
          <p className="mb-12 rounded-md border border-dashed border-white/10 px-5 py-6 text-sm text-white/35">
            No matches are live right now.
          </p>
        )}

        <div className="space-y-10">
          {primaryLeagues.map(renderLeague)}
          {otherLeagues.length > 0 ? (
            <section>
              <h3 className="mb-5 text-xl font-bold">Other Competitions</h3>
              <div className="space-y-10">{otherLeagues.map(renderLeague)}</div>
            </section>
          ) : null}
        </div>
      </div>
    </section>
  );
}
