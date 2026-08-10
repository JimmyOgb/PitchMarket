import { NextRequest, NextResponse } from "next/server";

import type { Match, Team } from "@/types/home";

const API_FOOTBALL_URL = "https://v3.football.api-sports.io/fixtures";
const LIVE_STATUSES = new Set([
  "1H",
  "HT",
  "2H",
  "ET",
  "BT",
  "P",
  "LIVE",
  "INT",
]);
const TEAM_ACCENTS = [
  "#16a34a",
  "#2563eb",
  "#dc2626",
  "#7c3aed",
  "#ea580c",
  "#0891b2",
];

type ApiFootballTeam = {
  id: number;
  name: string;
  code: string | null;
  logo: string | null;
};

type ApiFootballFixture = {
  fixture: {
    id: number;
    date: string;
    status: { short: string; elapsed: number | null };
    venue: { name: string | null; city: string | null } | null;
  };
  league: {
    id: number;
    name: string;
    logo: string | null;
    country: string | null;
  };
  teams: { home: ApiFootballTeam; away: ApiFootballTeam };
  goals: { home: number | null; away: number | null };
};

type ApiFootballResponse = {
  errors?: Record<string, string> | string[];
  results?: number;
  response?: ApiFootballFixture[];
};

function resolveTimezone(value: string | null): string {
  if (!value) return "UTC";

  try {
    new Intl.DateTimeFormat("en", { timeZone: value }).format();
    return value;
  } catch {
    return "UTC";
  }
}

function getDateInTimezone(timezone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts();
  const values = Object.fromEntries(
    parts.map(({ type, value }) => [type, value]),
  );

  return `${values.year}-${values.month}-${values.day}`;
}

function toTeam(team: ApiFootballTeam): Team {
  const name = team.name || "Unknown team";
  const fallbackCode = name
    .replace(/[^a-zA-Z]/g, "")
    .slice(0, 3)
    .toUpperCase();

  return {
    name,
    shortName: team.code?.slice(0, 3).toUpperCase() || fallbackCode || "FC",
    accent: TEAM_ACCENTS[Math.abs(team.id) % TEAM_ACCENTS.length],
    logo: team.logo ?? undefined,
  };
}

function toMatch(
  item: ApiFootballFixture,
  timezone: string,
  upcoming: boolean,
): Match {
  const hasScore =
    item.goals?.home !== null &&
    item.goals?.home !== undefined &&
    item.goals?.away !== null &&
    item.goals?.away !== undefined;
  const status = item.fixture.status?.short ?? "NS";

  return {
    id: String(item.fixture.id),
    fixtureId: String(item.fixture.id),
    kickoffTime: item.fixture.date,
    competition: item.league.name,
    competitionId: item.league.id,
    competitionLogo: item.league.logo ?? undefined,
    competitionCountry: item.league.country ?? undefined,
    dateLabel: upcoming
      ? new Intl.DateTimeFormat(undefined, {
          timeZone: timezone,
          weekday: "short",
          day: "numeric",
          month: "short",
        }).format(new Date(item.fixture.date))
      : "Today",
    time: new Intl.DateTimeFormat(undefined, {
      timeZone: timezone,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(new Date(item.fixture.date)),
    kickoffTimestamp: new Date(item.fixture.date).getTime(),
    minute: LIVE_STATUSES.has(status)
      ? (item.fixture.status?.elapsed ?? undefined)
      : undefined,
    venue:
      item.fixture.venue?.name ?? item.fixture.venue?.city ?? "Venue TBC",
    homeTeam: toTeam(item.teams.home),
    awayTeam: toTeam(item.teams.away),
    status: upcoming
      ? "Upcoming"
      : LIVE_STATUSES.has(status)
        ? "Live"
        : "Today",
    score: hasScore
      ? `${item.goals.home} — ${item.goals.away}`
      : undefined,
  };
}

function hasApiErrors(errors: ApiFootballResponse["errors"]): boolean {
  if (!errors) return false;
  return Array.isArray(errors)
    ? errors.length > 0
    : Object.keys(errors).length > 0;
}

function formatApiErrors(errors: ApiFootballResponse["errors"]): string {
  if (!errors) return "Unknown API-Football error.";
  if (Array.isArray(errors)) return errors.join("; ");
  return Object.entries(errors)
    .map(([field, message]) => `${field}: ${message}`)
    .join("; ");
}

function errorResponse(
  message: string,
  status: number,
  details: Record<string, number | string | null> = {},
) {
  return NextResponse.json(
    { error: message, ...details },
    { status },
  );
}

export async function GET(request: NextRequest) {
  const apiKey = process.env.API_FOOTBALL_KEY;

  if (!apiKey) {
    return errorResponse(
      "API-Football is not configured on the server.",
      503,
    );
  }

  const timezone = resolveTimezone(
    request.nextUrl.searchParams.get("timezone"),
  );
  const upcoming = request.nextUrl.searchParams.get("upcoming") === "true";
  const url = new URL(API_FOOTBALL_URL);
  // API-Football's Free plan supports date queries, while `next` and
  // from/to queries require plan features that are not universally enabled.
  url.searchParams.set("date", getDateInTimezone(timezone));
  url.searchParams.set("timezone", timezone);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);

  try {
    const response = await fetch(url, {
      headers: { "x-apisports-key": apiKey },
      cache: "no-store",
      signal: controller.signal,
    });

    if (!response.ok) {
      const statusMessage =
        response.status === 401 || response.status === 403
          ? "API-Football rejected the server API key."
          : response.status === 429
            ? "API-Football rate limit reached."
            : `API-Football returned HTTP ${response.status}.`;
      return errorResponse(statusMessage, response.status, {
        upstreamStatus: response.status,
      });
    }

    let payload: ApiFootballResponse;
    try {
      payload = (await response.json()) as ApiFootballResponse;
    } catch {
      return errorResponse("API-Football returned malformed JSON.", 502, {
        upstreamStatus: response.status,
      });
    }

    if (hasApiErrors(payload.errors)) {
      return errorResponse(
        `API-Football returned an error: ${formatApiErrors(payload.errors)}`,
        502,
        {
          upstreamStatus: response.status,
          resultCount: payload.results ?? null,
          responseCount: Array.isArray(payload.response)
            ? payload.response.length
            : null,
        },
      );
    }

    if (!Array.isArray(payload.response)) {
      return errorResponse(
        "API-Football returned an invalid fixture response.",
        502,
        { upstreamStatus: response.status, resultCount: payload.results ?? null },
      );
    }

    const now = Date.now();
    const filteredFixtures = payload.response.filter(
      (fixture) => !upcoming || new Date(fixture.fixture.date).getTime() > now,
    );
    const matches: Match[] = [];

    for (const fixture of filteredFixtures) {
      try {
        matches.push(toMatch(fixture, timezone, upcoming));
      } catch (error: unknown) {
        console.error("[fixtures] fixture transformation failed", {
          fixtureId: fixture.fixture?.id ?? null,
          message: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    const liveFixtureCount = matches.filter(
      (match) => match.status === "Live",
    ).length;
    const upcomingFixtureCount = matches.filter(
      (match) => match.status === "Upcoming",
    ).length;
    console.info("[fixtures] API-Football mapping", {
      resultCount: payload.results ?? payload.response.length,
      transformedFixtureCount: matches.length,
      filteredFixtureCount: filteredFixtures.length,
      liveFixtureCount,
      upcomingFixtureCount,
      timezone,
      upcomingRequest: upcoming,
    });

    return NextResponse.json({
      matches,
      resultCount: payload.results ?? payload.response.length,
      transformedFixtureCount: matches.length,
      filteredFixtureCount: filteredFixtures.length,
      liveFixtureCount,
      upcomingFixtureCount,
    });
  } catch (error: unknown) {
    if (error instanceof DOMException && error.name === "AbortError") {
      return errorResponse("API-Football request timed out.", 504);
    }
    return errorResponse(
      error instanceof Error
        ? `Could not reach API-Football: ${error.message}`
        : "Could not reach API-Football.",
      502,
    );
  } finally {
    clearTimeout(timeout);
  }
}
