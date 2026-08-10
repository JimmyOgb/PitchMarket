import { Clock3, TrendingUp } from "lucide-react";

import type { PredictionMarket } from "@/types/home";

type MarketCardProps = {
  market: PredictionMarket;
};

export function MarketCard({ market }: MarketCardProps) {
  return (
    <article className="flex h-full flex-col rounded-md border border-white/10 bg-ink p-5 transition duration-300 hover:border-lime/35 sm:p-6">
      <div className="flex items-center justify-between gap-3">
        <span className="rounded-md bg-lime/10 px-2.5 py-1 text-[10px] font-bold uppercase text-lime">
          {market.category}
        </span>
        <span className="flex items-center gap-1.5 text-xs text-white/35">
          <TrendingUp className="size-3.5" />
          {market.volume}
        </span>
      </div>

      <h3 className="mt-6 text-balance text-xl font-bold leading-7">
        {market.question}
      </h3>

      <div className="mt-8 space-y-4">
        {market.options.map((option, index) => (
          <div key={option.label}>
            <div className="mb-2 flex items-center justify-between text-sm">
              <span className="font-semibold text-white/70">
                {option.label}
              </span>
              <span
                className={
                  index === 0 ? "font-black text-lime" : "font-black text-white"
                }
              >
                {option.probability}%
              </span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
              <div
                className={`h-full rounded-full ${index === 0 ? "bg-lime" : "bg-white/40"}`}
                style={{ width: `${option.probability}%` }}
              />
            </div>
          </div>
        ))}
      </div>

      <div className="mt-auto flex items-center gap-2 border-t border-white/10 pt-6 text-xs text-white/40">
        <Clock3 className="size-3.5" />
        {market.closes}
      </div>
    </article>
  );
}
