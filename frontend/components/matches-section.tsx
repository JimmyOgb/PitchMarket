"use client";

import { useState } from "react";

import { MatchCard } from "@/components/match-card";
import { SectionHeader } from "@/components/section-header";
import type { Match } from "@/types/home";

/* API-Football supplies the remote logo URLs at runtime. */
/* eslint-disable @next/next/no-img-element */

const LEAGUE_PRIORITY = [
  ["Premier League"],
  ["LaLiga", "La Liga"],
  ["Bundesliga"],
  ["Serie A"],
  ["Ligue 1"],
  ["UEFA Champions League"],
  ["UEFA Europa League"],
  ["UEFA Conference League"],
] as const;

type LeagueGroup = {
  key: string;
  matches: Match[];
};

function normalizeLeagueName(name: string): string {
  return name.toLocaleLowerCase().replace(/[\s-]+/g, "");
}

function getLeaguePriority(name: string): number {
  const normalizedName = normalizeLeagueName(name);
  const priority = LEAGUE_PRIORITY.findIndex((aliases) =>
    aliases.some((alias) => normalizeLeagueName(alias) === normalizedName),
  );

  return priority === -1 ? LEAGUE_PRIORITY.length : priority;
}

function getLeagueKey(match: Match): string {
  if (match.competitionId !== undefined) {
    return `league-${match.competitionId}`;
  }

  return `league-${normalizeLeagueName(match.competition)}-${normalizeLeagueName(match.competitionCountry ?? "international")}`;
}

function groupUpcomingMatches(matches: Match[]): LeagueGroup[] {
  const grouped = new Map<string, Match[]>();

  for (const match of matches) {
    const current = grouped.get(getLeagueKey(match)) ?? [];
    current.push(match);
    grouped.set(getLeagueKey(match), current);
  }

  return [...grouped.entries()]
    .map(([key, leagueMatches]) => ({
      key,
      matches: [...leagueMatches].sort(
        (a, b) =>
          (a.kickoffTimestamp ?? Number.MAX_SAFE_INTEGER) -
            (b.kickoffTimestamp ?? Number.MAX_SAFE_INTEGER) ||
          a.id.localeCompare(b.id),
      ),
    }))
    .sort((a, b) => {
      const aPriority = getLeaguePriority(a.matches[0].competition);
      const bPriority = getLeaguePriority(b.matches[0].competition);

      return (
        aPriority - bPriority ||
        a.matches[0].competition.localeCompare(b.matches[0].competition) ||
        a.key.localeCompare(b.key)
      );
    });
}

type MatchesSectionProps = {
  eyebrow: string;
  title: string;
  description: string;
  matches: Match[];
  id?: string;
  variant?: "default" | "compact";
};

export function MatchesSection({
  eyebrow,
  title,
  description,
  matches,
  id,
  variant = "default",
}: MatchesSectionProps) {
  const leagueGroups = groupUpcomingMatches(matches);

  return (
    <section className="px-5 py-16 sm:px-8 sm:py-20 lg:px-10" id={id}>
      <div className="mx-auto max-w-7xl">
        <SectionHeader
          eyebrow={eyebrow}
          title={title}
          description={description}
          actionLabel={variant === "default" ? "View all fixtures" : undefined}
        />
        {variant === "compact" ? (
          <div className="space-y-3">
            {leagueGroups.map((group, index) => (
              <LeagueAccordion
                group={group}
                initiallyExpanded={index === 0}
                key={group.key}
              />
            ))}
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {matches.map((match) => (
              <MatchCard key={match.id} match={match} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function LeagueAccordion({
  group,
  initiallyExpanded,
}: {
  group: LeagueGroup;
  initiallyExpanded: boolean;
}) {
  const [expanded, setExpanded] = useState(initiallyExpanded);
  const headingId = `${group.key}-heading`;
  const panelId = `${group.key}-matches`;
  const firstMatch = group.matches[0];

  return (
    <section className="overflow-hidden rounded-md border border-white/10 bg-panel/60">
      <h3 id={headingId}>
        <button
          aria-controls={panelId}
          aria-expanded={expanded}
          className="flex min-h-20 w-full items-center justify-between gap-4 px-5 py-4 text-left transition hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-lime sm:px-6"
          onClick={() => setExpanded((current) => !current)}
          type="button"
        >
          <span className="flex min-w-0 items-center gap-3">
            {firstMatch.competitionLogo ? (
              <img
                alt=""
                className="size-8 shrink-0 object-contain"
                src={firstMatch.competitionLogo}
              />
            ) : (
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-white/10 text-[10px] font-black text-lime">
                {firstMatch.competition.slice(0, 2).toUpperCase()}
              </span>
            )}
            <span className="min-w-0">
              <span className="block truncate font-bold">
                {firstMatch.competition}
              </span>
              <span className="block truncate text-xs text-white/45">
                {firstMatch.competitionCountry ?? "International"} · {group.matches.length} match
                {group.matches.length === 1 ? "" : "es"}
              </span>
            </span>
          </span>
          <span
            aria-hidden="true"
            className="shrink-0 text-xl leading-none text-white/45"
          >
            {expanded ? "⌄" : "›"}
          </span>
        </button>
      </h3>
      <div
        aria-labelledby={headingId}
        className={`grid transition-[grid-template-rows,opacity] duration-200 ease-out ${expanded ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}
        id={panelId}
        role="region"
      >
        <div className="min-h-0 overflow-hidden px-5 sm:px-6">
          <div className="border-t border-white/10">
            {group.matches.map((match) => (
              <MatchCard key={match.id} match={match} variant="compact" />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
