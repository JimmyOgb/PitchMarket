"use client";

import { LoaderCircle, TriangleAlert } from "lucide-react";
import { useEffect, useState } from "react";

import { SectionHeader } from "@/components/section-header";
import { getMarketCount, listMarkets, type Market } from "@/services/market";

const PAGE_SIZE = BigInt(25);

function asBigInt(value: number | string): bigint {
  return BigInt(value);
}

function formatPool(value: number | string): string {
  const amount = Number(value) / 10 ** 18;
  return `${amount.toFixed(4)} GEN`;
}

function statusForMarket(market: Market): string {
  if (market.status === "resolved") return "Resolved";
  if (market.status === "void") return "Void";
  return asBigInt(market.total_staked) > BigInt(0) ? "Active" : "Waiting";
}

export function MarketsSection() {
  const [markets, setMarkets] = useState<Market[]>([]);
  const [state, setState] = useState<"loading" | "success" | "error">(
    "loading",
  );

  useEffect(() => {
    let cancelled = false;

    async function loadMarkets() {
      try {
        const count = asBigInt(await getMarketCount());
        const loaded: Market[] = [];
        for (let start = BigInt(0); start < count; start += PAGE_SIZE) {
          const page = await listMarkets(start, PAGE_SIZE);
          loaded.push(...page);
          if (page.length === 0) break;
        }
        if (!cancelled) {
          setMarkets(loaded);
          setState("success");
        }
      } catch {
        if (!cancelled) setState("error");
      }
    }

    void loadMarkets();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section
      className="border-y border-white/10 bg-panel px-5 py-16 sm:px-8 sm:py-20 lg:px-10"
      id="markets"
    >
      <div className="mx-auto max-w-7xl">
        <SectionHeader
          eyebrow="Crowd outlook"
          title="Open markets"
          description="Real markets created on the GenLayer network."
          actionLabel="Explore all markets"
        />
        {state === "loading" ? (
          <div className="flex min-h-40 items-center justify-center rounded-md border border-white/10 bg-ink">
            <LoaderCircle className="size-7 animate-spin text-lime" />
          </div>
        ) : state === "error" ? (
          <div className="flex min-h-40 items-center justify-center gap-3 rounded-md border border-red-400/20 bg-ink px-5 text-sm text-red-300">
            <TriangleAlert className="size-5" />
            Markets are temporarily unavailable.
          </div>
        ) : markets.length === 0 ? (
          <div className="flex min-h-40 items-center justify-center rounded-md border border-white/10 bg-ink px-5 text-sm text-white/45">
            No markets have been created yet.
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {markets.slice(0, 6).map((market) => {
              const status = statusForMarket(market);
              return (
                <a
                  className="flex h-full flex-col rounded-md border border-white/10 bg-ink p-5 transition hover:border-lime/35 sm:p-6"
                  href="/markets"
                  key={String(market.market_id)}
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-xs text-white/35">
                      Market #{String(market.market_id)}
                    </span>
                    <span className="rounded-md bg-lime/10 px-2.5 py-1 text-[10px] font-bold uppercase text-lime">
                      {status}
                    </span>
                  </div>
                  <h3 className="mt-6 text-xl font-bold leading-7">
                    {market.home_team} <span className="text-white/35">vs</span>{" "}
                    {market.away_team}
                  </h3>
                  <p className="mt-2 text-sm text-white/45">
                    Total staked: {formatPool(market.total_staked)}
                  </p>
                  <div className="mt-6 grid grid-cols-3 gap-2 border-t border-white/10 pt-5 text-center text-xs">
                    {[
                      ["Home pool", "Not exposed"],
                      ["Draw pool", "Not exposed"],
                      ["Away pool", "Not exposed"],
                    ].map(([label, value]) => (
                      <div key={label}>
                        <p className="text-white/35">{label}</p>
                        <p className="mt-1 font-semibold text-white/65">
                          {value}
                        </p>
                      </div>
                    ))}
                  </div>
                </a>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
