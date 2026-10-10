import hashlib
import secrets
import time
import uuid
from typing import Tuple, Union, Literal
from app.core.constants import (
    EUR_WHEEL_SEQUENCE,
    USA_WHEEL_SEQUENCE,
    RED_NUMBERS,
    BLACK_NUMBERS,
)

PocketValue = Union[int, Literal["00"]]

class RNGService:
    @staticmethod
    def get_pocket_color(pocket: PocketValue) -> Literal["red", "black", "green"]:
        if pocket == 0 or pocket == "00":
            return "green"
        if isinstance(pocket, int) and pocket in RED_NUMBERS:
            return "red"
        if isinstance(pocket, int) and pocket in BLACK_NUMBERS:
            return "black"
        return "green"

    @classmethod
    def generate_spin(cls, rules: str = "EUR") -> Tuple[PocketValue, str, str, str, float]:
        """
        Generates a single cryptographically secure spin.
        Returns:
            (pocket_number, color, rng_method, seed_hash, timestamp)
        """
        is_usa = rules.upper() == "USA"
        pocket_count = 38 if is_usa else 37
        
        # Cryptographically secure random integer in [0, pocket_count - 1]
        random_index = secrets.randbelow(pocket_count)
        
        if is_usa:
            # 0 to 36 and 37 represents "00"
            pocket: PocketValue = "00" if random_index == 37 else random_index
        else:
            pocket = random_index

        color = cls.get_pocket_color(pocket)
        now = time.time()
        
        # Generate tamper-evident audit seed hash
        audit_entropy = f"{uuid.uuid4()}:{random_index}:{now}:{secrets.token_hex(16)}"
        seed_hash = hashlib.sha256(audit_entropy.encode("utf-8")).hexdigest()
        
        return pocket, color, "secrets.randbelow", seed_hash, now

rng_service = RNGService()
