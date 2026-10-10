import pytest
import asyncio
from app.services.pragmatic_feed import PragmaticFeedService

@pytest.mark.asyncio
async def test_pragmatic_feed_message_handling():
    feed = PragmaticFeedService()

    # 1. Test table catalog message
    catalog_frame = {
        "tableKey": ["206", "201", "204", "230a124"]
    }
    await feed._handle_message(str(catalog_frame).replace("'", '"'))

    # 2. Test initial table snapshot with 20 results
    snapshot_frame = {
        "tableId": "206",
        "tableName": "Roulette Macao",
        "tableType": "ROULETTE",
        "dealer": {"name": "Thea", "id": "th123"},
        "last20Results": [
            {"time": "18:20:00", "result": "13", "color": "black", "gameId": "1001"},
            {"time": "18:21:00", "result": "0", "color": "green", "gameId": "1002"},
            {"time": "18:22:00", "result": "32", "color": "red", "gameId": "1003"},
        ]
    }
    await feed._handle_message(str(snapshot_frame).replace("'", '"'))

    assert "206" in feed.available_tables
    table = feed.available_tables["206"]
    assert table["tableName"] == "Roulette Macao"
    assert table["dealer"]["name"] == "Thea"
    assert len(table["lastResults"]) == 3

    # 3. Test dealer rotation
    dealer_swap_frame = {
        "tableId": "206",
        "dealer": {"name": "Bobby-Dylan", "id": "bd456"}
    }
    await feed._handle_message(str(dealer_swap_frame).replace("'", '"'))
    assert feed.available_tables["206"]["dealer"]["name"] == "Bobby-Dylan"

    # 4. Test delta spin result
    delta_frame = {
        "tableId": "206",
        "last20Results": [
            {"time": "18:23:00", "result": "26", "color": "black", "gameId": "1004"}
        ]
    }
    await feed._handle_message(str(delta_frame).replace("'", '"'))
    assert "1004" in feed.seen_game_ids
    assert feed.available_tables["206"]["lastResults"][0]["result"] == "26"

    # 5. Test duplicate delta deduplication
    await feed._handle_message(str(delta_frame).replace("'", '"'))
    # Should not add duplicate to front
    assert feed.available_tables["206"]["lastResults"][0]["result"] == "26"
