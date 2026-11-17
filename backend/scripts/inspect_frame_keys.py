import asyncio
import json
from websockets.asyncio.client import connect

async def inspect_raw_keys():
    headers = [
        ("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"),
        ("Origin", "https://pragmaticplaylive.net"),
    ]
    async with connect("wss://dga-lc.pragmaticplaylive.net/ws", additional_headers=headers) as ws:
        await ws.send(json.dumps({
            "type": "subscribe",
            "isDeltaEnabled": True,
            "key": ["201", "204", "2244", "225a117", "236"],
            "casinoId": "ppcds00000003709",
            "currency": "USD"
        }))
        for _ in range(5):
            msg = await ws.recv()
            data = json.loads(msg)
            items = data if isinstance(data, list) else [data]
            for it in items:
                print(f"Top-level keys in item: {list(it.keys())}")
                if "casinoId" in it or "casino" in it:
                    print("Found casino key:", it.get("casinoId") or it.get("casino"))
                break

if __name__ == "__main__":
    asyncio.run(inspect_raw_keys())
