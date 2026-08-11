"use client";

import { CheckCircle2, LoaderCircle, TriangleAlert, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { formatEther, parseEther } from "viem";
import { useConnect, useConnection, useConnectors } from "wagmi";

import { Footer } from "@/components/footer";
import { SectionHeader } from "@/components/section-header";
import { SiteHeader } from "@/components/site-header";
import {
  clearMarketReadCache,
  readMarketContract,
} from "@/services/genlayer";
import {
  getMarket,
  getMyBet,
  getOutcomeTotal,
  placeBet,
  resolve,
  type Bet,
  type MarketOutcome,
} from "@/services/market";

type JsonU256 = bigint | number | string;

type ContractMarket = {
  market_id: JsonU256;
  home_team: string;
  away_team: string;
  kickoff_at: string;
  status: string;
  outcome: JsonU256;
  total_staked: JsonU256;
  final_score: string;
  resolution_source: string;
  resolved_at: string;
  void_reason: string;
  creator_outcome: JsonU256;
  total_paid_out: JsonU256;
  total_entitled: JsonU256;
  settlement_state: string;
  bet: Bet | null;
  league?: string;
  winningTotal?: JsonU256;
  outcomeTotals?: JsonU256[];
};

type MarketLoadState = "loading" | "success" | "error";

const PAGE_SIZE = BigInt(25);
const outcomeTotalsCache = new Map<string, JsonU256[]>();
function asBigInt(value: JsonU256): bigint {
  return BigInt(value);
}

function normalizeMarket(raw: unknown): ContractMarket {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error("Unexpected get_market response shape.");
  }

  const value = raw as Record<string, unknown>;
  const requiredString = (field: string): string => {
    const fieldValue = value[field];
    if (typeof fieldValue !== "string") {
      throw new Error(`Invalid get_market field: ${field}`);
    }
    return fieldValue;
  };
  const requiredU256 = (field: string): bigint => {
    const fieldValue = value[field];
    if (
      typeof fieldValue !== "bigint" &&
      typeof fieldValue !== "number" &&
      typeof fieldValue !== "string"
    ) {
      throw new Error(`Invalid get_market field: ${field}`);
    }
    return asBigInt(fieldValue);
  };

  return {
    market_id: requiredU256("market_id"),
    home_team: requiredString("home_team"),
    away_team: requiredString("away_team"),
    kickoff_at: requiredString("kickoff_at"),
    status: requiredString("status"),
    outcome: requiredU256("outcome"),
    total_staked: requiredU256("total_staked"),
    final_score: requiredString("final_score"),
    resolution_source: requiredString("resolution_source"),
    resolved_at: requiredString("resolved_at"),
    void_reason: requiredString("void_reason"),
    creator_outcome: requiredU256("creator_outcome"),
    total_paid_out: requiredU256("total_paid_out"),
    total_entitled: requiredU256("total_entitled"),
    settlement_state: requiredString("settlement_state"),
    bet: null,
  };
}

function formatKickoff(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function formatPool(value: JsonU256): string {
  return `${Number(formatEther(asBigInt(value))).toFixed(4)} GEN`;
}

function getStatus(
  market: ContractMarket,
): "Waiting" | "Active" | "Resolved" | "Void" {
  if (market.status === "resolved") return "Resolved";
  if (market.status === "void") return "Void";
  return asBigInt(market.total_staked) > BigInt(0) ? "Active" : "Waiting";
}

function getOutcome(market: ContractMarket): string | null {
  if (market.status !== "resolved") return null;
  const outcomes = ["Home win", "Draw", "Away win"];
  return outcomes[Number(market.outcome)] ?? "Unknown outcome";
}

function outcomeLabel(outcome: JsonU256): string {
  return ["Home win", "Draw", "Away win"][Number(outcome)] ?? "Unknown";
}

function formatStakeInput(value: string): string {
  const amount = Number(value);
  if (!value.trim() || !Number.isFinite(amount)) return "—";
  return `${amount.toLocaleString(undefined, { maximumFractionDigits: 18 })} GEN`;
}

const statusClasses: Record<string, string> = {
  Waiting: "bg-white/10 text-white/65",
  Active: "bg-lime/10 text-lime",
  Resolved: "bg-lime/10 text-lime",
  Void: "bg-amber-400/10 text-amber-300",
};

function kickoffHasPassed(value: string): boolean {
  const timestamp = Date.parse(value);
  return !Number.isNaN(timestamp) && timestamp <= Date.now();
}

function isRateLimitError(error: unknown): boolean {
  return /429|rate limit|too many requests/i.test(
    error instanceof Error ? error.message : String(error),
  );
}

export default function MarketsPage() {
  const [markets, setMarkets] = useState<ContractMarket[]>([]);
  const [state, setState] = useState<MarketLoadState>("loading");
  const [errorMessage, setErrorMessage] = useState("");
  const [selectedMarket, setSelectedMarket] = useState<ContractMarket | null>(
    null,
  );
  const [selectedOutcome, setSelectedOutcome] = useState<MarketOutcome | null>(
    null,
  );
  const [stake, setStake] = useState("");
  const [betError, setBetError] = useState("");
  const [isBetting, setIsBetting] = useState(false);
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [toast, setToast] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);
  const connection = useConnection();
  const connectors = useConnectors();
  const { mutate: connect, isPending: isConnecting } = useConnect();
  const loadMarkets = useCallback(async () => {
    setState("loading");
    try {
      const rawCount = await readMarketContract<number | string>(
        "get_market_count",
      );
      const count = asBigInt(rawCount);
      const loaded: ContractMarket[] = [];

      for (let start = BigInt(0); start < count; start += PAGE_SIZE) {
        const rawPage = await readMarketContract<unknown[]>(
          "list_markets",
          [start, PAGE_SIZE],
        );
        const page = await Promise.all(
          rawPage.map((rawMarket) => {
            const rawValue = rawMarket as Record<string, unknown>;
            const marketId = asBigInt(rawValue.market_id as JsonU256);
            return getMarket(marketId).then((freshMarket) => {
              const normalizedMarket = normalizeMarket(freshMarket);
              console.info("[PM-READ] MARKET_ID:", String(marketId));
              console.info("[PM-READ] NORMALIZED_MARKET:", normalizedMarket);
              console.info(
                "[PM-READ] TOTAL_STAKED:",
                normalizedMarket.total_staked.toString(),
              );
              console.info("[PM-READ] STATUS:", getStatus(normalizedMarket));
              console.info("[PM-READ] KICKOFF:", normalizedMarket.kickoff_at);
              return normalizedMarket;
            });
          }),
        );
        loaded.push(...page);
        if (rawPage.length === 0) break;
      }

      const marketsWithBets = await Promise.all(
        loaded.map(async (market) => {
          let bet: Bet | null = null;
          if (
            connection.address &&
            (market.status === "resolved" || market.status === "void")
          ) {
            try {
              bet = await getMyBet(asBigInt(market.market_id));
            } catch {
              bet = null;
            }
          }
          return { ...market, bet, outcomeTotals: undefined };
        }),
      );

      setMarkets(marketsWithBets);
      console.info("[PM-READ] RENDERED_MARKETS_COUNT:", marketsWithBets.length);
      setState("success");
    } catch (error: unknown) {
      setErrorMessage(
        isRateLimitError(error)
          ? "Market data is temporarily rate-limited. Please wait a minute before trying again."
          : error instanceof Error
            ? error.message
            : "Please try again shortly.",
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

  async function openBetModal(market: ContractMarket) {
    setSelectedMarket(market);
    setSelectedOutcome(null);
    setStake("");
    setBetError("");

    const cacheKey = String(market.market_id);
    const cachedTotals = outcomeTotalsCache.get(cacheKey);
    if (cachedTotals) {
      setSelectedMarket({ ...market, outcomeTotals: cachedTotals });
      return;
    }

    try {
      const outcomeTotals = await Promise.all(
        ([0, 1, 2] as const).map((outcome) =>
          getOutcomeTotal(asBigInt(market.market_id), outcome),
        ),
      );
      outcomeTotalsCache.set(cacheKey, outcomeTotals);
      setSelectedMarket((currentMarket) =>
        currentMarket &&
        String(currentMarket.market_id) === cacheKey
          ? { ...currentMarket, outcomeTotals }
          : currentMarket,
      );
    } catch {
      // The bet form remains usable if optional pool reads are rate-limited.
    }
  }

  function closeBetModal() {
    if (isBetting) return;
    setSelectedMarket(null);
    setBetError("");
  }

  async function submitBet() {
    if (!selectedMarket || isBetting) return;
    if (!connection.isConnected || !connection.address) {
      setBetError("Connect your GenLayer wallet before placing a bet.");
      return;
    }
    if (selectedOutcome === null) {
      setBetError("Select an outcome to continue.");
      return;
    }
    if (!stake.trim()) {
      setBetError("Enter a stake amount.");
      return;
    }

    let amount: bigint;
    try {
      amount = parseEther(stake);
    } catch {
      setBetError("Enter a valid positive stake.");
      return;
    }
    if (amount <= BigInt(0)) {
      setBetError("Stake must be greater than zero.");
      return;
    }

    setBetError("");
    setIsBetting(true);
    const marketId = asBigInt(selectedMarket.market_id);
    try {
      const transactionHash = await placeBet(marketId, selectedOutcome, amount);
      console.log("[PM-POSTBET] HASH:", transactionHash);

      setMarkets((currentMarkets) =>
        currentMarkets.map((currentMarket) =>
          String(currentMarket.market_id) === String(marketId)
            ? {
                ...currentMarket,
                // This is the state rendered by the market cards. Update it
                // from the current card value so a prior read cannot make
                // the optimistic pool stale or overwrite another bet.
                total_staked: asBigInt(currentMarket.total_staked) + amount,
                status: "active",
              }
            : currentMarket,
        ),
      );
      const optimisticTotal = asBigInt(selectedMarket.total_staked) + amount;
      console.log("[PM-OPTIMISTIC-BET] MARKET_ID:", String(marketId));
      console.log("[PM-OPTIMISTIC-BET] BET_AMOUNT:", amount.toString());
      console.log("[PM-OPTIMISTIC-BET] NEW_TOTAL:", optimisticTotal.toString());
      console.log("[PM-OPTIMISTIC-BET] STATUS:", "ACTIVE");

      clearMarketReadCache();
      let reconciliationFailed = false;
      try {
        const refreshedMarket = await getMarket(marketId);
        console.log("[PM-RECONCILE] TOTAL_STAKED:", refreshedMarket.total_staked);
        setMarkets((currentMarkets) =>
          currentMarkets.map((currentMarket) =>
            String(currentMarket.market_id) === String(marketId)
              ? { ...currentMarket, ...refreshedMarket }
              : currentMarket,
          ),
        );
      } catch {
        reconciliationFailed = true;
      }

      setSelectedMarket(null);
      setToast({
        type: "success",
        message: reconciliationFailed
          ? `Transaction submitted and shown optimistically. On-chain confirmation is temporarily unavailable. Hash: ${String(transactionHash)}`
          : `Transaction submitted. Hash: ${String(transactionHash)}`,
      });
    } catch (error: unknown) {
      setToast({
        type: "error",
        message: error instanceof Error ? error.message : "Bet failed.",
      });
    } finally {
      setIsBetting(false);
    }
  }

  async function handleResolve(market: ContractMarket) {
    const marketId = String(market.market_id);
    if (resolvingId || !kickoffHasPassed(market.kickoff_at)) return;

    setResolvingId(marketId);
    try {
      await resolve(asBigInt(market.market_id));
      await loadMarkets();
      setToast({ type: "success", message: "Match resolved successfully." });
    } catch (error: unknown) {
      setToast({
        type: "error",
        message: error instanceof Error ? error.message : "Resolution failed.",
      });
    } finally {
      setResolvingId(null);
    }
  }

  return (
    <div className="min-h-screen overflow-hidden bg-ink text-white">
      <SiteHeader />
      <main className="surface-grid px-5 pb-20 pt-36 sm:px-8 sm:pt-44 lg:px-10">
        <div className="mx-auto max-w-7xl">
          <SectionHeader
            eyebrow="On-chain markets"
            title="All markets"
            description="Discover every football market created on PitchMarket."
          />

          {state === "loading" ? (
            <div className="flex min-h-48 items-center justify-center rounded-md border border-white/10 bg-panel px-6 py-12 text-center">
              <div>
                <LoaderCircle className="mx-auto size-7 animate-spin text-lime" />
                <p className="mt-4 font-semibold">Loading markets…</p>
              </div>
            </div>
          ) : state === "error" ? (
            <div className="flex min-h-48 items-center justify-center rounded-md border border-white/10 bg-panel px-6 py-12 text-center">
              <div className="max-w-md">
                <TriangleAlert className="mx-auto size-7 text-amber-400" />
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
              <p className="font-semibold">No markets have been created yet.</p>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {markets.map((market) => {
                const status = getStatus(market);
                const outcome = getOutcome(market);

                const canBet = status === "Waiting" || status === "Active";
                const canResolve = canBet;
                const kickoffPassed = kickoffHasPassed(market.kickoff_at);
                const isResolving = resolvingId === String(market.market_id);

                return (
                  <article
                    className="flex h-full flex-col rounded-md border border-white/10 bg-ink p-5 transition duration-300 hover:border-lime/35 sm:p-6"
                    key={String(market.market_id)}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-xs text-white/35">
                        Market #{String(market.market_id)}
                      </span>
                      <span
                        className={`rounded-md px-2.5 py-1 text-[10px] font-bold uppercase ${statusClasses[status]}`}
                      >
                        {status}
                      </span>
                    </div>
                    <h2 className="mt-6 text-xl font-bold leading-7">
                      {market.home_team}{" "}
                      <span className="text-white/35">vs</span>{" "}
                      {market.away_team}
                    </h2>
                    {market.league ? (
                      <p className="mt-2 text-sm text-white/45">
                        {market.league}
                      </p>
                    ) : null}
                    <dl className="mt-8 space-y-3 border-t border-white/10 pt-5 text-sm">
                      <div className="flex justify-between gap-4">
                        <dt className="text-white/40">Kickoff</dt>
                        <dd className="text-right text-white/75">
                          {formatKickoff(market.kickoff_at)}
                        </dd>
                      </div>
                      <div className="flex justify-between gap-4">
                        <dt className="text-white/40">Total pool</dt>
                        <dd className="font-semibold text-lime">
                          {formatPool(market.total_staked)}
                        </dd>
                      </div>
                      {outcome ? (
                        <div className="flex justify-between gap-4">
                          <dt className="text-white/40">Selected outcome</dt>
                          <dd className="text-right font-semibold text-white/75">
                            {outcome}
                            {market.final_score
                              ? ` · ${market.final_score}`
                              : ""}
                          </dd>
                        </div>
                      ) : null}
                      <div className="flex justify-between gap-4">
                        <dt className="text-white/40">Creator pick</dt>
                        <dd className="text-right text-white/75">
                          {outcomeLabel(market.creator_outcome)}
                        </dd>
                      </div>
                      {status === "Resolved" ? (
                        <>
                          <div className="flex justify-between gap-4">
                            <dt className="text-white/40">Final Score</dt>
                            <dd className="font-semibold text-white/75">
                              {market.final_score || "—"}
                            </dd>
                          </div>
                          <div className="flex justify-between gap-4">
                            <dt className="text-white/40">Winning Outcome</dt>
                            <dd className="text-right text-white/75">
                              {outcome ?? "—"}
                            </dd>
                          </div>
                          <div className="flex justify-between gap-4">
                            <dt className="text-white/40">Resolution Source</dt>
                            <dd className="text-right text-white/75">
                              {market.resolution_source || "—"}
                            </dd>
                          </div>
                          <div className="flex justify-between gap-4">
                            <dt className="text-white/40">Resolved Time</dt>
                            <dd className="text-right text-white/75">
                              {market.resolved_at
                                ? formatKickoff(market.resolved_at)
                                : "—"}
                            </dd>
                          </div>
                        </>
                      ) : null}
                      {status === "Void" ? (
                        <div className="flex justify-between gap-4">
                          <dt className="text-white/40">Void</dt>
                          <dd className="text-right text-amber-300">
                            {market.void_reason || "No reason provided"}
                          </dd>
                        </div>
                      ) : null}
                      {(status === "Resolved" || status === "Void") && market.bet ? (
                        <>
                          <div className="flex justify-between gap-4">
                            <dt className="text-white/40">My Stake</dt>
                            <dd className="font-semibold text-lime">
                              {formatPool(market.bet.amount)}
                            </dd>
                          </div>
                          <div className="flex justify-between gap-4">
                            <dt className="text-white/40">Entitlement</dt>
                            <dd className="font-semibold text-lime">
                              {formatPool(market.bet.entitlement)}
                            </dd>
                          </div>
                          <p className="mt-3 text-center text-sm font-bold text-amber-300">
                            {market.bet.settlement_state === "payout_pending"
                              ? "Settlement available"
                              : market.bet.settlement_state === "refund_pending"
                                ? "Refund available"
                                : market.bet.settlement_state === "not_eligible"
                                  ? "Not eligible for settlement"
                                  : "Settlement pending"}
                          </p>
                          {market.bet.settlement_state !== "not_eligible" ? (
                            <p className="mt-2 text-center text-xs leading-5 text-white/45">
                              Transfer confirmation unavailable. Your entitlement remains recorded and has not been marked paid.
                            </p>
                          ) : null}
                        </>
                      ) : null}
                    </dl>
                    {canBet ? (
                      <button
                        className="mt-6 rounded-md bg-lime px-4 py-3 text-sm font-bold text-ink transition hover:bg-white"
                        onClick={() => void openBetModal(market)}
                        type="button"
                      >
                        Place Bet
                      </button>
                    ) : null}
                    {canResolve ? (
                      <button
                        className="mt-3 flex items-center justify-center gap-2 rounded-md border border-white/15 bg-white/5 px-4 py-3 text-sm font-bold transition hover:border-lime/50 hover:text-lime disabled:cursor-not-allowed disabled:opacity-50"
                        disabled={!kickoffPassed || resolvingId !== null}
                        onClick={() => void handleResolve(market)}
                        type="button"
                      >
                        {isResolving ? (
                          <>
                            <LoaderCircle className="size-4 animate-spin" />
                            Resolving…
                          </>
                        ) : kickoffPassed ? (
                          "Resolve Match"
                        ) : (
                          "Available after full-time."
                        )}
                      </button>
                    ) : null}
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </main>
      <Footer />

      {selectedMarket ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/80 px-5 py-8 backdrop-blur-sm"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeBetModal();
          }}
        >
          <div
            aria-labelledby="place-bet-title"
            aria-modal="true"
            className="max-h-full w-full max-w-lg overflow-y-auto rounded-md border border-white/15 bg-panel p-6 shadow-2xl sm:p-8"
            role="dialog"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase text-lime">
                  Place a bet
                </p>
                <h2 id="place-bet-title" className="mt-2 text-2xl font-bold">
                  {selectedMarket.home_team} vs {selectedMarket.away_team}
                </h2>
              </div>
              <button
                aria-label="Close betting dialog"
                className="rounded-md p-1 text-white/45 transition hover:bg-white/5 hover:text-white disabled:opacity-50"
                disabled={isBetting}
                onClick={closeBetModal}
                type="button"
              >
                <X className="size-5" />
              </button>
            </div>

            <div className="mt-6 grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-md border border-white/10 bg-white/5 p-3">
                <p className="text-xs text-white/40">Current pool</p>
                <p className="mt-1 font-semibold text-lime">
                  {formatPool(selectedMarket.total_staked)}
                </p>
              </div>
              <div className="rounded-md border border-white/10 bg-white/5 p-3">
                <p className="text-xs text-white/40">Market status</p>
                <p className="mt-1 font-semibold">
                  {getStatus(selectedMarket)}
                </p>
              </div>
            </div>
            {selectedMarket.outcomeTotals ? (
              <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                {selectedMarket.outcomeTotals.map((total, index) => (
                  <div
                    className="rounded-md border border-white/10 bg-white/5 p-2"
                    key={index}
                  >
                    <p className="text-white/40">
                      {index === 0 ? "Home" : index === 1 ? "Draw" : "Away"}
                    </p>
                    <p className="mt-1 font-semibold text-lime">
                      {formatPool(total)}
                    </p>
                  </div>
                ))}
              </div>
            ) : null}

            <fieldset className="mt-6">
              <legend className="text-sm font-semibold">Choose outcome</legend>
              <div className="mt-3 grid gap-2">
                {(
                  [
                    [0, "Home Win"],
                    [1, "Draw"],
                    [2, "Away Win"],
                  ] as const
                ).map(([outcome, label]) => (
                  <label
                    className={`flex cursor-pointer items-center justify-between rounded-md border px-4 py-3 text-sm transition ${selectedOutcome === outcome ? "border-lime bg-lime/10 text-lime" : "border-white/10 bg-white/5 text-white/70 hover:border-white/25"}`}
                    key={label}
                  >
                    <span>{label}</span>
                    <input
                      checked={selectedOutcome === outcome}
                      className="accent-lime"
                      disabled={isBetting}
                      name="market-outcome"
                      onChange={() => setSelectedOutcome(outcome)}
                      type="radio"
                    />
                  </label>
                ))}
              </div>
            </fieldset>

            <label className="mt-6 block text-sm font-semibold" htmlFor="stake">
              Stake in GEN
              <input
                className="mt-2 w-full rounded-md border border-white/15 bg-white/5 px-3 py-3 font-normal text-white outline-none transition placeholder:text-white/25 focus:border-lime/60"
                disabled={isBetting}
                id="stake"
                inputMode="decimal"
                min="0"
                onChange={(event) => setStake(event.target.value)}
                placeholder="0.00"
                step="any"
                type="number"
                value={stake}
              />
              <p className="mt-2 text-sm text-lime">
                Stake: {formatStakeInput(stake)}
              </p>
            </label>

            {betError ? (
              <p className="mt-3 text-sm leading-5 text-red-300" role="alert">
                {betError}
              </p>
            ) : null}

            {!connection.isConnected ? (
              <button
                className="mt-6 w-full rounded-md border border-lime/30 bg-lime/10 px-4 py-3 text-sm font-bold text-lime transition hover:bg-lime/20 disabled:opacity-60"
                disabled={!connectors[0] || isConnecting}
                onClick={() =>
                  connectors[0] && connect({ connector: connectors[0] })
                }
                type="button"
              >
                {isConnecting ? "Connecting wallet…" : "Connect wallet to bet"}
              </button>
            ) : (
              <button
                className="mt-6 flex w-full items-center justify-center gap-2 rounded-md bg-lime px-4 py-3 text-sm font-bold text-ink transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
                disabled={
                  isBetting ||
                  selectedOutcome === null ||
                  !stake.trim() ||
                  !Number.isFinite(Number(stake)) ||
                  Number(stake) <= 0
                }
                onClick={submitBet}
                type="button"
              >
                {isBetting ? (
                  <>
                    <LoaderCircle className="size-4 animate-spin" />
                    Submitting…
                  </>
                ) : (
                  "Place Bet"
                )}
              </button>
            )}
          </div>
        </div>
      ) : null}

      {toast ? (
        <div
          className={`fixed bottom-5 right-5 z-[60] flex max-w-sm items-start gap-3 rounded-md border px-4 py-3 text-sm shadow-xl ${toast.type === "success" ? "border-lime/30 bg-lime/10 text-lime" : "border-red-400/30 bg-ink text-red-300"}`}
          role="status"
        >
          {toast.type === "success" ? (
            <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
          ) : (
            <TriangleAlert className="mt-0.5 size-4 shrink-0" />
          )}
          <span>{toast.message}</span>
        </div>
      ) : null}
    </div>
  );
}
