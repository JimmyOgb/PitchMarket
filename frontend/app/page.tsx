"use client";

import { LoaderCircle, TriangleAlert } from "lucide-react";
import { useEffect, useState } from "react";

import { Footer } from "@/components/footer";
import { HeroSection } from "@/components/hero-section";
import { LiveScoresSection } from "@/components/live-scores-section";
import { MatchesSection } from "@/components/matches-section";
import { MarketsSection } from "@/components/markets-section";
import { SectionHeader } from "@/components/section-header";
import { SiteHeader } from "@/components/site-header";
import {
  fetchTodaysFixtures,
  fetchUpcomingFixtures,
} from "@/services/apiFootball";
import type { Match } from "@/types/home";

type FixturesStatus = "loading" | "success" | "error";

type FixturesFeedbackProps = {
  status: Exclude<FixturesStatus, "success"> | "empty";
  errorMessage: string;
  onRetry: () => void;
};

function FixturesFeedback({
  status,
  errorMessage,
  onRetry,
}: FixturesFeedbackProps) {
  const isLoading = status === "loading";

  return (
    <section
      className="px-5 py-16 sm:px-8 sm:py-20 lg:px-10"
      id="matches"
      aria-live="polite"
    >
      <div className="mx-auto max-w-7xl">
        <SectionHeader
          eyebrow="Match centre"
          title="Today’s matches"
          description="The biggest fixtures on the board today, all in one place."
        />
        <div className="flex min-h-48 items-center justify-center rounded-md border border-white/10 bg-panel px-6 py-12 text-center">
          <div className="max-w-md">
            {isLoading ? (
              <>
                <LoaderCircle className="mx-auto size-7 animate-spin text-lime" />
                <p className="mt-4 font-semibold">Loading today&apos;s fixtures...</p>
                <p className="mt-2 text-sm text-white/45">
                  Checking the latest match schedule.
                </p>
              </>
            ) : status === "empty" ? (
              <>
                <p className="font-semibold">No fixtures available.</p>
              </>
            ) : (
              <>
                <TriangleAlert className="mx-auto size-7 text-amber-400" />
                <p className="mt-4 font-semibold">
                  Fixture service is temporarily unavailable.
                </p>
                <p className="mt-2 text-sm leading-6 text-white/45">
                  {errorMessage}
                </p>
                <button
                  className="mt-5 rounded-md border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold transition hover:border-lime/40 hover:text-lime"
                  onClick={onRetry}
                  type="button"
                >
                  Try again
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

export default function HomePage() {
  const [fixtures, setFixtures] = useState<Match[]>([]);
  const [status, setStatus] = useState<FixturesStatus>("loading");
  const [errorMessage, setErrorMessage] = useState("");
  const [requestVersion, setRequestVersion] = useState(0);
  const [upcomingFixtures, setUpcomingFixtures] = useState<Match[]>([]);
  const [upcomingStatus, setUpcomingStatus] = useState<FixturesStatus>("loading");

  useEffect(() => {
    const controller = new AbortController();

    fetchTodaysFixtures(controller.signal)
      .then((today) => {
        setFixtures(today);
        setStatus("success");
        if (process.env.NODE_ENV === "development") {
          console.info("[homepage] fixtures received", {
            received: today.length,
            live: today.filter((match) => match.status === "Live").length,
            upcoming: today.filter((match) => match.status === "Upcoming").length,
          });
        }
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError")
          return;

        setErrorMessage(
          error instanceof Error ? error.message : "Please try again shortly.",
        );
        setStatus("error");
      });

    fetchUpcomingFixtures(controller.signal)
      .then((upcoming) => {
        setUpcomingFixtures(upcoming);
        setUpcomingStatus("success");
        if (process.env.NODE_ENV === "development") {
          console.info("[homepage] upcoming fixtures received", {
            received: upcoming.length,
            leagueGroups: new Set(
              upcoming.map((match) => match.competition),
            ).size,
          });
        }
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError")
          return;

        setUpcomingStatus("error");
      });

    return () => controller.abort();
  }, [requestVersion]);

  function retryFixtures() {
    setStatus("loading");
    setErrorMessage("");
    setRequestVersion((version) => version + 1);
  }

  return (
    <div className="min-h-screen overflow-hidden bg-ink text-white">
      <SiteHeader />
      <main>
        <HeroSection />
        {status === "success" && fixtures.length > 0 ? (
          <LiveScoresSection matches={fixtures} />
        ) : (
          <FixturesFeedback
            status={status === "success" ? "empty" : status}
            errorMessage={errorMessage}
            onRetry={retryFixtures}
          />
        )}
        <MatchesSection
          eyebrow="On the horizon"
          title="Upcoming matches"
          description="Scout the next round of fixtures before the market opens up."
          matches={upcomingFixtures}
          variant="compact"
        />
        {upcomingStatus === "success" && upcomingFixtures.length === 0 ? (
          <p className="-mt-10 px-5 pb-16 text-center text-white/60 sm:px-8 lg:px-10">
            No upcoming fixtures available.
          </p>
        ) : null}
        <MarketsSection />
      </main>
      <Footer />
    </div>
  );
}
