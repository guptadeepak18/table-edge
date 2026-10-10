import json
import re
import uuid
from typing import Optional, List, Dict, Any, Tuple
import httpx

from app.core.config import settings
from app.core.constants import BET_PAYOUT_MULTIPLIERS
from app.schemas.strategy import (
    StrategyCondition,
    AIConditionSuggestionRequest,
    AIConditionSuggestionResponse,
)

STANDARD_TRIGGERS = [
    "total_loss", "partial_loss", "any_loss",
    "partial_win", "max_win", "any_win",
    "profit_loss", "new_peak",
    "consecutive_losses", "consecutive_wins", "drawdown_gte"
]

STANDARD_ACTIONS = [
    "increase_level", "decrease_level", "goto_level",
    "reset_to_start", "keep_level",
    "increase_multiplier", "decrease_multiplier",
    "double_multiplier", "triple_multiplier", "half_multiplier",
    "stop_simulation"
]

STANDARD_COMPARISONS = [
    "session_profit_gte", "session_loss_gte",
    "spin_profit_gte", "spin_loss_gte",
    "session_profit_incremental"
]

class AIAdvisorService:
    @classmethod
    async def suggest_conditions(
        cls,
        req: AIConditionSuggestionRequest
    ) -> AIConditionSuggestionResponse:
        """
        Analyzes the strategy's level structure, covered pockets, payout distribution,
        and mathematical edge to synthesize optimal workflow conditions for maximizing
        chances of winning and bankroll survival.
        """
        rules = req.rules.upper()
        max_pockets = 38 if rules == "USA" else 37
        
        # Analyze strategy layout math
        analysis = cls._analyze_strategy_payouts(req.levels, rules, max_pockets)
        
        # Determine provider preference
        provider = (req.model_provider or "auto").lower()
        
        parsed_data = None
        used_model = None

        # 1. Try selected / preferred model
        if "nvidia" in provider and settings.NVIDIA_API_KEY:
            try:
                parsed_data = await cls._call_nvidia_llm(req, analysis, settings.NVIDIA_API_KEY)
                used_model = "NVIDIA NIM (Llama 3.2 11B Vision Instruct)"
            except Exception as e:
                print(f"[AI Advisor] NVIDIA call failed: {e}. Falling back...")

        elif "deepseek" in provider and settings.OPENROUTER_API_KEY:
            try:
                parsed_data = await cls._call_openrouter_llm(req, analysis, settings.OPENROUTER_API_KEY, model="deepseek/deepseek-chat")
                used_model = "OpenRouter (DeepSeek Chat)"
            except Exception as e:
                print(f"[AI Advisor] DeepSeek call failed: {e}. Falling back...")

        elif "gpt" in provider or "openrouter" in provider:
            if settings.OPENROUTER_API_KEY:
                try:
                    parsed_data = await cls._call_openrouter_llm(req, analysis, settings.OPENROUTER_API_KEY, model="openai/gpt-4o-mini")
                    used_model = "OpenRouter (GPT-4o-mini)"
                except Exception as e:
                    print(f"[AI Advisor] OpenRouter GPT-4o-mini call failed: {e}. Falling back...")

        # 2. If 'auto' or preferred failed, run cascade
        if not parsed_data:
            # Try OpenRouter GPT-4o-mini first (highest reliability)
            if settings.OPENROUTER_API_KEY:
                try:
                    parsed_data = await cls._call_openrouter_llm(req, analysis, settings.OPENROUTER_API_KEY, model="openai/gpt-4o-mini")
                    used_model = "OpenRouter (GPT-4o-mini)"
                except Exception as e:
                    print(f"[AI Advisor Cascade] OpenRouter GPT-4o-mini failed: {e}")

            # Try NVIDIA NIM
            if not parsed_data and settings.NVIDIA_API_KEY:
                try:
                    parsed_data = await cls._call_nvidia_llm(req, analysis, settings.NVIDIA_API_KEY)
                    used_model = "NVIDIA NIM (Llama 3.2 11B Vision Instruct)"
                except Exception as e:
                    print(f"[AI Advisor Cascade] NVIDIA failed: {e}")

        # 3. Deterministic quantitative fallback if network/API keys unavailable
        if not parsed_data:
            parsed_data = cls._quantitative_fallback_optimizer(req, analysis)
            used_model = "Quantitative Edge Optimizer (Deterministic Heuristic)"

        # Assemble StrategyCondition models
        suggested_conditions: List[StrategyCondition] = []
        condition_reasons: Dict[str, str] = {}

        for raw_c in parsed_data.get("suggested_conditions", []):
            cond_id = raw_c.get("id") or f"ai-cond-{uuid.uuid4().hex[:6]}"
            trig = raw_c.get("trigger", "total_loss")
            act = raw_c.get("action", "increase_multiplier")
            comp = raw_c.get("comparison")
            
            # Sanitize trigger & action
            if trig not in STANDARD_TRIGGERS:
                trig = "total_loss"
            if act not in STANDARD_ACTIONS:
                act = "increase_multiplier"
            if comp and comp not in STANDARD_COMPARISONS:
                comp = None

            cond = StrategyCondition(
                id=cond_id,
                trigger=trig,
                triggerCount=int(raw_c.get("trigger_count", raw_c.get("triggerCount", 1))),
                comparison=comp,
                thresholdAmount=float(raw_c["threshold_amount"]) if raw_c.get("threshold_amount") is not None else (float(raw_c["thresholdAmount"]) if raw_c.get("thresholdAmount") is not None else None),
                thresholdIncrement=float(raw_c["threshold_increment"]) if raw_c.get("threshold_increment") is not None else (float(raw_c["thresholdIncrement"]) if raw_c.get("thresholdIncrement") is not None else None),
                action=act,
                actionValue=int(raw_c.get("action_value", raw_c.get("actionValue", 1))),
                multiplier=float(raw_c.get("multiplier", 1.0)),
                multiplierMode=raw_c.get("multiplier_mode", raw_c.get("multiplierMode", "fixed")),
                reason=raw_c.get("reason", "Optimized by AI Advisor"),
            )
            suggested_conditions.append(cond)
            if raw_c.get("reason"):
                condition_reasons[cond_id] = raw_c["reason"]

        return AIConditionSuggestionResponse(
            title=parsed_data.get("title", f"AI Win-Maximizer: {req.strategy_name or 'Custom Strategy'}"),
            diagnosis=parsed_data.get("diagnosis", "Automated strategy analysis completed."),
            mathematical_edge_summary=parsed_data.get("mathematical_edge_summary", analysis.get("summary", "")),
            suggested_conditions=suggested_conditions,
            condition_reasons=condition_reasons,
            predicted_impact=parsed_data.get("predicted_impact", "Enhances win rate consistency while providing automated drawdown brakes."),
            archetype=parsed_data.get("archetype", analysis.get("archetype", "Adaptive Dynamic Progression")),
            used_ai_model=used_model or "AI Quantitative Advisor",
        )

    @classmethod
    def _analyze_strategy_payouts(cls, levels: List[Any], rules: str, max_pockets: int) -> Dict[str, Any]:
        """Calculates exact pocket coverage, payout tiers, win probability, and loss profile for Level 1."""
        if not levels:
            return {"summary": "Empty strategy", "win_rate": 0, "coverage_pct": 0, "archetype": "Unknown"}

        lvl1 = levels[0]
        base_wager = float(lvl1.total_wager) if lvl1.total_wager > 0 else sum(float(b.amount) for b in lvl1.placements)
        if base_wager <= 0:
            base_wager = 1.0

        pockets_payout = [0.0] * max_pockets
        for bet in lvl1.placements:
            default_mult = BET_PAYOUT_MULTIPLIERS.get(bet.bet_type, 1.0)
            mult = bet.multiplier if bet.multiplier > 0 else default_mult
            win_return = bet.amount * (mult + 1)
            for cov in bet.covered_pockets:
                c_idx = 37 if (rules == "USA" and str(cov) == "00") else int(cov)
                if 0 <= c_idx < max_pockets:
                    pockets_payout[c_idx] += win_return

        max_wins = sum(1 for p in pockets_payout if p > base_wager)
        partial_losses = sum(1 for p in pockets_payout if 0 < p < base_wager)
        total_losses = sum(1 for p in pockets_payout if p == 0)
        pushes = sum(1 for p in pockets_payout if abs(p - base_wager) < 0.001)

        win_prob = round((max_wins / max_pockets) * 100, 1)
        loss_prob = round(((partial_losses + total_losses) / max_pockets) * 100, 1)

        max_p = max(pockets_payout) if pockets_payout else 0.0
        max_net = max_p - base_wager

        archetype = "High-Coverage Harvester" if win_prob >= 60 else ("Balanced System" if win_prob >= 40 else "High-Volatility Longshot")

        summary = (
            f"Level 1 Base Wager: ${base_wager:.2f}. "
            f"Win Pockets: {max_wins}/{max_pockets} ({win_prob}% chance, up to +${max_net:.2f} net). "
            f"Partial Losses: {partial_losses}/{max_pockets} pockets. "
            f"Total Losses: {total_losses}/{max_pockets} pockets. "
            f"Expected Loss Rate: {loss_prob}%."
        )

        return {
            "base_wager": base_wager,
            "max_pockets": max_pockets,
            "win_pockets": max_wins,
            "partial_loss_pockets": partial_losses,
            "total_loss_pockets": total_losses,
            "pushes": pushes,
            "win_probability": win_prob,
            "loss_probability": loss_prob,
            "max_net_win": max_net,
            "archetype": archetype,
            "summary": summary,
        }

    @classmethod
    def _build_prompt(cls, req: AIConditionSuggestionRequest, analysis: Dict[str, Any]) -> str:
        strat_name = req.strategy_name or "Custom Strategy"
        bankroll = req.bankroll or 1000.0
        target = f"+${req.target_profit:.2f}" if req.target_profit else "Adaptive dynamic milestones"
        stop = f"-${req.stop_loss:.2f}" if req.stop_loss else "Automated loss mitigation"

        return f"""You are the Lead Quantitative Architect for TableEdge roulette analytics engine.
Analyze this roulette strategy layout and synthesize the mathematically optimal rule sequence for MAXIMUM CHANCES OF WINNING, capital preservation, and streak compounding.

STRATEGY DETAILS:
- Name: {strat_name}
- Rules: {req.rules} Roulette ({analysis['max_pockets']} pockets)
- Progression Levels: {len(req.levels)} level(s)
- Level 1 Base Wager: ${analysis['base_wager']:.2f}
- Pockets Profile:
  * Winning Pockets: {analysis['win_pockets']} pockets ({analysis['win_probability']}% hit rate, max net +${analysis['max_net_win']:.2f})
  * Partial Loss Pockets: {analysis['partial_loss_pockets']} pockets
  * Total Loss Pockets: {analysis['total_loss_pockets']} pockets
- Bankroll: ${bankroll:.2f}
- Take Profit Goal: {target}
- Stop Loss Limit: {stop}
- Optimization Goal: {req.optimization_goal or 'Maximum win probability & positive streak exploitation'}

ALLOWED SYSTEM TRIGGERS (use exact strings):
"total_loss", "partial_loss", "any_loss", "partial_win", "max_win", "any_win", "profit_loss", "new_peak", "consecutive_losses", "consecutive_wins", "drawdown_gte"

ALLOWED SYSTEM ACTIONS (use exact strings):
"increase_level", "decrease_level", "goto_level", "reset_to_start", "keep_level", "increase_multiplier", "decrease_multiplier", "double_multiplier", "triple_multiplier", "half_multiplier", "stop_simulation"

ALLOWED COMPARISONS (for profit_loss trigger):
"session_profit_gte", "session_loss_gte", "spin_profit_gte", "spin_loss_gte", "session_profit_incremental"

TASK:
Generate 3 to 4 synergistic, precision rules that maximize the win rate for this exact layout:
1. Handle Partial Loss vs Total Loss appropriately (e.g. if partial loss is small, +1 multiplier; if total loss, manage risk).
2. Exploit winning streaks (e.g. decrease multiplier or lock in profit after consecutive wins).
3. Capital protection / profit locking (e.g. reset to base on New Peak balance or incremental profit milestones).
4. Drawdown stop or de-escalation rule.

Return ONLY strict valid JSON matching:
{{
  "title": "Compelling Title for this AI Recommendation",
  "diagnosis": "2-3 sentences explaining the mathematical characteristics and vulnerabilities of this specific layout.",
  "mathematical_edge_summary": "1-2 sentences summarizing the win probability and risk-reward profile.",
  "suggested_conditions": [
    {{
      "id": "ai-rule-1",
      "trigger": "partial_loss",
      "trigger_count": 1,
      "comparison": null,
      "threshold_amount": null,
      "threshold_increment": null,
      "action": "increase_multiplier",
      "action_value": 1,
      "multiplier": 1.0,
      "multiplier_mode": "fixed",
      "reason": "Detailed mathematical justification of why this rule maximizes winning chances"
    }}
  ],
  "predicted_impact": "Expected outcome on win rate, drawdown reduction, and profit stabilization.",
  "archetype": "{analysis['archetype']}"
}}"""

    @classmethod
    async def _call_openrouter_llm(
        cls,
        req: AIConditionSuggestionRequest,
        analysis: Dict[str, Any],
        api_key: str,
        model: str = "openai/gpt-4o-mini"
    ) -> Dict[str, Any]:
        prompt = cls._build_prompt(req, analysis)
        async with httpx.AsyncClient(timeout=25.0) as client:
            resp = await client.post(
                "https://openrouter.ai/api/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": model,
                    "messages": [
                        {"role": "system", "content": "You are a quantitative roulette mathematician. Return only valid JSON."},
                        {"role": "user", "content": prompt},
                    ],
                    "response_format": {"type": "json_object"},
                    "max_tokens": 1400,
                }
            )
            if resp.status_code != 200:
                raise RuntimeError(f"OpenRouter ({model}) returned HTTP {resp.status_code}: {resp.text[:200]}")
            data = resp.json()
            raw = data["choices"][0]["message"]["content"]
            return json.loads(raw)

    @classmethod
    async def _call_nvidia_llm(
        cls,
        req: AIConditionSuggestionRequest,
        analysis: Dict[str, Any],
        api_key: str,
    ) -> Dict[str, Any]:
        prompt = cls._build_prompt(req, analysis)
        async with httpx.AsyncClient(timeout=25.0) as client:
            resp = await client.post(
                "https://integrate.api.nvidia.com/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": "meta/llama-3.2-11b-vision-instruct",
                    "messages": [
                        {"role": "system", "content": "You are a quantitative roulette strategy architect. Return strictly valid JSON with no markdown formatting."},
                        {"role": "user", "content": prompt},
                    ],
                    "max_tokens": 1400,
                }
            )
            if resp.status_code != 200:
                raise RuntimeError(f"NVIDIA NIM returned HTTP {resp.status_code}: {resp.text[:200]}")
            raw = resp.json()["choices"][0]["message"]["content"]
            
            # Clean markdown codeblocks if model included them
            clean = re.sub(r"^```json\s*", "", raw.strip())
            clean = re.sub(r"^```\s*", "", clean)
            clean = re.sub(r"\s*```$", "", clean)
            return json.loads(clean)

    @classmethod
    def _quantitative_fallback_optimizer(
        cls,
        req: AIConditionSuggestionRequest,
        analysis: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Deterministic quantitative rule optimizer tailored to the layout's exact payout profile.
        """
        win_prob = analysis["win_probability"]
        has_partial_loss = analysis["partial_loss_pockets"] > 0
        base_wager = analysis["base_wager"]
        num_levels = len(req.levels)

        rules: List[Dict[str, Any]] = []

        # 1. Partial loss recovery rule
        if has_partial_loss:
            rules.append({
                "id": "opt-partial-loss",
                "trigger": "partial_loss",
                "trigger_count": 1,
                "action": "increase_multiplier",
                "action_value": 1,
                "reason": f"Recovers the minor partial loss with a measured 1x wager step without incurring excessive drawdowns."
            })

        # 2. Total loss mitigation
        if win_prob >= 60:
            # High win rate: total loss is rare; moderate double or step
            rules.append({
                "id": "opt-total-loss",
                "trigger": "total_loss",
                "trigger_count": 1,
                "action": "double_multiplier" if num_levels <= 1 else "increase_level",
                "action_value": 2 if num_levels <= 1 else 1,
                "reason": f"With a {win_prob}% win probability, total loss is a statistical anomaly; doubling multiplier ensures immediate recovery on the next high-probability hit."
            })
        else:
            rules.append({
                "id": "opt-total-loss",
                "trigger": "consecutive_losses",
                "trigger_count": 2,
                "action": "increase_level" if num_levels > 1 else "increase_multiplier",
                "action_value": 1,
                "reason": "Waits for 2 consecutive losses before escalating bet, preventing rapid capital depletion on choppy sessions."
            })

        # 3. Winning streak de-escalation / profit harvesting
        rules.append({
            "id": "opt-win-deescalate",
            "trigger": "any_win",
            "trigger_count": 2,
            "action": "decrease_multiplier" if num_levels <= 1 else "decrease_level",
            "action_value": 1,
            "reason": "Harvests accrued profits by stepping down wager size after every 2 wins, locking in gains before reversion to the mean."
        })

        # 4. Bankroll peak reset
        rules.append({
            "id": "opt-peak-reset",
            "trigger": "new_peak",
            "trigger_count": 1,
            "action": "reset_to_start",
            "action_value": 1,
            "reason": "Instantly resets wager to base bet (1.0x) upon establishing a New All-Time Peak balance, creating a ratchet effect that locks in session profit."
        })

        return {
            "title": f"Quantitative Edge Optimizer ({analysis['archetype']})",
            "diagnosis": f"Strategy features a {win_prob}% win probability across {analysis['win_pockets']} pockets. The primary risk is asymmetric drawdowns during consecutive total loss events.",
            "mathematical_edge_summary": f"{win_prob}% win probability. Recommended progression pairs measured loss escalation with an immediate ratchet reset on new peak balance.",
            "suggested_conditions": rules,
            "predicted_impact": "Significantly compresses maximum drawdown depth while maximizing the probability of exiting in net profit.",
            "archetype": analysis["archetype"]
        }

ai_advisor_service = AIAdvisorService()
