from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from typing import List
from app.core.database import get_db
from app.models.tracker import LiveTrackingSession, LiveSpinEntry, CasinoConfig, TableDealerSpinHistory
from app.schemas.tracker import (
    LiveSessionCreate,
    LiveSessionResponse,
    LiveSpinInput,
    LiveSpinRecord,
    LiveSessionAnalytics,
    LiveFeedStartRequest,
    LiveFeedBindRequest,
    CasinoConfigResponse,
    HistoricalArchiveStats,
)
from app.services.tracker_service import tracker_service
from app.services.pragmatic_feed import pragmatic_feed_service


router = APIRouter(prefix="/tracker", tags=["tracker"])

@router.post("/sessions", response_model=LiveSessionResponse)
async def create_session(data: LiveSessionCreate, db: AsyncSession = Depends(get_db)):
    session = LiveTrackingSession(
        rules=data.rules,
        casino=data.casino,
        table_id=data.table_id,
        dealer_name=data.dealer_name,
        label=data.label,
    )
    db.add(session)
    await db.commit()
    await db.refresh(session)

    if data.table_id:
        pragmatic_feed_service.bind_table_to_session(data.table_id, session.id)
        table_meta = pragmatic_feed_service.available_tables.get(data.table_id)
        if table_meta and table_meta.get("lastResults"):
            await pragmatic_feed_service.bootstrap_session_spins_direct(
                session.id,
                table_meta["lastResults"],
                db
            )
        if table_meta and not session.dealer_name:
            dealer_info = table_meta.get("dealer")
            if dealer_info and isinstance(dealer_info, dict) and dealer_info.get("name"):
                session.dealer_name = dealer_info.get("name")
                await db.commit()
                await db.refresh(session)

    return LiveSessionResponse(
        id=session.id,
        rules=session.rules,
        casino=session.casino,
        table_id=session.table_id,
        dealer_name=session.dealer_name,
        label=session.label,
        started_at=session.started_at.isoformat(),
        entries=[],
    )

@router.get("/sessions", response_model=List[LiveSessionResponse])
async def list_sessions(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(LiveTrackingSession).order_by(LiveTrackingSession.started_at.desc()))
    sessions = result.scalars().all()
    out = []
    for s in sessions:
        out.append(LiveSessionResponse(
            id=s.id,
            rules=s.rules,
            casino=s.casino,
            table_id=s.table_id,
            dealer_name=s.dealer_name,
            label=s.label,
            started_at=s.started_at.isoformat(),
            ended_at=s.ended_at.isoformat() if s.ended_at else None,
            entries=[],
        ))
    return out

@router.get("/sessions/{session_id}/analytics", response_model=LiveSessionAnalytics)
async def get_session_analytics(session_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(LiveTrackingSession).where(LiveTrackingSession.id == session_id))
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    entries_res = await db.execute(
        select(LiveSpinEntry)
        .where(LiveSpinEntry.live_session_id == session_id)
        .order_by(LiveSpinEntry.sequence_order.asc())
    )
    entries_db = entries_res.scalars().all()
    
    records = []
    for e in entries_db:
        records.append(LiveSpinRecord(
            id=e.id,
            pocket_number=int(e.pocket_number) if e.pocket_number != "00" else "00",
            direction=e.direction,
            sequence_order=e.sequence_order,
            entered_at=e.entered_at.isoformat(),
            segment_index=e.segment_index,
            wheel_index=tracker_service.get_wheel_index(int(e.pocket_number) if e.pocket_number != "00" else "00", session.rules),
            offset_from_previous=e.offset_from_previous,
        ))

    return tracker_service.compute_session_analytics(records, session.rules)

@router.post("/sessions/{session_id}/spins", response_model=LiveSessionAnalytics)
async def add_spin_entry(
    session_id: str,
    entry: LiveSpinInput,
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(LiveTrackingSession).where(LiveTrackingSession.id == session_id))
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    entries_res = await db.execute(
        select(LiveSpinEntry)
        .where(LiveSpinEntry.live_session_id == session_id)
        .order_by(LiveSpinEntry.sequence_order.asc())
    )
    existing_entries = entries_res.scalars().all()

    # Convert existing entries to records
    records = []
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

    # Process new spin
    new_record = tracker_service.process_spin_entry(entry, records, session.rules)

    db_entry = LiveSpinEntry(
        id=new_record.id,
        live_session_id=session_id,
        pocket_number=str(new_record.pocket_number),
        direction=new_record.direction,
        sequence_order=new_record.sequence_order,
        segment_index=new_record.segment_index,
        offset_from_previous=new_record.offset_from_previous,
    )
    db.add(db_entry)
    await db.commit()

    # Also archive into permanent master TableDealerSpinHistory
    red_set = {1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36}
    p_int = new_record.pocket_number if isinstance(new_record.pocket_number, int) else 0
    color = "green" if p_int == 0 else ("red" if p_int in red_set else "black")
    await pragmatic_feed_service.record_to_master_history(
        table_id=session.table_id or "manual",
        table_name=session.label,
        dealer_name=session.dealer_name or "Manual Dealer",
        dealer_id=None,
        pocket=p_int,
        color=color,
        direction=new_record.direction,
        segment_index=new_record.segment_index,
        offset_from_previous=new_record.offset_from_previous,
        game_id=new_record.id,
        db=db,
    )

    records.append(new_record)
    return tracker_service.compute_session_analytics(records, session.rules)

@router.delete("/sessions/{session_id}/spins/last", response_model=LiveSessionAnalytics)
async def delete_last_spin_entry(
    session_id: str,
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(LiveTrackingSession).where(LiveTrackingSession.id == session_id))
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    entries_res = await db.execute(
        select(LiveSpinEntry)
        .where(LiveSpinEntry.live_session_id == session_id)
        .order_by(LiveSpinEntry.sequence_order.desc())
    )
    entries = entries_res.scalars().all()
    if entries:
        last_entry = entries[0]
        await db.delete(last_entry)
        await db.commit()
        remaining_entries = entries[1:]
        remaining_entries.reverse()
    else:
        remaining_entries = []

    records = []
    for e in remaining_entries:
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

    return tracker_service.compute_session_analytics(records, session.rules)

@router.delete("/sessions/{session_id}/spins", response_model=LiveSessionAnalytics)
async def clear_all_spins(
    session_id: str,
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(LiveTrackingSession).where(LiveTrackingSession.id == session_id))
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    entries_res = await db.execute(
        select(LiveSpinEntry).where(LiveSpinEntry.live_session_id == session_id)
    )
    for entry in entries_res.scalars().all():
        await db.delete(entry)
    await db.commit()

    return tracker_service.compute_session_analytics([], session.rules)

@router.get("/casinos", response_model=List[CasinoConfigResponse])
async def get_active_casinos(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(CasinoConfig).where(CasinoConfig.is_active == True).order_by(CasinoConfig.is_default.desc(), CasinoConfig.created_at.asc()))
    casinos = result.scalars().all()
    return [
        CasinoConfigResponse(
            id=c.id,
            name=c.name,
            casino_id=c.casino_id,
            provider=c.provider or "pragmatic",
            is_default=bool(c.is_default),
            is_active=bool(c.is_active),
            notes=c.notes,
            created_at=c.created_at.isoformat() if c.created_at else "",
        )
        for c in casinos
    ]

@router.post("/live-feed/start")
async def start_live_feed(payload: LiveFeedStartRequest, db: AsyncSession = Depends(get_db)):
    casino_id_to_use = payload.casino_id
    if not casino_id_to_use:
        result = await db.execute(select(CasinoConfig).where(CasinoConfig.is_default == True))
        default_casino = result.scalar_one_or_none()
        if default_casino:
            casino_id_to_use = default_casino.casino_id
        else:
            casino_id_to_use = "ppcdk00000003716"
            
    if casino_id_to_use:
        pragmatic_feed_service.set_casino_id(casino_id_to_use)
    if payload.currency:
        pragmatic_feed_service.currency = payload.currency
    await pragmatic_feed_service.start(target_tables=payload.table_keys)
    return {
        "status": "started",
        "running": pragmatic_feed_service._running,
        "casino_id": pragmatic_feed_service.casino_id,
        "subscribed_keys": list(pragmatic_feed_service.subscribed_keys),
    }

@router.post("/live-feed/stop")
async def stop_live_feed():
    await pragmatic_feed_service.stop()
    return {"status": "stopped", "running": False}

@router.get("/live-feed/status")
async def get_live_feed_status():
    return {
        "running": pragmatic_feed_service._running,
        "casino_id": pragmatic_feed_service.casino_id,
        "currency": pragmatic_feed_service.currency,
        "subscribed_keys": list(pragmatic_feed_service.subscribed_keys),
        "tables_discovered": len(pragmatic_feed_service.available_tables),
        "bound_tables": pragmatic_feed_service.active_table_session_map,
    }

@router.get("/live-feed/tables")
async def get_live_feed_tables():
    return list(pragmatic_feed_service.available_tables.values())

@router.post("/live-feed/bind")
async def bind_live_feed_table(payload: LiveFeedBindRequest, db: AsyncSession = Depends(get_db)):
    pragmatic_feed_service.bind_table_to_session(payload.table_id, payload.session_id)
    
    # Enrich session in DB with table name and active dealer if available
    sess_res = await db.execute(select(LiveTrackingSession).where(LiveTrackingSession.id == payload.session_id))
    session = sess_res.scalar_one_or_none()
    table_meta = pragmatic_feed_service.available_tables.get(payload.table_id)
    if session and table_meta:
        session.table_id = payload.table_id
        table_name = table_meta.get("tableName", f"Table {payload.table_id}")
        dealer_info = table_meta.get("dealer")
        if dealer_info and isinstance(dealer_info, dict) and dealer_info.get("name"):
            session.dealer_name = dealer_info.get("name")
        session.label = f"{table_name} • {session.dealer_name or 'Live'}"
        await db.commit()

    analytics = None
    if table_meta and table_meta.get("lastResults"):
        analytics = await pragmatic_feed_service.bootstrap_session_spins_direct(
            payload.session_id,
            table_meta["lastResults"],
            db
        )

    return {
        "status": "bound",
        "table_id": payload.table_id,
        "session_id": payload.session_id,
        "analytics": analytics,
    }

@router.post("/live-feed/unbind")
async def unbind_live_feed_table(payload: LiveFeedBindRequest):
    pragmatic_feed_service.unbind_table(payload.table_id)
    pragmatic_feed_service.unbind_session(payload.session_id)
    return {"status": "unbound", "table_id": payload.table_id, "session_id": payload.session_id}

@router.get("/history/dealer/{dealer_name:path}/analytics", response_model=LiveSessionAnalytics)
async def get_dealer_historical_analytics(
    dealer_name: str,
    rules: str = "EUR",
    limit: int = 500,
    db: AsyncSession = Depends(get_db)
):
    query = (
        select(TableDealerSpinHistory)
        .where(
            (TableDealerSpinHistory.dealer_name == dealer_name) |
            (TableDealerSpinHistory.dealer_name == f"{dealer_name}.") |
            (TableDealerSpinHistory.dealer_name == dealer_name.rstrip('.'))
        )
        .order_by(TableDealerSpinHistory.spun_at.desc())
        .limit(limit)
    )
    result = await db.execute(query)
    entries = list(reversed(result.scalars().all()))

    records: List[LiveSpinRecord] = []
    distinct_tables = set()

    for idx, e in enumerate(entries):
        p_val = e.pocket_number
        if e.table_name:
            distinct_tables.add(e.table_name)
        elif e.table_id:
            distinct_tables.add(f"Table {e.table_id}")

        records.append(LiveSpinRecord(
            id=e.id,
            pocket_number=p_val,
            direction=e.direction or "cw",
            sequence_order=idx + 1,
            entered_at=e.spun_at.isoformat() if e.spun_at else "",
            segment_index=e.segment_index or tracker_service.get_pocket_segment(p_val, rules),
            wheel_index=tracker_service.get_wheel_index(p_val, rules),
            offset_from_previous=e.offset_from_previous,
        ))

    analytics = tracker_service.compute_session_analytics(records, rules)
    analytics.context_type = "dealer"
    analytics.context_name = dealer_name
    analytics.distinct_tables = sorted(list(distinct_tables))
    return analytics

@router.get("/history/table/{table_id}/analytics", response_model=LiveSessionAnalytics)
async def get_table_historical_analytics(
    table_id: str,
    rules: str = "EUR",
    limit: int = 500,
    db: AsyncSession = Depends(get_db)
):
    query = (
        select(TableDealerSpinHistory)
        .where(TableDealerSpinHistory.table_id == table_id)
        .order_by(TableDealerSpinHistory.spun_at.desc())
        .limit(limit)
    )
    result = await db.execute(query)
    entries = list(reversed(result.scalars().all()))

    records: List[LiveSpinRecord] = []
    distinct_dealers = set()
    table_name = f"Table {table_id}"

    for idx, e in enumerate(entries):
        p_val = e.pocket_number
        if e.table_name:
            table_name = e.table_name
        if e.dealer_name:
            distinct_dealers.add(e.dealer_name)

        records.append(LiveSpinRecord(
            id=e.id,
            pocket_number=p_val,
            direction=e.direction or "cw",
            sequence_order=idx + 1,
            entered_at=e.spun_at.isoformat() if e.spun_at else "",
            segment_index=e.segment_index or tracker_service.get_pocket_segment(p_val, rules),
            wheel_index=tracker_service.get_wheel_index(p_val, rules),
            offset_from_previous=e.offset_from_previous,
        ))

    analytics = tracker_service.compute_session_analytics(records, rules)
    analytics.context_type = "table"
    analytics.context_name = table_name
    analytics.distinct_dealers = sorted(list(distinct_dealers))
    return analytics

@router.get("/history/stats", response_model=HistoricalArchiveStats)
async def get_history_stats(db: AsyncSession = Depends(get_db)):
    # Total spins
    cnt_res = await db.execute(select(func.count(TableDealerSpinHistory.id)))
    total_spins = cnt_res.scalar() or 0

    # Dealers breakdown
    dealer_res = await db.execute(
        select(TableDealerSpinHistory.dealer_name, func.count(TableDealerSpinHistory.id))
        .where(TableDealerSpinHistory.dealer_name.isnot(None))
        .group_by(TableDealerSpinHistory.dealer_name)
        .order_by(func.count(TableDealerSpinHistory.id).desc())
    )
    dealers = [{"name": row[0], "spins": row[1]} for row in dealer_res.all()]

    # Tables breakdown
    table_res = await db.execute(
        select(TableDealerSpinHistory.table_id, TableDealerSpinHistory.table_name, func.count(TableDealerSpinHistory.id))
        .group_by(TableDealerSpinHistory.table_id, TableDealerSpinHistory.table_name)
        .order_by(func.count(TableDealerSpinHistory.id).desc())
    )
    tables = [{"id": row[0], "name": row[1] or f"Table {row[0]}", "spins": row[2]} for row in table_res.all()]

    return HistoricalArchiveStats(
        total_spins=total_spins,
        dealers=dealers,
        tables=tables,
    )


