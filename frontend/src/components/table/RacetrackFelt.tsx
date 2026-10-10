import React, { useState, useMemo } from 'react';
import { useSimulatorStore, type PocketValue } from '../../stores/simulator.store';
import { getChipClass, formatChipLabel } from '../../utils/chipUtils';
import { Minus, Plus } from 'lucide-react';

// =========================================================================
// WHEEL SEQUENCES & CONSTANTS
// =========================================================================

export const EUR_WHEEL_SEQUENCE: PocketValue[] = [
  0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5,
  24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26
];

export const USA_WHEEL_SEQUENCE: PocketValue[] = [
  0, 28, 9, 26, 30, 11, 7, 20, 32, 17, 5, 22, 34, 15, 3, 24, 36, 13, 1, '00',
  27, 10, 25, 29, 12, 8, 19, 31, 18, 6, 21, 33, 16, 4, 23, 35, 14, 2
];

const RED_POCKETS = new Set<number>([
  1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36
]);

export function getPocketColor(p: PocketValue): 'red' | 'black' | 'green' {
  if (p === 0 || String(p) === '00' || String(p) === '0') return 'green';
  return RED_POCKETS.has(Number(p)) ? 'red' : 'black';
}

// Helper to get N neighbours on both sides of a target pocket in circular wheel sequence
export function getNeighbours(
  target: PocketValue,
  n: number,
  sequence: PocketValue[]
): PocketValue[] {
  const idx = sequence.findIndex(p => String(p) === String(target));
  if (idx === -1) return [target];
  const len = sequence.length;
  const result: PocketValue[] = [];
  for (let i = -n; i <= n; i++) {
    const wrapped = (idx + i + len * 10) % len;
    result.push(sequence[wrapped]);
  }
  return result;
}

// =========================================================================
// RACETRACK POCKET ARRANGEMENTS
// Continuous clockwise wheel alignment with 0 centered on the right turn apex
// =========================================================================

// Top straight (left to right, 16 numbers: 24 through 3)
const EUR_TRACK_TOP: PocketValue[] = [
  24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3
];

// Right curve (top to bottom, 3 numbers: 26, 0, 32 — 0 right at 3 o'clock apex)
const EUR_TRACK_RIGHT: PocketValue[] = [26, 0, 32];

// Bottom straight (left to right, 15 numbers: 8 through 15)
const EUR_TRACK_BOTTOM: PocketValue[] = [
  8, 30, 11, 36, 13, 27, 6, 34, 17, 25, 2, 21, 4, 19, 15
];

// Left curve (bottom to top, 3 numbers: 23, 10, 5 — 10 right at 9 o'clock apex)
const EUR_TRACK_LEFT: PocketValue[] = [23, 10, 5];

// USA Racetrack Ring arrangement (38 pockets with 0 on right apex and 00 on left apex)
const USA_TRACK_TOP: PocketValue[] = [
  10, 25, 29, 12, 8, 19, 31, 18, 6, 21, 33, 16, 4, 23, 35, 14
];
const USA_TRACK_RIGHT: PocketValue[] = [2, 0, 28];
const USA_TRACK_BOTTOM: PocketValue[] = [
  13, 36, 24, 3, 15, 34, 22, 5, 17, 32, 20, 7, 11, 30, 26, 9
];
const USA_TRACK_LEFT: PocketValue[] = [1, '00', 27];

// French Bets Definitions
export const FRENCH_BETS = {
  tiers: {
    id: 'tiers',
    title: 'TIER',
    chipCount: 6,
    numbers: [27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33] as PocketValue[],
    splits: [
      [5, 8], [10, 11], [13, 16], [23, 24], [27, 30], [33, 36]
    ] as Array<[PocketValue, PocketValue]>,
  },
  orphelins: {
    id: 'orphelins',
    title: 'ORPHELINS',
    chipCount: 5,
    numbers: [1, 20, 14, 31, 9, 17, 34, 6] as PocketValue[],
    straight: 1 as PocketValue,
    splits: [
      [6, 9], [14, 17], [17, 20], [31, 34]
    ] as Array<[PocketValue, PocketValue]>,
  },
  voisins: {
    id: 'voisins',
    title: 'VOISINS',
    chipCount: 9,
    numbers: [22, 18, 29, 7, 28, 12, 35, 3, 26, 0, 32, 15, 19, 4, 21, 2, 25] as PocketValue[],
    trio: [0, 2, 3] as PocketValue[],
    splits: [
      [4, 7], [12, 15], [18, 21], [19, 22], [32, 35]
    ] as Array<[PocketValue, PocketValue]>,
    corner: [25, 26, 28, 29] as PocketValue[],
  },
  zero: {
    id: 'zero',
    title: 'ZERO',
    chipCount: 4,
    numbers: [12, 35, 3, 26, 0, 32, 15] as PocketValue[],
    splits: [
      [0, 3], [12, 15], [32, 35]
    ] as Array<[PocketValue, PocketValue]>,
    straight: 26 as PocketValue,
  },
};

// =========================================================================
// RACETRACK FELT COMPONENT
// =========================================================================

interface RacetrackFeltProps {
  readOnlyBets?: import('../../stores/simulator.store').BetPlacement[];
  winningPocket?: PocketValue;
}

export const RacetrackFelt: React.FC<RacetrackFeltProps> = ({
  readOnlyBets,
  winningPocket,
}) => {
  const {
    rules,
    currency,
    selectedChip,
    activeBets,
    placeBatchBets,
    lastSpinResult,
    isSpinning,
  } = useSimulatorStore();

  const isReadOnly = readOnlyBets !== undefined;
  const effectiveBets = readOnlyBets || activeBets;

  // Determine winning pocket from prop or last spin result (when not spinning)
  const effectiveWinningPocket =
    winningPocket !== undefined
      ? winningPocket
      : !isSpinning && lastSpinResult
      ? lastSpinResult.pocketNumber
      : undefined;

  // Number picker for neighbours (default 2, min 2, max 9)
  const [neighboursCount, setNeighboursCount] = useState<number>(2);

  // Hover states
  const [hoveredPocket, setHoveredPocket] = useState<PocketValue | null>(null);
  const [hoveredSector, setHoveredSector] = useState<'tiers' | 'orphelins' | 'voisins' | 'zero' | null>(null);

  const isUsa = rules === 'USA';
  const sequence = isUsa ? USA_WHEEL_SEQUENCE : EUR_WHEEL_SEQUENCE;

  const trackTop = isUsa ? USA_TRACK_TOP : EUR_TRACK_TOP;
  const trackRight = isUsa ? USA_TRACK_RIGHT : EUR_TRACK_RIGHT;
  const trackBottom = isUsa ? USA_TRACK_BOTTOM : EUR_TRACK_BOTTOM;
  const trackLeft = isUsa ? USA_TRACK_LEFT : EUR_TRACK_LEFT;

  // Compute currently highlighted pockets
  const highlightedPockets = useMemo<Set<string>>(() => {
    if (isReadOnly) return new Set<string>();
    const set = new Set<string>();
    if (hoveredPocket !== null) {
      const neighs = getNeighbours(hoveredPocket, neighboursCount, sequence);
      neighs.forEach(p => set.add(String(p)));
    } else if (hoveredSector !== null && !isUsa) {
      const sec = FRENCH_BETS[hoveredSector];
      if (sec) {
        sec.numbers.forEach(p => set.add(String(p)));
      }
    }
    return set;
  }, [hoveredPocket, hoveredSector, neighboursCount, sequence, isUsa, isReadOnly]);

  // Only neighbour bets should be visible on the racetrack pockets
  const getPocketNeighbourBet = (p: PocketValue): number => {
    return effectiveBets
      .filter(b => b.isNeighbour && b.betType === 'straight' && b.coveredPockets.length === 1 && String(b.coveredPockets[0]) === String(p))
      .reduce((sum, b) => sum + b.amount, 0);
  };

  // Check French bet wager totals strictly by frenchSector tag (prevents shared split overlap)
  const getFrenchBetWager = (sectorId: 'tiers' | 'orphelins' | 'voisins' | 'zero'): number => {
    if (isUsa) return 0;
    return effectiveBets
      .filter(b => b.frenchSector === sectorId)
      .reduce((sum, b) => sum + b.amount, 0);
  };

  // Handler: Click Pocket -> Place Neighbour Bet (tagged with isNeighbour: true)
  const handlePocketClick = (target: PocketValue) => {
    if (isReadOnly) return;
    const neighs = getNeighbours(target, neighboursCount, sequence);
    const bets = neighs.map(p => ({
      betType: 'straight' as const,
      coveredPockets: [p],
      multiplier: 35,
      amount: selectedChip,
      isNeighbour: true,
    }));
    placeBatchBets(bets);
  };

  // Handler: Click French Bet Sector (tagged with frenchSector for strict separation)
  const handleFrenchBetClick = (sectorId: 'tiers' | 'orphelins' | 'voisins' | 'zero') => {
    if (isReadOnly || isUsa) return;

    if (sectorId === 'tiers') {
      const sec = FRENCH_BETS.tiers;
      const bets = sec.splits.map(pair => ({
        betType: 'split' as const,
        coveredPockets: pair,
        multiplier: 17,
        amount: selectedChip,
        isNeighbour: false,
        frenchSector: 'tiers' as const,
      }));
      placeBatchBets(bets);
    } else if (sectorId === 'orphelins') {
      const sec = FRENCH_BETS.orphelins;
      const bets = [
        { betType: 'straight' as const, coveredPockets: [sec.straight], multiplier: 35, amount: selectedChip, isNeighbour: false, frenchSector: 'orphelins' as const },
        ...sec.splits.map(pair => ({
          betType: 'split' as const,
          coveredPockets: pair,
          multiplier: 17,
          amount: selectedChip,
          isNeighbour: false,
          frenchSector: 'orphelins' as const,
        })),
      ];
      placeBatchBets(bets);
    } else if (sectorId === 'voisins') {
      const sec = FRENCH_BETS.voisins;
      const bets = [
        { betType: 'trio' as const, coveredPockets: sec.trio, multiplier: 11, amount: selectedChip * 2, isNeighbour: false, frenchSector: 'voisins' as const },
        ...sec.splits.map(pair => ({
          betType: 'split' as const,
          coveredPockets: pair,
          multiplier: 17,
          amount: selectedChip,
          isNeighbour: false,
          frenchSector: 'voisins' as const,
        })),
        { betType: 'corner' as const, coveredPockets: sec.corner, multiplier: 8, amount: selectedChip * 2, isNeighbour: false, frenchSector: 'voisins' as const },
      ];
      placeBatchBets(bets);
    } else if (sectorId === 'zero') {
      const sec = FRENCH_BETS.zero;
      const bets = [
        ...sec.splits.map(pair => ({
          betType: 'split' as const,
          coveredPockets: pair,
          multiplier: 17,
          amount: selectedChip,
          isNeighbour: false,
          frenchSector: 'zero' as const,
        })),
        { betType: 'straight' as const, coveredPockets: [sec.straight], multiplier: 35, amount: selectedChip, isNeighbour: false, frenchSector: 'zero' as const },
      ];
      placeBatchBets(bets);
    }
  };

  // Helper to generate SVG path for curved annular sectors
  const describeArc = (
    cx: number,
    cy: number,
    rInner: number,
    rOuter: number,
    startAngle: number,
    endAngle: number
  ): string => {
    const xO1 = cx + rOuter * Math.cos(startAngle);
    const yO1 = cy + rOuter * Math.sin(startAngle);
    const xO2 = cx + rOuter * Math.cos(endAngle);
    const yO2 = cy + rOuter * Math.sin(endAngle);

    const xI2 = cx + rInner * Math.cos(endAngle);
    const yI2 = cy + rInner * Math.sin(endAngle);
    const xI1 = cx + rInner * Math.cos(startAngle);
    const yI1 = cy + rInner * Math.sin(startAngle);

    return `M ${xO1.toFixed(2)} ${yO1.toFixed(2)} A ${rOuter} ${rOuter} 0 0 1 ${xO2.toFixed(2)} ${yO2.toFixed(2)} L ${xI2.toFixed(2)} ${yI2.toFixed(2)} A ${rInner} ${rInner} 0 0 0 ${xI1.toFixed(2)} ${yI1.toFixed(2)} Z`;
  };

  // French sector wager totals
  const tierWager = getFrenchBetWager('tiers');
  const orphelinsWager = getFrenchBetWager('orphelins');
  const voisinsWager = getFrenchBetWager('voisins');
  const zeroWager = getFrenchBetWager('zero');

  // SVG Geometry Constants: 160px box depth, 240px center gap, viewBox="0 0 4000 620"
  const TRACK_XL = 324.48;
  const TRACK_XR = 3675.52;
  const TRACK_STRAIGHT_LEN = 3351.03;
  const TRACK_RIN = 120;
  const TRACK_ROUT = 280;
  const TRACK_RC = 200;
  const TRACK_YC = 310;
  const TRACK_BOX_H = 160;

  // Collect all active chips to render in the HTML overlay (matching main betting felt scale & crispness)
  const chipsToRender = useMemo(() => {
    const list: Array<{ id: string; x: number; y: number; amount: number }> = [];

    // 1. French Sector Chips (centered in the section gap below sector name)
    if (!isUsa) {
      if (tierWager > 0) list.push({ id: 'sector-tier', x: 750, y: 345, amount: tierWager });
      if (orphelinsWager > 0) list.push({ id: 'sector-orphelins', x: 1738, y: 345, amount: orphelinsWager });
      if (voisinsWager > 0) list.push({ id: 'sector-voisins', x: 2708, y: 345, amount: voisinsWager });
      if (zeroWager > 0) list.push({ id: 'sector-zero', x: 3480, y: 345, amount: zeroWager });
    }

    // 2. Pocket Neighbour Chips (Top straight)
    trackTop.forEach((pocket, idx) => {
      const amt = getPocketNeighbourBet(pocket);
      if (amt > 0) {
        const cellWidth = TRACK_STRAIGHT_LEN / trackTop.length;
        const cx = TRACK_XL + (idx + 0.5) * cellWidth;
        list.push({ id: `top-${pocket}`, x: cx, y: 30 + TRACK_BOX_H / 2, amount: amt });
      }
    });

    // 3. Right Curve (3 pockets: 26, 0, 32)
    trackRight.forEach((pocket, idx) => {
      const amt = getPocketNeighbourBet(pocket);
      if (amt > 0) {
        const sliceCount = trackRight.length;
        const angleSlice = Math.PI / sliceCount;
        const midAngle = -Math.PI / 2 + (idx + 0.5) * angleSlice;
        const tx = TRACK_XR + TRACK_RC * Math.cos(midAngle);
        const ty = TRACK_YC + TRACK_RC * Math.sin(midAngle);
        list.push({ id: `right-${pocket}`, x: tx, y: ty, amount: amt });
      }
    });

    // 4. Bottom Straight
    trackBottom.forEach((pocket, idx) => {
      const amt = getPocketNeighbourBet(pocket);
      if (amt > 0) {
        const cellWidth = TRACK_STRAIGHT_LEN / trackBottom.length;
        const cx = TRACK_XL + (idx + 0.5) * cellWidth;
        list.push({ id: `bottom-${pocket}`, x: cx, y: 430 + TRACK_BOX_H / 2, amount: amt });
      }
    });

    // 5. Left Curve (3 pockets: 23, 10, 5)
    trackLeft.forEach((pocket, idx) => {
      const amt = getPocketNeighbourBet(pocket);
      if (amt > 0) {
        const sliceCount = trackLeft.length;
        const angleSlice = Math.PI / sliceCount;
        const midAngle = Math.PI / 2 + (idx + 0.5) * angleSlice;
        const tx = TRACK_XL + TRACK_RC * Math.cos(midAngle);
        const ty = TRACK_YC + TRACK_RC * Math.sin(midAngle);
        list.push({ id: `left-${pocket}`, x: tx, y: ty, amount: amt });
      }
    });

    return list;
  }, [
    isUsa,
    tierWager,
    orphelinsWager,
    voisinsWager,
    zeroWager,
    effectiveBets,
    trackTop,
    trackRight,
    trackBottom,
    trackLeft,
  ]);

  return (
    <div className="w-full flex flex-col items-center justify-center pt-2 pb-4 px-2 select-none bg-transparent overflow-x-auto">
      {/* Container scaled to mimic main felt (min-w-[1080px] max-w-[1520px]) */}
      <div className="min-w-[1080px] max-w-[1520px] w-full flex flex-col items-center justify-center">
        
        {/* ================================================================= */}
        {/* RACETRACK FELT CANVAS & CHIP OVERLAY                              */}
        {/* ================================================================= */}
        <div className="relative w-full">
          <svg
            viewBox="0 0 4000 620"
            className="w-full h-auto block drop-shadow-[0_12px_35px_rgba(0,0,0,0.7)]"
          >
            {/* Center Felt Green Background Fill (240px tall center gap) */}
            <path
              d="M 324.48 190 L 3675.52 190 A 120 120 0 0 1 3675.52 430 L 324.48 430 A 120 120 0 0 1 324.48 190 Z"
              fill="transparent"
            />

            {/* =============================================================== */}
            {/* CENTER FRENCH CALL BET SECTORS (Accurate, balanced areas)        */}
            {/* =============================================================== */}
            {!isUsa && (
              <g>
                {/* 1. TIER */}
                <path
                  d="M 952.80 190 L 324.48 190 A 120 120 0 0 0 324.48 430 L 1664.88 430 Z"
                  fill={hoveredSector === 'tiers' ? 'rgba(255,255,255,0.12)' : 'transparent'}
                  stroke="rgba(255, 255, 255, 0.65)"
                  strokeWidth="3"
                  className="cursor-pointer transition-all hover:fill-white/10"
                  onMouseEnter={() => setHoveredSector('tiers')}
                  onMouseLeave={() => setHoveredSector(null)}
                  onClick={() => handleFrenchBetClick('tiers')}
                />
                <text
                  x="750"
                  y={tierWager > 0 ? "260" : "310"}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fill="#ffffff"
                  fontSize="46"
                  fontWeight="600"
                  letterSpacing="5"
                  className="pointer-events-none select-none font-sans"
                >
                  TIER
                </text>

                {/* 2. ORPHELINS */}
                <path
                  d="M 952.80 190 L 2000.00 190 L 2335.08 430 L 1664.88 430 Z"
                  fill={hoveredSector === 'orphelins' ? 'rgba(255,255,255,0.12)' : 'transparent'}
                  stroke="rgba(255, 255, 255, 0.65)"
                  strokeWidth="3"
                  className="cursor-pointer transition-all hover:fill-white/10"
                  onMouseEnter={() => setHoveredSector('orphelins')}
                  onMouseLeave={() => setHoveredSector(null)}
                  onClick={() => handleFrenchBetClick('orphelins')}
                />
                <text
                  x="1738"
                  y={orphelinsWager > 0 ? "260" : "310"}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fill="#ffffff"
                  fontSize="42"
                  fontWeight="600"
                  letterSpacing="5"
                  className="pointer-events-none select-none font-sans"
                >
                  ORPHELINS
                </text>

                {/* 3. VOISINS (Broad, generous section significantly larger than Zero) */}
                <path
                  d="M 2000.00 190 L 3047.20 190 L 3452.08 430 L 2335.08 430 Z"
                  fill={hoveredSector === 'voisins' ? 'rgba(255,255,255,0.12)' : 'transparent'}
                  stroke="rgba(255, 255, 255, 0.65)"
                  strokeWidth="3"
                  className="cursor-pointer transition-all hover:fill-white/10"
                  onMouseEnter={() => setHoveredSector('voisins')}
                  onMouseLeave={() => setHoveredSector(null)}
                  onClick={() => handleFrenchBetClick('voisins')}
                />
                <text
                  x="2708"
                  y={voisinsWager > 0 ? "260" : "310"}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fill="#ffffff"
                  fontSize="46"
                  fontWeight="600"
                  letterSpacing="5"
                  className="pointer-events-none select-none font-sans"
                >
                  VOISINS
                </text>

                {/* 4. ZERO (Compact section covering strictly 12,35,3 on top, 26,0,32 on turn, 15 on bottom) */}
                <path
                  d="M 3047.20 190 L 3675.52 190 A 120 120 0 0 1 3675.52 430 L 3452.08 430 Z"
                  fill={hoveredSector === 'zero' ? 'rgba(255,255,255,0.12)' : 'transparent'}
                  stroke="rgba(255, 255, 255, 0.65)"
                  strokeWidth="3"
                  className="cursor-pointer transition-all hover:fill-white/10"
                  onMouseEnter={() => setHoveredSector('zero')}
                  onMouseLeave={() => setHoveredSector(null)}
                  onClick={() => handleFrenchBetClick('zero')}
                />
                <text
                  x="3480"
                  y={zeroWager > 0 ? "260" : "310"}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fill="#ffffff"
                  fontSize="44"
                  fontWeight="600"
                  letterSpacing="5"
                  className="pointer-events-none select-none font-sans"
                >
                  ZERO
                </text>
              </g>
            )}

            {/* USA Center Label */}
            {isUsa && (
              <g>
                <text
                  x="2000"
                  y="310"
                  textAnchor="middle"
                  dominantBaseline="central"
                  fill="#ffffff"
                  fontSize="46"
                  fontWeight="600"
                  letterSpacing="5"
                >
                  AMERICAN RACETRACK
                </text>
              </g>
            )}

            {/* =============================================================== */}
            {/* 1. TOP STRAIGHT POCKETS (16 numbers, 209.44px wide x 160px high) */}
            {/* =============================================================== */}
            <g>
              {trackTop.map((pocket, idx) => {
                const count = trackTop.length;
                const cellWidth = TRACK_STRAIGHT_LEN / count;
                const x = TRACK_XL + idx * cellWidth;
                const y = 30;
                const w = cellWidth;
                const h = TRACK_BOX_H;
                const color = getPocketColor(pocket);
                const isHighlight = highlightedPockets.has(String(pocket));
                const isWinning = effectiveWinningPocket !== undefined && String(effectiveWinningPocket) === String(pocket);

                const fill = color === 'red' ? '#c8191d' : color === 'black' ? '#111417' : '#008f39';
                const cx = x + w / 2;
                const cy = y + h / 2;

                return (
                  <g
                    key={`top-${pocket}`}
                    className={`${isReadOnly ? 'cursor-default' : 'cursor-pointer'} transition-all`}
                    onClick={() => handlePocketClick(pocket)}
                    onMouseEnter={() => setHoveredPocket(pocket)}
                    onMouseLeave={() => setHoveredPocket(null)}
                  >
                    <rect
                      x={x}
                      y={y}
                      width={w}
                      height={h}
                      fill={fill}
                      stroke={isWinning ? '#facc15' : isHighlight ? '#f59e0b' : '#ffffff'}
                      strokeWidth={isWinning ? '6' : isHighlight ? '4' : '2.5'}
                      className={`transition-colors ${isWinning ? 'brightness-125' : (isHighlight ? 'brightness-125' : isReadOnly ? '' : 'hover:brightness-110')}`}
                    />
                    <text
                      x={cx}
                      y={cy}
                      textAnchor="middle"
                      dominantBaseline="central"
                      fill="#ffffff"
                      fontSize="58"
                      fontWeight="600"
                      className="pointer-events-none select-none font-sans"
                    >
                      {pocket}
                    </text>
                  </g>
                );
              })}
            </g>

            {/* =============================================================== */}
            {/* 2. RIGHT CURVE POCKETS: [26, 0, 32] (0 centered at 3 o'clock)    */}
            {/* Arc length 209.44px x depth 160px — Exact same size as straights!*/}
            {/* =============================================================== */}
            <g>
              {trackRight.map((pocket, idx) => {
                const sliceCount = trackRight.length;
                const angleSlice = Math.PI / sliceCount;
                const startAngle = -Math.PI / 2 + idx * angleSlice;
                const endAngle = startAngle + angleSlice;
                const pathD = describeArc(TRACK_XR, TRACK_YC, TRACK_RIN, TRACK_ROUT, startAngle, endAngle);
                const color = getPocketColor(pocket);
                const isHighlight = highlightedPockets.has(String(pocket));
                const isWinning = effectiveWinningPocket !== undefined && String(effectiveWinningPocket) === String(pocket);

                const fill = color === 'red' ? '#c8191d' : color === 'black' ? '#111417' : '#008f39';

                const midAngle = (startAngle + endAngle) / 2;
                const tx = TRACK_XR + TRACK_RC * Math.cos(midAngle);
                const ty = TRACK_YC + TRACK_RC * Math.sin(midAngle);

                return (
                  <g
                    key={`right-${pocket}`}
                    className={`${isReadOnly ? 'cursor-default' : 'cursor-pointer'} transition-all`}
                    onClick={() => handlePocketClick(pocket)}
                    onMouseEnter={() => setHoveredPocket(pocket)}
                    onMouseLeave={() => setHoveredPocket(null)}
                  >
                    <path
                      d={pathD}
                      fill={fill}
                      stroke={isWinning ? '#facc15' : isHighlight ? '#f59e0b' : '#ffffff'}
                      strokeWidth={isWinning ? '6' : isHighlight ? '4' : '2.5'}
                      className={`transition-colors ${isWinning ? 'brightness-125' : (isHighlight ? 'brightness-125' : isReadOnly ? '' : 'hover:brightness-110')}`}
                    />
                    <text
                      x={tx}
                      y={ty}
                      textAnchor="middle"
                      dominantBaseline="central"
                      fill="#ffffff"
                      fontSize="58"
                      fontWeight="600"
                      className="pointer-events-none select-none font-sans"
                    >
                      {pocket}
                    </text>
                  </g>
                );
              })}
            </g>

            {/* =============================================================== */}
            {/* 3. BOTTOM STRAIGHT POCKETS (15 numbers, 223.40px wide x 160px)   */}
            {/* =============================================================== */}
            <g>
              {trackBottom.map((pocket, idx) => {
                const count = trackBottom.length;
                const cellWidth = TRACK_STRAIGHT_LEN / count;
                const x = TRACK_XL + idx * cellWidth;
                const y = 430;
                const w = cellWidth;
                const h = TRACK_BOX_H;
                const color = getPocketColor(pocket);
                const isHighlight = highlightedPockets.has(String(pocket));
                const isWinning = effectiveWinningPocket !== undefined && String(effectiveWinningPocket) === String(pocket);

                const fill = color === 'red' ? '#c8191d' : color === 'black' ? '#111417' : '#008f39';
                const cx = x + w / 2;
                const cy = y + h / 2;

                return (
                  <g
                    key={`bottom-${pocket}`}
                    className={`${isReadOnly ? 'cursor-default' : 'cursor-pointer'} transition-all`}
                    onClick={() => handlePocketClick(pocket)}
                    onMouseEnter={() => setHoveredPocket(pocket)}
                    onMouseLeave={() => setHoveredPocket(null)}
                  >
                    <rect
                      x={x}
                      y={y}
                      width={w}
                      height={h}
                      fill={fill}
                      stroke={isWinning ? '#facc15' : isHighlight ? '#f59e0b' : '#ffffff'}
                      strokeWidth={isWinning ? '6' : isHighlight ? '4' : '2.5'}
                      className={`transition-colors ${isWinning ? 'brightness-125' : (isHighlight ? 'brightness-125' : isReadOnly ? '' : 'hover:brightness-110')}`}
                    />
                    <text
                      x={cx}
                      y={cy}
                      textAnchor="middle"
                      dominantBaseline="central"
                      fill="#ffffff"
                      fontSize="58"
                      fontWeight="600"
                      className="pointer-events-none select-none font-sans"
                    >
                      {pocket}
                    </text>
                  </g>
                );
              })}
            </g>

            {/* =============================================================== */}
            {/* 4. LEFT CURVE POCKETS: [23, 10, 5] (10 centered at 9 o'clock)    */}
            {/* Arc length 209.44px x depth 160px — Exact same size as straights!*/}
            {/* =============================================================== */}
            <g>
              {trackLeft.map((pocket, idx) => {
                const sliceCount = trackLeft.length;
                const angleSlice = Math.PI / sliceCount;
                const startAngle = Math.PI / 2 + idx * angleSlice;
                const endAngle = startAngle + angleSlice;
                const pathD = describeArc(TRACK_XL, TRACK_YC, TRACK_RIN, TRACK_ROUT, startAngle, endAngle);
                const color = getPocketColor(pocket);
                const isHighlight = highlightedPockets.has(String(pocket));
                const isWinning = effectiveWinningPocket !== undefined && String(effectiveWinningPocket) === String(pocket);

                const fill = color === 'red' ? '#c8191d' : color === 'black' ? '#111417' : '#008f39';

                const midAngle = (startAngle + endAngle) / 2;
                const tx = TRACK_XL + TRACK_RC * Math.cos(midAngle);
                const ty = TRACK_YC + TRACK_RC * Math.sin(midAngle);

                return (
                  <g
                    key={`left-${pocket}`}
                    className={`${isReadOnly ? 'cursor-default' : 'cursor-pointer'} transition-all`}
                    onClick={() => handlePocketClick(pocket)}
                    onMouseEnter={() => setHoveredPocket(pocket)}
                    onMouseLeave={() => setHoveredPocket(null)}
                  >
                    <path
                      d={pathD}
                      fill={fill}
                      stroke={isWinning ? '#facc15' : isHighlight ? '#f59e0b' : '#ffffff'}
                      strokeWidth={isWinning ? '6' : isHighlight ? '4' : '2.5'}
                      className={`transition-colors ${isWinning ? 'brightness-125' : (isHighlight ? 'brightness-125' : isReadOnly ? '' : 'hover:brightness-110')}`}
                    />
                    <text
                      x={tx}
                      y={ty}
                      textAnchor="middle"
                      dominantBaseline="central"
                      fill="#ffffff"
                      fontSize="58"
                      fontWeight="600"
                      className="pointer-events-none select-none font-sans"
                    >
                      {pocket}
                    </text>
                  </g>
                );
              })}
            </g>
          </svg>

          {/* =============================================================== */}
          {/* REALISTIC HTML CHIP OVERLAY                                     */}
          {/* Identical size (w-12 h-12 md:w-13 md:h-13) and clear typography */}
          {/* =============================================================== */}
          <div className="absolute inset-0 pointer-events-none select-none">
            {chipsToRender.map(chip => (
              <div
                key={chip.id}
                style={{
                  position: 'absolute',
                  left: `${(chip.x / 4000) * 100}%`,
                  top: `${(chip.y / 620) * 100}%`,
                  transform: 'translate(-50%, -50%)',
                }}
                className="pointer-events-none z-30"
              >
                <span
                  className={`${getChipClass(chip.amount)} w-12 h-12 md:w-13 md:h-13 text-xs md:text-sm font-black shadow-2xl drop-shadow-[0_4px_10px_rgba(0,0,0,0.85)] flex items-center justify-center`}
                >
                  <span className="chip-label">{formatChipLabel(chip.amount, currency.symbol)}</span>
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* ================================================================= */}
        {/* NEIGHBOURS PICKER BELOW THE FELT (Generous spacing, no card)       */}
        {/* ================================================================= */}
        {!isReadOnly && (
          <div className="w-full flex items-center justify-center pt-8 sm:pt-10 pb-2 select-none">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => setNeighboursCount(prev => Math.max(2, prev - 1))}
                disabled={neighboursCount <= 2}
                title="Decrease neighbours"
                className="w-8 h-8 rounded-full text-white/70 hover:text-white hover:bg-white/10 active:scale-95 flex items-center justify-center transition disabled:opacity-20 disabled:cursor-not-allowed cursor-pointer"
              >
                <Minus className="w-4 h-4" />
              </button>

              <span className="font-mono text-xl font-bold text-white min-w-[28px] text-center drop-shadow select-none">
                {neighboursCount}
              </span>

              <button
                onClick={() => setNeighboursCount(prev => Math.min(9, prev + 1))}
                disabled={neighboursCount >= 9}
                title="Increase neighbours"
                className="w-8 h-8 rounded-full text-white/70 hover:text-white hover:bg-white/10 active:scale-95 flex items-center justify-center transition disabled:opacity-20 disabled:cursor-not-allowed cursor-pointer"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};
