import pytest
from collections import Counter
from app.services.rng_service import rng_service

def test_rng_service_eur_range_and_colors():
    counts = Counter()
    for _ in range(1000):
        pocket, color, method, seed_hash, ts = rng_service.generate_spin("EUR")
        assert isinstance(pocket, int)
        assert 0 <= pocket <= 36
        assert color in ["red", "black", "green"]
        assert method == "secrets.randbelow"
        assert len(seed_hash) == 64
        counts[pocket] += 1
    
    # Check that multiple pockets hit
    assert len(counts) > 25

def test_rng_service_usa_includes_double_zero():
    hit_double_zero = False
    for _ in range(2000):
        pocket, color, method, seed_hash, ts = rng_service.generate_spin("USA")
        if pocket == "00":
            hit_double_zero = True
            assert color == "green"
        else:
            assert isinstance(pocket, int)
            assert 0 <= pocket <= 36
    assert hit_double_zero, "Expected '00' to appear in 2000 USA spins"
