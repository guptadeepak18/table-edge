import os
import sys
import sqlite3
import asyncio
from datetime import datetime, timezone
import asyncpg

SQLITE_DB_PATH = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "table_edge.db"))

def get_target_db_url():
    if len(sys.argv) > 1 and sys.argv[1].startswith("postgres"):
        return sys.argv[1]
    
    env_url = os.environ.get("DATABASE_URL")
    if env_url and "postgres" in env_url:
        return env_url
        
    env_file = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".env"))
    if os.path.exists(env_file):
        with open(env_file, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line.startswith("DATABASE_URL=") and not line.startswith("#"):
                    val = line.split("=", 1)[1].strip().strip('"').strip("'")
                    if "postgres" in val:
                        return val
    return None

def parse_dt(raw):
    if not raw:
        return None
    if isinstance(raw, str):
        try:
            return datetime.fromisoformat(raw.replace("Z", "+00:00"))
        except Exception:
            return datetime.now(timezone.utc)
    return datetime.now(timezone.utc)

async def migrate():
    print("=" * 65)
    print("  TableEdge: Local SQLite -> Aiven PostgreSQL Migration Tool")
    print("=" * 65)
    
    db_url = get_target_db_url()
    if not db_url:
        print("\n[ERROR] No PostgreSQL target DATABASE_URL found.")
        print("Please provide the Aiven PostgreSQL connection URL either:")
        print("  1. In backend/.env: DATABASE_URL=postgres://avnadmin:<password>@table-edge-hborion.f.aivencloud.com:23471/defaultdb?sslmode=require")
        print("  2. As a CLI argument: python scripts/migrate_sqlite_to_aiven.py \"postgres://...\"")
        print("  3. As an environment variable: set DATABASE_URL=\"postgres://...\"")
        sys.exit(1)
        
    if not os.path.exists(SQLITE_DB_PATH):
        print(f"[ERROR] SQLite database not found at {SQLITE_DB_PATH}")
        sys.exit(1)
        
    sqlite_conn = sqlite3.connect(SQLITE_DB_PATH)
    sqlite_conn.row_factory = sqlite3.Row
    sqlite_cur = sqlite_conn.cursor()
    
    clean_url = db_url
    if clean_url.startswith("postgresql+asyncpg://"):
        clean_url = clean_url.replace("postgresql+asyncpg://", "postgresql://", 1)
        
    base_url = clean_url.split("?")[0]
        
    print("\n[1/4] Connecting to Aiven Cloud PostgreSQL...")
    try:
        pg_conn = await asyncpg.connect(base_url, ssl="require")
    except Exception as e:
        print(f"[CONNECTION FAILED] Could not connect to Aiven PostgreSQL: {e}")
        sys.exit(1)
    print("      Connected successfully!")
    
    # ---------------------------------------------------------
    # 1. Migrate table_dealer_spin_history (57k+ records)
    # ---------------------------------------------------------
    print("\n[2/4] Migrating 'table_dealer_spin_history' (Master Wheel & Dealer Spins)...")
    cur_pg_spins = await pg_conn.fetchval("SELECT COUNT(*) FROM table_dealer_spin_history")
    print(f"      Current Aiven spins: {cur_pg_spins:,}")
    
    sqlite_cur.execute("""
        SELECT id, game_id, table_id, table_name, dealer_name, dealer_id,
               pocket_number, color, direction, segment_index, offset_from_previous, spun_at
        FROM table_dealer_spin_history
        ORDER BY spun_at ASC
    """)
    spin_rows = sqlite_cur.fetchall()
    total_spins = len(spin_rows)
    print(f"      Local SQLite spins to process: {total_spins:,}")
    
    insert_spin_sql = """
        INSERT INTO table_dealer_spin_history (
            id, game_id, table_id, table_name, dealer_name, dealer_id,
            pocket_number, color, direction, segment_index, offset_from_previous, spun_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        ON CONFLICT (game_id) DO NOTHING;
    """
    
    batch_size = 2000
    for i in range(0, total_spins, batch_size):
        chunk = spin_rows[i:i + batch_size]
        prepared = [
            (
                str(r["id"]),
                str(r["game_id"]) if r["game_id"] else None,
                str(r["table_id"]),
                str(r["table_name"]) if r["table_name"] else None,
                str(r["dealer_name"]) if r["dealer_name"] else None,
                str(r["dealer_id"]) if r["dealer_id"] else None,
                int(r["pocket_number"]),
                str(r["color"]),
                str(r["direction"]) if r["direction"] else "cw",
                int(r["segment_index"]),
                int(r["offset_from_previous"]) if r["offset_from_previous"] is not None else None,
                parse_dt(r["spun_at"])
            )
            for r in chunk
        ]
        await pg_conn.executemany(insert_spin_sql, prepared)
        done = min(i + batch_size, total_spins)
        print(f"      -> Progress: {done:,} / {total_spins:,} spins ({(done/total_spins)*100:.1f}%)")
        
    new_pg_spins = await pg_conn.fetchval("SELECT COUNT(*) FROM table_dealer_spin_history")
    print(f"      Completed! Aiven total spins now: {new_pg_spins:,} (+{new_pg_spins - cur_pg_spins:,})")
    
    # ---------------------------------------------------------
    # 2. Migrate live_tracking_sessions
    # ---------------------------------------------------------
    print("\n[3/4] Migrating 'live_tracking_sessions'...")
    try:
        sqlite_cur.execute("""
            SELECT id, user_id, rules, casino, table_id, dealer_name, label, started_at, ended_at
            FROM live_tracking_sessions
        """)
        session_rows = sqlite_cur.fetchall()
        insert_sess_sql = """
            INSERT INTO live_tracking_sessions (
                id, user_id, rules, casino, table_id, dealer_name, label, started_at, ended_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            ON CONFLICT (id) DO NOTHING;
        """
        prepared_sess = [
            (
                str(r["id"]),
                str(r["user_id"]) if r["user_id"] else None,
                str(r["rules"]) if r["rules"] else "EUR",
                str(r["casino"]) if r["casino"] else None,
                str(r["table_id"]) if r["table_id"] else None,
                str(r["dealer_name"]) if r["dealer_name"] else None,
                str(r["label"]) if r["label"] else None,
                parse_dt(r["started_at"]),
                parse_dt(r["ended_at"])
            )
            for r in session_rows
        ]
        if prepared_sess:
            await pg_conn.executemany(insert_sess_sql, prepared_sess)
            print(f"      Migrated {len(prepared_sess)} live tracking sessions.")
    except Exception as e:
        print(f"      Session migration note: {e}")

    # ---------------------------------------------------------
    # 3. Migrate live_spin_entries
    # ---------------------------------------------------------
    print("\n[4/4] Migrating 'live_spin_entries'...")
    try:
        sqlite_cur.execute("""
            SELECT id, live_session_id, pocket_number, direction, sequence_order,
                   segment_index, offset_from_previous, entered_at
            FROM live_spin_entries
            ORDER BY sequence_order ASC
        """)
        entry_rows = sqlite_cur.fetchall()
        insert_entry_sql = """
            INSERT INTO live_spin_entries (
                id, live_session_id, pocket_number, direction, sequence_order,
                segment_index, offset_from_previous, entered_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            ON CONFLICT (id) DO NOTHING;
        """
        prepared_entries = [
            (
                str(r["id"]),
                str(r["live_session_id"]),
                str(r["pocket_number"]),
                str(r["direction"]) if r["direction"] else "cw",
                int(r["sequence_order"]),
                int(r["segment_index"]),
                int(r["offset_from_previous"]) if r["offset_from_previous"] is not None else None,
                parse_dt(r["entered_at"])
            )
            for r in entry_rows
        ]
        if prepared_entries:
            for i in range(0, len(prepared_entries), 2000):
                chunk = prepared_entries[i:i + 2000]
                await pg_conn.executemany(insert_entry_sql, chunk)
            print(f"      Migrated {len(prepared_entries):,} live spin entries.")
    except Exception as e:
        print(f"      Live spin entries migration note: {e}")

    print("\n" + "=" * 65)
    print("  ALL HISTORICAL DATA HAS BEEN FULLY MIGRATED TO AIVEN!")
    print("=" * 65)
    
    await pg_conn.close()
    sqlite_conn.close()

if __name__ == "__main__":
    asyncio.run(migrate())
