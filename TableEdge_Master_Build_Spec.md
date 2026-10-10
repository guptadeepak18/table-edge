# TableEdge — Master Build Specification (v1)

> **Note to the build agent (Antigravity):** This is a complete, standalone build spec for a two-module SaaS product. It merges business rationale, functional requirements, exact game-math, UI/UX detail, data model, and phased sequencing. Sections are ordered so that Phase 1 code (§5) can start from §5–§6 alone; §7 (Module B), §8 (data model), and §9 (admin/billing) are needed before Phase 5–6. Treat every numeric default in §9.2 as a seed value, not a hardcoded constant — the whole point of §9.3 is that these are admin-editable at runtime.

---

## 1. Product Overview & Business Rationale

### 1.1 Vision
**TableEdge** bundles two independent tools under one subscription for roulette players who want an analytical edge — virtual or real:

- **Module A — Strategy Simulator**: a pure-RNG practice environment where users build and save their own betting progressions, then stress-test them across thousands of simulated sessions via a Monte Carlo backtester.
- **Module B — Dealer Signature Tracker**: a manual spin-logging tool for real (physical or live-dealer) tables, surfacing sector/dealer patterns in a user's own observed data.

These modules share only account and billing infrastructure — no data crosses between them (§3).

### 1.2 Competitive positioning

| Product | Model | What it does | Gap TableEdge fills |
| --- | --- | --- | --- |
| **Winjot** | Fully paywalled, no free tier | RNG roulette simulator, strategy levels, backtester | No freemium on-ramp; single-module only |
| **Roulette Kicker / Roulette Kicker PRO** | One-time paid iOS app (~$180 for PRO) | Dealer Signature Tracker (DST), wheel signature, neighbors strategy, live-table stats | iOS-only, one-time purchase (no recurring revenue), no simulator/backtester |
| **SpinSignature** | Unclear (client-rendered site, pricing not observed) | Dealer signature tracking for live tables | Single-module; no strategy simulator |
| **TableEdge** | Freemium web + mobile subscription | Both: RNG backtester **and** live dealer-signature tracker, one account | First to combine both categories under one recurring subscription, with a free on-ramp |

### 1.3 Business model
- **Freemium subscription**, monthly/annual, via a third-party billing provider (e.g., Stripe).
- Free tier drives signups on Module A's core loop; paid tier monetizes on unlimited saved strategies, full-scale backtesting, and all of Module B (§9).
- Roulette-only at launch; the data layer is deliberately not roulette-locked so blackjack/baccarat can follow once roulette proves traction (non-goal for v1, tracked in §10).

### 1.4 Goals (v1)
- Match or exceed Winjot's simulator feature set (wheel physics, bet coverage, progression builder, backtester).
- Ship Module B as a genuinely distinct flow, not a re-skin of Module A.
- Convert free → paid on the strength of the backtester and unlimited saved strategies.
- Fully responsive on mobile web from day one (no native app in v1).

### 1.5 Success metrics (first 90 days post-launch)
- Free-to-paid conversion rate.
- Weekly active users running ≥1 backtest.
- Average saved strategies per paid user.
- Churn rate at first renewal.

### 1.6 Explicit non-goals (v1)
- No real-money wagering or payout of any kind — practice/analysis tool only, never a gambling operator.
- No blackjack, baccarat, or other games — roulette only.
- No native iOS/Android app — responsive web only (PWA is a reasonable stretch goal, not required).
- No live multiplayer, social, or leaderboard features.
- **No automated/scraped live-table data capture** — Module B is manual entry only (see §7.4 for why, and the decision record in §11).

---

## 2. Users & Core Use Cases

| Persona | Uses | Module |
| --- | --- | --- |
| Strategy hobbyist | Builds a progression, wants long-run expectancy before touching a real table | A |
| Systems tester | Runs thousands of simulated sessions comparing progressions by drawdown/bust rate | A |
| Live-table regular | Logs spins at a real table, checks for sector/dealer bias over a session | B |
| Free/curious user | Tries the simulator with capped limits before subscribing | Both |

**Core use cases**
1. Create a custom bet layout, save it as "Level 1" of a progression.
2. Chain levels into a full progression (win/loss rules at each), save as a named strategy.
3. Run that strategy through 1,000+ simulated sessions; see bankroll trajectory, bust rate, max drawdown before ever placing a real-money bet.
4. At a real table, log each spin as it happens; watch live sector/frequency stats build up.
5. As a free user, hit a usage cap and get prompted to upgrade.

---

## 3. Architecture Overview: Two Modules, One Account

One account, one subscription, a top-level switcher between modules. **No shared data model beyond the user/subscription record.**

| | Module A | Module B |
| --- | --- | --- |
| Data source | Server-generated RNG spins | User-entered real-world spins |
| Core value | "Does my system survive long-run variance?" | "Is this real wheel/dealer showing a pattern?" |
| Statistical basis | Every spin independent — no predictive signal exists, by design | Assumes physical bias/habit *can* exist — contested but commercially established premise |
| Interaction | Place bets, spin, build/backtest progressions | Tap in observed numbers, view sector analytics |

**Required UI treatment**: a persistent one-line banner in Module B — *"This module analyzes real-world spins you enter. It is not connected to Module A's simulator and does not predict RNG-based outcomes."* This prevents users from misreading Module A's hot/cold display as predictive, and protects against implying an RNG game can be beaten.

---

## 4. Module A — Strategy Simulator

### 4.1 Wheel configuration & RNG (integrity-critical)

Two rule sets, toggleable:

| Rule set | Pockets | House edge |
| --- | --- | --- |
| EUR | 37 (0–36) | 2.70% |
| USA | 38 (0–36, 00) | 5.26% |

**Canonical wheel-order pocket sequences** (required for racetrack/neighbor bets to be meaningful):
- **EUR**: `0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26`
- **USA**: `0, 28, 9, 26, 30, 11, 7, 20, 32, 17, 5, 22, 34, 15, 3, 24, 36, 13, 1, 00, 27, 10, 25, 29, 12, 8, 19, 31, 18, 6, 21, 33, 16, 4, 23, 35, 14, 2`

**RNG requirement (hard requirement, not a nice-to-have)**:
- All spin outcomes are generated **server-side** using a cryptographically secure RNG (e.g., Node `crypto.randomInt`), never client-side.
- Every spin persists its RNG method/seed metadata for auditability.
- This is the product's credibility foundation — a paid strategy-testing tool with a client-side or biased RNG is a trust-destroying bug, not a minor one.

### 4.2 Bet types, payouts & coordinate hit-mapping

| Bet type | Payout | Coverage | Placement target | Hit-detection boundary |
| --- | --- | --- | --- | --- |
| Straight up | 35:1 | 1 number | Center of number cell | Inner 60% of cell geometry |
| Split (H/V) | 17:1 | 2 adjacent numbers | Row/column divider line | Within 6px of divider |
| Street | 11:1 | 3 numbers (a row) | Top outer edge of row | Within 8px of top boundary |
| Corner | 8:1 | 4 numbers | 4-way intersection | Within 8px radius of vertex |
| Six-line | 5:1 | 6 numbers (2 rows) | Outer intersection of 2 rows | Within 8px radius |
| Dozen (1st/2nd/3rd) | 2:1 | 12 numbers | Dozen bounding box | Bounding box hit |
| Column | 2:1 | 12 numbers | 2:1 cell | Bounding box hit |
| Red/Black, Odd/Even, 1-18/19-36 | 1:1 | 18 numbers | Respective rectangles | Bounding box hit |

The betting felt is governed by an invisible raycasting/intersection hit-plane mapped across the canvas — implement bet placement as coordinate hit-testing against this table, not hardcoded per-cell click handlers, so the layout can be redrawn/reskinned without touching bet logic.

### 4.3 Racetrack / French call bets (EUR mode)

- **Voisins du Zéro** (9 chips / 17 numbers): `22, 18, 29, 7, 28, 12, 35, 3, 26, 0, 32, 15, 19, 4, 21, 2, 25`
- **Tiers du Cylindre** (6 chips / 12 numbers): `27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33`
- **Orphelins** (5 chips / 8 numbers): `1, 20, 14, 31, 9, 17, 34, 6`
- **Neighbor bets**: user picks a center number; engine auto-places equal chips on it plus N wheel-adjacent numbers each side (N ∈ {1,2,3,4}).

### 4.4 Bankroll & wager controls
- User-configurable starting bankroll, adjustable mid-session via a numeric-keypad "set bankroll" control.
- Configurable min/max bet limits.
- Default chip denominations (themeable): $1 / $5 / $10 / $20 / $40 / $100.
- Table actions: **Undo** last bet, **Double** (2× all current bets), **Clear** board, **Rebet** (repeat last spin's layout).

### 4.5 Rendering modes & wheel physics

**Two modes, both required:**
- **Fast mode**: no animation, result resolves in ~200ms.
- **Physical wheel mode**: full animated 3D wheel — built with **Three.js (r160+)** from day one (confirmed decision — not deferred, not a 2D-canvas placeholder). The RNG result is fixed *before* the animation starts; animation is presentation only and must never influence or appear to influence the outcome.

**Physics state machine:**
```
[ IDLE ]
   |  (User clicks SPIN)
   v
[ LAUNCH ] ----> Rotor accelerates CCW to peak angular velocity (ω_rotor ≈ 3.8 rad/s)
   |             Ball launches CW in outer rim track (ω_ball ≈ -9.2 rad/s)
   v
[ DECELERATION ] -> dω_rotor/dt = -α ;  dω_ball/dt = -β(ω_ball)^1.5
   |             Ball loses centrifugal grip, drops toward deflectors
   v
[ CHATTER ] ---> Ball collides with metal deflector studs/frets
   |             Elastic rebound with damping: v_rebound = -e·v_impact + jitter
   v
[ SETTLING ] --> RNG target pocket pulls ball into center cradle; dampens to 0
   |
   v
[ REVEAL ] ---> Overlay disk illuminates with winning number; board returns
```

**Pocket result presentation**: once the ball settles, a circular badge expands from the center turret in the winning pocket's color (red `#d32027` / black `#111417` / green `#008f39`), large bold white number in the middle, holds 1.2s, then a floating status card shows NET WIN ±$[amount] (green/red) before returning to the felt.

### 4.6 Sound design (Howler.js, audio sprite pool)

| Event | Profile | Notes |
| --- | --- | --- |
| Chip click | Ceramic transient clink, 25ms | Pitch randomized 0.96–1.04× |
| Chip stack | Staccato ceramic rattle, 60ms | Gain 0.7 |
| Chip sweep (clear) | Felt swish, low-pass white noise | 280ms |
| Wheel spin | Mechanical hum + bearing friction | Loops while ω > 0.4 |
| Ball roll | Metallic rolling on wood | Pitch tracks ball angular velocity |
| Ball chatter | Sharp metallic ping + bounces | Triggers 3–7× per drop |
| Ball drop | Muffled wood clatter | Single shot on lock |
| Win payout | Ascending chime (Cmaj7/E♭maj) | Gain 0.85 |
| Loss settle | Muted low-frequency thud | Low gain, soft cutoff |
| Modal alert | Digital double-beep | Clean sine |

### 4.7 Strategy builder (no predefined strategies — founder decision)

Every strategy is user-authored and saved. This is the core paid-tier differentiator.

- A **Level** = one bet layout (any combination from §4.2–4.3) plus its total wager.
- A **Strategy** = an ordered sequence of Levels (cap: 9, matching reference spec) plus win/loss rules per level.
- Users name and save strategies; private to the account; one-tap reload onto the live table.
- Actions: Add level (from current board state), Remove level, Reorder, Duplicate strategy, Delete strategy.

**Bet Placement Saves drawer** (UI spec):
- Header: `BET PLACEMENT SAVES` / Sub-header: `TAP LEVEL TO LOAD BOARD. TAP SAVE TO OVERWRITE CURRENT BOARD.`
- Rows: `[ LEVEL 1 - $18 ] [💾 SAVE]` through Level 9.
- Footer: `[+ ADD]` `[- REMOVE]` `[CLEAR ALL SAVES]` `[CLOSE]`.
- Clicking a level sweeps current chips and places the saved chip array with matching aggregate value.

**Session logic** (identical in manual play and backtesting):
1. Session starts at Level 1.
2. Level's bets are wagered against one spin.
3. Win → session ends WIN, net profit banked.
4. Loss → advance to next level; repeat.
5. Loss on final level → session ends LOSS, cumulative wager deducted.

### 4.8 Backtesting ("Test Strategy") engine

- **Inputs**: starting bankroll (default $1,000), sessions to simulate (10 / 100 / 1,000 / 10,000+ — actual max is admin-configurable per tier, §9.2).
- Runs off the main thread — Web Worker for client-side runs; for large runs (10,000+), prefer **server-side execution with progress streamed via WebSocket/SSE**, both to protect RNG integrity (§4.1) and avoid taxing low-end mobile devices.
- Optional stop conditions: stop-loss (halt below X), target profit (halt above Y).
- **Output metrics**: sessions won, sessions lost, win rate, max drawdown, peak bankroll, ending bankroll, net P/L, bankroll-over-sessions chart.
- Results saved per run — a user can compare multiple strategies' backtests side by side (paid-tier retention feature).

**Worker implementation pattern** (adapt for server-side execution — same algorithm, different execution context):
```ts
// simulation.worker.ts
export interface SimConfig {
  initialBankroll: number;
  totalSessions: number;
  rules: 'USA' | 'EUR';
  levels: { level: number; betTotal: number; placements: any[] }[];
}

self.onmessage = (e: MessageEvent<SimConfig>) => {
  const { initialBankroll, totalSessions, rules, levels } = e.data;
  let bankroll = initialBankroll;
  let sessionsWon = 0, sessionsLost = 0, maxDrawdown = 0, peakBankroll = initialBankroll;
  const history: number[] = [initialBankroll];
  const maxPocket = rules === 'USA' ? 38 : 37;

  for (let s = 0; s < totalSessions; s++) {
    let currentLevelIndex = 0, sessionWon = false;
    while (currentLevelIndex < levels.length && !sessionWon) {
      const activeLevel = levels[currentLevelIndex];
      bankroll -= activeLevel.betTotal;

      // Server-side: use crypto.randomInt(maxPocket) instead of client crypto.getRandomValues
      const randArr = new Uint32Array(1);
      crypto.getRandomValues(randArr);
      const landedNumber = randArr[0] % maxPocket;

      const payout = calculatePayout(activeLevel.placements, landedNumber, rules);
      if (payout > 0) { bankroll += payout; sessionWon = true; }
      else { currentLevelIndex++; }

      if (bankroll > peakBankroll) peakBankroll = bankroll;
      const currentDrawdown = peakBankroll - bankroll;
      if (currentDrawdown > maxDrawdown) maxDrawdown = currentDrawdown;
    }
    sessionWon ? sessionsWon++ : sessionsLost++;
    history.push(bankroll);

    if (s % 10 === 0 || s === totalSessions - 1) {
      self.postMessage({ type: 'PROGRESS', progress: (s + 1) / totalSessions,
        currentBankroll: bankroll, sessionsWon, sessionsLost, maxDrawdown, history });
    }
  }
  self.postMessage({ type: 'COMPLETE', bankroll, sessionsWon, sessionsLost, maxDrawdown, history });
};

function calculatePayout(placements: any[], landedNumber: number, rules: string): number {
  let total = 0;
  for (const bet of placements) {
    if (bet.coveredPockets.includes(landedNumber)) total += bet.amount * (bet.multiplier + 1);
  }
  return total;
}
```

**Design intent**: because every strategy converges to the same negative expectancy under a fair RNG, the backtester's real value is showing *how* a strategy fails — drawdown shape, bust probability, time-to-ruin — never implying any progression turns the edge positive. Reflect this in results-UI copy, not just a footer disclaimer.

### 4.9 UI layout reference

```
+-------------------------------------------------------------------------------------------------------+
| [HOT 8 21 27 28 2] [COLD 36 35 34 31] | [14][12][33][27][21][ 4][27][ 8][ 8][ 2][28][17] (History)    |
+---+---------------------------------------------------------------------------------------------------+
| G | +----+  +---------------------------------------------------------------------------------+ +----+ |
| E | |    |  |  3 |  6 |  9 | 12 | 15 | 18 | 21 | 24 | 27 | 30 | 33 | 36                      | |2to1| |
| A | | 00 |  +---------------------------------------------------------------------------------+ +----+ |
| R | |    |  |  2 |  5 |  8 | 11 | 14 | 17 | 20 | 23 | 26 | 29 | 32 | 35                      | |2to1| |
| - | +----+  +---------------------------------------------------------------------------------+ +----+ |
| L | | 0  |  |  1 |  4 |  7 | 10 | 13 | 16 | 19 | 22 | 25 | 28 | 31 | 34                      | |2to1| |
| O | +----+  +---------------------------------------------------------------------------------+ +----+ |
| G |         |            1ST 12           |           2ND 12            |           3RD 12        |        |
| - |         +---------------------------------------------------------------------------------+        |
| B |         |   1-18   |   EVEN   |    RED     |    BLACK    |    ODD    |       19-36        |        |
| O |         +---------------------------------------------------------------------------------+        |
| T |                                                                                                   |
+---+---------------------------------------------------------------------------------------------------+
| BANKROLL: $14,162 | BET: $90 | LAST WIN: $0 | LAST BET: $600 | NET WIN: -$600 | P/L: +$800            |
| [  SPIN  ]     [  UNDO  ]     ( ( LOGO CHIP ) )     [ DOUBLE (2X) ]     [ REMOVE / CLEAR ]     |
+-------------------------------------------------------------------------------------------------------+
```

**Top ribbon** (48px fixed height): History tape (last 15–30 outcomes as colored 32×32 tiles, sliding in from right with `cubic-bezier(0.2,0.8,0.2,1)`), Hot (top 5 frequency, `#22c55e`) / Cold (longest-absent 5, `#ef4444`) matrix.

**Left floating toolbar** (top:50%, left:12px, 44px wide): Performance Log, General Settings, Racetrack Switcher, Felt Color Shortcut, Bet Placement Saves, Strategy Testing Engine, Fullscreen toggle.

**Drawers/modals**:
- **General Settings**: EUR/USA toggle, Fast Mode toggle, Physical Wheel toggle, felt color picker, Set Bankroll.
- **Performance Log**: Last Win, Last Bet, Net Win, Profit/Loss, Peak, Low (max drawdown), Close.
- **Test Strategy modal**: bankroll + sessions inputs, live SVG/Canvas line chart (green `#00ff87` on black grid, bankroll vs. sessions), metrics grid (sessions won/lost, max drawdown, earnings, final bankroll, P/L, active level), Run/Stop, Reset Stats, Close.
- **"Placement Empty" dialog**: triggered on SPIN with $0 bet — `PLACEMENT EMPTY` / `PLACE SOME BETS ON THE BOARD FIRST!` / `[OK]`.
- **"Simulation Complete" dialog**: `SIMULATION COMPLETE` / `SIMULATION COMPLETED TARGET OF [X] SESSIONS REACHED.` / `[OK]`.

### 4.10 Design tokens

```css
:root {
  --bg-primary: #050b08;
  --felt-default: #0b3d24;
  --surface-panel: #0d1217;
  --surface-card: #151d24;
  --border-subtle: rgba(255, 255, 255, 0.12);
  --border-neon-green: #00ff87;

  --roulette-red: #d32027;
  --roulette-black: #111417;
  --roulette-green: #008f39;
  --table-line: #ffffff;

  --text-primary: #ffffff;
  --text-muted: #8e9ca8;
  --accent-gold: #eab308;
  --status-profit: #00e676;
  --status-loss: #ff3b30;
}
```

**Chip colorways**: $1 white/blue edge · $5 red/white edge · $10 deep blue/white edge · $20 crimson/light-pink edge · $40 purple/lavender edge · $100 black/gold edge.

**Typography**: Montserrat or Inter (400 regular, 600 semibold buttons, 800 heavy totals); felt numbers in Impact/Arial Black for visibility.

### 4.11 TypeScript data models (frontend contracts)

```ts
export type GameRules = 'USA' | 'EUR';

export interface Chip { id: string; denomination: 1 | 5 | 10 | 20 | 40 | 100; color: string; }

export interface BetPlacement {
  id: string;
  betType: 'straight' | 'split' | 'street' | 'corner' | 'sixline' | 'dozen' | 'column'
    | 'outside_red' | 'outside_black' | 'outside_even' | 'outside_odd' | 'outside_low' | 'outside_high';
  coordinateX: number; coordinateY: number;
  coveredPockets: number[];
  amount: number;
  multiplier: number; // 35 straight, 17 split, 1 red/black, etc.
}

export interface ProgressionLevel { levelNumber: number; totalWager: number; placements: BetPlacement[]; }

export interface SpinResult {
  id: string; pocketNumber: number; color: 'red' | 'black' | 'green';
  timestamp: number; totalBet: number; totalPayout: number; netWin: number; resultingBankroll: number;
}

export interface SimulatorState {
  bankroll: number; initialBankroll: number;
  activeBets: BetPlacement[]; savedLevels: ProgressionLevel[]; spinHistory: SpinResult[];
  rules: GameRules; fastMode: boolean; realMode: boolean; usePhysicalWheel: boolean;
  tableFeltColor: string; hotNumbers: number[]; coldNumbers: number[];

  placeChip: (target: BetPlacement, chip: Chip) => void;
  undoLastBet: () => void;
  doubleBets: () => void;
  clearBoard: () => void;
  rebet: () => void;
  executeSpin: () => Promise<SpinResult>;
  saveCurrentBoardToLevel: (levelIndex: number) => void;
  loadBoardFromLevel: (levelIndex: number) => void;
  setBankroll: (amount: number) => void;
  setRules: (rule: GameRules) => void;
}
```

---

## 5. Module B — Dealer Signature Tracker

### 5.1 Concept
Modeled on the commercial "dealer signature tracking" category (precedent: Roulette Kicker's DST/wheel-signature/neighbors features). Premise: on a physical or live-dealer wheel, a dealer's consistent ball-release habit plus physical wheel wear can, in theory, bias outcomes toward certain wheel *sectors*. This is genuinely contested among professional players — real commercial precedent exists, but it is not scientifically settled. Present it as pattern detection on the user's own data, never as a guaranteed edge.

### 5.2 Core flow
1. User starts a "Live Session," selects wheel type (EUR/USA), labels it (e.g., "Casino X — Table 3 — Dealer Maria").
2. After each real spin, user taps the observed number onto a number pad — **manual entry only, no RNG, no automated capture** (decision confirmed — see §11).
3. App computes, updating live:
   - Straight frequency table (count/% per number).
   - Hot/cold over the session and a rolling window (last 20/50 spins).
   - **Wheel-order** (not table-order) visualization showing physical clustering — the "sector" view a signature read depends on.
   - Neighbor-hit analysis: how often the next spin lands within N wheel-positions of the previous one.
4. Sessions save per labeled table/dealer for a longitudinal record across repeat visits.

### 5.3 What this module deliberately does NOT do
- No connection to Module A's RNG in any way.
- No claim of certainty — UI copy reads "observed pattern strength," never "predicted winning number."
- No auto-bet-on-predicted-sector — analysis only, never execution. This is also the safer product-liability position.
- **No automated/scraped data capture from any platform** — confirmed decision, see §11.

### 5.4 Number-entry UI requirement
Large, thumb-reachable tap targets (0–36 + 00), optimized for fast one-handed entry at a live table on mobile — this is the module's primary real-world usage context.

### 5.5 Compliance note (not legal advice)
Some jurisdictions restrict *using* predictive devices at a live table (a player-conduct rule at the casino/jurisdiction level, not a software-legality question). Marketing copy must avoid language implying guaranteed casino advantage. A legal review of terms-of-service and marketing language is scheduled at every build phase (§10).

---

## 6. Data Model — PostgreSQL Schema

```sql
-- Core identity & billing
users
  id, email, password_hash, display_name, is_admin,
  created_at, last_login_at

subscription_tiers          -- admin-managed, not hardcoded (see §9.3)
  id, name, price_cents, billing_provider_price_id, is_active,
  created_at, updated_at

tier_config                 -- flexible per-tier limits & feature flags
  id, tier_id (fk -> subscription_tiers), config_key, config_value (jsonb)

tier_config_audit_log       -- every tier_config change, for billing/entitlement traceability
  id, tier_config_id (fk), changed_by (fk -> users), old_value, new_value, changed_at

subscriptions
  id, user_id (fk), tier_id (fk -> subscription_tiers), status (active|canceled|past_due),
  billing_provider_ref, current_period_end, created_at

-- Module A
game_sessions                -- manual play sessions
  id, user_id (fk), rules (EUR|USA), starting_bankroll, ending_bankroll,
  started_at, ended_at

spins                        -- every RNG spin, live or backtest
  id, session_id (fk, nullable), backtest_run_id (fk, nullable),
  pocket_number, color, rng_method, created_at

strategies                   -- user-authored, saved
  id, user_id (fk), name, rules (EUR|USA), created_at, updated_at

strategy_levels
  id, strategy_id (fk), level_number, total_wager

bet_placements
  id, strategy_level_id (fk), bet_type, covered_pockets (int[]), amount, multiplier

backtest_runs                -- Monte Carlo results summary
  id, user_id (fk), strategy_id (fk), initial_bankroll, total_sessions,
  sessions_won, sessions_lost, max_drawdown, final_bankroll,
  session_history (jsonb),   -- avoid one row per simulated session at scale
  created_at

-- Module B
live_tracking_sessions
  id, user_id (fk), rules (EUR|USA), label, started_at, ended_at

live_spin_entries            -- manually entered real spins only
  id, live_session_id (fk), pocket_number, sequence_order, entered_at
```

**Design notes**
- `spins` and `live_spin_entries` are deliberately separate — structurally impossible to blend simulated and real data in analytics (reinforces §3).
- `strategies` → `strategy_levels` → `bet_placements` is a three-level hierarchy matching §4.7. Index `strategy_levels.strategy_id` and `bet_placements.strategy_level_id`.
- All monetary columns: `numeric`, never `float` (avoids rounding drift in payout math).
- Use a migration tool (Prisma, Drizzle, or Antigravity's native ORM) rather than hand-written migrations.

---

## 7. Subscription, Monetization & Admin Configuration

### 7.1 Freemium capability matrix (illustrative — see §9.2 for admin-editable defaults)

| Capability | Free | Paid |
| --- | --- | --- |
| Manual play (Module A), fast mode | ✓ | ✓ |
| Physical wheel animation | ✓ (capped/day) | ✓ unlimited |
| Saved strategies | 1 | Unlimited |
| Backtest sessions per run | Capped | Up to configured max |
| Backtest run history | Last 1 run | Full history + comparison |
| Racetrack / French bets | ✗ | ✓ |
| Module B | ✗ | ✓ |
| Live tracking session history | — | Unlimited, labeled |

### 7.2 Suggested admin default settings (seed values, not hardcoded)

| Setting | Suggested Free default | Suggested Paid default |
| --- | --- | --- |
| Price | $0 | $12.99/mo or $99/yr (~36% annual discount) |
| Saved strategies | 1 | Unlimited |
| Backtest sessions per run (max) | 100 | 50,000 |
| Backtest run history retained | 1 | Unlimited |
| Animated (physical wheel) spins/day | 15 | Unlimited |
| Racetrack/French bets | Locked | Unlocked |
| Module B access | Locked | Unlocked |
| Live tracking sessions stored | 0 | Unlimited |

*Rationale*: the free tier lets someone experience the core loop and even taste the backtester, but hits a wall exactly where the product's real value lives — unlimited strategies and full-scale backtesting. Module B is entirely paid, since it's the higher-intent, higher-willingness-to-pay use case and shouldn't be diluted by a free tier.

### 7.3 Admin Configuration Panel — functional spec

**What admins can configure:**
- **Tiers**: create/edit/archive tiers (names and count are admin-defined, not fixed to "free/paid"); each with display name, price, billing-provider price reference.
- **Feature gates per tier**: toggle racetrack/French bets, Module B access, physical wheel animation, backtest history depth, etc.
- **Numeric limits per tier**: max saved strategies, max backtest sessions/run, max live-tracking sessions — stored as flexible key/value config (`tier_config`, §6) so new limit types never require a schema migration.

**Access & audit**: admin panel is role-gated (`users.is_admin`), never exposed to regular subscribers. Every `tier_config` change writes to `tier_config_audit_log` (§6) since these changes directly affect billing and entitlements.

**Sequencing impact**: because pricing/limits aren't fixed at build time, a minimal Admin Panel is a **Phase 5 hard dependency** (§10) — subscription/billing can't ship without at least an internal-only version, since there'd otherwise be no way to actually set a price.

### 7.4 On automated live-table data capture (why it's out of scope)

Raised during design: whether Module B could auto-fetch live-table results (as reportedly done by a competitor, SpinSignature) rather than relying on manual entry.

- **What's plausible, conceptually**: live-dealer online casino games (Evolution, Pragmatic Play Live, Playtech, etc.) often show a public results ticker and the dealer-on-shift's name inside the game client. A tool reading data already rendered in a *user's own* authenticated session, on their own device, would be a materially different (safer) design than a service querying a casino operator's backend on behalf of many subscribers without that operator's involvement.
- **Why it's excluded from this build**: online casino operators' Terms of Service near-universally prohibit automated data collection/bots/scraping against their platform, regardless of whether the numbers are visible on screen. Building and selling a subscription product that automates pulling data from real operators' live games carries materially more legal exposure than manual entry — ToS-driven bans, cease-and-desist risk, and in several gambling jurisdictions, device-assisted outcome tracking during real-money play is separately regulated or prohibited under gaming-control law.
- **Decision**: manual entry only for v1 and the foreseeable roadmap (confirmed — §11). If revisited later, scope any automation as a personal, single-account, client-side reader of the *user's own* session only — never server-side aggregation across users — and route it through legal review (§10) before any engineering starts.

### 7.5 Billing
Third-party billing provider (e.g., Stripe) handles all payment data — `subscriptions.billing_provider_ref` stores the provider's customer/subscription id. Postgres is the system of record for entitlements only; no card data touches the app's own database.

---

## 8. Technical Architecture

### 8.1 Frontend (built via Antigravity)
- React 18+ with TypeScript (strict mode).
- Tailwind CSS with CSS variables for runtime theme injection (felt color, chip skins).
- **Three.js (r160+)** for the animated 3D wheel/ball — confirmed, built from day one (§4.5).
- State management: Zustand (or Context + hooks), persisted to the backend (not just localStorage) — strategies must survive across devices for a paid subscriber.
- Charts: Chart.js or a lightweight Canvas renderer for backtest bankroll-over-sessions graphs.
- Background computation: Web Workers for client-side backtests; server-side execution + WebSocket/SSE progress for large runs (§4.8).

### 8.2 Backend
- API layer (Node.js/Express, or Antigravity's generated backend) exposing: auth, strategy CRUD, spin resolution (RNG here, server-side only), backtest job submission/status, live-session spin logging, subscription/entitlement checks, admin tier-config endpoints.
- **RNG service**: one audited module responsible for all spin generation (live play and backtests both call through it) — the single place fairness can be verified.
- Backtest execution: synchronous for small runs; background job queue (BullMQ/Redis, or a Postgres-backed job table) for large runs, with client polling/subscribing for progress.

### 8.3 Database
PostgreSQL per §6. Migration tool required (Prisma/Drizzle/Antigravity-native).

### 8.4 Auth & entitlements
Standard email/password or OAuth. A single `subscriptions` row per user gates feature access — **checked server-side on every gated endpoint, never trusted from the client.**

### 8.5 Deployment
Follow Antigravity's native deployment path. Hard requirement independent of platform: Postgres is a **managed instance**, separate from the app tier, so it survives redeploys and can be backed up/scaled independently.

---

## 9. Non-Functional Requirements

### 9.1 Fairness & integrity
- RNG must be cryptographically secure and server-side (§4.1) — this is the product's credibility foundation.
- Payout math validated against official house-edge constants (2.70% EUR, 5.26% USA) as a standing automated test; any drift indicates a bet-coverage or multiplier bug.

### 9.2 Performance
- Backtest runs (thousands of sessions) must not block the UI thread; target sub-5-second completion for a 10,000-session run server-side, with incremental progress streamed to the client.
- Module B's number-entry pad must respond with no perceptible lag — used in real time at a live table.

### 9.3 Security & data
- No payment card data stored directly (delegated to billing provider, §7.5).
- Standard auth hardening: hashed passwords, rate-limited login, HTTPS everywhere.

### 9.4 Responsible-use positioning
- Persistent, non-dismissible footer/banner on every screen: practice/analysis tool only, no real-money wagering occurs in this product, gamble responsibly.
- No marketing or in-app language claiming or implying any strategy overcomes the house edge on a fair RNG game — factually false and a deceptive-advertising exposure.
- Module B outputs: "pattern observed in your data," never "predicted winning number."

### 9.5 Responsive/mobile
- Module B is mobile-first in practice (used at a physical table): thumb-reachable, minimal chrome.
- Module A's felt reflows for narrow viewports (collapsible racetrack, scrollable/zoomable grid) without shrinking bet targets below usable tap size.
- No native app in v1; installable PWA is a reasonable stretch goal.

---

## 10. Roadmap & Phasing

| Phase | Scope | Depends on | Compliance checkpoint |
| --- | --- | --- | --- |
| 1 — Core engine | RNG service, wheel/board math, EUR/USA rules, bet resolution, fast-mode play | — | Brief legal/compliance check before Phase 2 |
| 2 — Strategy builder | Levels, strategies, save/load, board reload | 1 | ✓ |
| 3 — Backtester | Background Monte Carlo runner, results UI, run history | 2 | ✓ |
| 4 — Physical wheel & polish | Three.js animated wheel/ball (required, not optional), theming, sound | 1 | ✓ |
| 5 — Subscriptions | Auth, billing integration, freemium gating, **minimal Admin Panel (§7.3)** | 1–3 | ✓ |
| 6 — Module B | Live session flow, manual number entry, sector analytics | 5 (shares auth/billing) | ✓ — includes ToS/marketing-language review (§7.4, §9.4) |
| 7 — Launch hardening | Full legal/compliance review, performance testing, mobile QA | All above | Full pre-launch review |
| Post-v1 | Additional games (blackjack, baccarat), native app evaluation | Roulette traction | — |

**Sequencing rationale**: the backtester (Phase 3) is the hardest-to-fake, highest-differentiation feature and the main paid-tier hook — build and validate it before investing heavily in visual polish (Phase 4), which can slip without threatening the core value proposition. Every phase includes a compliance check-in, not only a final pre-launch review, per the founder's decision.

---

## 11. Decision Log (for traceability)

| Item | Decision |
| --- | --- |
| Wheel rendering | Three.js 3D wheel from day one — not deferred, not 2D-canvas-first |
| Backtest scale caps | Admin-configurable per tier, not hardcoded |
| Pricing | Admin-configurable via Admin Panel, not fixed in this spec (defaults suggested in §7.2) |
| Legal review cadence | Every phase, not only pre-launch |
| Module B data entry | Manual entry only — automated/scraped capture is explicitly out of scope (§7.4) |
| Product name | **TableEdge** |
| Scope order | Roulette first; other games are a post-v1 expansion contingent on traction |

---

## 12. Open Items Still Requiring Input
- Exact final price points (defaults suggested in §7.2 — admin can change post-launch, but an initial number is needed for Phase 5 billing setup).
- Whether a PWA (installable, offline-tolerant shell) is worth prioritizing for v1 given "mobile responsive" is an explicit requirement, or purely post-v1 polish.
- Legal review scope and jurisdiction(s) to design for (affects §7.4/§9.4 copy and Module B's launch markets).
