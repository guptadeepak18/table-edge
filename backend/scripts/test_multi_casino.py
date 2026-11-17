import asyncio
import json
from websockets.asyncio.client import connect

DGA_WS_URL = "wss://dga-lc.pragmaticplaylive.net/ws"
USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
)

async def test_multi_casino():
    headers = [
        ("User-Agent", USER_AGENT),
        ("Origin", "https://pragmaticplaylive.net"),
    ]
    
    casino_ids = ["ppcwm00000006838", "ppcdk00000003716"]
    
    print("Testing sending subscriptions for multiple casino IDs on single WebSocket...")
    try:
        async with connect(DGA_WS_URL, additional_headers=headers) as ws:
            for cid in casino_ids:
                payload = {
                    "type": "subscribe",
                    "isDeltaEnabled": True,
                    "key": ["201", "204", "206", "228"],
                    "casinoId": cid,
                    "currency": "USD"
                }
                print(f"Sending sub with casinoId={cid}...")
                await ws.send(json.dumps(payload))
                await asyncio.sleep(0.5)

            start = asyncio.get_event_loop().time()
            tables = set()
            errors = []
            while asyncio.get_event_loop().time() - start < 5:
                try:
                    msg = await asyncio.wait_for(ws.recv(), timeout=2.0)
                    data = json.loads(msg)
                    items = data if isinstance(data, list) else [data]
                    for it in items:
                        if "error" in it:
                            errors.append(it["error"])
                        t_id = it.get("tableId")
                        if t_id:
                            tables.add(f"{t_id} ({it.get('tableName')})")
                except asyncio.TimeoutError:
                    break
            print(f"Tables received: {tables}")
            print(f"Errors received: {errors}")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    asyncio.run(test_multi_casino())
