# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }

from dataclasses import dataclass

from genlayer import *


OUTCOME_HOME_WIN = 0
OUTCOME_DRAW = 1
OUTCOME_AWAY_WIN = 2
OUTCOME_UNRESOLVED = 3

MARKET_STATUS_OPEN = "open"
MARKET_STATUS_ACTIVE = "active"
MARKET_STATUS_RESOLVED = "resolved"
MARKET_STATUS_VOID = "void"

MARKET_SETTLEMENT_UNSETTLED = "unsettled"
MARKET_SETTLEMENT_PAYOUT_PENDING = "payout_pending"
MARKET_SETTLEMENT_REFUND_PENDING = "refund_pending"
MARKET_SETTLEMENT_NO_ENTITLEMENTS = "no_entitlements"

BET_SETTLEMENT_UNSETTLED = "unsettled"
BET_SETTLEMENT_PAYOUT_PENDING = "payout_pending"
BET_SETTLEMENT_REFUND_PENDING = "refund_pending"
BET_SETTLEMENT_NOT_ELIGIBLE = "not_eligible"

TRUSTED_MATCH_DATA_SOURCE = "api-football"


@allow_storage
@dataclass
class Market:
    market_id: u256
    creator: Address
    home_team: str
    away_team: str
    kickoff_at: str
    fixture_id: str
    status: str
    outcome: u256
    total_staked: u256
    final_score: str
    resolved_at: str
    resolution_source: str
    void_reason: str
    creator_outcome: u256
    total_paid_out: u256
    total_entitled: u256
    settlement_state: str


@allow_storage
@dataclass
class Bet:
    market_id: u256
    bettor: Address
    outcome: u256
    amount: u256
    claimed: bool
    entitlement: u256
    settlement_state: str


class PitchMarket(gl.Contract):
    owner: Address
    next_market_id: u256
    markets: TreeMap[u256, Market]
    bets: TreeMap[str, Bet]
    outcome_totals: TreeMap[str, u256]
    bet_order: DynArray[str]
    outstanding_liabilities: u256

    def __init__(self):
        self.owner = gl.message.sender_address
        self.next_market_id = u256(0)
        self.outstanding_liabilities = u256(0)

    def _bet_key(self, market_id: u256, bettor: Address) -> str:
        return f"{market_id}:{bettor}"

    def _outcome_total_key(self, market_id: u256, outcome: u256) -> str:
        return f"{market_id}:{outcome}"

    @gl.public.write
    def create_market(
        self,
        home_team: str,
        away_team: str,
        kickoff_time: str,
        fixture_id: str,
        creator_outcome: u256,
    ) -> None:
        if not home_team.strip():
            raise gl.vm.UserError("Home team is required")
        if not away_team.strip():
            raise gl.vm.UserError("Away team is required")
        if not kickoff_time.strip():
            raise gl.vm.UserError("Kickoff time is required")
        if not fixture_id.strip():
            raise gl.vm.UserError("Fixture ID is required")
        if creator_outcome not in (
            OUTCOME_HOME_WIN,
            OUTCOME_DRAW,
            OUTCOME_AWAY_WIN,
        ):
            raise gl.vm.UserError("Invalid creator outcome")

        market_id = self.next_market_id
        self.markets[market_id] = Market(
            market_id=market_id,
            creator=gl.message.sender_address,
            home_team=home_team,
            away_team=away_team,
            kickoff_at=kickoff_time,
            fixture_id=fixture_id,
            status=MARKET_STATUS_OPEN,
            outcome=u256(OUTCOME_UNRESOLVED),
            total_staked=u256(0),
            final_score="",
            resolved_at="",
            resolution_source="",
            void_reason="",
            creator_outcome=creator_outcome,
            total_paid_out=u256(0),
            total_entitled=u256(0),
            settlement_state=MARKET_SETTLEMENT_UNSETTLED,
        )
        self.next_market_id = u256(market_id + 1)

    @gl.public.write.payable
    def place_bet(self, market_id: u256, outcome: u256) -> None:
        import datetime

        if market_id not in self.markets:
            raise gl.vm.UserError("Market does not exist")

        market = self.markets[market_id]
        if market.status not in (MARKET_STATUS_OPEN, MARKET_STATUS_ACTIVE):
            raise gl.vm.UserError("Market is not open")
        try:
            kickoff_at = datetime.datetime.fromisoformat(
                market.kickoff_at.replace("Z", "+00:00")
            )
            transaction_time = datetime.datetime.fromisoformat(
                gl.message_raw["datetime"].replace("Z", "+00:00")
            )
        except (KeyError, TypeError, ValueError):
            raise gl.vm.UserError("Kickoff time must be a valid ISO timestamp")
        if kickoff_at.tzinfo is None or transaction_time.tzinfo is None:
            raise gl.vm.UserError("Kickoff time must include a timezone")
        if transaction_time >= kickoff_at:
            raise gl.vm.UserError("Betting is closed after kickoff")
        if outcome not in (
            OUTCOME_HOME_WIN,
            OUTCOME_DRAW,
            OUTCOME_AWAY_WIN,
        ):
            raise gl.vm.UserError("Invalid outcome")
        amount = gl.message.value
        if amount == u256(0):
            raise gl.vm.UserError("Bet amount must be greater than zero")

        bettor = gl.message.sender_address
        if bettor == market.creator and outcome != market.creator_outcome:
            raise gl.vm.UserError("Creator may only bet on the creator outcome")
        bet_key = self._bet_key(market_id, bettor)
        if bet_key in self.bets:
            raise gl.vm.UserError("Address has already bet on this market")

        self.bets[bet_key] = Bet(
            market_id=market_id,
            bettor=bettor,
            outcome=outcome,
            amount=amount,
            claimed=False,
            entitlement=u256(0),
            settlement_state=BET_SETTLEMENT_UNSETTLED,
        )
        self.bet_order.append(bet_key)

        outcome_total_key = self._outcome_total_key(market_id, outcome)
        current_outcome_total = u256(0)
        if outcome_total_key in self.outcome_totals:
            current_outcome_total = self.outcome_totals[outcome_total_key]
        self.outcome_totals[outcome_total_key] = u256(
            current_outcome_total + amount
        )

        market.total_staked = u256(market.total_staked + amount)
        market.status = MARKET_STATUS_ACTIVE
        self.outstanding_liabilities = u256(
            self.outstanding_liabilities + amount
        )
        if self.outstanding_liabilities > self.balance:
            raise gl.vm.UserError("Escrow balance is below recorded liabilities")
        self.markets[market_id] = market

    def _prepare_settlement(self, market: Market) -> Market:
        winning_total = u256(0)
        if market.status == MARKET_STATUS_RESOLVED:
            winning_total_key = self._outcome_total_key(
                market.market_id, market.outcome
            )
            if winning_total_key in self.outcome_totals:
                winning_total = self.outcome_totals[winning_total_key]

        total_entitled = u256(0)
        has_payouts = False
        has_refunds = False
        for bet_key in self.bet_order:
            if bet_key not in self.bets:
                continue
            bet = self.bets[bet_key]
            if bet.market_id != market.market_id:
                continue

            bet.entitlement = u256(0)
            if market.status == MARKET_STATUS_VOID:
                bet.entitlement = bet.amount
                bet.settlement_state = BET_SETTLEMENT_REFUND_PENDING
                has_refunds = True
            elif (
                market.status == MARKET_STATUS_RESOLVED
                and winning_total > u256(0)
                and bet.outcome == market.outcome
            ):
                losing_total = u256(market.total_staked - winning_total)
                bet.entitlement = u256(
                    bet.amount + (bet.amount * losing_total // winning_total)
                )
                bet.settlement_state = BET_SETTLEMENT_PAYOUT_PENDING
                has_payouts = True
            else:
                bet.settlement_state = BET_SETTLEMENT_NOT_ELIGIBLE

            total_entitled = u256(total_entitled + bet.entitlement)
            self.bets[bet_key] = bet

        if total_entitled > market.total_staked:
            raise gl.vm.UserError("Settlement entitlements exceed liabilities")
        if self.outstanding_liabilities > self.balance:
            raise gl.vm.UserError("Settlement entitlements exceed escrow funds")

        market.total_entitled = total_entitled
        if has_payouts:
            market.settlement_state = MARKET_SETTLEMENT_PAYOUT_PENDING
        elif has_refunds:
            market.settlement_state = MARKET_SETTLEMENT_REFUND_PENDING
        else:
            market.settlement_state = MARKET_SETTLEMENT_NO_ENTITLEMENTS
        return market

    @gl.public.write
    def resolve(self, market_id: u256) -> str:
        import datetime
        import json

        if market_id not in self.markets:
            raise gl.vm.UserError("Market does not exist")

        market = self.markets[market_id]
        if market.status not in (MARKET_STATUS_OPEN, MARKET_STATUS_ACTIVE):
            raise gl.vm.UserError("Market is not open")

        try:
            kickoff_at = datetime.datetime.fromisoformat(
                market.kickoff_at.replace("Z", "+00:00")
            )
            transaction_time = datetime.datetime.fromisoformat(
                gl.message_raw["datetime"].replace("Z", "+00:00")
            )
        except ValueError:
            raise gl.vm.UserError("Kickoff time must be a valid ISO timestamp")

        if kickoff_at.tzinfo is None:
            raise gl.vm.UserError("Kickoff time must include a timezone")
        if transaction_time.tzinfo is None:
            raise gl.vm.UserError("Transaction time must include a timezone")
        if transaction_time <= kickoff_at:
            raise gl.vm.UserError("Match kickoff time has not passed")
        if not market.fixture_id.isdigit():
            raise gl.vm.UserError("Fixture ID must be numeric")

        def resolve_from_trusted_web() -> str:
            fixture_url = (
                "https://v3.football.api-sports.io/fixtures?id="
                + market.fixture_id
            )
            web_data = gl.nondet.web.render(fixture_url, mode="text")

            result = gl.nondet.exec_prompt(
                f"""
Extract the final status and score for one football fixture from the trusted
{TRUSTED_MATCH_DATA_SOURCE} source below.

Expected fixture identity:
- Fixture ID: {market.fixture_id}
- Home team: {market.home_team}
- Away team: {market.away_team}
- Kickoff: {market.kickoff_at}

Trusted source content:
{web_data}

Return only this JSON object with no markdown or additional text:
{{
  "fixture_id": string,
  "home_team": string,
  "away_team": string,
  "status": "resolved" | "unresolved" | "void",
  "home_goals": integer,
  "away_goals": integer,
  "outcome": 0 | 1 | 2 | 3,
  "void_reason": string
}}

Use "resolved" only when the fixture identity matches and the match is final.
Use "unresolved" when the match is not final or the result cannot be verified.
Use "void" only when the source explicitly marks the fixture cancelled,
abandoned, or otherwise void. For unresolved or void fixtures, set both goal
fields to -1. Never infer missing facts.
""",
                response_format="json",
            )

            if not isinstance(result, dict):
                raise gl.vm.UserError("[LLM_ERROR] Result is not an object")

            fixture_id = str(result.get("fixture_id", "")).strip()
            home_team = str(result.get("home_team", "")).strip()
            away_team = str(result.get("away_team", "")).strip()
            if not fixture_id or not home_team or not away_team:
                raise gl.vm.UserError(
                    "[LLM_ERROR] Missing fixture identity or team names"
                )

            status = str(result.get("status", "")).strip().lower()
            void_reason = str(result.get("void_reason", "")).strip()
            home_goals = result.get("home_goals")
            away_goals = result.get("away_goals")
            reported_outcome = result.get("outcome")

            if status == MARKET_STATUS_RESOLVED:
                if (
                    isinstance(home_goals, bool)
                    or not isinstance(home_goals, int)
                    or isinstance(away_goals, bool)
                    or not isinstance(away_goals, int)
                ):
                    raise gl.vm.UserError("[LLM_ERROR] Invalid goal values")
                if home_goals < 0 or away_goals < 0:
                    raise gl.vm.UserError("[LLM_ERROR] Invalid final score")

                if home_goals > away_goals:
                    derived_outcome = OUTCOME_HOME_WIN
                elif home_goals == away_goals:
                    derived_outcome = OUTCOME_DRAW
                else:
                    derived_outcome = OUTCOME_AWAY_WIN

                if (
                    isinstance(reported_outcome, bool)
                    or not isinstance(reported_outcome, int)
                ):
                    raise gl.vm.UserError("[LLM_ERROR] Missing result outcome")
                outcome = derived_outcome

                final_score = f"{home_goals}:{away_goals}"
                void_reason = ""
            elif status == MARKET_STATUS_VOID:
                if home_goals != -1 or away_goals != -1:
                    raise gl.vm.UserError("[LLM_ERROR] Void fixture has scores")
                if reported_outcome != OUTCOME_UNRESOLVED:
                    raise gl.vm.UserError("[LLM_ERROR] Invalid void outcome")
                outcome = OUTCOME_UNRESOLVED
                final_score = ""
                if not void_reason:
                    raise gl.vm.UserError("[LLM_ERROR] Missing void reason")
            elif status == "unresolved":
                if reported_outcome != OUTCOME_UNRESOLVED:
                    raise gl.vm.UserError("[LLM_ERROR] Invalid unresolved outcome")
                outcome = OUTCOME_UNRESOLVED
                final_score = ""
                void_reason = ""
            else:
                raise gl.vm.UserError("[LLM_ERROR] Invalid fixture status")

            normalized_result = {
                "away_team": away_team,
                "away_goals": away_goals,
                "final_score": final_score,
                "fixture_id": fixture_id,
                "home_team": home_team,
                "home_goals": home_goals,
                "outcome": outcome,
                "reported_outcome": reported_outcome,
                "resolution_source": TRUSTED_MATCH_DATA_SOURCE,
                "status": status,
                "void_reason": void_reason,
            }
            return json.dumps(
                normalized_result,
                sort_keys=True,
                separators=(",", ":"),
            )

        consensus_result = gl.eq_principle.prompt_comparative(
            resolve_from_trusted_web,
            principle="""
Both results must be valid normalized JSON and exactly agree on fixture_id,
status, outcome, reported_outcome, final_score, resolution_source, and
void_reason. Reject any difference in those fields.
""",
        )

        try:
            settlement = json.loads(consensus_result)
        except (TypeError, ValueError):
            raise gl.vm.UserError("Invalid consensus settlement")

        if not isinstance(settlement, dict):
            raise gl.vm.UserError("Invalid consensus settlement")

        settlement_status = str(settlement.get("status", "")).strip().lower()
        if settlement_status not in (
            MARKET_STATUS_RESOLVED,
            MARKET_STATUS_VOID,
        ):
            raise gl.vm.UserError("Fixture is not ready for settlement")

        if str(settlement.get("fixture_id", "")).strip() != market.fixture_id:
            raise gl.vm.UserError("Consensus fixture does not match market")
        if str(settlement.get("home_team", "")).strip() != market.home_team:
            raise gl.vm.UserError("Consensus home team does not match market")
        if str(settlement.get("away_team", "")).strip() != market.away_team:
            raise gl.vm.UserError("Consensus away team does not match market")
        if (
            str(settlement.get("resolution_source", "")).strip()
            != TRUSTED_MATCH_DATA_SOURCE
        ):
            raise gl.vm.UserError("Consensus source is not trusted")

        raw_outcome = settlement.get("outcome")
        try:
            settlement_outcome = int(raw_outcome)
        except (TypeError, ValueError):
            raise gl.vm.UserError("Invalid consensus outcome")

        final_score = str(settlement.get("final_score", "")).strip()
        void_reason = str(settlement.get("void_reason", "")).strip()

        if settlement_status == MARKET_STATUS_RESOLVED:
            if settlement_outcome not in (
                OUTCOME_HOME_WIN,
                OUTCOME_DRAW,
                OUTCOME_AWAY_WIN,
            ):
                raise gl.vm.UserError("Invalid resolved outcome")
            home_goals = settlement.get("home_goals")
            away_goals = settlement.get("away_goals")
            if (
                isinstance(home_goals, bool)
                or not isinstance(home_goals, int)
                or isinstance(away_goals, bool)
                or not isinstance(away_goals, int)
                or home_goals < 0
                or away_goals < 0
            ):
                raise gl.vm.UserError("Invalid resolved fixture scores")
            expected_score = f"{home_goals}:{away_goals}"
            if final_score != expected_score:
                raise gl.vm.UserError("Resolved fixture score is not canonical")
            if home_goals > away_goals:
                expected_outcome = OUTCOME_HOME_WIN
            elif home_goals == away_goals:
                expected_outcome = OUTCOME_DRAW
            else:
                expected_outcome = OUTCOME_AWAY_WIN
            if settlement_outcome != expected_outcome:
                raise gl.vm.UserError("Resolved outcome contradicts final score")
            if settlement.get("reported_outcome") != expected_outcome:
                raise gl.vm.UserError("Reported outcome contradicts final score")
            void_reason = ""
        else:
            if settlement_outcome != OUTCOME_UNRESOLVED:
                raise gl.vm.UserError("Invalid void outcome")
            if final_score:
                raise gl.vm.UserError("Void fixture cannot have a final score")
            if not void_reason:
                raise gl.vm.UserError("Void fixture is missing a reason")

        market.status = settlement_status
        market.outcome = u256(settlement_outcome)
        market.final_score = final_score
        market.resolved_at = transaction_time.astimezone(
            datetime.timezone.utc
        ).isoformat().replace("+00:00", "Z")
        market.resolution_source = TRUSTED_MATCH_DATA_SOURCE
        market.void_reason = void_reason
        market = self._prepare_settlement(market)
        self.markets[market_id] = market

        return consensus_result

    @gl.public.write
    def claim_winnings(self, market_id: u256) -> None:
        if market_id not in self.markets:
            raise gl.vm.UserError("Market does not exist")

        market = self.markets[market_id]
        if market.status not in (MARKET_STATUS_RESOLVED, MARKET_STATUS_VOID):
            raise gl.vm.UserError("Market is not settled")

        bet_key = self._bet_key(market_id, gl.message.sender_address)
        if bet_key not in self.bets:
            raise gl.vm.UserError("Caller has not placed a bet in this market")

        bet = self.bets[bet_key]
        if bet.claimed:
            raise gl.vm.UserError("Winnings have already been claimed")
        if bet.settlement_state not in (
            BET_SETTLEMENT_PAYOUT_PENDING,
            BET_SETTLEMENT_REFUND_PENDING,
        ):
            raise gl.vm.UserError("Bettor has no pending settlement entitlement")

        raise gl.vm.UserError(
            "External payout confirmation is unavailable; entitlement remains pending"
        )

    @gl.public.view
    def get_outcome_total(self, market_id: u256, outcome: u256) -> u256:
        if market_id not in self.markets:
            raise gl.vm.UserError("Market does not exist")
        if outcome not in (
            OUTCOME_HOME_WIN,
            OUTCOME_DRAW,
            OUTCOME_AWAY_WIN,
        ):
            raise gl.vm.UserError("Invalid outcome")
        key = self._outcome_total_key(market_id, outcome)
        if key not in self.outcome_totals:
            return u256(0)
        return self.outcome_totals[key]

    @gl.public.view
    def get_escrow_balance(self) -> u256:
        return self.balance

    @gl.public.view
    def get_market(self, market_id: u256) -> Market:
        if market_id not in self.markets:
            raise gl.vm.UserError("Market does not exist")
        return self.markets[market_id]

    @gl.public.view
    def get_market_count(self) -> u256:
        return self.next_market_id

    @gl.public.view
    def list_markets(self, start: u256, limit: u256) -> list[Market]:
        results: list[Market] = []
        end = min(start + limit, self.next_market_id)
        for market_id in range(start, end):
            if market_id in self.markets:
                results.append(self.markets[market_id])
        return results

    @gl.public.view
    def get_my_bet(self, market_id: u256) -> Bet:
        if market_id not in self.markets:
            raise gl.vm.UserError("Market does not exist")

        bet_key = self._bet_key(market_id, gl.message.sender_address)
        if bet_key not in self.bets:
            raise gl.vm.UserError("Caller has not placed a bet in this market")
        return self.bets[bet_key]
