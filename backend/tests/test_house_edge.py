import pytest
import numpy as np
from app.core.constants import THEORETICAL_HOUSE_EDGE

def test_eur_straight_house_edge():
    """
    Validate EUR straight bet house edge over 2,000,000 spins.
    Pockets 0-36. Bet on single number (payout 35:1).
    EV = (1/37 * 35) - (36/37 * 1) = -1/37 = -2.7027%
    """
    rng = np.random.default_rng(42)
    spins = 2_000_000
    chosen_number = 17
    outcomes = rng.integers(0, 37, size=spins)
    
    # Win returns +35, loss loses -1
    net_pl = np.where(outcomes == chosen_number, 35.0, -1.0)
    empirical_house_edge = -np.mean(net_pl)
    
    assert abs(empirical_house_edge - THEORETICAL_HOUSE_EDGE["EUR"]) < 0.01, (
        f"EUR Straight EV deviated: {empirical_house_edge:.4f} vs expected {THEORETICAL_HOUSE_EDGE['EUR']:.4f}"
    )

def test_eur_even_money_house_edge():
    """
    Validate EUR Red/Black (18 numbers) house edge.
    EV = (18/37 * 1) - (19/37 * 1) = -1/37 = -2.7027%
    """
    rng = np.random.default_rng(42)
    spins = 1_000_000
    red_pockets = {1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36}
    outcomes = rng.integers(0, 37, size=spins)
    is_red = np.isin(outcomes, list(red_pockets))
    
    net_pl = np.where(is_red, 1.0, -1.0)
    empirical_house_edge = -np.mean(net_pl)
    
    assert abs(empirical_house_edge - THEORETICAL_HOUSE_EDGE["EUR"]) < 0.003

def test_usa_straight_house_edge():
    """
    Validate USA straight bet house edge over 1,000,000 spins.
    Pockets 0-37 (where 37 is 00). Bet on single number (payout 35:1).
    EV = (1/38 * 35) - (37/38 * 1) = -2/38 = -5.2632%
    Single straight bet has std dev ~5.76, so SE for 1M is ~0.0058.
    """
    rng = np.random.default_rng(42)
    spins = 2_000_000
    chosen_number = 20
    outcomes = rng.integers(0, 38, size=spins)
    
    net_pl = np.where(outcomes == chosen_number, 35.0, -1.0)
    empirical_house_edge = -np.mean(net_pl)
    
    assert abs(empirical_house_edge - THEORETICAL_HOUSE_EDGE["USA"]) < 0.01, (
        f"USA Straight EV deviated: {empirical_house_edge:.4f} vs expected {THEORETICAL_HOUSE_EDGE['USA']:.4f}"
    )

def test_usa_even_money_house_edge():
    """
    Validate USA Red/Black house edge.
    EV = (18/38 * 1) - (20/38 * 1) = -2/38 = -5.2632%
    """
    spins = 1_000_000
    red_pockets = {1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36}
    outcomes = np.random.randint(0, 38, size=spins)
    is_red = np.isin(outcomes, list(red_pockets))
    
    net_pl = np.where(is_red, 1.0, -1.0)
    empirical_house_edge = -np.mean(net_pl)
    
    assert abs(empirical_house_edge - THEORETICAL_HOUSE_EDGE["USA"]) < 0.003
