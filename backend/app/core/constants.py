"""Canonical Roulette Constants for TableEdge."""

EUR_WHEEL_SEQUENCE = [
    0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5,
    24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26
]

USA_WHEEL_SEQUENCE = [
    0, 28, 9, 26, 30, 11, 7, 20, 32, 17, 5, 22, 34, 15, 3, 24, 36, 13, 1, "00",
    27, 10, 25, 29, 12, 8, 19, 31, 18, 6, 21, 33, 16, 4, 23, 35, 14, 2
]

RED_NUMBERS = {1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36}
BLACK_NUMBERS = {2, 4, 6, 8, 10, 11, 13, 15, 17, 20, 22, 24, 26, 28, 29, 31, 33, 35}

# 6 Segments Partitioning starting at 0:
# EUR (37 pockets): 5 segments of 6, 1 segment of 7
EUR_SEGMENTS = [
    EUR_WHEEL_SEQUENCE[0:6],    # Seg 1: 0, 32, 15, 19, 4, 21
    EUR_WHEEL_SEQUENCE[6:12],   # Seg 2: 2, 25, 17, 34, 6, 27
    EUR_WHEEL_SEQUENCE[12:18],  # Seg 3: 13, 36, 11, 30, 8, 23
    EUR_WHEEL_SEQUENCE[18:24],  # Seg 4: 10, 5, 24, 16, 33, 1
    EUR_WHEEL_SEQUENCE[24:30],  # Seg 5: 20, 14, 31, 9, 22, 18
    EUR_WHEEL_SEQUENCE[30:37],  # Seg 6: 29, 7, 28, 12, 35, 3, 26 (7 pockets)
]

# USA (38 pockets): 6, 6, 7, 6, 6, 7
USA_SEGMENTS = [
    USA_WHEEL_SEQUENCE[0:6],    # Seg 1: 0, 28, 9, 26, 30, 11
    USA_WHEEL_SEQUENCE[6:12],   # Seg 2: 7, 20, 32, 17, 5, 22
    USA_WHEEL_SEQUENCE[12:19],  # Seg 3: 34, 15, 3, 24, 36, 13, 1 (7 pockets)
    USA_WHEEL_SEQUENCE[19:25],  # Seg 4: '00', 27, 10, 25, 29, 12
    USA_WHEEL_SEQUENCE[25:31],  # Seg 5: 8, 19, 31, 18, 6, 21
    USA_WHEEL_SEQUENCE[31:38],  # Seg 6: 33, 16, 4, 23, 35, 14, 2 (7 pockets)
]

BET_PAYOUT_MULTIPLIERS = {
    "straight": 35,
    "single": 35,
    "split": 17,
    "street": 11,
    "trio": 11,
    "corner": 8,
    "square": 8,
    "basket": 8,
    "first_four": 8,
    "first_five": 6,
    "sixline": 5,
    "line": 5,
    "double_street": 5,
    "dozen": 2,
    "dozen_1": 2,
    "dozen_2": 2,
    "dozen_3": 2,
    "doz1": 2,
    "doz2": 2,
    "doz3": 2,
    "doz_1": 2,
    "doz_2": 2,
    "doz_3": 2,
    "1st 12": 2,
    "2nd 12": 2,
    "3rd 12": 2,
    "first_twelve": 2,
    "second_twelve": 2,
    "third_twelve": 2,
    "column": 2,
    "column_1": 2,
    "column_2": 2,
    "column_3": 2,
    "col_1": 2,
    "col_2": 2,
    "col_3": 2,
    "col1": 2,
    "col2": 2,
    "col3": 2,
    "outside_red": 1,
    "outside_black": 1,
    "outside_even": 1,
    "outside_odd": 1,
    "outside_low": 1,
    "outside_high": 1,
    "red": 1,
    "black": 1,
    "even": 1,
    "odd": 1,
    "low": 1,
    "high": 1,
}

THEORETICAL_HOUSE_EDGE = {
    "EUR": 0.027027,  # 1/37 = 2.7027%
    "USA": 0.052632,  # 2/38 = 5.2632%
}
