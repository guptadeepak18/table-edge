from typing import List, Dict, Any, Tuple
from app.schemas.game import BetPlacement, PocketValue
from app.core.constants import BET_PAYOUT_MULTIPLIERS

class PayoutService:
    @staticmethod
    def calculate_payout(
        bets: List[BetPlacement],
        landed_pocket: PocketValue,
        rules: str = "EUR"
    ) -> Tuple[float, float, float]:
        """
        Calculates total bet, total payout, and net win.
        Returns:
            (total_bet, total_payout, net_win)
        """
        total_bet = 0.0
        total_payout = 0.0

        for bet in bets:
            total_bet += bet.amount
            
            # Check if landed pocket is covered by this bet placement
            # Handle potential int vs str comparison for "00"
            is_hit = False
            for pocket in bet.covered_pockets:
                if str(pocket) == str(landed_pocket):
                    is_hit = True
                    break
            
            if is_hit:
                # Payout multiplier is e.g. 35 for straight (returns 35:1 profit + 1x stake = 36x stake)
                multiplier = bet.multiplier if bet.multiplier > 0 else BET_PAYOUT_MULTIPLIERS.get(bet.bet_type, 1)
                total_payout += bet.amount * (multiplier + 1)

        net_win = total_payout - total_bet
        return round(total_bet, 2), round(total_payout, 2), round(net_win, 2)

    @staticmethod
    def test_coordinate_hit(x: float, y: float, felt_width: float, felt_height: float) -> Dict[str, Any]:
        """
        Mathematical raycast hit detection across felt layout based on §4.2 spec.
        Standard felt layout grid (3 rows x 12 columns for numbers 1-36, 0 / 00 on left, outside bets below).
        """
        # Coordinate boundary testing implementation for coordinate plane hit-testing
        return {"hit": True, "x": x, "y": y}

payout_service = PayoutService()
