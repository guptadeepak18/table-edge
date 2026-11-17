import asyncio
import json
import sys
from websockets.asyncio.client import connect

DGA_WS_URL = "wss://dga-lc.pragmaticplaylive.net/ws"
USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
)

async def probe(casino_id: str):
    headers = [
        ("User-Agent", USER_AGENT),
        ("Origin", "https://pragmaticplaylive.net"),
    ]
    
    print(f"Connecting to Pragmatic DGA with casinoId={casino_id}...")
    try:
        async with connect(DGA_WS_URL, additional_headers=headers) as ws:
            print("Connected! Sending initial subscription without keys to discover catalog...")
            # Pragmatic DGA usually returns catalog if key is empty or '*' or standard keys
            payload = {
                "type": "subscribe",
                "isDeltaEnabled": True,
                "key": [],
                "casinoId": casino_id,
                "currency": "USD"
            }
            await ws.send(json.dumps(payload))
            
            # Also send a test for known roulette keys and blackjack/baccarat keys
            test_keys = ["201", "203", "204", "206", "208", "210", "225", "238", "240", "101", "301", "401"]
            payload_keys = {
                "type": "subscribe",
                "isDeltaEnabled": True,
                "key": test_keys,
                "casinoId": casino_id,
                "currency": "USD"
            }
            await ws.send(json.dumps(payload_keys))
            
            tables_received = {}
            raw_frames = []
            
            start_time = asyncio.get_event_loop().time()
            while asyncio.get_event_loop().time() - start_time < 12:
                try:
                    msg = await asyncio.wait_for(ws.recv(), timeout=4.0)
                    data = json.loads(msg)
                    raw_frames.append(data)
                    
                    items = data if isinstance(data, list) else [data]
                    for item in items:
                        if "error" in item:
                            print(f"[ERROR]: {item['error']}")
                        if "tableKey" in item:
                            print(f"[CATALOG FOUND]: Received {len(item['tableKey'])} table keys: {item['tableKey'][:20]}...")
                            # Subscribe to discovered keys in batches
                            all_discovered = [str(k) for k in item['tableKey']]
                            sub_all = {
                                "type": "subscribe",
                                "isDeltaEnabled": True,
                                "key": all_discovered[:50], # first 50
                                "casinoId": casino_id,
                                "currency": "USD"
                            }
                            await ws.send(json.dumps(sub_all))
                            
                        t_id = item.get("tableId") or item.get("id")
                        if t_id:
                            tables_received[str(t_id)] = item
                            print(f"-> Table {t_id}: name={item.get('tableName')}, type={item.get('tableType')}, dealer={item.get('dealer')}, results_count={len(item.get('last20Results') or [])}")
                except asyncio.TimeoutError:
                    print("Timeout waiting for more frames.")
                    break
                except Exception as e:
                    print(f"Exception during receive: {e}")
                    break
                    
            print(f"\n--- PROBE SUMMARY for casinoId={casino_id} ---")
            print(f"Total unique tables parsed: {len(tables_received)}")
            print(f"Total raw frames received: {len(raw_frames)}")
            
            if tables_received:
                sample_id = next(iter(tables_received))
                print(f"\nSample Table Object ({sample_id}):")
                print(json.dumps(tables_received[sample_id], indent=2))
            else:
                print("\nRaw responses received:")
                for i, f in enumerate(raw_frames[:5]):
                    print(f"Frame {i}: {json.dumps(f)[:300]}...")
                    
    except Exception as e:
        print(f"Failed to connect or probe: {e}")

if __name__ == "__main__":
    cid = sys.argv[1] if len(sys.argv) > 1 else "ppcwm00000006838"
    asyncio.run(probe(cid))
