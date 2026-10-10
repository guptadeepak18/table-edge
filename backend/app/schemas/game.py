from pydantic import BaseModel, Field
from typing import List, Union, Optional, Literal

GameRules = Literal["EUR", "USA"]
BetType = Union[
    Literal[
        "straight",
        "split",
        "street",
        "corner",
        "sixline",
        "col_1",
        "col_2",
        "col_3",
        "column",
        "dozen_1",
        "dozen_2",
        "dozen_3",
        "dozen",
        "outside_red",
        "outside_black",
        "outside_even",
        "outside_odd",
        "outside_low",
        "outside_high",
        "trio",
        "basket",
        "first_four",
        "first_five"
    ],
    str
]

PocketValue = Union[int, Literal["00"]]

class BetPlacement(BaseModel):
    id: str
    bet_type: BetType = Field(alias="betType", default="straight")
    coordinate_x: float = Field(alias="coordinateX", default=0.0)
    coordinate_y: float = Field(alias="coordinateY", default=0.0)
    covered_pockets: List[PocketValue] = Field(alias="coveredPockets", default=[])
    amount: float = Field(gt=0)
    multiplier: float = Field(ge=1)

    model_config = {
        "populate_by_name": True,
        "arbitrary_types_allowed": True
    }

class ProgressionLevel(BaseModel):
    level_number: int = Field(alias="levelNumber", default=1, ge=1)
    total_wager: float = Field(alias="totalWager", default=0.0, ge=0)
    placements: List[BetPlacement] = []

    model_config = {
        "populate_by_name": True,
        "arbitrary_types_allowed": True
    }

class SpinRequest(BaseModel):
    rules: GameRules = "EUR"
    session_id: Optional[str] = None
    user_id: Optional[str] = None
    strategy_name: Optional[str] = "Manual Bet"
    level_number: Optional[int] = 1
    client_bankroll: Optional[float] = None
    bets: List[BetPlacement] = []

class SpinResponse(BaseModel):
    id: str
    pocket_number: PocketValue
    color: Literal["red", "black", "green"]
    total_bet: float
    total_payout: float
    net_win: float
    resulting_bankroll: Optional[float] = None
    rng_method: str = "secrets.randbelow"
    seed_hash: str
    timestamp: float
    hot_numbers: List[PocketValue] = []
    cold_numbers: List[PocketValue] = []
    total_spins_recorded: int = 0

class HotColdStatsResponse(BaseModel):
    total_spins: int
    rules: GameRules
    hot_numbers: List[PocketValue]
    cold_numbers: List[PocketValue]
    frequencies: dict
