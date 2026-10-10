import math
import uuid
from datetime import datetime, timezone
from typing import List, Dict, Tuple, Optional
from app.core.constants import (
    EUR_WHEEL_SEQUENCE,
    USA_WHEEL_SEQUENCE,
    EUR_SEGMENTS,
    USA_SEGMENTS,
)
from app.schemas.tracker import (
    LiveSpinInput,
    LiveSpinRecord,
    SegmentStat,
    SectorPrediction,
    LiveSessionAnalytics,
    PocketValue,
    GameRules,
)

class TrackerService:
    @staticmethod
    def get_wheel_sequence(rules: GameRules) -> List[PocketValue]:
        return USA_WHEEL_SEQUENCE if rules.upper() == "USA" else EUR_WHEEL_SEQUENCE

    @staticmethod
    def get_wheel_segments(rules: GameRules) -> List[List[PocketValue]]:
        return USA_SEGMENTS if rules.upper() == "USA" else EUR_SEGMENTS

    @classmethod
    def get_wheel_index(cls, pocket: PocketValue, rules: GameRules) -> int:
        seq = cls.get_wheel_sequence(rules)
        pocket_str = str(pocket)
        for idx, p in enumerate(seq):
            if str(p) == pocket_str:
                return idx
        raise ValueError(f"Pocket {pocket} not found in {rules} wheel sequence.")

    @classmethod
    def get_pocket_segment(cls, pocket: PocketValue, rules: GameRules) -> int:
        """
        Returns segment index 1 through 6 for a given pocket.
        """
        segments = cls.get_wheel_segments(rules)
        pocket_str = str(pocket)
        for seg_idx, seg_pockets in enumerate(segments):
            for p in seg_pockets:
                if str(p) == pocket_str:
                    return seg_idx + 1  # 1-indexed (1 to 6)
        return 1

    @classmethod
    def calculate_directional_offset(
        cls,
        prev_pocket: PocketValue,
        curr_pocket: PocketValue,
        direction: str,
        rules: GameRules,
    ) -> int:
        """
        Calculates angular/pocket offset based on spin direction:
        - Clockwise (CW): (index_curr - index_prev) % N
        - Anticlockwise (CCW): (index_prev - index_curr) % N
        """
        seq = cls.get_wheel_sequence(rules)
        total_pockets = len(seq)
        prev_idx = cls.get_wheel_index(prev_pocket, rules)
        curr_idx = cls.get_wheel_index(curr_pocket, rules)

        if direction.lower() == "ccw":
            return (prev_idx - curr_idx) % total_pockets
        else:
            return (curr_idx - prev_idx) % total_pockets

    @classmethod
    def process_spin_entry(
        cls,
        entry: LiveSpinInput,
        previous_entries: List[LiveSpinRecord],
        rules: GameRules,
    ) -> LiveSpinRecord:
        wheel_idx = cls.get_wheel_index(entry.pocket_number, rules)
        segment_idx = cls.get_pocket_segment(entry.pocket_number, rules)
        seq_order = entry.sequence_order or (len(previous_entries) + 1)
        
        offset = None
        if previous_entries:
            last_entry = previous_entries[-1]
            offset = cls.calculate_directional_offset(
                last_entry.pocket_number,
                entry.pocket_number,
                entry.direction,
                rules,
            )

        return LiveSpinRecord(
            id=str(uuid.uuid4()),
            pocket_number=entry.pocket_number,
            direction=entry.direction,
            sequence_order=seq_order,
            entered_at=datetime.now(timezone.utc).isoformat(),
            segment_index=segment_idx,
            wheel_index=wheel_idx,
            offset_from_previous=offset,
        )

    @classmethod
    def compute_session_analytics(
        cls,
        entries: List[LiveSpinRecord],
        rules: GameRules,
    ) -> LiveSessionAnalytics:
        seq = cls.get_wheel_sequence(rules)
        total_pockets = len(seq)
        segments = cls.get_wheel_segments(rules)
        total_spins = len(entries)

        # Straight frequency
        straight_freq: Dict[str, int] = {str(p): 0 for p in seq}
        for e in entries:
            p_str = str(e.pocket_number)
            straight_freq[p_str] = straight_freq.get(p_str, 0) + 1

        # Rolling hot/cold (based on all or last 20)
        sorted_pockets = sorted(seq, key=lambda p: straight_freq.get(str(p), 0), reverse=True)
        rolling_hot = sorted_pockets[:5]
        rolling_cold = sorted_pockets[-5:]

        # 6 Segments Statistics
        segment_counts = {i + 1: 0 for i in range(6)}
        for e in entries:
            segment_counts[e.segment_index] = segment_counts.get(e.segment_index, 0) + 1

        segment_stats: List[SegmentStat] = []
        highest_z = -999.0
        best_segment = 1

        for i, seg_pockets in enumerate(segments):
            seg_idx = i + 1
            hit_cnt = segment_counts[seg_idx]
            hit_pct = (hit_cnt / total_spins * 100) if total_spins > 0 else 0.0
            
            p_expected = len(seg_pockets) / total_pockets
            if total_spins > 0:
                expected_hits = total_spins * p_expected
                std_dev = math.sqrt(total_spins * p_expected * (1.0 - p_expected))
                z = (hit_cnt - expected_hits) / (std_dev if std_dev > 0 else 1.0)
            else:
                z = 0.0

            if z > highest_z:
                highest_z = z
                best_segment = seg_idx

            segment_stats.append(SegmentStat(
                segment_index=seg_idx,
                pocket_count=len(seg_pockets),
                pockets=seg_pockets,
                hit_count=hit_cnt,
                hit_percentage=round(hit_pct, 2),
                z_score=round(z, 2),
            ))

        # Direction-aware offset distribution & dominant offset
        offset_dist: Dict[int, int] = {}
        for e in entries:
            if e.offset_from_previous is not None:
                offset_dist[e.offset_from_previous] = offset_dist.get(e.offset_from_previous, 0) + 1

        dominant_offset = None
        if offset_dist:
            dominant_offset = max(offset_dist.keys(), key=lambda k: offset_dist[k])

        # Prediction engine
        prediction = None
        if total_spins >= 3:
            # Segment confidence score calibrated from Z-score and sample size
            # 50% baseline for random, climbing towards 95% for pronounced clustering
            confidence_factor = 1.0 / (1.0 + math.exp(-highest_z * 0.8))  # Sigmoid scaling
            sample_weight = min(total_spins / 25.0, 1.0)  # Weights up to 25 spins
            confidence_score = round((0.40 + 0.55 * confidence_factor * sample_weight) * 100, 1)

            last_entry = entries[-1]
            last_wheel_idx = last_entry.wheel_index
            target_offset = dominant_offset if dominant_offset is not None else 0

            # Projected landing index using dominant offset in next expected direction
            # If next spin alternates direction, apply in that direction
            next_direction = "ccw" if last_entry.direction == "cw" else "cw"
            if next_direction == "cw":
                target_idx = (last_wheel_idx + target_offset) % total_pockets
            else:
                target_idx = (last_wheel_idx - target_offset) % total_pockets

            # Top numbers: target pocket plus 6 adjacent pockets on either side (13 total)
            top_numbers = [seq[(target_idx + i) % total_pockets] for i in range(-6, 7)]

            target_segment = cls.get_pocket_segment(seq[target_idx], rules)

            prediction = SectorPrediction(
                predicted_segment=target_segment,
                confidence_score=confidence_score,
                top_numbers=top_numbers,
                dominant_offset=dominant_offset,
                rationale=(
                    f"Segment {target_segment} displays clustering (Z={highest_z:.2f}) "
                    f"with dominant directional drop offset of {dominant_offset} pockets."
                ),
            )

        return LiveSessionAnalytics(
            total_spins=total_spins,
            straight_frequency=straight_freq,
            rolling_hot=rolling_hot,
            rolling_cold=rolling_cold,
            segment_stats=segment_stats,
            offset_distribution=offset_dist,
            dominant_offset=dominant_offset,
            prediction=prediction,
            recent_spins=[e.pocket_number for e in reversed(entries)],
        )

tracker_service = TrackerService()
