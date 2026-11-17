import asyncio
import json
import sys
from websockets.asyncio.client import connect

DGA_WS_URL = "wss://dga-lc.pragmaticplaylive.net/ws"
USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
)

# Standard roulette keys + Stake exclusive / special keys
ROULETTE_KEYS = [
    "201", "203", "204", "206", "208", "210", "212", "214", "216", "219",
    "221", "222", "223", "224", "225", "226", "227", "228", "229", "230",
    "231", "232", "233", "234", "235", "236", "237", "238", "239", "240",
    "241", "242", "243", "244", "245", "246", "247", "248", "249", "250",
    "225a117", "226a98", "230a124",
    # Specific Stake / custom table IDs
    "gatesofolympus01", "gatesofolympusroulette", "2244", "102"
]

BLACKJACK_KEYS = [f"3{i:02d}" for i in range(1, 26)] + ["601", "602", "603", "901"]
BACCARAT_KEYS = [f"4{i:02d}" for i in range(1, 16)]
GAMESHOW_KEYS = ["701", "801", "501", "502"]

ALL_KEYS = ROULETTE_KEYS + BLACKJACK_KEYS + BACCARAT_KEYS + GAMESHOW_KEYS

async def probe_id(cid: str):
    headers = [
        ("User-Agent", USER_AGENT),
        ("Origin", "https://pragmaticplaylive.net"),
    ]
    print(f"\n{'='*70}\nTesting casinoId: {cid}\n{'='*70}")
    try:
        async with connect(DGA_WS_URL, additional_headers=headers) as ws:
            # 1. First probe without keys to check if server sends full catalog
            await ws.send(json.dumps({
                "type": "subscribe",
                "isDeltaEnabled": True,
                "key": [],
                "casinoId": cid,
                "currency": "USD"
            }))
            
            # 2. Subscribe to all candidate keys in batches
            batch_size = 35
            for i in range(0, len(ALL_KEYS), batch_size):
                batch = ALL_KEYS[i:i + batch_size]
                await ws.send(json.dumps({
                    "type": "subscribe",
                    "isDeltaEnabled": True,
                    "key": batch,
                    "casinoId": cid,
                    "currency": "USD"
                }))
                await asyncio.sleep(0.05)

            tables = {}
            unsupported = []
            deltas = 0
            catalog_keys = []
            
            start = asyncio.get_event_loop().time()
            while asyncio.get_event_loop().time() - start < 7.0:
                try:
                    msg = await asyncio.wait_for(ws.recv(), timeout=2.5)
                    data = json.loads(msg)
                    items = data if isinstance(data, list) else [data]
                    for it in items:
                        if "error" in it:
                            unsupported.append(it["error"])
                        if "tableKey" in it:
                            catalog_keys = it["tableKey"]
                        t_id = it.get("tableId") or it.get("id")
                        if not t_id:
                            continue
                        str_id = str(t_id)
                        if str_id not in tables:
                            tables[str_id] = {
                                "id": str_id,
                                "name": it.get("tableName"),
                                "type": it.get("tableType"),
                                "dealer": (it.get("dealer") or {}).get("name") if isinstance(it.get("dealer"), dict) else None,
                                "spins": len(it.get("last20Results") or []),
                                "sampleSpin": (it.get("last20Results") or [None])[0]
                            }
                        else:
                            if it.get("tableName"): tables[str_id]["name"] = it.get("tableName")
                            if it.get("tableType"): tables[str_id]["type"] = it.get("tableType")
                            if it.get("dealer") and isinstance(it.get("dealer"), dict): 
                                tables[str_id]["dealer"] = it["dealer"].get("name")
                            if it.get("last20Results"):
                                if len(it["last20Results"]) == 1:
                                    deltas += 1
                                elif len(it["last20Results"]) > 1:
                                    tables[str_id]["spins"] = len(it["last20Results"])
                                    tables[str_id]["sampleSpin"] = it["last20Results"][0]
                except asyncio.TimeoutError:
                    break
                except Exception as e:
                    print(f"Error: {e}")
                    break

            print(f"Active Tables Found: {len(tables)}")
            print(f"Live Deltas in 7s:   {deltas}")
            print(f"Unsupported Errors:  {len(unsupported)}")
            if catalog_keys:
                print(f"Catalog broadcast keys: {len(catalog_keys)}")

            by_type = {}
            for t in tables.values():
                by_type.setdefault(t.get("type") or "UNKNOWN", []).append(t)
            
            for ttype, tlist in by_type.items():
                print(f"\n  [{ttype}] ({len(tlist)} tables):")
                for t in sorted(tlist, key=lambda x: str(x['id'])):
                    print(f"    - {t['id']:<15} | {t['name'] or 'Unnamed':<30} | Dealer: {t['dealer'] or 'Auto':<15} | Spins: {t['spins']}")
                    
            if "gatesofolympus01" in tables or any("olympus" in str(t.get("name", "")).lower() for t in tables.values()):
                print("\n  🌟 FOUND GATES OF OLYMPUS ROULETTE!")

    except Exception as e:
        print(f"Connection failed for {cid}: {e}")

async def main():
    test_ids = ["ppcds00000003709", "ppc1735417293931"]
    for cid in test_ids:
        await probe_id(cid)

if __name__ == "__main__":
    asyncio.run(main())
