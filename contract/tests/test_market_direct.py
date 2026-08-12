from datetime import datetime, timezone
import json

import pytest


WEI_PER_GEN = 10**18
KICKOFF = datetime(2099, 1, 1, tzinfo=timezone.utc).isoformat()


def deploy_market(
    direct_vm,
    direct_deploy,
    creator,
    creator_outcome=0,
    kickoff=KICKOFF,
):
    contract = direct_deploy("contract/market.py")
    direct_vm.sender = creator
    direct_vm.value = 0
    contract.create_market(
        "Home FC",
        "Away FC",
        kickoff,
        "12345",
        creator_outcome,
    )
    return contract


def place(direct_vm, contract, sender, value, outcome=1):
    direct_vm.sender = sender
    direct_vm.value = value
    contract.place_bet(0, outcome)


def test_zero_value_bet_rejected(direct_vm, direct_deploy, direct_alice, direct_bob):
    contract = deploy_market(direct_vm, direct_deploy, direct_alice)
    direct_vm.sender = direct_bob
    direct_vm.value = 0
    with direct_vm.expect_revert("Bet amount must be greater than zero"):
        contract.place_bet(0, 1)


def test_value_is_authoritative_and_accounted(direct_vm, direct_deploy, direct_alice, direct_bob):
    contract = deploy_market(direct_vm, direct_deploy, direct_alice)
    amount = 10 * WEI_PER_GEN
    place(direct_vm, contract, direct_bob, amount)

    market = contract.get_market(0)
    bet = contract.get_my_bet(0)
    assert bet.amount == amount
    assert market.total_staked == amount
    assert contract.get_outcome_total(0, 1) == amount
    assert market.status == "active"
    assert bet.entitlement == 0
    assert bet.settlement_state == "unsettled"


def test_creator_can_bet_on_own_outcome(
    direct_vm, direct_deploy, direct_alice
):
    contract = deploy_market(direct_vm, direct_deploy, direct_alice, creator_outcome=0)

    direct_vm.sender = direct_alice
    direct_vm.value = WEI_PER_GEN
    contract.place_bet(0, 0)

    market = contract.get_market(0)
    assert market.total_staked == WEI_PER_GEN
    assert contract.get_outcome_total(0, 0) == WEI_PER_GEN
    assert market.status == "active"


def test_creator_cannot_bet_against_own_outcome(
    direct_vm, direct_deploy, direct_alice
):
    contract = deploy_market(direct_vm, direct_deploy, direct_alice, creator_outcome=0)

    direct_vm.sender = direct_alice
    direct_vm.value = WEI_PER_GEN
    with direct_vm.expect_revert("Creator may only bet on the creator outcome"):
        contract.place_bet(0, 1)

    market = contract.get_market(0)
    assert market.total_staked == 0
    assert market.status == "open"
    assert contract.get_outcome_total(0, 0) == 0
    assert contract.get_outcome_total(0, 1) == 0


def test_non_creator_can_bet_on_creator_outcome(
    direct_vm, direct_deploy, direct_alice, direct_bob
):
    contract = deploy_market(direct_vm, direct_deploy, direct_alice, creator_outcome=0)

    place(direct_vm, contract, direct_bob, WEI_PER_GEN, outcome=0)

    assert contract.get_market(0).total_staked == WEI_PER_GEN
    assert contract.get_outcome_total(0, 0) == WEI_PER_GEN


def test_non_creator_can_bet_against_creator_outcome(
    direct_vm, direct_deploy, direct_alice, direct_bob
):
    contract = deploy_market(direct_vm, direct_deploy, direct_alice, creator_outcome=0)

    place(direct_vm, contract, direct_bob, WEI_PER_GEN, outcome=1)

    assert contract.get_market(0).total_staked == WEI_PER_GEN
    assert contract.get_outcome_total(0, 1) == WEI_PER_GEN


def test_rejected_creator_bet_does_not_mutate_accounting(
    direct_vm, direct_deploy, direct_alice
):
    contract = deploy_market(direct_vm, direct_deploy, direct_alice, creator_outcome=0)

    direct_vm.sender = direct_alice
    direct_vm.value = WEI_PER_GEN
    with direct_vm.expect_revert("Creator may only bet on the creator outcome"):
        contract.place_bet(0, 1)

    market = contract.get_market(0)
    assert market.total_staked == 0
    assert market.status == "open"
    assert contract.get_outcome_total(0, 0) == 0
    assert contract.get_outcome_total(0, 1) == 0


def test_second_bet_by_same_user_rejected(direct_vm, direct_deploy, direct_alice, direct_bob):
    contract = deploy_market(direct_vm, direct_deploy, direct_alice)
    place(direct_vm, contract, direct_bob, WEI_PER_GEN)
    direct_vm.value = WEI_PER_GEN
    with direct_vm.expect_revert("Address has already bet"):
        contract.place_bet(0, 2)


def test_second_user_on_opposing_side_keeps_market_active(
    direct_vm, direct_deploy, direct_alice, direct_bob, direct_charlie
):
    contract = deploy_market(direct_vm, direct_deploy, direct_alice)
    place(direct_vm, contract, direct_bob, WEI_PER_GEN)
    place(direct_vm, contract, direct_charlie, 2 * WEI_PER_GEN)
    assert contract.get_market(0).status == "active"
    assert contract.get_market(0).total_staked == 3 * WEI_PER_GEN


def test_escrow_balance_covers_recorded_liabilities(
    direct_vm, direct_deploy, direct_alice, direct_bob
):
    contract = deploy_market(direct_vm, direct_deploy, direct_alice)
    place(direct_vm, contract, direct_bob, 10 * WEI_PER_GEN)
    assert contract.get_escrow_balance() >= contract.get_market(0).total_staked


def test_bet_after_cutoff_rejected(
    direct_vm, direct_deploy, direct_alice, direct_bob
):
    contract = deploy_market(
        direct_vm,
        direct_deploy,
        direct_alice,
        kickoff="2000-01-01T00:00:00+00:00",
    )
    direct_vm.sender = direct_bob
    direct_vm.value = WEI_PER_GEN
    with direct_vm.expect_revert("Betting is closed after kickoff"):
        contract.place_bet(0, 1)


@pytest.mark.parametrize("bad_outcome", [3, 99])
def test_invalid_outcome_rejected(
    direct_vm, direct_deploy, direct_alice, direct_bob, bad_outcome
):
    contract = deploy_market(direct_vm, direct_deploy, direct_alice)
    direct_vm.sender = direct_bob
    direct_vm.value = WEI_PER_GEN
    with direct_vm.expect_revert("Invalid outcome"):
        contract.place_bet(0, bad_outcome)


def mock_resolution(direct_vm, result):
    direct_vm.mock_web(
        r".*v3\.football\.api-sports\.io/fixtures\?id=12345.*",
        {"status": 200, "body": "authoritative fixture payload"},
    )
    direct_vm.mock_llm(
        r".*Extract the final status and score.*",
        json.dumps(result) if not isinstance(result, str) else result,
    )


def resolution_result(
    *,
    fixture_id="12345",
    home_team="Home FC",
    away_team="Away FC",
    status="resolved",
    home_goals=2,
    away_goals=1,
    outcome=None,
    void_reason="",
):
    if outcome is None:
        if status == "resolved" and isinstance(home_goals, int) and isinstance(away_goals, int):
            outcome = 0 if home_goals > away_goals else 1 if home_goals == away_goals else 2
        elif status == "resolved":
            outcome = 0
        else:
            outcome = 3
    return {
        "fixture_id": fixture_id,
        "home_team": home_team,
        "away_team": away_team,
        "status": status,
        "home_goals": home_goals,
        "away_goals": away_goals,
        "outcome": outcome,
        "void_reason": void_reason,
    }


def prepare_resolution(direct_vm, contract, sender, amount=WEI_PER_GEN, outcome=0):
    place(direct_vm, contract, sender, amount, outcome)
    # gltest 0.29.2's warp updates datetime.now() but not message_raw.datetime.
    # Set the VM transaction timestamp explicitly for this payable contract.
    direct_vm._datetime = "2100-01-01T00:00:00Z"
    import genlayer.gl as runtime_gl

    runtime_gl.message_raw["datetime"] = direct_vm._datetime


def restore_betting_time(direct_vm):
    direct_vm._datetime = "2024-01-01T00:00:00Z"
    import genlayer.gl as runtime_gl

    runtime_gl.message_raw["datetime"] = direct_vm._datetime


def set_resolution_time(direct_vm):
    direct_vm._datetime = "2100-01-01T00:00:00Z"
    import genlayer.gl as runtime_gl

    runtime_gl.message_raw["datetime"] = direct_vm._datetime


def test_resolved_market_with_no_winning_stake_has_no_refund_entitlement(
    direct_vm, direct_deploy, direct_alice, direct_bob
):
    contract = deploy_market(direct_vm, direct_deploy, direct_alice)
    prepare_resolution(direct_vm, contract, direct_bob, outcome=1)
    mock_resolution(direct_vm, resolution_result(home_goals=2, away_goals=1))

    contract.resolve(0)

    market = contract.get_market(0)
    assert market.status == "resolved"
    assert market.outcome == 0
    assert market.total_staked == WEI_PER_GEN
    assert market.total_entitled == 0
    assert contract.get_escrow_balance() >= WEI_PER_GEN

    bet = contract.get_my_bet(0)
    assert bet.entitlement == 0
    assert bet.claimed is False
    assert bet.settlement_state == "not_eligible"
    direct_vm.sender = direct_bob
    with direct_vm.expect_revert("not eligible for winnings"):
        contract.claim_winnings(0)


@pytest.mark.parametrize(
    "result",
    [
        resolution_result(fixture_id="99999"),
        resolution_result(fixture_id=""),
        resolution_result(home_team="Other FC"),
        resolution_result(away_team="Other FC"),
        resolution_result(status="unresolved", home_goals=-1, away_goals=-1),
        resolution_result(home_goals=-1),
        resolution_result(home_goals="2"),
        resolution_result(home_goals=2, away_goals=2, outcome=0),
    ],
)
def test_invalid_resolution_leaves_market_unchanged(
    direct_vm, direct_deploy, direct_alice, direct_bob, result
):
    contract = deploy_market(direct_vm, direct_deploy, direct_alice)
    prepare_resolution(direct_vm, contract, direct_bob, outcome=0)
    before = contract.get_market(0)
    mock_resolution(direct_vm, result)

    with direct_vm.expect_revert():
        contract.resolve(0)

    after = contract.get_market(0)
    assert after == before
    assert contract.get_escrow_balance() >= before.total_staked


def test_unavailable_result_source_leaves_market_unchanged(
    direct_vm, direct_deploy, direct_alice, direct_bob
):
    contract = deploy_market(direct_vm, direct_deploy, direct_alice)
    prepare_resolution(direct_vm, contract, direct_bob, outcome=0)
    before = contract.get_market(0)

    with direct_vm.expect_revert():
        contract.resolve(0)

    assert contract.get_market(0) == before


def test_malformed_result_json_leaves_market_unchanged(
    direct_vm, direct_deploy, direct_alice, direct_bob
):
    contract = deploy_market(direct_vm, direct_deploy, direct_alice)
    prepare_resolution(direct_vm, contract, direct_bob, outcome=0)
    before = contract.get_market(0)
    mock_resolution(direct_vm, "not-json")

    with direct_vm.expect_revert():
        contract.resolve(0)

    assert contract.get_market(0) == before


@pytest.mark.parametrize(
    "result, expected_outcome",
    [
        (resolution_result(home_goals=2, away_goals=1), 0),
        (resolution_result(home_goals=1, away_goals=2), 2),
        (resolution_result(home_goals=1, away_goals=1), 1),
    ],
)
def test_valid_final_results_resolve_deterministically(
    direct_vm,
    direct_deploy,
    direct_alice,
    direct_bob,
    result,
    expected_outcome,
):
    contract = deploy_market(direct_vm, direct_deploy, direct_alice)
    prepare_resolution(direct_vm, contract, direct_bob, outcome=expected_outcome)
    mock_resolution(direct_vm, result)

    contract.resolve(0)

    market = contract.get_market(0)
    assert market.status == "resolved"
    assert market.outcome == expected_outcome
    assert market.final_score == f"{result['home_goals']}:{result['away_goals']}"


def test_cancelled_fixture_becomes_void_and_preserves_liability(
    direct_vm, direct_deploy, direct_alice, direct_bob
):
    contract = deploy_market(direct_vm, direct_deploy, direct_alice)
    prepare_resolution(direct_vm, contract, direct_bob, outcome=0)
    mock_resolution(
        direct_vm,
        resolution_result(
            status="void", home_goals=-1, away_goals=-1, void_reason="abandoned"
        ),
    )

    contract.resolve(0)

    market = contract.get_market(0)
    assert market.status == "void"
    assert market.total_staked == WEI_PER_GEN
    assert contract.get_my_bet(0).entitlement == WEI_PER_GEN
    direct_vm.sender = direct_bob
    contract.refund(0)
    assert contract.get_my_bet(0).claimed is True
    assert contract.get_my_bet(0).settlement_state == "claimed"
    assert contract.get_market(0).total_paid_out == WEI_PER_GEN
    assert contract.outstanding_liabilities == 0
    with direct_vm.expect_revert("already been claimed"):
        contract.refund(0)


def test_winner_claim_updates_state_and_liability_once(
    direct_vm, direct_deploy, direct_alice, direct_bob, direct_charlie
):
    contract = deploy_market(direct_vm, direct_deploy, direct_alice)
    prepare_resolution(direct_vm, contract, direct_bob, amount=WEI_PER_GEN, outcome=0)
    restore_betting_time(direct_vm)
    place(direct_vm, contract, direct_charlie, 3 * WEI_PER_GEN, outcome=1)
    mock_resolution(direct_vm, resolution_result(home_goals=2, away_goals=1))
    set_resolution_time(direct_vm)
    contract.resolve(0)

    direct_vm.sender = direct_bob
    contract.claim_winnings(0)
    bet = contract.get_my_bet(0)
    assert bet.claimed is True
    assert bet.settlement_state == "claimed"
    assert contract.get_market(0).total_paid_out == 4 * WEI_PER_GEN
    assert contract.outstanding_liabilities == 0

    with direct_vm.expect_revert("already been claimed"):
        contract.claim_winnings(0)


def test_loser_and_wrong_recipient_cannot_claim(
    direct_vm, direct_deploy, direct_alice, direct_bob, direct_charlie
):
    contract = deploy_market(direct_vm, direct_deploy, direct_alice)
    prepare_resolution(direct_vm, contract, direct_bob, amount=WEI_PER_GEN, outcome=0)
    restore_betting_time(direct_vm)
    place(direct_vm, contract, direct_charlie, WEI_PER_GEN, outcome=2)
    mock_resolution(direct_vm, resolution_result(home_goals=2, away_goals=1))
    set_resolution_time(direct_vm)
    contract.resolve(0)

    direct_vm.sender = direct_charlie
    with direct_vm.expect_revert("not eligible for winnings"):
        contract.claim_winnings(0)
    direct_vm.sender = direct_alice
    with direct_vm.expect_revert("has not placed a bet"):
        contract.claim_winnings(0)


def test_void_bettor_cannot_claim_winnings_or_refund_twice(
    direct_vm, direct_deploy, direct_alice, direct_bob
):
    contract = deploy_market(direct_vm, direct_deploy, direct_alice)
    prepare_resolution(direct_vm, contract, direct_bob, amount=2 * WEI_PER_GEN, outcome=0)
    mock_resolution(
        direct_vm,
        resolution_result(status="void", home_goals=-1, away_goals=-1, void_reason="cancelled"),
    )
    contract.resolve(0)
    direct_vm.sender = direct_bob
    with direct_vm.expect_revert("not resolved"):
        contract.claim_winnings(0)
    contract.refund(0)
    with direct_vm.expect_revert("already been claimed"):
        contract.refund(0)


def test_multiple_winners_use_integer_proportional_formula(
    direct_vm, direct_deploy, direct_alice, direct_bob, direct_charlie
):
    contract = deploy_market(direct_vm, direct_deploy, direct_alice)
    prepare_resolution(direct_vm, contract, direct_bob, amount=2 * WEI_PER_GEN, outcome=0)
    restore_betting_time(direct_vm)
    place(direct_vm, contract, direct_charlie, WEI_PER_GEN, outcome=0)
    mock_resolution(direct_vm, resolution_result(home_goals=2, away_goals=1))
    set_resolution_time(direct_vm)
    contract.resolve(0)
    assert contract.get_my_bet(0).entitlement == WEI_PER_GEN
    direct_vm.sender = direct_bob
    contract.claim_winnings(0)
    direct_vm.sender = direct_charlie
    contract.claim_winnings(0)
    assert contract.get_market(0).total_paid_out == 3 * WEI_PER_GEN
