import type { Address, TransactionHash } from "genlayer-js/types";

import { readMarketContract, writeMarketContract } from "./genlayer";

export type MarketOutcome = 0 | 1 | 2;
export type JsonU256 = number | string;

export type Market = {
  market_id: JsonU256;
  creator: Address;
  home_team: string;
  away_team: string;
  kickoff_at: string;
  fixture_id: string;
  status: string;
  outcome: JsonU256;
  total_staked: JsonU256;
  final_score: string;
  resolved_at: string;
  resolution_source: string;
  void_reason: string;
  creator_outcome: JsonU256;
  total_paid_out: JsonU256;
  total_entitled: JsonU256;
  settlement_state: string;
};

export type Bet = {
  market_id: JsonU256;
  bettor: Address;
  outcome: JsonU256;
  amount: JsonU256;
  claimed: boolean;
  entitlement: JsonU256;
  settlement_state: string;
};

export function createMarket(
  homeTeam: string,
  awayTeam: string,
  kickoffTime: string,
  fixtureId: string,
  creatorOutcome: MarketOutcome,
): Promise<TransactionHash> {
  return writeMarketContract("create_market", [
    homeTeam,
    awayTeam,
    kickoffTime,
    fixtureId,
    creatorOutcome,
  ], BigInt(0));
}

export function placeBet(
  marketId: bigint,
  outcome: MarketOutcome,
  stakeWei: bigint,
): Promise<TransactionHash> {
  return writeMarketContract("place_bet", [marketId, outcome], stakeWei);
}

export function getMarket(marketId: bigint): Promise<Market> {
  return readMarketContract<Market>("get_market", [marketId]);
}

export function getMarketCount(): Promise<number | string> {
  return readMarketContract<number | string>("get_market_count");
}

export function listMarkets(start: bigint, limit: bigint): Promise<Market[]> {
  return readMarketContract<Market[]>("list_markets", [start, limit]);
}

export function getMyBet(marketId: bigint): Promise<Bet> {
  return readMarketContract<Bet>("get_my_bet", [marketId], true);
}

export function resolve(marketId: bigint): Promise<TransactionHash> {
  return writeMarketContract("resolve", [marketId]);
}

export function claimWinnings(marketId: bigint): Promise<TransactionHash> {
  return writeMarketContract("claim_winnings", [marketId]);
}

export function getOutcomeTotal(
  marketId: bigint,
  outcome: MarketOutcome,
): Promise<JsonU256> {
  return readMarketContract<JsonU256>("get_outcome_total", [marketId, outcome]);
}
