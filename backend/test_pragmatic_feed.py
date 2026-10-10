"""
Test runner script for Pragmatic Play Live DGA Feed.

Usage:
    python test_pragmatic_feed.py [--casino-id <id>] [--keys <key1,key2...>]

Example:
    python test_pragmatic_feed.py --casino-id ppcdk00000003716 --keys 206,201,204
"""

import sys
import asyncio
import json
import argparse
from datetime import datetime
import websockets
from websockets.asyncio.client import connect

DGA_WS_URL = "wss://dga-lc.pragmaticplaylive.net/ws"
USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"

async def run_feed(casino_id: str = None, table_keys: list = None):
    print("=" * 70)
    print("🚀 TableEdge — Pragmatic Play Live Dealer Tracker Ingest Engine")
    print(f"Connecting to: {DGA_WS_URL}")
    print(f"Casino ID:     {casino_id or '(none)'}")
    print(f"Target Keys:   {table_keys or ['206 (Roulette Macao)']}")
    print("=" * 70)

    headers = [
        ("User-Agent", USER_AGENT),
        ("Origin", "https://pragmaticplaylive.net"),
    ]

    async with connect(DGA_WS_URL, additional_headers=headers) as ws:
        print("✅ WebSocket Connection Established!")

        sub_keys = table_keys or ["206"]
        sub_msg = {
            "type": "subscribe",
            "isDeltaEnabled": True,
            "key": sub_keys,
            "currency": "USD"
        }
        if casino_id:
            sub_msg["casinoId"] = casino_id

        print(f"📡 Sending Subscription Frame: {json.dumps(sub_msg)}")
        await ws.send(json.dumps(sub_msg))
        print("Listening for incoming frames... (Press Ctrl+C to stop)\n")

        async for raw_message in ws:
            try:
                data = json.loads(raw_message)
            except Exception as e:
                print("Raw Non-JSON Message:", raw_message)
                continue

            items = data if isinstance(data, list) else [data]

            for item in items:
                if "error" in item:
                    print(f"❌ [SERVER ERROR] {item['error']}")
                    continue

                if "tableKey" in item:
                    keys = item["tableKey"]
                    print(f"📋 [LOBBY CATALOG] Received {len(keys)} active table keys on the network!")
                    print(f"   Sample keys: {keys[:15]}...")
                    continue

                table_id = item.get("tableId") or item.get("id")
                table_name = item.get("tableName", f"Table {table_id}")
                dealer = item.get("dealer")
                results = item.get("last20Results")

                # Dealer update
                if dealer:
                    name = dealer.get("name") or dealer.get("value")
                    dealer_id = dealer.get("id")
                    print(f"👤 [DEALER ROTATION] Table [{table_id} - {table_name}] Dealer: {name} (ID: {dealer_id})")

                # Results / Spins
                if results and isinstance(results, list):
                    if len(results) > 1:
                        print(f"📊 [INITIAL 20-SPIN SNAPSHOT] Table [{table_id} - {table_name}] ({len(results)} historical spins):")
                        spins_str = " -> ".join([f"{s.get('result')}({s.get('color', '')[0].upper() if s.get('color') else '?'})" for s in reversed(results[-10:])])
                        print(f"   Last 10: {spins_str}")
                    elif len(results) == 1:
                        spin = results[0]
                        res = spin.get("result")
                        color = spin.get("color")
                        time_str = spin.get("time")
                        game_id = spin.get("gameId")
                        print(f"🎯 [NEW LIVE SPIN DELTA] Table [{table_id}] Winning Pocket: {res} | Color: {color} | Time: {time_str} | Round: {game_id}")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Pragmatic Play Live DGA Feed Ingestion Test")
    parser.add_argument("--casino-id", type=str, default=None, help="Casino ID captured from DevTools inspect")
    parser.add_argument("--keys", type=str, default="206", help="Comma-separated table keys (e.g. 206,201)")
    args = parser.parse_args()

    keys = [k.strip() for k in args.keys.split(",") if k.strip()]
    try:
        asyncio.run(run_feed(args.casino_id, keys))
    except KeyboardInterrupt:
        print("\nFeed stopped by user.")
