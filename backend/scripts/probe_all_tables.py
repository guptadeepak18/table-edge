import asyncio
import json
import sys
from websockets.asyncio.client import connect

DGA_WS_URL = "wss://dga-lc.pragmaticplaylive.net/ws"
USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
)

# Canonical list of roulette keys from pragmatic_feed.py
ROULETTE_KEYS = [
    "201", "203", "204", "206", "208", "210", "212", "214", "216", "219",
    "221", "222", "223", "224", "225", "226", "227", "228", "229", "230",
    "231", "232", "233", "234", "235", "236", "237", "238", "239", "240",
    "241", "242", "243", "244", "245", "246", "247", "248", "249", "250",
    "225a117"
]

# Blackjack & Baccarat & Game Show keys
OTHER_KEYS = [
    f"3{i:02d}" for i in range(1, 26)  # 301 - 325 (Blackjack)
] + [
    f"4{i:02d}" for i in range(1, 20)  # 401 - 419 (Baccarat)
] + [
    "501", "502", "503", "504", "505",  # Game Shows (Mega Wheel, Sweet Bonanza, etc.)
    "601", "602", "603",
    "701", "702", "801", "802", "901"
]

ALL_TEST_KEYS = ROULETTE_KEYS + OTHER_KEYS

async def probe_all(casino_id: str):
    headers = [
        ("User-Agent", USER_AGENT),
        ("Origin", "https://pragmaticplaylive.net"),
    ]
    
    print(f"Connecting to Pragmatic DGA with casinoId={casino_id}...")
    try:
        async with connect(DGA_WS_URL, additional_headers=headers) as ws:
            print(f"Connected! Subscribing to {len(ALL_TEST_KEYS)} tables ({len(ROULETTE_KEYS)} Roulette, {len(OTHER_KEYS)} other games)...")
            
            # Send in batches of 40 keys to avoid payload overflow
            batch_size = 40
            for i in range(0, len(ALL_TEST_KEYS), batch_size):
                batch = ALL_TEST_KEYS[i:i + batch_size]
                payload = {
                    "type": "subscribe",
                    "isDeltaEnabled": True,
                    "key": batch,
                    "casinoId": casino_id,
                    "currency": "USD"
                }
                await ws.send(json.dumps(payload))
                await asyncio.sleep(0.1)

            tables = {}
            unsupported = []
            deltas_count = 0
            
            start_time = asyncio.get_event_loop().time()
            # Listen for 10 seconds to collect table descriptors and deltas
            while asyncio.get_event_loop().time() - start_time < 10.0:
                try:
                    msg = await asyncio.wait_for(ws.recv(), timeout=3.0)
                    data = json.loads(msg)
                    items = data if isinstance(data, list) else [data]
                    for item in items:
                        if "error" in item:
                            unsupported.append(item["error"])
                            continue
                        
                        t_id = item.get("tableId") or item.get("id")
                        if not t_id:
                            continue
                        
                        str_id = str(t_id)
                        if str_id not in tables:
                            tables[str_id] = {
                                "tableId": str_id,
                                "tableName": item.get("tableName"),
                                "tableType": item.get("tableType"),
                                "dealer": item.get("dealer"),
                                "hasResults": len(item.get("last20Results") or []) > 0,
                                "resultsCount": len(item.get("last20Results") or []),
                                "sampleSpin": (item.get("last20Results") or [None])[0],
                                "minBet": item.get("minBet"),
                                "maxBet": item.get("maxBet"),
                                "deltasReceived": 0,
                            }
                        else:
                            # Update with table details if previous was delta
                            if item.get("tableName"):
                                tables[str_id]["tableName"] = item.get("tableName")
                            if item.get("tableType"):
                                tables[str_id]["tableType"] = item.get("tableType")
                            if item.get("dealer"):
                                tables[str_id]["dealer"] = item.get("dealer")
                            if item.get("last20Results"):
                                count = len(item.get("last20Results"))
                                if count == 1:
                                    tables[str_id]["deltasReceived"] += 1
                                    deltas_count += 1
                                elif count > 1:
                                    tables[str_id]["resultsCount"] = count
                                    tables[str_id]["hasResults"] = True
                                    tables[str_id]["sampleSpin"] = item["last20Results"][0]
                except asyncio.TimeoutError:
                    break
                except Exception as e:
                    print(f"Receive error: {e}")
                    break

            print("\n" + "=" * 75)
            print(f"🎯 PROBE RESULTS SUMMARY FOR CASINO ID: {casino_id}")
            print("=" * 75)
            print(f"Total Unique Active Tables Found: {len(tables)}")
            print(f"Live Spin Deltas Captured in 10s: {deltas_count}")
            print(f"Unsupported Table Errors:        {len(unsupported)}")
            
            # Group by table type
            by_type = {}
            for t_id, t in tables.items():
                ttype = t.get("tableType") or "UNKNOWN"
                by_type.setdefault(ttype, []).append(t)
                
            for ttype, t_list in by_type.items():
                print(f"\n--- {ttype} ({len(t_list)} Tables) ---")
                for t in sorted(t_list, key=lambda x: str(x['tableId'])):
                    dealer_name = (t['dealer'] or {}).get('name', 'N/A') if isinstance(t['dealer'], dict) else 'N/A'
                    print(f"  [{t['tableId']:>8}] {t['tableName'] or 'Unnamed Table':<30} | Dealer: {dealer_name:<16} | Spins: {t['resultsCount']} | Deltas: {t['deltasReceived']}")

            if unsupported:
                print(f"\nSample Unsupported Errors (first 5): {unsupported[:5]}")
                
            # Print sample detailed payload for a roulette table and blackjack/baccarat table
            roulette_sample = next((t for t in tables.values() if t.get("tableType") == "ROULETTE" and t.get("sampleSpin")), None)
            if roulette_sample:
                print("\n" + "=" * 75)
                print(f"📊 Detailed Sample Spin Data Structure (Table {roulette_sample['tableId']} - {roulette_sample['tableName']}):")
                print("=" * 75)
                print(json.dumps(roulette_sample['sampleSpin'], indent=2))

    except Exception as e:
        print(f"Fatal connection error: {e}")

if __name__ == "__main__":
    cid = sys.argv[1] if len(sys.argv) > 1 else "ppcwm00000006838"
    asyncio.run(probe_all(cid))
