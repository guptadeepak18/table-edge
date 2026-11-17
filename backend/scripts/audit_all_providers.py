import asyncio
import json
from websockets.asyncio.client import connect

DGA_WS_URL = "wss://dga-lc.pragmaticplaylive.net/ws"
USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
)

# Comprehensive list of test keys
ROULETTE_KEYS = [
    "201", "203", "204", "206", "208", "210", "212", "214", "216", "219",
    "221", "222", "223", "224", "225", "226", "227", "228", "229", "230",
    "231", "232", "233", "234", "235", "236", "237", "238", "239", "240",
    "241", "242", "243", "244", "245", "246", "247", "248", "249", "250",
    "225a117", "226a98", "230a124", "2244"
]

BLACKJACK_KEYS = [f"3{i:02d}" for i in range(1, 26)] + ["601", "602", "603", "901"]
BACCARAT_KEYS = [f"4{i:02d}" for i in range(1, 16)]
GAMESHOW_KEYS = ["701", "801", "501", "502"]

ALL_KEYS = ROULETTE_KEYS + BLACKJACK_KEYS + BACCARAT_KEYS + GAMESHOW_KEYS

PROVIDERS = [
    {"name": "Stake", "id": "ppcds00000003709"},
    {"name": "Shuffle", "id": "ppcwm00000006838"},
    {"name": "Pragmatic Direct (Legacy)", "id": "ppcdk00000003716"},
]

async def query_provider(provider):
    pname = provider["name"]
    cid = provider["id"]
    tables = {}
    headers = [
        ("User-Agent", USER_AGENT),
        ("Origin", "https://pragmaticplaylive.net"),
    ]
    try:
        async with connect(DGA_WS_URL, additional_headers=headers) as ws:
            # Send in batches
            batch_size = 40
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

            start = asyncio.get_event_loop().time()
            while asyncio.get_event_loop().time() - start < 5.0:
                try:
                    msg = await asyncio.wait_for(ws.recv(), timeout=2.0)
                    data = json.loads(msg)
                    items = data if isinstance(data, list) else [data]
                    for it in items:
                        t_id = it.get("tableId") or it.get("id")
                        if not t_id or "error" in it:
                            continue
                        str_id = str(t_id)
                        if str_id not in tables:
                            tables[str_id] = {
                                "id": str_id,
                                "name": it.get("tableName"),
                                "type": it.get("tableType"),
                                "dealer": (it.get("dealer") or {}).get("name") if isinstance(it.get("dealer"), dict) else "Auto",
                                "open": it.get("tableOpen", True),
                                "spins": len(it.get("last20Results") or []),
                            }
                        else:
                            if it.get("tableName"): tables[str_id]["name"] = it.get("tableName")
                            if it.get("tableType"): tables[str_id]["type"] = it.get("tableType")
                            if it.get("dealer") and isinstance(it.get("dealer"), dict): 
                                tables[str_id]["dealer"] = it["dealer"].get("name")
                            if it.get("last20Results") and len(it["last20Results"]) > 1:
                                tables[str_id]["spins"] = len(it["last20Results"])
                except asyncio.TimeoutError:
                    break
    except Exception as e:
        print(f"Error querying {pname}: {e}")
    return pname, cid, tables

async def main():
    print("Auditing active tables across Stake, Shuffle, and Pragmatic Direct...")
    results = await asyncio.gather(*(query_provider(p) for p in PROVIDERS))
    
    # Aggregate data
    all_tables = {} # id -> {info, providers: []}
    provider_counts = {}
    
    for pname, cid, tables in results:
        provider_counts[pname] = len(tables)
        for tid, tinfo in tables.items():
            if tid not in all_tables:
                all_tables[tid] = {
                    "id": tid,
                    "name": tinfo["name"] or f"Table {tid}",
                    "type": tinfo["type"] or "ROULETTE",
                    "dealer": tinfo["dealer"],
                    "open": tinfo["open"],
                    "spins": tinfo["spins"],
                    "providers": [pname]
                }
            else:
                all_tables[tid]["providers"].append(pname)
                if tinfo["name"] and not all_tables[tid]["name"]:
                    all_tables[tid]["name"] = tinfo["name"]

    print("\n" + "=" * 80)
    print("📊 MULTI-PROVIDER AGGREGATION AUDIT")
    print("=" * 80)
    for p, c in provider_counts.items():
        print(f"  • {p:<25} : {c} accessible tables")
    print(f"  👉 TOTAL UNIQUE ACTIVE TABLES ACROSS FEED: {len(all_tables)}")

    # Group by Game Type
    by_type = {}
    for tid, t in all_tables.items():
        by_type.setdefault(t["type"], []).append(t)

    summary_file_data = {
        "provider_counts": provider_counts,
        "total_unique_tables": len(all_tables),
        "by_type": {}
    }

    for ttype, tlist in sorted(by_type.items()):
        print(f"\n--- {ttype} ({len(tlist)} Tables) ---")
        summary_file_data["by_type"][ttype] = []
        for t in sorted(tlist, key=lambda x: str(x['id'])):
            prov_str = ", ".join(t['providers'])
            status_str = "🟢 Live" if t['open'] else "🔴 Closed"
            print(f"  [{t['id']:>8}] {t['name']:<32} | {prov_str:<25} | Dealer: {t['dealer']:<16} | {status_str}")
            summary_file_data["by_type"][ttype].append({
                "id": t["id"],
                "name": t["name"],
                "providers": t["providers"],
                "dealer": t["dealer"],
                "status": "Live" if t["open"] else "Closed",
                "spins_captured": t["spins"]
            })

    with open("d:/Applications/table-edge/backend/scripts/live_tables_audit.json", "w") as f:
        json.dump(summary_file_data, f, indent=2)
    print("\nFull audit report saved to backend/scripts/live_tables_audit.json")

if __name__ == "__main__":
    asyncio.run(main())
