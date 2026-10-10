import pytest
from app.services.tracker_service import tracker_service
from app.schemas.tracker import LiveSpinInput

def test_six_segment_division():
    # Pocket 0 must be in Segment 1
    assert tracker_service.get_pocket_segment(0, "EUR") == 1
    assert tracker_service.get_pocket_segment(0, "USA") == 1

    # Check EUR wheel segments count
    segments = tracker_service.get_wheel_segments("EUR")
    assert len(segments) == 6
    total_pockets = sum(len(s) for s in segments)
    assert total_pockets == 37

    # Check USA wheel segments count
    usa_segments = tracker_service.get_wheel_segments("USA")
    assert len(usa_segments) == 6
    assert sum(len(s) for s in usa_segments) == 38

def test_directional_offset():
    # EUR canonical sequence: 0, 32, 15, 19, 4 ...
    # 0 is idx 0, 32 is idx 1, 15 is idx 2
    # From 0 to 32 clockwise: (1 - 0) % 37 = 1
    offset_cw = tracker_service.calculate_directional_offset(0, 32, "cw", "EUR")
    assert offset_cw == 1

    # From 0 to 32 anticlockwise: (0 - 1) % 37 = 36
    offset_ccw = tracker_service.calculate_directional_offset(0, 32, "ccw", "EUR")
    assert offset_ccw == 36

def test_session_analytics_and_prediction():
    # Simulate spins with consistent 10-pocket CW offset
    seq = tracker_service.get_wheel_sequence("EUR")
    entries = []
    
    current_idx = 0
    for i in range(10):
        pocket = seq[current_idx]
        record = tracker_service.process_spin_entry(
            LiveSpinInput(pocket_number=pocket, direction="cw"),
            entries,
            "EUR"
        )
        entries.append(record)
        current_idx = (current_idx + 10) % 37

    analytics = tracker_service.compute_session_analytics(entries, "EUR")
    assert analytics.total_spins == 10
    assert analytics.dominant_offset == 10
    assert analytics.prediction is not None
    assert 50 <= analytics.prediction.confidence_score <= 100
    assert len(analytics.prediction.top_numbers) == 13
    assert 1 <= analytics.prediction.predicted_segment <= 6
