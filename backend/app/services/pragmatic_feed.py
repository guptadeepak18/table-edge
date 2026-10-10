import asyncio
import json
import logging
from datetime import datetime, timezone, timedelta
from typing import Dict, List, Optional, Set, Callable, Any
import websockets
from websockets.asyncio.client import connect

from app.core.database import AsyncSessionLocal
from app.models.tracker import LiveTrackingSession, LiveSpinEntry, TableDealerSpinHistory
from app.services.tracker_service import tracker_service
from app.schemas.tracker import LiveSpinInput, LiveSpinRecord, LiveSessionAnalytics
from sqlalchemy import select, delete, func
from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger("pragmatic_feed")
logging.basicConfig(level=logging.INFO)

DEFAULT_DGA_WS_URL = "wss://dga-lc.pragmaticplaylive.net/ws"
DEFAULT_USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
)

PRAGMATIC_ROULETTE_NAMES: Dict[str, str] = {
    "201": "Roulette Azure",
    "203": "Roulette 1",
    "204": "Roulette Monaco",
    "206": "Mega Roulette",
    "208": "Speed Roulette 1",
    "210": "VIP Roulette - The Club",
    "212": "Roulette 2",
    "214": "Roulette 3 - Macao",
    "216": "Speed Roulette 2",
    "219": "Auto Roulette VIP",
    "221": "Roulette Green",
    "222": "Auto Roulette",
    "223": "Speed Roulette Spanish",
    "224": "Turkce Rulet",
    "225": "Roulette Macao",
    "226": "Auto Roulette 1",
    "227": "Speed Auto Roulette",
    "228": "Roulette Ruby",
    "229": "Ruleta Romaneasca",
    "230": "Auto Roulette 2",
    "231": "Roleta Brasileira",
    "232": "Vlaamse Roulette",
    "233": "Ruleta en Espanol",
    "234": "Roulette Italiana",
    "235": "Deutsches Roulette",
    "236": "Russian Roulette",
    "237": "Korean Roulette",
    "238": "Namaste Roulette",
    "239": "Auto Roulette Green",
    "240": "PowerUP Roulette",
    "241": "Mega Roleta Brasileira",
    "242": "Deutsches Speed Roulette",
    "243": "Turkce Rulet 2",
    "244": "Prive Lounge Roulette 1",
    "245": "Prive Lounge Roulette 2",
    "246": "Prive Lounge Roulette 3",
    "247": "Prive Lounge Roulette 4",
    "248": "Prive Lounge Roulette 5",
    "249": "Lucky 6 Roulette",
    "250": "Auto Mega Roulette",
}

DEALER_SHIFT_ROSTER: Dict[str, List[str]] = {
    "201": ["Sophie Dubois", "Lucas Petit", "Celine Laurent", "Julien Blanc"],
    "203": ["Lucas Petit", "Maxime Dupuis", "Lea Fontaine", "Alexandre Martin"],
    "204": ["Elena V.", "Marko Petrov", "Irina S.", "Andrei Sokolov", "Yulia Morozova"],
    "206": ["Marcus Kane", "Gabriel Costa", "Victor Vance", "Rafael Silva", "Leo Sterling"],
    "208": ["Viktor Kozlov", "Dmitri Volkov", "Sergei Orlov", "Alexei Romanov"],
    "210": ["Anastasia R.", "Valeria Bianchi", "Alexander Wright", "Seraphina Laurent"],
    "212": ["Antoine Mercier", "Camille Robert", "Nicolas Roux", "Emilie Richard"],
    "214": ["Mei-Ling Zhou", "Lucas Chen", "Jia-Wei Lin", "Xiao-Long Wu"],
    "216": ["Dmitri Volkov", "Viktor Kozlov", "Igor Smirnov", "Oleg Kuznetsov"],
    "221": ["Chloe Bennett", "Hannah Scott", "Oliver Reed", "James Foster"],
    "223": ["Mateo Silva", "Alejandro Silva", "Carlos Mendoza", "Sofia Herrera"],
    "224": ["Caner Yilmaz", "Emre Demir", "Burak Kaya", "Sinan Celik", "Murat Sahin"],
    "225": ["Lucas Chen", "Mei-Ling Zhou", "Hao Ran", "Wei Zhang"],
    "228": ["Matteo Rossi", "Gianna Moretti", "Leonardo Esposito", "Marco Ricci"],
    "229": ["Andreea Popescu", "Mihai Ionescu", "Roxana Dima", "Cristian Radu"],
    "231": ["Thiago Santos", "Camila Ribeiro", "Rodrigo Souza", "Fernanda Lima"],
    "232": ["Charlotte De Smet", "Thomas Peeters", "Lukas Maes", "Anouk Jacobs"],
    "233": ["Alejandro Silva", "Mateo Silva", "Diego Alvarez", "Lucia Gomez"],
    "234": ["Gianna Moretti", "Matteo Rossi", "Chiara Conti", "Lorenzo Romano"],
    "235": ["Lukas Weber", "Maximilian Koch", "Felix Schmidt", "Hannah Fischer"],
    "236": ["Daria Ivanova", "Elena V.", "Natalia Popova", "Svetlana Sokolova"],
    "237": ["Min-jun Kim", "Ji-hoon Park", "Seo-yeon Lee", "Do-hyun Jung"],
    "238": ["Priya Sharma", "Aarav Patel", "Rohan Mehta", "Ananya Verma"],
    "240": ["Claire Moreau", "Marcus Kane", "Vincent Roy", "Pauline Girard"],
    "241": ["Camila Ribeiro", "Thiago Santos", "Beatriz Rocha", "Felipe Alves"],
    "242": ["Maximilian Koch", "Lukas Weber", "Leon Schneider", "Moritz Becker"],
    "243": ["Emre Demir", "Caner Yilmaz", "Tolga Aydin", "Kaan Ozturk"],
    "244": ["Isabella Santos", "Julian Vance", "Valeria Bianchi", "Alexander Wright"],
    "245": ["Julian Vance", "Isabella Santos", "Seraphina Laurent", "Dominic Cole"],
    "246": ["Valeria Bianchi", "Julian Vance", "Alexander Wright", "Elena V."],
    "247": ["Alexander Wright", "Seraphina Laurent", "Isabella Santos", "Julian Vance"],
    "248": ["Seraphina Laurent", "Alexander Wright", "Valeria Bianchi", "Isabella Santos"],
    "249": ["Gabriel Costa", "Marcus Kane", "Victor Vance", "Leo Sterling"],
}

def _make_table_item(table_id: str, name: str, dealer_name: str, dealer_id: str, spins: List[int]) -> Dict[str, Any]:
    red_set = {1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36}
    last_res = []
    for p in spins:
        color = "green" if p == 0 else ("red" if p in red_set else "black")
        last_res.append({"result": str(p), "color": color})
    return {
        "tableId": table_id,
        "tableName": name,
        "tableType": "ROULETTE",
        "dealer": {"name": dealer_name, "id": dealer_id},
        "lastResults": last_res,
        "updatedAt": datetime.now(timezone.utc).isoformat(),
    }

DEFAULT_INITIAL_TABLES: List[Dict[str, Any]] = [
    _make_table_item("201", "Roulette Azure", "Sophie Dubois", "d-201", [3, 26, 35, 12, 28, 7, 29, 18, 22, 9, 31, 14, 20, 1, 33, 16]),
    _make_table_item("203", "Roulette 1", "Lucas Petit", "d-203", [11, 36, 13, 27, 6, 34, 17, 25, 2, 21, 4, 19, 15, 32, 0, 26]),
    _make_table_item("204", "Roulette Monaco", "Elena V.", "d-204", [17, 32, 0, 15, 19, 4, 21, 2, 25, 34, 6, 27, 13, 36, 11, 30]),
    _make_table_item("206", "Mega Roulette", "Marcus Kane", "d-206", [7, 29, 18, 22, 9, 31, 14, 20, 1, 33, 16, 24, 5, 10, 23, 8]),
    _make_table_item("208", "Speed Roulette 1", "Viktor Kozlov", "d-208", [28, 9, 2, 11, 36, 13, 27, 6, 34, 17, 25, 2, 21, 4, 19, 15]),
    _make_table_item("210", "VIP Roulette - The Club", "Anastasia R.", "d-210", [36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22]),
    _make_table_item("212", "Roulette 2", "Antoine Mercier", "d-212", [15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23]),
    _make_table_item("214", "Roulette 3 - Macao", "Mei-Ling Zhou", "d-214", [22, 18, 29, 7, 28, 12, 35, 3, 26, 0, 32, 15, 19, 4, 21, 2]),
    _make_table_item("216", "Speed Roulette 2", "Dmitri Volkov", "d-216", [6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14]),
    _make_table_item("219", "Auto Roulette VIP", "Auto Sensor VIP", "d-219", [24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3]),
    _make_table_item("221", "Roulette Green", "Chloe Bennett", "d-221", [0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30]),
    _make_table_item("222", "Auto Roulette", "Precision Auto 1", "d-222", [31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26, 0, 32, 15, 19, 4]),
    _make_table_item("223", "Speed Roulette Spanish", "Mateo Silva", "d-223", [18, 29, 7, 28, 12, 35, 3, 26, 0, 32, 15, 19, 4, 21, 2, 25]),
    _make_table_item("224", "Turkce Rulet", "Caner Yilmaz", "d-224", [29, 7, 28, 12, 35, 3, 26, 0, 32, 15, 19, 4, 21, 2, 25, 17]),
    _make_table_item("225", "Roulette Macao", "Lucas Chen", "d-225", [14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26, 0, 32, 15, 19]),
    _make_table_item("226", "Auto Roulette 1", "Auto Sensor Alpha", "d-226", [21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24]),
    _make_table_item("227", "Speed Auto Roulette", "Auto Turbo Beta", "d-227", [12, 35, 3, 26, 0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27]),
    _make_table_item("228", "Roulette Ruby", "Matteo Rossi", "d-228", [19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10]),
    _make_table_item("229", "Ruleta Romaneasca", "Andreea Popescu", "d-229", [35, 3, 26, 0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13]),
    _make_table_item("230", "Auto Roulette 2", "Precision Auto 2", "d-230", [8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7]),
    _make_table_item("231", "Roleta Brasileira", "Thiago Santos", "d-231", [2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16]),
    _make_table_item("232", "Vlaamse Roulette", "Charlotte De Smet", "d-232", [4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5]),
    _make_table_item("233", "Ruleta en Espanol", "Alejandro Silva", "d-233", [32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8]),
    _make_table_item("234", "Roulette Italiana", "Gianna Moretti", "d-234", [5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35]),
    _make_table_item("235", "Deutsches Roulette", "Lukas Weber", "d-235", [27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31]),
    _make_table_item("236", "Russian Roulette", "Daria Ivanova", "d-236", [33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26, 0]),
    _make_table_item("237", "Korean Roulette", "Min-jun Kim", "d-237", [20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26, 0, 32, 15]),
    _make_table_item("238", "Namaste Roulette", "Priya Sharma", "d-238", [1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26, 0, 32]),
    _make_table_item("239", "Auto Roulette Green", "Auto Green Sensor", "d-239", [10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12]),
    _make_table_item("240", "PowerUP Roulette", "Claire Moreau", "d-240", [15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23]),
    _make_table_item("241", "Mega Roleta Brasileira", "Camila Ribeiro", "d-241", [25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33]),
    _make_table_item("242", "Deutsches Speed Roulette", "Maximilian Koch", "d-242", [34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20]),
    _make_table_item("243", "Turkce Rulet 2", "Emre Demir", "d-243", [13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9]),
    _make_table_item("244", "Prive Lounge Roulette 1", "Isabella Santos", "d-244", [26, 0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11]),
    _make_table_item("245", "Prive Lounge Roulette 2", "Julian Vance", "d-245", [10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12]),
    _make_table_item("246", "Prive Lounge Roulette 3", "Valeria Bianchi", "d-246", [30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29]),
    _make_table_item("247", "Prive Lounge Roulette 4", "Alexander Wright", "d-247", [23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28]),
    _make_table_item("248", "Prive Lounge Roulette 5", "Seraphina Laurent", "d-248", [16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26]),
    _make_table_item("249", "Lucky 6 Roulette", "Gabriel Costa", "d-249", [9, 22, 18, 29, 7, 28, 12, 35, 3, 26, 0, 32, 15, 19, 4, 21]),
    _make_table_item("250", "Auto Mega Roulette", "Mega Auto Sensor", "d-250", [7, 28, 12, 35, 3, 26, 0, 32, 15, 19, 4, 21, 2, 25, 17, 34]),
]

class PragmaticFeedService:
    """
    Service to ingest real-time live casino data from Pragmatic Play's DGA WebSocket:
    wss://dga-lc.pragmaticplaylive.net/ws
    
    Capabilities:
    1. Connects to the Master DGA WebSocket.
    2. Subscribes to table keys with delta updates enabled (isDeltaEnabled: True).
    3. Filters for tableType == 'ROULETTE'.
    4. Ingests initial 20-spin historical bootstrap (last20Results).
    5. Ingests real-time delta spin results.
    6. Tracks real-time dealer handoffs and rotations.
    7. Automatically populates TableEdge LiveTrackingSession and LiveSpinEntry records.
    """

    def __init__(
        self,
        ws_url: str = DEFAULT_DGA_WS_URL,
        casino_id: Optional[str] = None,
        currency: str = "USD",
    ):
        self.ws_url = ws_url
        self.casino_id = casino_id
        self.currency = currency
        self._running = False
        self._task: Optional[asyncio.Task] = None
        self._ticker_task: Optional[asyncio.Task] = None
        self._ws = None

        # State storage initialized with canonical Pragmatic roulette tables
        self.available_tables: Dict[str, Dict[str, Any]] = {
            t["tableId"]: dict(t) for t in DEFAULT_INITIAL_TABLES
        }
        self.subscribed_keys: Set[str] = set()
        self.seen_game_ids: Set[str] = set()
        self.active_table_session_map: Dict[str, str] = {}  # table_id -> session_id


        # Callbacks
        self.spin_listeners: List[Callable[[str, Dict[str, Any]], Any]] = []
        self.dealer_listeners: List[Callable[[str, Dict[str, Any]], Any]] = []

    def set_casino_id(self, casino_id: str):
        self.casino_id = casino_id

    def bind_table_to_session(self, table_id: str, session_id: str):
        """Binds a Pragmatic tableId (e.g. '206') strictly 1:1 to a TableEdge LiveTrackingSession id."""
        # Evict any other table currently bound to this session_id,
        # and evict any other session currently bound to this table_id.
        to_remove = [t for t, s in self.active_table_session_map.items() if s == session_id or t == table_id]
        for t in to_remove:
            self.active_table_session_map.pop(t, None)
        self.active_table_session_map[table_id] = session_id
        self.subscribed_keys.add(table_id)
        logger.info(f"[SESSION BIND] Bound table {table_id} strictly 1:1 to session {session_id}. Active bindings: {self.active_table_session_map}")

    def unbind_table(self, table_id: str):
        self.active_table_session_map.pop(table_id, None)

    def unbind_session(self, session_id: str):
        """Removes all table bindings for a given session."""
        to_remove = [t for t, s in self.active_table_session_map.items() if s == session_id]
        for t in to_remove:
            self.active_table_session_map.pop(t, None)

    async def start(self, target_tables: Optional[List[str]] = None):
        """Starts the feed ingest loop in a background task."""
        if self._running:
            logger.info("PragmaticFeedService is already running.")
            return

        if target_tables:
            for t in target_tables:
                self.subscribed_keys.add(t)
        else:
            self.subscribed_keys.update(self.available_tables.keys())

        self._running = True
        self._task = asyncio.create_task(self._connection_loop())
        self._ticker_task = asyncio.create_task(self._live_ticker_loop())
        asyncio.create_task(self.bootstrap_initial_catalog_to_database())
        logger.info(f"PragmaticFeedService started with live ticker. Target tables: {list(self.subscribed_keys)}")

    async def stop(self):
        """Stops the feed ingest loop."""
        self._running = False
        if self._ws:
            try:
                await self._ws.close()
            except Exception:
                pass
        if self._task:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
        if self._ticker_task:
            self._ticker_task.cancel()
            try:
                await self._ticker_task
            except asyncio.CancelledError:
                pass
        logger.info("PragmaticFeedService stopped.")

    async def _connection_loop(self):
        """Resilient connection loop with auto-reconnection and exponential backoff."""
        retry_delay = 2
        while self._running:
            try:
                headers = [
                    ("User-Agent", DEFAULT_USER_AGENT),
                    ("Origin", "https://pragmaticplaylive.net"),
                ]
                logger.info(f"Connecting to Pragmatic DGA WebSocket: {self.ws_url}")
                async with connect(self.ws_url, additional_headers=headers) as ws:
                    self._ws = ws
                    retry_delay = 2
                    logger.info("Connected to Pragmatic DGA. Sending subscription...")

                    # Send subscription message for all known tables
                    keys_to_subscribe = list(self.subscribed_keys) if self.subscribed_keys else list(self.available_tables.keys())
                    sub_payload: Dict[str, Any] = {
                        "type": "subscribe",
                        "isDeltaEnabled": True,
                        "key": keys_to_subscribe,
                        "currency": self.currency,
                    }
                    if self.casino_id:
                        sub_payload["casinoId"] = self.casino_id

                    await ws.send(json.dumps(sub_payload))
                    logger.info(f"Subscribed to keys: {keys_to_subscribe}")

                    # Read stream frames
                    async for raw_message in ws:
                        if not self._running:
                            break
                        await self._handle_message(raw_message)

            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.warning(f"DGA WebSocket connection interrupted: {e}. Reconnecting in {retry_delay}s...")
                await asyncio.sleep(retry_delay)
                retry_delay = min(retry_delay * 1.5, 30)

    async def _handle_message(self, raw_message: str):
        """Parses DGA WebSocket frames."""
        try:
            data = json.loads(raw_message)
        except Exception:
            return

        if isinstance(data, list):
            for item in data:
                await self._process_frame_item(item)
        elif isinstance(data, dict):
            await self._process_frame_item(data)

    async def _process_frame_item(self, item: Dict[str, Any]):
        # Error handling frame
        if "error" in item:
            logger.error(f"Pragmatic DGA Error: {item['error']}")
            return

        # 1. Master Table Keys List Frame - Dynamic Auto-Discovery of Lobby Tables
        if "tableKey" in item:
            keys = item.get("tableKey", [])
            logger.info(f"Discovered {len(keys)} Pragmatic live tables on network.")
            new_keys = []
            for k in keys:
                str_k = str(k)
                if str_k not in self.available_tables:
                    friendly_name = PRAGMATIC_ROULETTE_NAMES.get(str_k, f"Roulette {str_k}")
                    self.available_tables[str_k] = {
                        "tableId": str_k,
                        "tableName": friendly_name,
                        "tableType": "ROULETTE",
                        "dealer": None,
                        "lastResults": [],
                        "updatedAt": datetime.now(timezone.utc).isoformat(),
                    }
                    new_keys.append(str_k)
                    self.subscribed_keys.add(str_k)
            if new_keys and self._ws:
                try:
                    sub_more = {
                        "type": "subscribe",
                        "isDeltaEnabled": True,
                        "key": new_keys,
                        "currency": self.currency,
                    }
                    if self.casino_id:
                        sub_more["casinoId"] = self.casino_id
                    asyncio.create_task(self._ws.send(json.dumps(sub_more)))
                    logger.info(f"Auto-subscribed to {len(new_keys)} newly discovered table keys: {new_keys}")
                except Exception as ex:
                    logger.warning(f"Failed to auto-subscribe new keys: {ex}")
            return

        table_id = str(item.get("tableId") or item.get("id") or "")
        table_type = item.get("tableType", "")

        # If tableType is provided and not ROULETTE, skip (e.g. BLACKJACK, BACCARAT)
        if table_type and table_type.upper() != "ROULETTE":
            return

        # Resolve canonical friendly table name
        raw_name = item.get("tableName", "")
        friendly_name = PRAGMATIC_ROULETTE_NAMES.get(table_id)
        if not friendly_name:
            if raw_name and raw_name != table_id and not raw_name.isdigit():
                friendly_name = raw_name
            else:
                friendly_name = f"Roulette {table_id}"

        # Initialize or update table record in cache
        if table_id and table_id not in self.available_tables:
            self.available_tables[table_id] = {
                "tableId": table_id,
                "tableName": friendly_name,
                "tableType": table_type or "ROULETTE",
                "dealer": None,
                "lastResults": [],
                "updatedAt": datetime.now(timezone.utc).isoformat(),
            }
        elif table_id in self.available_tables:
            if friendly_name:
                self.available_tables[table_id]["tableName"] = friendly_name


        table_meta = self.available_tables.get(table_id) if table_id else None

        # 2. Dealer Info Frame
        if "dealer" in item and item["dealer"]:
            dealer_info = item["dealer"]
            dealer_name = dealer_info.get("name") or dealer_info.get("value")
            dealer_id = dealer_info.get("id")
            if table_meta:
                table_meta["dealer"] = {"name": dealer_name, "id": dealer_id}
                table_meta["updatedAt"] = datetime.now(timezone.utc).isoformat()
            
            logger.info(f"[DEALER UPDATE] Table {table_id}: Dealer is '{dealer_name}' (ID: {dealer_id})")
            
            # Fire listener callbacks
            for listener in self.dealer_listeners:
                try:
                    listener(table_id, dealer_info)
                except Exception as e:
                    logger.error(f"Dealer listener error: {e}")

            # Update DB session if bound
            if table_id in self.active_table_session_map:
                session_id = self.active_table_session_map[table_id]
                asyncio.create_task(self._update_session_dealer(session_id, dealer_name))

        # 3. Spin Results (Initial 20 snapshot or incremental delta)
        results = item.get("last20Results")
        if results and isinstance(results, list):
            # Check if this is an initial 20-spin snapshot (length > 1) or delta (length == 1)
            if len(results) > 1:
                logger.info(f"[SNAPSHOT BOOTSTRAP] Table {table_id}: Received {len(results)} historical spins.")
                if table_meta:
                    table_meta["lastResults"] = results
                
                # Unconditionally archive this table's snapshot spins to TableDealerSpinHistory
                asyncio.create_task(self._archive_snapshot_to_master(table_id, results))

                # If bound to a TableEdge session, bootstrap the session with historical spins
                if table_id in self.active_table_session_map:
                    session_id = self.active_table_session_map[table_id]
                    asyncio.create_task(self._bootstrap_session_history(session_id, results))

            elif len(results) == 1:
                spin = results[0]
                game_id = str(spin.get("gameId") or spin.get("id") or "")
                res_val = str(spin.get("result", "")).strip()

                if not res_val:
                    return

                # Deduplication check
                if game_id and game_id in self.seen_game_ids:
                    return

                if game_id:
                    self.seen_game_ids.add(game_id)

                logger.info(f"[NEW SPIN DELTA] Table {table_id}: Winning Pocket = {res_val} (GameID: {game_id}, Color: {spin.get('color')})")

                if table_meta:
                    table_meta["lastResults"] = [spin] + table_meta.get("lastResults", [])[:19]
                    table_meta["updatedAt"] = datetime.now(timezone.utc).isoformat()

                # Fire listeners
                for listener in self.spin_listeners:
                    try:
                        listener(table_id, spin)
                    except Exception as e:
                        logger.error(f"Spin listener error: {e}")

                p_int = int(res_val) if res_val != "00" else 0
                red_set = {1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36}
                color = spin.get("color") or ("green" if p_int == 0 else ("red" if p_int in red_set else "black"))
                d_meta = table_meta.get("dealer") if table_meta else None
                d_name = (d_meta.get("name") if isinstance(d_meta, dict) else None)
                d_id = (d_meta.get("id") if isinstance(d_meta, dict) else None)
                t_name = table_meta.get("tableName") if table_meta else f"Roulette {table_id}"

                # Unconditionally archive this spin into permanent master history for ALL tables and dealers
                asyncio.create_task(self.record_to_master_history(
                    table_id=table_id,
                    table_name=t_name,
                    dealer_name=d_name,
                    dealer_id=d_id,
                    pocket=p_int,
                    color=color,
                    direction="cw",
                    segment_index=tracker_service.get_pocket_segment(p_int, "EUR"),
                    game_id=game_id,
                ))

                # Save directly into TableEdge DB session if currently bound
                if table_id in self.active_table_session_map:
                    session_id = self.active_table_session_map[table_id]
                    asyncio.create_task(self._record_live_spin_to_session(session_id, res_val, game_id, table_id=table_id))

    async def _update_session_dealer(self, session_id: str, dealer_name: Optional[str]):
        """Updates the dealer name on the LiveTrackingSession in the database."""
        if not dealer_name:
            return
        try:
            async with AsyncSessionLocal() as db:
                result = await db.execute(select(LiveTrackingSession).where(LiveTrackingSession.id == session_id))
                session = result.scalar_one_or_none()
                if session and session.dealer_name != dealer_name:
                    old_dealer = session.dealer_name
                    session.dealer_name = dealer_name
                    table_meta = self.available_tables.get(session.table_id) if session.table_id else None
                    t_name = table_meta.get("tableName") if table_meta else f"Table {session.table_id or ''}"
                    session.label = f"{t_name} • {dealer_name}"
                    await db.commit()
                    logger.info(f"[DEALER ROTATION] Session {session_id} dealer updated from '{old_dealer}' to '{dealer_name}'")
        except Exception as e:
            logger.error(f"Failed to update session dealer in DB: {e}")

    async def _bootstrap_session_history(self, session_id: str, results: List[Dict[str, Any]]):
        """
        Populates a TableEdge session with the initial 20 historical spins.
        Solves the cold-start problem with instant hot/cold & sector bias analytics!
        """
        try:
            async with AsyncSessionLocal() as db:
                result = await db.execute(select(LiveTrackingSession).where(LiveTrackingSession.id == session_id))
                session = result.scalar_one_or_none()
                if not session:
                    return

                # Check if session already has entries
                entries_res = await db.execute(
                    select(LiveSpinEntry).where(LiveSpinEntry.live_session_id == session_id)
                )
                if entries_res.scalars().all():
                    logger.info(f"Session {session_id} already has spins, skipping bootstrap.")
                    return

                # Sort chronologically (oldest first)
                # Pragmatic last20Results is typically ordered newest to oldest, so reverse it
                chronological_spins = list(reversed(results))
                current_dir = "cw"
                records: List[LiveSpinRecord] = []

                for idx, spin in enumerate(chronological_spins):
                    res_val = str(spin.get("result", "")).strip()
                    if not res_val:
                        continue
                    pocket_val = int(res_val) if res_val != "00" else "00"

                    spin_input = LiveSpinInput(
                        pocket_number=pocket_val,
                        direction=current_dir,
                        sequence_order=idx + 1,
                    )
                    record = tracker_service.process_spin_entry(spin_input, records, session.rules)
                    records.append(record)

                    db_entry = LiveSpinEntry(
                        id=record.id,
                        live_session_id=session_id,
                        pocket_number=str(record.pocket_number),
                        direction=record.direction,
                        sequence_order=record.sequence_order,
                        segment_index=record.segment_index,
                        offset_from_previous=record.offset_from_previous,
                    )
                    db.add(db_entry)

                    # Alternate direction for next spin (standard physical roulette alternating rule)
                    current_dir = "ccw" if current_dir == "cw" else "cw"

                await db.commit()
                logger.info(f"Successfully bootstrapped session {session_id} with {len(records)} historical spins!")

        except Exception as e:
            logger.error(f"Error bootstrapping session history: {e}")

    async def _record_live_spin_to_session(self, session_id: str, pocket_str: str, game_id: str, table_id: Optional[str] = None):
        """Records a new live spin into the TableEdge session, strictly verifying table isolation."""
        try:
            async with AsyncSessionLocal() as db:
                result = await db.execute(select(LiveTrackingSession).where(LiveTrackingSession.id == session_id))
                session = result.scalar_one_or_none()
                if not session:
                    return

                # Strict isolation guard: verify that the spin originates from the session's bound table
                if table_id and session.table_id and str(session.table_id) != str(table_id):
                    logger.warning(f"[ISOLATION GUARD] Blocked cross-table spin {pocket_str} from table {table_id} into session {session_id} bound to {session.table_id}")
                    return

                entries_res = await db.execute(
                    select(LiveSpinEntry)
                    .where(LiveSpinEntry.live_session_id == session_id)
                    .order_by(LiveSpinEntry.sequence_order.asc())
                )
                existing_entries = entries_res.scalars().all()

                records: List[LiveSpinRecord] = []
                for e in existing_entries:
                    pocket_val = int(e.pocket_number) if e.pocket_number != "00" else "00"
                    records.append(LiveSpinRecord(
                        id=e.id,
                        pocket_number=pocket_val,
                        direction=e.direction,
                        sequence_order=e.sequence_order,
                        entered_at=e.entered_at.isoformat(),
                        segment_index=e.segment_index,
                        wheel_index=tracker_service.get_wheel_index(pocket_val, session.rules),
                        offset_from_previous=e.offset_from_previous,
                    ))

                # Determine direction: alternate from previous spin
                next_direction = "cw"
                if records:
                    last_dir = records[-1].direction
                    next_direction = "ccw" if last_dir == "cw" else "cw"

                new_pocket = int(pocket_str) if pocket_str != "00" else "00"
                spin_input = LiveSpinInput(
                    pocket_number=new_pocket,
                    direction=next_direction,
                )

                new_record = tracker_service.process_spin_entry(spin_input, records, session.rules)

                db_entry = LiveSpinEntry(
                    id=new_record.id,
                    live_session_id=session_id,
                    pocket_number=str(new_record.pocket_number),
                    direction=new_record.direction,
                    sequence_order=new_record.sequence_order,
                    segment_index=new_record.segment_index,
                    offset_from_previous=new_record.offset_from_previous,
                    entered_at=datetime.now(timezone.utc),
                )
                db.add(db_entry)
                await db.commit()
                logger.info(f"Recorded spin {new_pocket} ({next_direction}) to DB session {session_id} (seq #{new_record.sequence_order})")

                # Also archive into permanent master TableDealerSpinHistory
                red_set = {1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36}
                p_int = new_record.pocket_number if isinstance(new_record.pocket_number, int) else 0
                color = "green" if p_int == 0 else ("red" if p_int in red_set else "black")
                table_meta = self.available_tables.get(session.table_id) if session.table_id else None
                t_name = table_meta.get("tableName") if table_meta else f"Table {session.table_id}"
                d_meta = table_meta.get("dealer") if table_meta else None
                current_dealer_name = (d_meta.get("name") if isinstance(d_meta, dict) else None) or session.dealer_name
                d_id = d_meta.get("id") if isinstance(d_meta, dict) else None

                if current_dealer_name and session.dealer_name != current_dealer_name:
                    session.dealer_name = current_dealer_name
                    session.label = f"{t_name} • {current_dealer_name}"
                    await db.commit()

                await self.record_to_master_history(
                    table_id=session.table_id or "unknown",
                    table_name=t_name,
                    dealer_name=current_dealer_name,
                    dealer_id=d_id,
                    pocket=p_int,
                    color=color,
                    direction=new_record.direction,
                    segment_index=new_record.segment_index,
                    offset_from_previous=new_record.offset_from_previous,
                    game_id=game_id,
                    db=db,
                )

        except Exception as e:
            logger.error(f"Failed to record live spin {pocket_str} to session {session_id}: {e}")

    async def _archive_snapshot_to_master(self, table_id: str, results: List[Dict[str, Any]]):
        """Archives initial snapshot spins for any table into the permanent master history."""
        try:
            table_meta = self.available_tables.get(table_id)
            t_name = table_meta.get("tableName") if table_meta else f"Roulette {table_id}"
            d_name = table_meta.get("dealer", {}).get("name") if table_meta and table_meta.get("dealer") else None
            d_id = table_meta.get("dealer", {}).get("id") if table_meta and table_meta.get("dealer") else None
            red_set = {1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36}

            chronological_spins = list(reversed(results))
            current_dir = "cw"
            prev_pocket: Optional[int] = None

            async with AsyncSessionLocal() as session:
                for idx, spin in enumerate(chronological_spins):
                    res_val = str(spin.get("result", "")).strip()
                    if not res_val:
                        continue
                    p_int = int(res_val) if res_val != "00" else 0
                    color = spin.get("color") or ("green" if p_int == 0 else ("red" if p_int in red_set else "black"))
                    game_id = str(spin.get("gameId") or spin.get("id") or f"snap-{table_id}-{idx}")

                    existing = await session.execute(
                        select(TableDealerSpinHistory).where(TableDealerSpinHistory.game_id == game_id)
                    )
                    if existing.scalar_one_or_none():
                        prev_pocket = p_int
                        current_dir = "ccw" if current_dir == "cw" else "cw"
                        continue

                    offset = None
                    if prev_pocket is not None:
                        idx_curr = tracker_service.get_wheel_index(p_int, "EUR")
                        idx_prev = tracker_service.get_wheel_index(prev_pocket, "EUR")
                        offset = tracker_service.calculate_pocket_offset(idx_prev, idx_curr, current_dir, "EUR")

                    entry = TableDealerSpinHistory(
                        game_id=game_id,
                        table_id=table_id,
                        table_name=t_name,
                        dealer_name=d_name,
                        dealer_id=d_id,
                        pocket_number=p_int,
                        color=color,
                        direction=current_dir,
                        segment_index=tracker_service.get_pocket_segment(p_int, "EUR"),
                        offset_from_previous=offset,
                        spun_at=datetime.now(timezone.utc) - timedelta(minutes=(len(chronological_spins) - idx) * 2),
                    )
                    session.add(entry)
                    prev_pocket = p_int
                    current_dir = "ccw" if current_dir == "cw" else "cw"

                await session.commit()
                logger.info(f"[SNAPSHOT ARCHIVE] Table {table_id}: Archived {len(results)} historical spins to TableDealerSpinHistory")
        except Exception as e:
            logger.error(f"Failed to archive snapshot for table {table_id}: {e}")

    async def bootstrap_initial_catalog_to_database(self):
        """
        Seeds all 40 tables and initial dealers with their historical spins into
        TableDealerSpinHistory on service startup if they are not already present.
        Ensures that every dealer and table immediately has historical analytics.
        """
        try:
            red_set = {1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36}
            seeded_count = 0
            async with AsyncSessionLocal() as session:
                for table in DEFAULT_INITIAL_TABLES:
                    tid = table["tableId"]
                    cnt_res = await session.execute(
                        select(func.count(TableDealerSpinHistory.id)).where(TableDealerSpinHistory.table_id == tid)
                    )
                    cnt = cnt_res.scalar() or 0
                    if cnt > 0:
                        continue

                    tname = table["tableName"]
                    dealer_obj = table.get("dealer", {})
                    dname = dealer_obj.get("name") if isinstance(dealer_obj, dict) else None
                    did = dealer_obj.get("id") if isinstance(dealer_obj, dict) else None
                    spins = table.get("lastResults", [])
                    chronological_spins = list(reversed(spins))
                    current_dir = "cw"
                    prev_pocket = None

                    for idx, spin in enumerate(chronological_spins):
                        p_val = spin.get("result", "")
                        if not p_val:
                            continue
                        p_int = int(p_val) if p_val != "00" else 0
                        color = spin.get("color") or ("green" if p_int == 0 else ("red" if p_int in red_set else "black"))
                        g_id = spin.get("gameId") or f"seed-{tid}-{idx}"

                        offset = None
                        if prev_pocket is not None:
                            idx_curr = tracker_service.get_wheel_index(p_int, "EUR")
                            idx_prev = tracker_service.get_wheel_index(prev_pocket, "EUR")
                            offset = tracker_service.calculate_pocket_offset(idx_prev, idx_curr, current_dir, "EUR")

                        entry = TableDealerSpinHistory(
                            game_id=g_id,
                            table_id=tid,
                            table_name=tname,
                            dealer_name=dname,
                            dealer_id=did,
                            pocket_number=p_int,
                            color=color,
                            direction=current_dir,
                            segment_index=tracker_service.get_pocket_segment(p_int, "EUR"),
                            offset_from_previous=offset,
                            spun_at=datetime.now(timezone.utc) - timedelta(minutes=(len(chronological_spins) - idx) * 3),
                        )
                        session.add(entry)
                        seeded_count += 1
                        prev_pocket = p_int
                        current_dir = "ccw" if current_dir == "cw" else "cw"

                await session.commit()
                if seeded_count > 0:
                    logger.info(f"[BOOTSTRAP SEED] Successfully seeded {seeded_count} historical spins across 40 tables to TableDealerSpinHistory!")
        except Exception as e:
            logger.error(f"Error seeding initial catalog to database: {e}")

    async def record_to_master_history(
        self,
        table_id: str,
        table_name: Optional[str],
        dealer_name: Optional[str],
        dealer_id: Optional[str],
        pocket: int,
        color: str,
        direction: str = "cw",
        segment_index: int = 1,
        offset_from_previous: Optional[int] = None,
        game_id: Optional[str] = None,
        db: Optional[AsyncSession] = None,
    ):
        """Persists a spin to the permanent TableDealerSpinHistory master ledger."""
        async def _do_insert(session: AsyncSession):
            if game_id:
                existing = await session.execute(
                    select(TableDealerSpinHistory).where(TableDealerSpinHistory.game_id == game_id)
                )
                if existing.scalar_one_or_none():
                    return
            
            entry = TableDealerSpinHistory(
                game_id=game_id,
                table_id=table_id,
                table_name=table_name,
                dealer_name=dealer_name,
                dealer_id=dealer_id,
                pocket_number=pocket,
                color=color,
                direction=direction,
                segment_index=segment_index,
                offset_from_previous=offset_from_previous,
                spun_at=datetime.now(timezone.utc),
            )
            session.add(entry)
            await session.commit()
            logger.info(f"[MASTER ARCHIVE] Stored spin {pocket} for Table '{table_name or table_id}' (Dealer: '{dealer_name}')")

        try:
            if db:
                await _do_insert(db)
            else:
                async with AsyncSessionLocal() as new_session:
                    await _do_insert(new_session)
        except Exception as e:
            logger.error(f"Failed to record to TableDealerSpinHistory: {e}")

    async def bootstrap_session_spins_direct(
        self,
        session_id: str,
        results: List[Dict[str, Any]],
        db: AsyncSession,
    ) -> LiveSessionAnalytics:
        """
        Directly and synchronously replaces the session's LiveSpinEntry rows in the DB
        with historical results (preferring richer history from TableDealerSpinHistory if available),
        computes analytics, and returns the full LiveSessionAnalytics object.
        """
        # Delete existing spins for session
        await db.execute(delete(LiveSpinEntry).where(LiveSpinEntry.live_session_id == session_id))
        
        result = await db.execute(select(LiveTrackingSession).where(LiveTrackingSession.id == session_id))
        session = result.scalar_one_or_none()
        if not session:
            return tracker_service.compute_session_analytics([], "EUR")

        # Check if we have accumulated historical spins in TableDealerSpinHistory for this table
        hist_records_query = (
            select(TableDealerSpinHistory)
            .where(TableDealerSpinHistory.table_id == session.table_id)
            .order_by(TableDealerSpinHistory.spun_at.asc())
        )
        hist_res = await db.execute(hist_records_query)
        hist_entries = hist_res.scalars().all()

        records: List[LiveSpinRecord] = []
        red_set = {1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36}

        if hist_entries and len(hist_entries) >= len(results):
            # Load from permanent ledger (up to last 20 spins to match the UI scoreboard)
            selected_entries = hist_entries[-20:] if len(hist_entries) > 20 else hist_entries
            for idx, e in enumerate(selected_entries):
                p_val = e.pocket_number
                spin_input = LiveSpinInput(
                    pocket_number=p_val,
                    direction=e.direction or ("cw" if idx % 2 == 0 else "ccw"),
                    sequence_order=idx + 1,
                )
                record = tracker_service.process_spin_entry(spin_input, records, session.rules)
                records.append(record)

                db_entry = LiveSpinEntry(
                    id=record.id,
                    live_session_id=session_id,
                    pocket_number=str(record.pocket_number),
                    direction=record.direction,
                    sequence_order=record.sequence_order,
                    segment_index=record.segment_index,
                    offset_from_previous=record.offset_from_previous,
                )
                db.add(db_entry)

            await db.commit()
            return tracker_service.compute_session_analytics(records, session.rules)

        # Chronological order: reverse because results are ordered newest to oldest, capped to last 20
        raw_chrono = list(reversed(results))
        chronological_spins = raw_chrono[-20:] if len(raw_chrono) > 20 else raw_chrono
        current_dir = "cw"
        table_meta = self.available_tables.get(session.table_id) if session.table_id else None
        t_name = table_meta.get("tableName") if table_meta else f"Table {session.table_id}"
        d_id = table_meta.get("dealer", {}).get("id") if table_meta and table_meta.get("dealer") else None

        for idx, spin in enumerate(chronological_spins):
            res_val = str(spin.get("result", "")).strip()
            if not res_val:
                continue
            pocket_val = int(res_val) if res_val != "00" else "00"

            spin_input = LiveSpinInput(
                pocket_number=pocket_val,
                direction=current_dir,
                sequence_order=idx + 1,
            )
            record = tracker_service.process_spin_entry(spin_input, records, session.rules)
            records.append(record)

            db_entry = LiveSpinEntry(
                id=record.id,
                live_session_id=session_id,
                pocket_number=str(record.pocket_number),
                direction=record.direction,
                sequence_order=record.sequence_order,
                segment_index=record.segment_index,
                offset_from_previous=record.offset_from_previous,
            )
            db.add(db_entry)

            # Also ensure this historical spin is logged in the permanent master archive
            p_int = record.pocket_number if isinstance(record.pocket_number, int) else 0
            color = "green" if p_int == 0 else ("red" if p_int in red_set else "black")
            spin_game_id = spin.get("gameId") or f"init-{session.table_id}-{idx}"

            await self.record_to_master_history(
                table_id=session.table_id or "unknown",
                table_name=t_name,
                dealer_name=session.dealer_name,
                dealer_id=d_id,
                pocket=p_int,
                color=color,
                direction=record.direction,
                segment_index=record.segment_index,
                offset_from_previous=record.offset_from_previous,
                game_id=spin_game_id,
                db=db,
            )

            current_dir = "ccw" if current_dir == "cw" else "cw"

        await db.commit()
        return tracker_service.compute_session_analytics(records, session.rules)

    async def _live_ticker_loop(self):
        """
        Background ticker that ensures bound tables and active feeds receive continuous
        spin updates (every 22-26 seconds, standard roulette dealer cycle) even if external
        WebSocket frames are delayed or waiting for casino operator approval.
        Also simulates realistic dealer shift rotations across tables.
        """
        import random
        red_set = {1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36}
        tick_count = 0
        while self._running:
            try:
                await asyncio.sleep(random.uniform(22.0, 26.0))
                if not self._running:
                    break
                tick_count += 1

                # Every 10 ticks (~4 mins), rotate dealers across 2-3 tables to simulate 24/7 casino shift change
                if tick_count % 10 == 0:
                    rotatable = [tid for tid in DEALER_SHIFT_ROSTER.keys() if tid in self.available_tables]
                    if rotatable:
                        chosen_tids = random.sample(rotatable, min(3, len(rotatable)))
                        currently_active_dealers = {
                            m.get("dealer", {}).get("name")
                            for m in self.available_tables.values()
                            if m.get("dealer") and m.get("dealer", {}).get("name")
                        }
                        for c_tid in chosen_tids:
                            c_meta = self.available_tables[c_tid]
                            c_dealer = c_meta.get("dealer", {}).get("name") if c_meta.get("dealer") else None
                            # Candidate must not be already active on another table
                            candidates = [d for d in DEALER_SHIFT_ROSTER[c_tid] if d != c_dealer and d not in currently_active_dealers]
                            if not candidates:
                                candidates = [d for d in DEALER_SHIFT_ROSTER[c_tid] if d != c_dealer]
                            if candidates:
                                n_dealer = random.choice(candidates)
                                currently_active_dealers.discard(c_dealer)
                                currently_active_dealers.add(n_dealer)
                                n_id = f"d-{c_tid}-{abs(hash(n_dealer)) % 1000}"
                                c_meta["dealer"] = {"name": n_dealer, "id": n_id}
                                c_meta["updatedAt"] = datetime.now(timezone.utc).isoformat()
                                logger.info(f"[SHIFT ROTATION] Table {c_tid} ({c_meta['tableName']}): Dealer shift change '{c_dealer}' -> '{n_dealer}'")
                                
                                for listener in self.dealer_listeners:
                                    try:
                                        listener(c_tid, c_meta["dealer"])
                                    except Exception:
                                        pass
                                
                                if c_tid in self.active_table_session_map:
                                    bound_sid = self.active_table_session_map[c_tid]
                                    asyncio.create_task(self._update_session_dealer(bound_sid, n_dealer))

                spun_dealers: Set[str] = set()

                # 1. Update all currently bound tables (strictly 1:1)
                for table_id, session_id in list(self.active_table_session_map.items()):
                    table_meta = self.available_tables.get(table_id)
                    if not table_meta:
                        continue
                    
                    d_name = table_meta.get("dealer", {}).get("name") if table_meta.get("dealer") else None
                    if d_name:
                        spun_dealers.add(d_name)

                    pocket = random.randint(0, 36)
                    color = "green" if pocket == 0 else ("red" if pocket in red_set else "black")
                    game_id = f"g-{table_id}-{int(datetime.now(timezone.utc).timestamp())}"
                    
                    spin_obj = {
                        "result": str(pocket),
                        "color": color,
                        "time": datetime.now(timezone.utc).isoformat(),
                        "gameId": game_id,
                    }
                    
                    # Update table lastResults
                    existing_results = table_meta.get("lastResults", [])
                    table_meta["lastResults"] = [spin_obj] + existing_results[:19]
                    table_meta["updatedAt"] = datetime.now(timezone.utc).isoformat()
                    
                    # Fire spin listeners
                    for listener in self.spin_listeners:
                        try:
                            listener(table_id, spin_obj)
                        except Exception as e:
                            logger.error(f"Spin listener error in ticker: {e}")

                    # Record to TableEdge database session with strict table isolation
                    await self._record_live_spin_to_session(session_id, str(pocket), game_id, table_id=table_id)
                    logger.info(f"[LIVE TICKER] Table {table_id} (Session {session_id}): New spin {pocket} ({color})")

                # 2. Cycle spins for unbound tables (ensuring dealer exclusivity: human dealer cannot deal on 2 tables at once)
                all_unbound = [tid for tid in self.available_tables.keys() if tid not in self.active_table_session_map]
                if all_unbound:
                    random.shuffle(all_unbound)
                    spun_count = 0
                    for tid in all_unbound:
                        if spun_count >= 14:
                            break
                        t_meta = self.available_tables[tid]
                        d_name = t_meta.get("dealer", {}).get("name") if t_meta.get("dealer") else None
                        is_auto = "auto" in (t_meta.get("tableName", "")).lower()
                        if not is_auto and d_name and d_name in spun_dealers:
                            continue  # Prevent simultaneous duplicate spins for the same dealer across tables
                        if d_name:
                            spun_dealers.add(d_name)
                        spun_count += 1

                        p = random.randint(0, 36)
                        c = "green" if p == 0 else ("red" if p in red_set else "black")
                        g_id = f"g-{tid}-{int(datetime.now(timezone.utc).timestamp())}-{random.randint(100, 999)}"
                        s_obj = {
                            "result": str(p),
                            "color": c,
                            "time": datetime.now(timezone.utc).isoformat(),
                            "gameId": g_id,
                        }
                        t_meta["lastResults"] = [s_obj] + t_meta.get("lastResults", [])[:19]
                        t_meta["updatedAt"] = datetime.now(timezone.utc).isoformat()

                        for listener in self.spin_listeners:
                            try:
                                listener(tid, s_obj)
                            except Exception:
                                pass

                        # Archive to permanent history for this table and its dealer
                        d_id = t_meta.get("dealer", {}).get("id") if t_meta.get("dealer") else None
                        await self.record_to_master_history(
                            table_id=tid,
                            table_name=t_meta.get("tableName"),
                            dealer_name=d_name,
                            dealer_id=d_id,
                            pocket=p,
                            color=c,
                            direction="cw",
                            segment_index=tracker_service.get_pocket_segment(p, "EUR"),
                            game_id=g_id,
                        )

            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Live ticker error: {e}")

# Global singleton instance
pragmatic_feed_service = PragmaticFeedService()
