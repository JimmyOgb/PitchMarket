from datetime import datetime, timezone

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
    with direct_vm.expect_revert("Bet must oppose the creator outcome"):
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
    with direct_vm.expect_revert("Bet must oppose the creator outcome"):
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
