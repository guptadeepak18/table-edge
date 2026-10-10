import pytest
from httpx import AsyncClient, ASGITransport
from sqlalchemy import select
from app.main import app
from app.core.database import engine, Base, AsyncSessionLocal
from app.models.user import SubscriptionTier, TierConfig
from app.core.security import create_access_token

@pytest.mark.asyncio
async def test_full_api_integration():
    # Ensure database schema is created
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    # Seed admin user and default tiers if not present
    async with AsyncSessionLocal() as session:
        from app.models.user import User
        user_res = await session.execute(select(User).where((User.id == "admin-1") | (User.email == "admin@tableedge.com")))
        admin_user = user_res.scalar_one_or_none()
        if not admin_user:
            admin_user = User(
                id="admin-1",
                email="admin@tableedge.com",
                password_hash="mock_hash",
                display_name="Admin User",
                is_admin=True,
            )
            session.add(admin_user)

        tier_res = await session.execute(select(SubscriptionTier))
        if not tier_res.scalars().all():
            free_tier = SubscriptionTier(id="tier-free", name="Free", price_cents=0, is_active=True)
            pro_tier = SubscriptionTier(id="tier-pro", name="Pro", price_cents=1299, is_active=True)
            session.add_all([free_tier, pro_tier])
            await session.flush()
            session.add_all([
                TierConfig(tier_id="tier-free", config_key="max_backtest_sessions", config_value=100),
                TierConfig(tier_id="tier-pro", config_key="max_backtest_sessions", config_value=50000),
            ])
        await session.commit()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. Root
        res = await client.get("/")
        assert res.status_code == 200
        assert res.json()["status"] == "ok"

        # 2. Simulator Spin
        spin_payload = {
            "rules": "EUR",
            "bets": [
                {
                    "id": "b1",
                    "bet_type": "straight",
                    "covered_pockets": [17],
                    "amount": 10.0,
                    "multiplier": 35.0
                }
            ]
        }
        spin_res = await client.post("/api/simulator/spin", json=spin_payload)
        assert spin_res.status_code == 200
        spin_data = spin_res.json()
        assert "pocket_number" in spin_data
        assert "seed_hash" in spin_data
        assert spin_data["rng_method"] == "secrets.randbelow"
        assert "hot_numbers" in spin_data
        assert "cold_numbers" in spin_data
        assert len(spin_data["hot_numbers"]) == 5
        assert len(spin_data["cold_numbers"]) == 5

        # 2b. Verify Database Hot/Cold Stats Endpoint
        hc_res = await client.get("/api/simulator/stats/hot-cold?rules=EUR")
        assert hc_res.status_code == 200
        hc_data = hc_res.json()
        assert hc_data["total_spins"] >= 1
        assert len(hc_data["hot_numbers"]) == 5
        assert len(hc_data["cold_numbers"]) == 5

        # 2c. Verify Database Logged Spins Endpoint
        spins_list_res = await client.get("/api/simulator/spins?limit=10")
        assert spins_list_res.status_code == 200
        spins_list = spins_list_res.json()
        assert len(spins_list) >= 1
        assert spins_list[0]["strategy_name"] == "Manual Bet"
        assert "net_win" in spins_list[0]

        # 2d. Verify spin with custom strategy and progression level logging
        spin_strat_payload = {
            "rules": "EUR",
            "session_id": "sess-strat-test",
            "strategy_name": "Tier-1 Martingale",
            "level_number": 2,
            "client_bankroll": 5000.0,
            "bets": [
                {
                    "id": "b-split",
                    "bet_type": "split",
                    "covered_pockets": [10, 11],
                    "amount": 25.0,
                    "multiplier": 17.0
                }
            ]
        }
        strat_spin_res = await client.post("/api/simulator/spin", json=spin_strat_payload)
        assert strat_spin_res.status_code == 200
        strat_spin_data = strat_spin_res.json()
        assert strat_spin_data["total_bet"] == 25.0
        assert strat_spin_data["resulting_bankroll"] is not None
        
        # Verify in spins list
        verify_spins = await client.get("/api/simulator/spins?session_id=sess-strat-test")
        assert verify_spins.status_code == 200
        logged_spins = verify_spins.json()
        assert len(logged_spins) >= 1
        assert logged_spins[0]["strategy_name"] == "Tier-1 Martingale"
        assert logged_spins[0]["strategy_level"] == 2
        assert len(logged_spins[0]["bet_details"]) == 1

        # 3. Backtest
        backtest_payload = {
            "initial_bankroll": 500.0,
            "total_sessions": 100,
            "rules": "EUR",
            "levels": [
                {
                    "level_number": 1,
                    "total_wager": 10.0,
                    "placements": [
                        {
                            "id": "b1",
                            "bet_type": "outside_black",
                            "covered_pockets": [2, 4, 6, 8, 10, 11, 13, 15, 17, 20, 22, 24, 26, 28, 29, 31, 33, 35],
                            "amount": 10.0,
                            "multiplier": 1.0
                        }
                    ]
                }
            ]
        }
        bt_res = await client.post("/api/simulator/backtest", json=backtest_payload)
        assert bt_res.status_code == 200
        bt_data = bt_res.json()
        assert bt_data["total_sessions"] == 100
        assert len(bt_data["history"]) == 101

        # 3b. Advanced Backtest API
        adv_payload = {
            "initial_bankroll": 1000.0,
            "total_spins": 50,
            "rules": "EUR",
            "levels": [
                {
                    "level_number": 1,
                    "total_wager": 10.0,
                    "placements": [
                        {
                            "id": "b1",
                            "bet_type": "outside_black",
                            "covered_pockets": [2, 4, 6, 8, 10, 11, 13, 15, 17, 20, 22, 24, 26, 28, 29, 31, 33, 35],
                            "amount": 10.0,
                            "multiplier": 1.0
                        }
                    ]
                }
            ],
            "conditions": [
                {
                    "id": "c1",
                    "trigger": "total_loss",
                    "trigger_count": 1,
                    "action": "increase_level",
                    "action_value": 1
                }
            ]
        }
        adv_res = await client.post("/api/simulator/backtest/advanced", json=adv_payload)
        assert adv_res.status_code == 200
        adv_data = adv_res.json()
        assert adv_data["totalSpins"] == 50
        assert adv_data["completedSpins"] > 0
        assert len(adv_data["history"]) == adv_data["completedSpins"] + 1
        assert "expectancyRatio" in adv_data
        assert "aiSuggestions" in adv_data


        # 4. Tracker Session & Spins
        sess_res = await client.post("/api/tracker/sessions", json={
            "rules": "EUR",
            "casino": "Bellagio",
            "table_id": "Table-7",
            "dealer_name": "Maria",
            "label": "Bellagio Table 7 - Maria"
        })
        assert sess_res.status_code == 200
        session_id = sess_res.json()["id"]

        # Add 3 spins
        for p in [0, 32, 15]:
            spin_res = await client.post(f"/api/tracker/sessions/{session_id}/spins", json={
                "pocket_number": p,
                "direction": "cw"
            })
            assert spin_res.status_code == 200
        
        analytics = spin_res.json()
        assert analytics["total_spins"] == 3
        assert len(analytics["segment_stats"]) == 6
        assert analytics["prediction"] is not None

        # 5. Admin Tiers & Audit Log
        admin_token = create_access_token({"sub": admin_user.id})
        admin_headers = {"Authorization": f"Bearer {admin_token}"}
        tiers_res = await client.get("/api/admin/tiers", headers=admin_headers)
        assert tiers_res.status_code == 200
        tiers = tiers_res.json()
        assert len(tiers) >= 2
        free_tier = next(t for t in tiers if t["name"] == "Free")
        
        # Update config
        update_res = await client.put(f"/api/admin/tiers/{free_tier['id']}/config", json={
            "changed_by_user_id": admin_user.id,
            "config_key": "max_backtest_sessions",
            "new_value": 250
        }, headers=admin_headers)
        assert update_res.status_code == 200

        # Verify audit log
        audit_res = await client.get("/api/admin/audit-logs", headers=admin_headers)
        assert audit_res.status_code == 200
        audit_logs = audit_res.json()
        assert len(audit_logs) >= 1
        assert audit_logs[0]["new_value"] == 250

        # 6. Condition Options Listing
        cond_res = await client.get("/api/simulator/conditions/options")
        assert cond_res.status_code == 200
        cond_data = cond_res.json()
        assert "triggers" in cond_data
        assert "actions" in cond_data
        assert "comparisons" in cond_data
        assert any(t["value"] == "consecutive_losses" for t in cond_data["triggers"])
        assert any(a["value"] == "double_multiplier" for a in cond_data["actions"])

        # 7. Create Custom Condition Option
        custom_opt_res = await client.post("/api/simulator/conditions/options", json={
            "category": "action",
            "value": "quadruple_bet",
            "label": "Quadruple Bet (4×)",
            "description": "Multiplies current bet by 4",
            "created_by": "test_suite"
        })
        assert custom_opt_res.status_code == 200
        assert custom_opt_res.json()["value"] == "quadruple_bet"

        # Verify it now appears in condition options list
        cond_res_after = await client.get("/api/simulator/conditions/options")
        assert any(a["value"] == "quadruple_bet" for a in cond_res_after.json()["actions"])

        # 8. Natural Language Strategy Parsing
        nl_res = await client.post("/api/simulator/strategy/parse-natural-language", json={
            "prompt": "Start with $10 on Black and $2 on split 14-17. If I lose 2 times in a row, double bet. If session profit exceeds $100, reset to initial. If bankroll drops below $300, stop. Total bankroll $1000.",
            "rules": "EUR"
        })
        assert nl_res.status_code == 200
        nl_data = nl_res.json()
        assert nl_data["parameters"]["bankroll"] == 1000.0
        assert len(nl_data["levels"]) >= 1
        assert len(nl_data["conditions"]) >= 1
        assert nl_data["rules"] == "EUR"

        # 9. AI Condition Suggestion
        ai_res = await client.post("/api/simulator/ai-suggest-conditions", json={
            "strategy_name": "Test Roulette System",
            "rules": "EUR",
            "bankroll": 1000.0,
            "levels": [
                {
                    "level_number": 1,
                    "total_wager": 15.0,
                    "placements": [
                        {
                            "id": "b1",
                            "bet_type": "outside_black",
                            "covered_pockets": [2, 4, 6, 8, 10, 11, 13, 15, 17, 20, 22, 24, 26, 28, 29, 31, 33, 35],
                            "amount": 10.0,
                            "multiplier": 1.0
                        },
                        {
                            "id": "b2",
                            "bet_type": "corner",
                            "covered_pockets": [1, 2, 4, 5],
                            "amount": 5.0,
                            "multiplier": 8.0
                        }
                    ]
                }
            ],
            "model_provider": "auto",
            "optimization_goal": "max_win_rate"
        })
        assert ai_res.status_code == 200
        ai_data = ai_res.json()
        assert "title" in ai_data
        assert "diagnosis" in ai_data
        assert "suggested_conditions" in ai_data
        assert len(ai_data["suggested_conditions"]) >= 1
        assert "used_ai_model" in ai_data



