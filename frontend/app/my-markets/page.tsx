"use client";

import { CheckCircle2, CircleAlert, LoaderCircle } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { formatEther } from "viem";
import { useBalance, useConnection } from "wagmi";
import { studionet } from "genlayer-js/chains";

import { Footer } from "@/components/footer";
import { SectionHeader } from "@/components/section-header";
import { SiteHeader } from "@/components/site-header";
import {
  claimWinnings,
  getMyBet,
  type Bet,
  type Market,
} from "@/services/market";
import { readMarketContract } from "@/services/genlayer";

type MarketWithLeague = Market & { league?: string };
type MyMarket = MarketWithLeague & { bet: Bet | null };
type PageState = "loading" | "success" | "error";
type GroupName = "Waiting" | "Active" | "Resolved" | "Void";

const PAGE_SIZE = BigInt(25);
const EXPLORER_URL =
  studionet.blockExplorers?.default.url ??
  "https://genlayer-explorer.vercel.app";
const GROUPS: GroupName[] = ["Waiting", "Active", "Resolved", "Void"];

function asBigInt(value: number | string): bigint {
  return BigInt(value);
}

function formatPool(value: number | string): string {
  return `${Number(formatEther(asBigInt(value))).toFixed(4)} GEN`;
}

function formatKickoff(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleString(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
      });
}

function groupForMarket(market: Market): GroupName {
  if (market.status === "resolved") return "Resolved";
  if (market.status === "void") return "Void";
  return asBigInt(market.total_staked) > BigInt(0) ? "Active" : "Waiting";
}

function outcomeLabel(outcome: number | string): string {
  return ["Home Win", "Draw", "Away Win"][Number(outcome)] ?? "Unknown";
}

function resultLabel(market: Market, bet: Bet): "Won" | "Lost" | "Draw" {
  if (Number(market.outcome) === 1) return "Draw";
  return Number(market.outcome) === Number(bet.outcome) ? "Won" : "Lost";
}

export default function MyMarketsPage() {
  const connection = useConnection();
  const [markets, setMarkets] = useState<MyMarket[]>([]);
  const [state, setState] = useState<PageState>("loading");
  const [errorMessage, setErrorMessage] = useState("");
  const [claimingId, setClaimingId] = useState<string | null>(null);
  const [claimHashes, setClaimHashes] = useState<Record<string, string>>({});
  const [toast, setToast] = useState<string | null>(null);
  const { refetch: refetchBalance } = useBalance({
    address: connection.address,
    query: { enabled: connection.isConnected },
  });

  const loadMarkets = useCallback(async () => {
    if (!connection.address) {
      setMarkets([]);
      setState("success");
      return;
    }

    setState("loading");
    try {
      const rawCount = await readMarketContract<number | string>(
        "get_market_count",
      );
      const count = asBigInt(rawCount);
      const allMarkets: MarketWithLeague[] = [];

      for (let start = BigInt(0); start < count; start += PAGE_SIZE) {
        const page = await readMarketContract<MarketWithLeague[]>(
          "list_markets",
          [start, PAGE_SIZE],
        );
        allMarkets.push(...page);
        if (page.length === 0) break;
      }

      const participated = await Promise.all(
        allMarkets.map(async (market) => {
          try {
            return { market, bet: await getMyBet(asBigInt(market.market_id)) };
          } catch {
            return market.creator.toLowerCase() ===
              connection.address!.toLowerCase()
              ? { market, bet: null }
              : null;
          }
        }),
      );

      setMarkets(
        participated
          .filter((item) => item !== null)
          .map(({ market, bet }) => ({ ...market, bet })),
      );
      setState("success");
    } catch (error: unknown) {
      setErrorMessage(
        error instanceof Error ? error.message : "Please try again shortly.",
      );
      setState("error");
    }
  }, [connection.address]);

  useEffect(() => {
    void loadMarkets();
  }, [loadMarkets]);

  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(null), 4500);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  async function handleClaim(market: MyMarket) {
    if (!market.bet || claimingId) return;
    setClaimingId(String(market.market_id));
    try {
      const transactionHash = await claimWinnings(asBigInt(market.market_id));
      setClaimHashes((hashes) => ({
        ...hashes,
        [String(market.market_id)]: String(transactionHash),
      }));
      setToast("Winnings claimed successfully.");
      await refetchBalance();
      await loadMarkets();
    } catch (error: unknown) {
      setToast(error instanceof Error ? error.message : "Claim failed.");
    } finally {
      setClaimingId(null);
    }
  }

  const groupedMarkets = useMemo(
    () =>
      GROUPS.reduce<Record<GroupName, MyMarket[]>>(
        (groups, group) => {
          groups[group] = markets.filter(
            (market) => groupForMarket(market) === group,
          );
          return groups;
        },
        { Waiting: [], Active: [], Resolved: [], Void: [] },
      ),
    [markets],
  );

  return (
    <div className="min-h-screen overflow-hidden bg-ink text-white">
      <SiteHeader />
      <main className="surface-grid px-5 pb-20 pt-36 sm:px-8 sm:pt-44 lg:px-10">
        <div className="mx-auto max-w-7xl">
          <SectionHeader
            eyebrow="Your portfolio"
            title="My markets"
            description="Manage every market you created or joined."
          />

          {state === "loading" ? (
            <div className="flex min-h-48 items-center justify-center rounded-md border border-white/10 bg-panel px-6 py-12 text-center">
              <div>
                <LoaderCircle className="mx-auto size-7 animate-spin text-lime" />
                <p className="mt-4 font-semibold">Loading your markets…</p>
              </div>
            </div>
          ) : state === "error" ? (
            <div className="flex min-h-48 items-center justify-center rounded-md border border-white/10 bg-panel px-6 py-12 text-center">
              <div className="max-w-md">
                <CircleAlert className="mx-auto size-7 text-amber-400" />
                <p className="mt-4 font-semibold">
                  Markets are temporarily unavailable
                </p>
                <p className="mt-2 text-sm leading-6 text-white/45">
                  {errorMessage}
                </p>
              </div>
            </div>
          ) : markets.length === 0 ? (
            <div className="flex min-h-48 items-center justify-center rounded-md border border-white/10 bg-panel px-6 py-12 text-center">
              <p className="font-semibold">
                You haven&apos;t participated in any markets yet.
              </p>
            </div>
          ) : (
            <div className="space-y-12">
              {GROUPS.map((group) => (
                <section aria-labelledby={`${group}-markets`} key={group}>
                  <div className="mb-5 flex items-center gap-3">
                    <h2 id={`${group}-markets`} className="text-xl font-bold">
                      {group}
                    </h2>
                    <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs text-white/55">
                      {groupedMarkets[group].length}
                    </span>
                  </div>
                  {groupedMarkets[group].length === 0 ? (
                    <p className="rounded-md border border-dashed border-white/10 px-5 py-6 text-sm text-white/35">
                      No {group.toLowerCase()} markets.
                    </p>
                  ) : (
                    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                      {groupedMarkets[group].map((market) => {
                        const bet = market.bet;
                        const isResolved = group === "Resolved";
                        const canClaim =
                          isResolved &&
                          bet &&
                          Number(market.outcome) === Number(bet.outcome) &&
                          !bet.claimed;

                        return (
                          <article
                            className="flex h-full flex-col rounded-md border border-white/10 bg-ink p-5 transition duration-300 hover:border-lime/35 sm:p-6"
                            key={String(market.market_id)}
                          >
                            <div className="flex items-center justify-between gap-3">
                              <span className="text-xs text-white/35">
                                Market #{String(market.market_id)}
                              </span>
                              <span className="rounded-md bg-lime/10 px-2.5 py-1 text-[10px] font-bold uppercase text-lime">
                                {group}
                              </span>
                            </div>
                            <h3 className="mt-6 text-xl font-bold leading-7">
                              {market.home_team}{" "}
                              <span className="text-white/35">vs</span>{" "}
                              {market.away_team}
                            </h3>
                            <dl className="mt-6 space-y-3 border-t border-white/10 pt-5 text-sm">
                              <div className="flex justify-between gap-4">
                                <dt className="text-white/40">League</dt>
                                <dd className="text-right text-white/75">
                                  {market.league ?? "—"}
                                </dd>
                              </div>
                              <div className="flex justify-between gap-4">
                                <dt className="text-white/40">Kickoff</dt>
                                <dd className="text-right text-white/75">
                                  {formatKickoff(market.kickoff_at)}
                                </dd>
                              </div>
                              <div className="flex justify-between gap-4">
                                <dt className="text-white/40">My prediction</dt>
                                <dd className="text-right text-white/75">
                                  {bet ? outcomeLabel(bet.outcome) : "Creator"}
                                </dd>
                              </div>
                              <div className="flex justify-between gap-4">
                                <dt className="text-white/40">My stake</dt>
                                <dd className="font-semibold text-lime">
                                  {bet ? formatPool(bet.amount) : "—"}
                                </dd>
                              </div>
                              <div className="flex justify-between gap-4">
                                <dt className="text-white/40">Total pool</dt>
                                <dd className="font-semibold text-lime">
                                  {formatPool(market.total_staked)}
                                </dd>
                              </div>
                              {market.final_score ? (
                                <div className="flex justify-between gap-4">
                                  <dt className="text-white/40">Final score</dt>
                                  <dd className="font-semibold text-white/75">
                                    {market.final_score}
                                  </dd>
                                </div>
                              ) : null}
                              {isResolved && bet ? (
                                <div className="flex justify-between gap-4">
                                  <dt className="text-white/40">
                                    Winning Outcome
                                  </dt>
                                  <dd className="text-right text-white/75">
                                    {outcomeLabel(market.outcome)}
                                  </dd>
                                </div>
                              ) : null}
                              {isResolved && bet ? (
                                <div className="flex justify-between gap-4">
                                  <dt className="text-white/40">
                                    Estimated Payout
                                  </dt>
                                  <dd className="font-semibold text-lime">
                                    {Number(market.outcome) ===
                                    Number(bet.outcome)
                                      ? formatPool(market.total_staked)
                                      : "—"}
                                  </dd>
                                </div>
                              ) : null}
                              {claimHashes[String(market.market_id)] ? (
                                <div className="flex justify-between gap-4">
                                  <dt className="text-white/40">Transaction</dt>
                                  <dd className="max-w-[60%] truncate text-right">
                                    <a
                                      className="text-lime underline-offset-2 hover:underline"
                                      href={`${EXPLORER_URL}/tx/${claimHashes[String(market.market_id)]}`}
                                      rel="noreferrer"
                                      target="_blank"
                                    >
                                      {claimHashes[String(market.market_id)]}
                                    </a>
                                  </dd>
                                </div>
                              ) : null}
                            </dl>
                            {isResolved && bet ? (
                              <p
                                className={`mt-5 text-sm font-bold ${resultLabel(market, bet) === "Won" ? "text-lime" : "text-white/65"}`}
                              >
                                {resultLabel(market, bet)}
                              </p>
                            ) : null}
                            {group === "Void" && bet ? (
                              <p className="mt-5 text-sm font-bold text-amber-300">
                                Refund Pending
                              </p>
                            ) : null}
                            {canClaim ? (
                              <button
                                className="mt-5 rounded-md bg-lime px-4 py-3 text-sm font-bold text-ink transition hover:bg-white disabled:opacity-60"
                                disabled={
                                  claimingId === String(market.market_id)
                                }
                                onClick={() => void handleClaim(market)}
                                type="button"
                              >
                                {claimingId === String(market.market_id)
                                  ? "Transaction pending…"
                                  : "Claim Winnings"}
                              </button>
                            ) : isResolved && bet?.claimed ? (
                              <p className="mt-5 flex items-center gap-1.5 text-sm font-bold text-lime">
                                <CheckCircle2 className="size-4" /> Claimed
                              </p>
                            ) : null}
                          </article>
                        );
                      })}
                    </div>
                  )}
                </section>
              ))}
            </div>
          )}
        </div>
      </main>
      <Footer />
      {toast ? (
        <div
          className={`fixed bottom-5 right-5 z-50 max-w-sm rounded-md border px-4 py-3 text-sm shadow-xl ${toast.includes("successfully") ? "border-lime/30 bg-lime/10 text-lime" : "border-red-400/30 bg-ink text-red-300"}`}
          role="status"
        >
          {toast}
        </div>
      ) : null}
    </div>
  );
}
