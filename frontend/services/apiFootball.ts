import type { Match } from "@/types/home";

type FixturesResponse = {
  matches?: Match[];
  error?: string;
  resultCount?: number;
};

export async function fetchTodaysFixtures(
  signal?: AbortSignal,
): Promise<Match[]> {
  return fetchFixtures(signal);
}

export async function fetchUpcomingFixtures(
  signal?: AbortSignal,
): Promise<Match[]> {
  return fetchFixtures(signal, true);
}

async function fetchFixtures(
  signal?: AbortSignal,
  upcoming = false,
): Promise<Match[]> {
  const timezone = "Africa/Lagos";
  const url = new URL("/api/fixtures", window.location.origin);
  url.searchParams.set("timezone", timezone);
  if (upcoming) url.searchParams.set("upcoming", "true");

  try {
    const response = await fetch(url, { cache: "no-store", signal });
    const payload = (await response.json()) as FixturesResponse;

    if (!response.ok || !Array.isArray(payload.matches)) {
      throw new Error(
        payload.error ??
          `The fixture service returned HTTP ${response.status}.`,
      );
    }

    return payload.matches;
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw error;
    }

    if (
      error instanceof Error &&
      (error.message.startsWith("The fixture") ||
        error.message.startsWith("API-Football") ||
        error.message.startsWith("Could not reach"))
    ) {
      throw error;
    }

    throw new Error(
      `We couldn’t load ${upcoming ? "upcoming" : "today’s"} fixtures. Please try again shortly.`,
    );
  }
}
