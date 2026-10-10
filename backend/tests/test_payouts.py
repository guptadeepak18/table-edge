import pytest
from app.services.payout_service import payout_service
from app.schemas.game import BetPlacement

def test_straight_up_win_and_loss():
    bet = BetPlacement(
        id="bet1",
        bet_type="straight",
        covered_pockets=[17],
        amount=10.0,
        multiplier=35.0
    )
    # Winning spin on 17
    total_bet, total_payout, net_win = payout_service.calculate_payout([bet], 17, "EUR")
    assert total_bet == 10.0
    assert total_payout == 360.0  # 10 * (35 + 1)
    assert net_win == 350.0

    # Losing spin on 18
    total_bet, total_payout, net_win = payout_service.calculate_payout([bet], 18, "EUR")
    assert total_bet == 10.0
    assert total_payout == 0.0
    assert net_win == -10.0

def test_split_and_outside_combination():
    split_bet = BetPlacement(
        id="bet2",
        bet_type="split",
        covered_pockets=[14, 17],
        amount=20.0,
        multiplier=17.0
    )
    red_bet = BetPlacement(
        id="bet3",
        bet_type="outside_red",
        covered_pockets=[1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36],
        amount=50.0,
        multiplier=1.0
    )
    
    # Landed on 14 (which is Red and part of split)
    total_bet, total_payout, net_win = payout_service.calculate_payout([split_bet, red_bet], 14, "EUR")
    assert total_bet == 70.0
    # Split returns 20 * 18 = 360; Red returns 50 * 2 = 100 -> Total = 460
    assert total_payout == 460.0
    assert net_win == 390.0

def test_usa_double_zero_handling():
    bet_00 = BetPlacement(
        id="bet_00",
        bet_type="straight",
        covered_pockets=["00"],
        amount=25.0,
        multiplier=35.0
    )
    total_bet, total_payout, net_win = payout_service.calculate_payout([bet_00], "00", "USA")
    assert total_payout == 900.0  # 25 * 36
    assert net_win == 875.0
