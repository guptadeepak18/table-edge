from pydantic import BaseModel, Field
from typing import List, Union, Optional, Literal, Dict, Any
from app.schemas.game import PocketValue, GameRules

SpinDirection = Literal["cw", "ccw"]

class LiveSpinInput(BaseModel):
    pocket_number: PocketValue
    direction: SpinDirection = "cw"
    sequence_order: Optional[int] = None

class LiveSpinRecord(BaseModel):
    id: str
    pocket_number: PocketValue
    direction: SpinDirection
    sequence_order: int
    entered_at: str
    segment_index: int  # 1 to 6
    wheel_index: int
    offset_from_previous: Optional[int] = None

class SegmentStat(BaseModel):
    segment_index: int  # 1 to 6
    pocket_count: int
    pockets: List[PocketValue]
    hit_count: int
    hit_percentage: float
    z_score: float

class SectorPrediction(BaseModel):
    predicted_segment: int
    confidence_score: float  # e.g. 78.5%
    top_numbers: List[PocketValue]
    dominant_offset: Optional[int] = None
    rationale: str

class LiveSessionAnalytics(BaseModel):
    total_spins: int
    straight_frequency: Dict[str, int]
    rolling_hot: List[PocketValue]
    rolling_cold: List[PocketValue]
    segment_stats: List[SegmentStat]
    offset_distribution: Dict[int, int]
    dominant_offset: Optional[int] = None
    prediction: Optional[SectorPrediction] = None
    recent_spins: List[PocketValue] = []
    context_type: Optional[str] = "session"  # "session" | "dealer" | "table"
    context_name: Optional[str] = None
    distinct_dealers: Optional[List[str]] = None
    distinct_tables: Optional[List[str]] = None

class HistoricalArchiveStats(BaseModel):
    total_spins: int
    dealers: List[Dict[str, Any]] = []
    tables: List[Dict[str, Any]] = []

class LiveSessionCreate(BaseModel):
    rules: GameRules = "EUR"
    casino: Optional[str] = None
    table_id: Optional[str] = None
    dealer_name: Optional[str] = None
    label: str = Field(default="Live Session")

class LiveSessionResponse(BaseModel):
    id: str
    user_id: Optional[str] = None
    rules: GameRules
    casino: Optional[str] = None
    table_id: Optional[str] = None
    dealer_name: Optional[str] = None
    label: str
    started_at: str
    ended_at: Optional[str] = None
    entries: List[LiveSpinRecord] = []

class LiveFeedStartRequest(BaseModel):
    casino_id: Optional[str] = None
    table_keys: Optional[List[str]] = None
    currency: str = "USD"

class LiveFeedBindRequest(BaseModel):
    table_id: str
    session_id: str

class CasinoConfigBase(BaseModel):
    name: str
    casino_id: str
    provider: str = "pragmatic"
    is_default: bool = False
    is_active: bool = True
    notes: Optional[str] = None

class CasinoConfigCreate(CasinoConfigBase):
    pass

class CasinoConfigUpdate(BaseModel):
    name: Optional[str] = None
    casino_id: Optional[str] = None
    provider: Optional[str] = None
    is_default: Optional[bool] = None
    is_active: Optional[bool] = None
    notes: Optional[str] = None

class CasinoConfigResponse(CasinoConfigBase):
    id: str
    created_at: str

