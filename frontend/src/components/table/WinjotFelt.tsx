import React, { useState, useRef } from 'react';
import type { BetPlacement, PocketValue } from '../../stores/simulator.store';
import { useSimulatorStore } from '../../stores/simulator.store';
import { getChipClass, formatChipLabel } from '../../utils/chipUtils';
import { RacetrackFelt } from './RacetrackFelt';

const RED_NUMBERS = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);

interface WinjotFeltProps {
  isRacetrackMode?: boolean;
  readOnlyBets?: BetPlacement[];
  winningPocket?: PocketValue;
}

export const WinjotFelt: React.FC<WinjotFeltProps> = ({
  isRacetrackMode = false,
  readOnlyBets,
  winningPocket,
}) => {
  const {
    rules,
    currency,
    activeBets,
    placeBet,
    removeBet,
    transferBet,
    lastSpinResult,
    isSpinning,
  } = useSimulatorStore();

  const isUsa = rules === 'USA';
  const isReadOnly = readOnlyBets !== undefined;
  const effectiveBets = readOnlyBets || activeBets;

  // Determine winning pocket from prop or last spin result (when not spinning)
  const effectiveWinningPocket =
    winningPocket !== undefined
      ? winningPocket
      : !isSpinning && lastSpinResult
      ? lastSpinResult.pocketNumber
      : undefined;

  const isWinningPocket = (num: PocketValue) =>
    effectiveWinningPocket !== undefined && String(effectiveWinningPocket) === String(num);

  // Hover highlighting state — set of pocket strings currently highlighted
  const [highlightedPockets, setHighlightedPockets] = useState<Set<string>>(new Set());
  // Drag state
  const draggingBetRef = useRef<BetPlacement | null>(null);
  const feltRef = useRef<HTMLDivElement>(null);

  const setHighlight = (pockets: PocketValue[]) => {
    if (isReadOnly) return;
    setHighlightedPockets(new Set(pockets.map(String)));
  };
  const clearHighlight = () => setHighlightedPockets(new Set());
  const isHighlighted = (num: PocketValue) => highlightedPockets.has(String(num));

  // ---- Chip Badge (draggable when bet object is provided and not readOnly) ----
  const RenderChipBadge = ({ amount, bet }: { amount: number; bet?: BetPlacement }) => {
    if (!amount || amount <= 0) return null;
    const canDrag = !isReadOnly && !!bet;
    return (
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-30">
        <span
          className={`${getChipClass(amount)} w-12 h-12 md:w-13 md:h-13 text-xs md:text-sm font-black ${canDrag ? 'pointer-events-auto cursor-grab active:cursor-grabbing' : ''}`}
          draggable={canDrag}
          onDragStart={canDrag ? (e) => {
            draggingBetRef.current = bet!;
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('application/x-bet-id', bet!.id);
            e.stopPropagation();
          } : undefined}
          onDragEnd={canDrag ? (e) => {
            // If drop effect is 'none' the chip was dropped outside any valid zone — remove the bet
            if (e.dataTransfer.dropEffect === 'none') {
              removeBet(bet!.id);
            }
            draggingBetRef.current = null;
            clearHighlight();
          } : undefined}
        >
          <span className="chip-label">{formatChipLabel(amount, currency.symbol)}</span>
        </span>
      </div>
    );
  };

  // Helper to find the BetPlacement object for a pocket set (for drag support)
  const findBetByPockets = (pockets: PocketValue[], betType?: string): BetPlacement | undefined => {
    const key = [...pockets].map(String).sort().join(',');
    return effectiveBets.find(b =>
      [...b.coveredPockets].map(String).sort().join(',') === key &&
      (!betType || b.betType === betType)
    );
  };
  const findStraightBet = (num: PocketValue): BetPlacement | undefined =>
    effectiveBets.find(b => b.betType === 'straight' && b.coveredPockets.length === 1 && String(b.coveredPockets[0]) === String(num));
  const findTypeBet = (betType: string): BetPlacement | undefined =>
    effectiveBets.find(b => b.betType === betType);

  // Drop zone handlers — accepts a moved chip
  const makeDropHandlers = (targetPockets: PocketValue[], targetBetType: string, targetMultiplier: number) => {
    if (isReadOnly) return {};
    return {
      onDragOver: (e: React.DragEvent) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; },
      onDrop: (e: React.DragEvent) => {
        e.preventDefault();
        const src = draggingBetRef.current;
        if (!src) return;
        transferBet(src.id, targetPockets, targetBetType, targetMultiplier);
        draggingBetRef.current = null;
        clearHighlight();
      },
    };
  };

  // ---- Amount Helpers ----
  const getBetOnExactPockets = (pockets: PocketValue[]) => {
    const key = [...pockets].map(String).sort().join(',');
    return effectiveBets
      .filter(b => [...b.coveredPockets].map(String).sort().join(',') === key)
      .reduce((sum, b) => sum + b.amount, 0);
  };
  const getBetOnPocket = (pocket: PocketValue) =>
    effectiveBets
      .filter(b => b.betType === 'straight' && b.coveredPockets.length === 1 && String(b.coveredPockets[0]) === String(pocket))
      .reduce((sum, b) => sum + b.amount, 0);
  const getBetOnType = (type: string) =>
    effectiveBets.filter(b => b.betType === type).reduce((sum, b) => sum + b.amount, 0);

  // ---- Bet Click Handlers ----
  const handleStraightClick = (pocket: PocketValue, x: number, y: number) => {
    if (isReadOnly) return;
    placeBet({ betType: 'straight', coordinateX: x, coordinateY: y, coveredPockets: [pocket], multiplier: 35 });
  };
  const handleSplitClick = (pockets: PocketValue[], x: number, y: number) => {
    if (isReadOnly) return;
    placeBet({ betType: 'split', coordinateX: x, coordinateY: y, coveredPockets: pockets, multiplier: 17 });
  };
  const handleCornerClick = (pockets: PocketValue[], x: number, y: number) => {
    if (isReadOnly) return;
    placeBet({ betType: 'corner', coordinateX: x, coordinateY: y, coveredPockets: pockets, multiplier: 8 });
  };
  const handleStreetClick = (pockets: PocketValue[], x: number) => {
    if (isReadOnly) return;
    placeBet({ betType: 'street', coordinateX: x, coordinateY: 0, coveredPockets: pockets, multiplier: 11 });
  };
  const handleSixLineClick = (pockets: PocketValue[], x: number) => {
    if (isReadOnly) return;
    placeBet({ betType: 'sixline', coordinateX: x, coordinateY: 0, coveredPockets: pockets, multiplier: 5 });
  };
  const handleTrioClick = (pockets: PocketValue[], x: number, y: number) => {
    if (isReadOnly) return;
    placeBet({ betType: 'trio', coordinateX: x, coordinateY: y, coveredPockets: pockets, multiplier: 11 });
  };
  const handleBasketClick = (pockets: PocketValue[], x: number, y: number, multiplier = 8) => {
    if (isReadOnly) return;
    placeBet({ betType: 'basket', coordinateX: x, coordinateY: y, coveredPockets: pockets, multiplier });
  };
  const handleOutsideClick = (type: string, pockets: PocketValue[], multiplier: number) => {
    if (isReadOnly) return;
    placeBet({ betType: type, coordinateX: 0, coordinateY: 0, coveredPockets: pockets, multiplier });
  };

  // ---- Pocket Sets ----
  const redPockets = Array.from(RED_NUMBERS);
  const blackPockets = [2, 4, 6, 8, 10, 11, 13, 15, 17, 20, 22, 24, 26, 28, 29, 31, 33, 35];
  const lowPockets = Array.from({ length: 18 }, (_, i) => i + 1);
  const highPockets = Array.from({ length: 18 }, (_, i) => i + 19);
  const evenPockets = Array.from({ length: 18 }, (_, i) => (i + 1) * 2);
  const oddPockets = Array.from({ length: 18 }, (_, i) => i * 2 + 1);

  const col1 = [3, 6, 9, 12, 15, 18, 21, 24, 27, 30, 33, 36];
  const col2 = [2, 5, 8, 11, 14, 17, 20, 23, 26, 29, 32, 35];
  const col3 = [1, 4, 7, 10, 13, 16, 19, 22, 25, 28, 31, 34];

  const doz1 = Array.from({ length: 12 }, (_, i) => i + 1);
  const doz2 = Array.from({ length: 12 }, (_, i) => i + 13);
  const doz3 = Array.from({ length: 12 }, (_, i) => i + 25);

  // Subtle amber glow on covered numbers when hovering a bet zone, or solid gold outline if winning pocket
  const numHighlightClass = (num: PocketValue) => {
    if (isWinningPocket(num)) {
      return 'ring-2 ring-yellow-400/95 ring-inset shadow-[0_0_25px_rgba(250,204,21,0.75)] z-20';
    }
    return isHighlighted(num)
      ? 'after:absolute after:inset-0 after:bg-amber-400/20 after:pointer-events-none after:z-10'
      : '';
  };

  if (isRacetrackMode) {
    return <RacetrackFelt readOnlyBets={readOnlyBets} winningPocket={effectiveWinningPocket} />;
  }

  // =========================================================
  // Standard Table Grid
  // =========================================================
  return (
    <div
      ref={feltRef}
      className="w-full flex items-center justify-center pt-8 pb-4 px-2 select-none overflow-x-auto"
    >
      <div className="min-w-[1080px] max-w-[1520px] w-full border-2 border-white rounded-xl relative shadow-2xl bg-black/45 backdrop-blur-xs">

        {/* Upper Main Grid */}
        <div className="flex border-b-2 border-white relative">

          {/* Left: 00 and 0 Column */}
          <div className="w-24 md:w-28 flex flex-col border-r-2 border-white relative shrink-0">
            {isUsa && (
              <div className="flex-1 h-36 md:h-42 relative">
                <button
                  onClick={() => handleStraightClick('00', 0, 0)}
                  className={`w-full h-full bg-[#008f39] hover:bg-emerald-600 border-b-2 border-white flex items-center justify-center font-black text-3xl md:text-4xl text-white active:scale-95 transition relative cursor-pointer overflow-hidden ${numHighlightClass('00')}`}
                >
                  <span>00</span>
                  <RenderChipBadge amount={getBetOnPocket('00')} bet={findStraightBet('00')} />
                </button>
                {/* USA Split 0-00 */}
                <div
                  onClick={() => handleSplitClick([0, '00'], 0, 0)}
                  title="Split 0-00 (Payout 17:1)"
                  onMouseEnter={() => setHighlight([0, '00'])}
                  onMouseLeave={clearHighlight}
                  {...makeDropHandlers([0, '00'], 'split', 17)}
                  className="absolute -bottom-3.5 left-2 right-2 h-7 z-25 flex items-center justify-center cursor-pointer"
                >
                  <RenderChipBadge amount={getBetOnExactPockets([0, '00'])} bet={findBetByPockets([0, '00'], 'split')} />
                </div>
              </div>
            )}
            <button
              onClick={() => handleStraightClick(0, 0, 1)}
              className={`flex-1 ${isUsa ? 'h-36 md:h-42' : 'h-[288px] md:h-[336px]'} bg-[#008f39] hover:bg-emerald-600 flex items-center justify-center font-black text-3xl md:text-4xl text-white active:scale-95 transition relative cursor-pointer overflow-hidden ${numHighlightClass(0)}`}
            >
              <span>0</span>
              <RenderChipBadge amount={getBetOnPocket(0)} bet={findStraightBet(0)} />
            </button>
          </div>



          {/* Center 3×12 Numbers Grid — Streets/Six-Lines on bottom border of Row 3 */}
          <div className="flex-1 flex flex-col relative">

            {/* Row 1: 3, 6, 9 … 36 */}
            <div className="flex h-24 md:h-28 border-b-2 border-white relative">
              {col1.map((num, idx) => {
                const isRed = RED_NUMBERS.has(num);
                const betAmt = getBetOnPocket(num);
                const hSplitPockets = [num, col2[idx]];
                const hSplitAmt = getBetOnExactPockets(hSplitPockets);
                const vSplitPockets: PocketValue[] = idx < 11 ? [num, col1[idx + 1]] : [];
                const vSplitAmt = idx < 11 ? getBetOnExactPockets(vSplitPockets) : 0;
                const cornerPockets: PocketValue[] = idx < 11 ? [num, col1[idx + 1], col2[idx], col2[idx + 1]] : [];
                const cornerAmt = idx < 11 ? getBetOnExactPockets(cornerPockets) : 0;

                return (
                  <div key={num} className="flex-1 relative border-r-2 border-white flex">
                    <button
                      onClick={() => handleStraightClick(num, idx, 0)}
                      className={`w-full h-full flex items-center justify-center text-white font-black text-3xl md:text-4xl transition active:scale-95 relative cursor-pointer ${isRed ? 'bg-[#c8191d] hover:bg-red-600' : 'bg-[#111417] hover:bg-zinc-800'} ${numHighlightClass(num)}`}
                    >
                      <span>{num}</span>
                      <RenderChipBadge amount={betAmt} bet={findStraightBet(num)} />
                    </button>

                    {/* H-Split: bottom border ↔ Row 2 */}
                    <div
                      onClick={() => handleSplitClick(hSplitPockets, idx, 0)}
                      title={`Split ${num}-${col2[idx]}`}
                      onMouseEnter={() => setHighlight(hSplitPockets)}
                      onMouseLeave={clearHighlight}
                      {...makeDropHandlers(hSplitPockets, 'split', 17)}
                      className="absolute -bottom-3.5 left-2 right-2 h-7 z-25 flex items-center justify-center cursor-pointer"
                    >
                      <RenderChipBadge amount={hSplitAmt} bet={findBetByPockets(hSplitPockets, 'split')} />
                    </div>

                    {/* Split 0-3 (left edge of cell 3, border between 0 and 3) */}
                    {idx === 0 && (
                      <div
                        onClick={() => handleSplitClick([0, num], 0, 0)}
                        title={`Split 0-${num} (Payout 17:1)`}
                        onMouseEnter={() => setHighlight([0, num])}
                        onMouseLeave={clearHighlight}
                        {...makeDropHandlers([0, num], 'split', 17)}
                        className="absolute -left-3.5 top-2 bottom-2 w-7 z-25 flex items-center justify-center cursor-pointer"
                      >
                        <RenderChipBadge amount={getBetOnExactPockets([0, num])} bet={findBetByPockets([0, num], 'split')} />
                      </div>
                    )}

                    {/* Trio 0-2-3 (bottom-left T-junction of cell 3) */}
                    {idx === 0 && (
                      <div
                        onClick={() => handleTrioClick([0, col2[0], num], 0, 0)}
                        title={`Trio 0-${col2[0]}-${num} (Payout 11:1)`}
                        onMouseEnter={() => setHighlight([0, col2[0], num])}
                        onMouseLeave={clearHighlight}
                        {...makeDropHandlers([0, col2[0], num], 'trio', 11)}
                        className="absolute -left-4.5 -bottom-4.5 w-9 h-9 rounded-full z-35 flex items-center justify-center cursor-pointer"
                      >
                        <RenderChipBadge amount={getBetOnExactPockets([0, col2[0], num])} bet={findBetByPockets([0, col2[0], num], 'trio')} />
                      </div>
                    )}

                    {/* V-Split: right border ↔ next column */}
                    {idx < 11 && (
                      <div
                        onClick={() => handleSplitClick(vSplitPockets, idx, 0)}
                        title={`Split ${num}-${col1[idx + 1]}`}
                        onMouseEnter={() => setHighlight(vSplitPockets)}
                        onMouseLeave={clearHighlight}
                        {...makeDropHandlers(vSplitPockets, 'split', 17)}
                        className="absolute -right-3.5 top-2 bottom-2 w-7 z-25 flex items-center justify-center cursor-pointer"
                      >
                        <RenderChipBadge amount={vSplitAmt} bet={findBetByPockets(vSplitPockets, 'split')} />
                      </div>
                    )}

                    {/* Corner: bottom-right intersection */}
                    {idx < 11 && (
                      <div
                        onClick={() => handleCornerClick(cornerPockets, idx, 0)}
                        title={`Corner ${cornerPockets.join('-')}`}
                        onMouseEnter={() => setHighlight(cornerPockets)}
                        onMouseLeave={clearHighlight}
                        {...makeDropHandlers(cornerPockets, 'corner', 8)}
                        className="absolute -right-4.5 -bottom-4.5 w-9 h-9 rounded-full z-35 flex items-center justify-center cursor-pointer"
                      >
                        <RenderChipBadge amount={cornerAmt} bet={findBetByPockets(cornerPockets, 'corner')} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>


            {/* Row 2: 2, 5, 8 … 35 */}
            <div className="flex h-24 md:h-28 border-b-2 border-white relative">
              {col2.map((num, idx) => {
                const isRed = RED_NUMBERS.has(num);
                const betAmt = getBetOnPocket(num);
                const hSplitPockets = [num, col3[idx]];
                const hSplitAmt = getBetOnExactPockets(hSplitPockets);
                const vSplitPockets: PocketValue[] = idx < 11 ? [num, col2[idx + 1]] : [];
                const vSplitAmt = idx < 11 ? getBetOnExactPockets(vSplitPockets) : 0;
                const cornerPockets: PocketValue[] = idx < 11 ? [num, col2[idx + 1], col3[idx], col3[idx + 1]] : [];
                const cornerAmt = idx < 11 ? getBetOnExactPockets(cornerPockets) : 0;

                return (
                  <div key={num} className="flex-1 relative border-r-2 border-white flex">
                    <button
                      onClick={() => handleStraightClick(num, idx, 1)}
                      className={`w-full h-full flex items-center justify-center text-white font-black text-3xl md:text-4xl transition active:scale-95 relative cursor-pointer ${isRed ? 'bg-[#c8191d] hover:bg-red-600' : 'bg-[#111417] hover:bg-zinc-800'} ${numHighlightClass(num)}`}
                    >
                      <span>{num}</span>
                      <RenderChipBadge amount={betAmt} bet={findStraightBet(num)} />
                    </button>

                    {/* H-Split: bottom border ↔ Row 3 */}
                    <div
                      onClick={() => handleSplitClick(hSplitPockets, idx, 1)}
                      title={`Split ${num}-${col3[idx]}`}
                      onMouseEnter={() => setHighlight(hSplitPockets)}
                      onMouseLeave={clearHighlight}
                      {...makeDropHandlers(hSplitPockets, 'split', 17)}
                      className="absolute -bottom-3.5 left-2 right-2 h-7 z-25 flex items-center justify-center cursor-pointer"
                    >
                      <RenderChipBadge amount={hSplitAmt} bet={findBetByPockets(hSplitPockets, 'split')} />
                    </div>

                    {/* Split 0-2 (left edge of cell 2, border between 0 and 2) */}
                    {idx === 0 && (
                      <div
                        onClick={() => handleSplitClick([0, num], 0, 1)}
                        title={`Split 0-${num} (Payout 17:1)`}
                        onMouseEnter={() => setHighlight([0, num])}
                        onMouseLeave={clearHighlight}
                        {...makeDropHandlers([0, num], 'split', 17)}
                        className="absolute -left-3.5 top-2 bottom-2 w-7 z-25 flex items-center justify-center cursor-pointer"
                      >
                        <RenderChipBadge amount={getBetOnExactPockets([0, num])} bet={findBetByPockets([0, num], 'split')} />
                      </div>
                    )}

                    {/* Trio 0-1-2 (bottom-left T-junction of cell 2) */}
                    {idx === 0 && (
                      <div
                        onClick={() => handleTrioClick([0, col3[0], num], 0, 1)}
                        title={`Trio 0-${col3[0]}-${num} (Payout 11:1)`}
                        onMouseEnter={() => setHighlight([0, col3[0], num])}
                        onMouseLeave={clearHighlight}
                        {...makeDropHandlers([0, col3[0], num], 'trio', 11)}
                        className="absolute -left-4.5 -bottom-4.5 w-9 h-9 rounded-full z-35 flex items-center justify-center cursor-pointer"
                      >
                        <RenderChipBadge amount={getBetOnExactPockets([0, col3[0], num])} bet={findBetByPockets([0, col3[0], num], 'trio')} />
                      </div>
                    )}

                    {/* V-Split */}
                    {idx < 11 && (
                      <div
                        onClick={() => handleSplitClick(vSplitPockets, idx, 1)}
                        title={`Split ${num}-${col2[idx + 1]}`}
                        onMouseEnter={() => setHighlight(vSplitPockets)}
                        onMouseLeave={clearHighlight}
                        {...makeDropHandlers(vSplitPockets, 'split', 17)}
                        className="absolute -right-3.5 top-2 bottom-2 w-7 z-25 flex items-center justify-center cursor-pointer"
                      >
                        <RenderChipBadge amount={vSplitAmt} bet={findBetByPockets(vSplitPockets, 'split')} />
                      </div>
                    )}

                    {/* Corner */}
                    {idx < 11 && (
                      <div
                        onClick={() => handleCornerClick(cornerPockets, idx, 1)}
                        title={`Corner ${cornerPockets.join('-')}`}
                        onMouseEnter={() => setHighlight(cornerPockets)}
                        onMouseLeave={clearHighlight}
                        {...makeDropHandlers(cornerPockets, 'corner', 8)}
                        className="absolute -right-4.5 -bottom-4.5 w-9 h-9 rounded-full z-35 flex items-center justify-center cursor-pointer"
                      >
                        <RenderChipBadge amount={cornerAmt} bet={findBetByPockets(cornerPockets, 'corner')} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Row 3: 1, 4, 7 … 34  (Street & Six-Line bet zones on bottom border) */}
            <div className="flex h-24 md:h-28 relative">
              {col3.map((num, idx) => {
                const isRed = RED_NUMBERS.has(num);
                const betAmt = getBetOnPocket(num);
                const vSplitPockets: PocketValue[] = idx < 11 ? [num, col3[idx + 1]] : [];
                const vSplitAmt = idx < 11 ? getBetOnExactPockets(vSplitPockets) : 0;

                // Street = this column triple
                const c1 = col1[idx], c2 = col2[idx];
                const streetPockets: PocketValue[] = [c1, c2, num];
                const streetAmt = getBetOnExactPockets(streetPockets);

                // Six-Line = two adjacent triples
                const sixLinePockets: PocketValue[] = idx < 11
                  ? [c1, c2, num, col1[idx + 1], col2[idx + 1], col3[idx + 1]]
                  : [];
                const sixLineAmt = idx < 11 ? getBetOnExactPockets(sixLinePockets) : 0;

                return (
                  <div key={num} className="flex-1 relative border-r-2 border-white flex">
                    <button
                      onClick={() => handleStraightClick(num, idx, 2)}
                      className={`w-full h-full flex items-center justify-center text-white font-black text-3xl md:text-4xl transition active:scale-95 relative cursor-pointer ${isRed ? 'bg-[#c8191d] hover:bg-red-600' : 'bg-[#111417] hover:bg-zinc-800'} ${numHighlightClass(num)}`}
                    >
                      <span>{num}</span>
                      <RenderChipBadge amount={betAmt} bet={findStraightBet(num)} />
                    </button>

                    {/* V-Split */}
                    {idx < 11 && (
                      <div
                        onClick={() => handleSplitClick(vSplitPockets, idx, 2)}
                        title={`Split ${num}-${col3[idx + 1]}`}
                        onMouseEnter={() => setHighlight(vSplitPockets)}
                        onMouseLeave={clearHighlight}
                        {...makeDropHandlers(vSplitPockets, 'split', 17)}
                        className="absolute -right-3.5 top-2 bottom-2 w-7 z-25 flex items-center justify-center cursor-pointer"
                      >
                        <RenderChipBadge amount={vSplitAmt} bet={findBetByPockets(vSplitPockets, 'split')} />
                      </div>
                    )}

                    {/* Split 0-1 (left edge of cell 1, border between 0 and 1) */}
                    {idx === 0 && (
                      <div
                        onClick={() => handleSplitClick([0, num], 0, 2)}
                        title={`Split 0-${num} (Payout 17:1)`}
                        onMouseEnter={() => setHighlight([0, num])}
                        onMouseLeave={clearHighlight}
                        {...makeDropHandlers([0, num], 'split', 17)}
                        className="absolute -left-3.5 top-2 bottom-2 w-7 z-25 flex items-center justify-center cursor-pointer"
                      >
                        <RenderChipBadge amount={getBetOnExactPockets([0, num])} bet={findBetByPockets([0, num], 'split')} />
                      </div>
                    )}

                    {/* Basket / First Four (0-1-2-3) or First Five (bottom-left intersection of cell 1) */}
                    {idx === 0 && (
                      <div
                        onClick={() => isUsa
                          ? handleBasketClick([0, '00', 1, 2, 3], 0, 2, 6)
                          : handleBasketClick([0, 1, 2, 3], 0, 2, 8)
                        }
                        title={isUsa ? 'First Five (0-00-1-2-3) - Payout 6:1' : 'Basket / First Four (0-1-2-3) - Payout 8:1'}
                        onMouseEnter={() => setHighlight(isUsa ? [0, '00', 1, 2, 3] : [0, 1, 2, 3])}
                        onMouseLeave={clearHighlight}
                        {...makeDropHandlers(isUsa ? [0, '00', 1, 2, 3] : [0, 1, 2, 3], 'basket', isUsa ? 6 : 8)}
                        className="absolute -left-4.5 -bottom-4.5 w-9 h-9 rounded-full z-35 flex items-center justify-center cursor-pointer"
                      >
                        <RenderChipBadge amount={getBetOnExactPockets(isUsa ? [0, '00', 1, 2, 3] : [0, 1, 2, 3])} bet={findBetByPockets(isUsa ? [0, '00', 1, 2, 3] : [0, 1, 2, 3], 'basket')} />
                      </div>
                    )}

                    {/* Street bet — on the bottom border line of Row 3 (between grid and dozens) */}
                    <div
                      onClick={() => handleStreetClick(streetPockets, idx)}
                      title={`Street: ${num}-${c2}-${c1} (Payout 11:1)`}
                      onMouseEnter={() => setHighlight(streetPockets)}
                      onMouseLeave={clearHighlight}
                      {...makeDropHandlers(streetPockets, 'street', 11)}
                      className="absolute -bottom-3.5 left-2 right-2 h-7 z-25 flex items-center justify-center cursor-pointer"
                    >
                      <RenderChipBadge amount={streetAmt} bet={findBetByPockets(streetPockets, 'street')} />
                    </div>

                    {/* Six-Line / Double Street — bottom-right corner at column boundary */}
                    {idx < 11 && (
                      <div
                        onClick={() => handleSixLineClick(sixLinePockets, idx)}
                        title={`Six-Line: ${num}–${col1[idx + 1]} (Payout 5:1)`}
                        onMouseEnter={() => setHighlight(sixLinePockets)}
                        onMouseLeave={clearHighlight}
                        {...makeDropHandlers(sixLinePockets, 'sixline', 5)}
                        className="absolute -right-4.5 -bottom-4.5 w-9 h-9 rounded-full z-35 flex items-center justify-center cursor-pointer"
                      >
                        <RenderChipBadge amount={sixLineAmt} bet={findBetByPockets(sixLinePockets, 'sixline')} />
                      </div>
                    )}

                  </div>
                );
              })}
            </div>
          </div>

          {/* Right 2:1 Column Bets */}
          <div className="w-20 md:w-24 flex flex-col shrink-0">
            <button
              onClick={() => handleOutsideClick('col_1', col1, 2)}
              onMouseEnter={() => setHighlight(col1)}
              onMouseLeave={clearHighlight}
              className="flex-1 h-24 md:h-28 bg-[#111417] hover:bg-zinc-800 border-b-2 border-white flex items-center justify-center font-black text-base md:text-lg text-white uppercase active:scale-95 relative cursor-pointer"
            >
              <span>2:1</span>
              <RenderChipBadge amount={getBetOnType('col_1')} bet={findTypeBet('col_1')} />
            </button>
            <button
              onClick={() => handleOutsideClick('col_2', col2, 2)}
              onMouseEnter={() => setHighlight(col2)}
              onMouseLeave={clearHighlight}
              className="flex-1 h-24 md:h-28 bg-[#111417] hover:bg-zinc-800 border-b-2 border-white flex items-center justify-center font-black text-base md:text-lg text-white uppercase active:scale-95 relative cursor-pointer"
            >
              <span>2:1</span>
              <RenderChipBadge amount={getBetOnType('col_2')} bet={findTypeBet('col_2')} />
            </button>
            <button
              onClick={() => handleOutsideClick('col_3', col3, 2)}
              onMouseEnter={() => setHighlight(col3)}
              onMouseLeave={clearHighlight}
              className="flex-1 h-24 md:h-28 bg-[#111417] hover:bg-zinc-800 flex items-center justify-center font-black text-base md:text-lg text-white uppercase active:scale-95 relative cursor-pointer"
            >
              <span>2:1</span>
              <RenderChipBadge amount={getBetOnType('col_3')} bet={findTypeBet('col_3')} />
            </button>
          </div>
        </div>

        {/* Lower Section: Dozens and Outside Bets */}
        <div className="flex">
          {/* Empty space under 0/00 */}
          <div className="w-24 md:w-28 border-r-2 border-white bg-transparent shrink-0" />

          {/* Middle Blocks */}
          <div className="flex-1 flex flex-col border-r-2 border-white">
            {/* Dozens Row */}
            <div className="flex h-16 md:h-18 border-b-2 border-white">
              <button
                onClick={() => handleOutsideClick('dozen_1', doz1, 2)}
                onMouseEnter={() => setHighlight(doz1)}
                onMouseLeave={clearHighlight}
                className="flex-1 bg-[#111417] hover:bg-zinc-800 border-r-2 border-white flex items-center justify-center font-black text-base md:text-lg text-white uppercase tracking-wider active:scale-98 relative cursor-pointer"
              >
                <span>1ST 12</span>
                <RenderChipBadge amount={getBetOnType('dozen_1')} bet={findTypeBet('dozen_1')} />
              </button>
              <button
                onClick={() => handleOutsideClick('dozen_2', doz2, 2)}
                onMouseEnter={() => setHighlight(doz2)}
                onMouseLeave={clearHighlight}
                className="flex-1 bg-[#111417] hover:bg-zinc-800 border-r-2 border-white flex items-center justify-center font-black text-base md:text-lg text-white uppercase tracking-wider active:scale-98 relative cursor-pointer"
              >
                <span>2ND 12</span>
                <RenderChipBadge amount={getBetOnType('dozen_2')} bet={findTypeBet('dozen_2')} />
              </button>
              <button
                onClick={() => handleOutsideClick('dozen_3', doz3, 2)}
                onMouseEnter={() => setHighlight(doz3)}
                onMouseLeave={clearHighlight}
                className="flex-1 bg-[#111417] hover:bg-zinc-800 flex items-center justify-center font-black text-base md:text-lg text-white uppercase tracking-wider active:scale-98 relative cursor-pointer"
              >
                <span>3RD 12</span>
                <RenderChipBadge amount={getBetOnType('dozen_3')} bet={findTypeBet('dozen_3')} />
              </button>
            </div>

            {/* Outside Bets Row */}
            <div className="flex h-16 md:h-18">
              <button
                onClick={() => handleOutsideClick('outside_low', lowPockets, 1)}
                onMouseEnter={() => setHighlight(lowPockets)}
                onMouseLeave={clearHighlight}
                className="flex-1 bg-[#111417] hover:bg-zinc-800 border-r-2 border-white flex items-center justify-center font-black text-base md:text-lg text-white uppercase tracking-wider active:scale-98 relative cursor-pointer"
              >
                <span>1-18</span>
                <RenderChipBadge amount={getBetOnType('outside_low')} bet={findTypeBet('outside_low')} />
              </button>
              <button
                onClick={() => handleOutsideClick('outside_even', evenPockets, 1)}
                onMouseEnter={() => setHighlight(evenPockets)}
                onMouseLeave={clearHighlight}
                className="flex-1 bg-[#111417] hover:bg-zinc-800 border-r-2 border-white flex items-center justify-center font-black text-base md:text-lg text-white uppercase tracking-wider active:scale-98 relative cursor-pointer"
              >
                <span>EVEN</span>
                <RenderChipBadge amount={getBetOnType('outside_even')} bet={findTypeBet('outside_even')} />
              </button>
              <button
                onClick={() => handleOutsideClick('outside_red', redPockets, 1)}
                onMouseEnter={() => setHighlight(redPockets)}
                onMouseLeave={clearHighlight}
                className="flex-1 bg-[#c8191d] hover:bg-red-600 border-r-2 border-white flex items-center justify-center font-black text-base md:text-lg text-white uppercase tracking-wider active:scale-98 relative cursor-pointer"
              >
                <span>RED</span>
                <RenderChipBadge amount={getBetOnType('outside_red')} bet={findTypeBet('outside_red')} />
              </button>
              <button
                onClick={() => handleOutsideClick('outside_black', blackPockets, 1)}
                onMouseEnter={() => setHighlight(blackPockets)}
                onMouseLeave={clearHighlight}
                className="flex-1 bg-[#111417] hover:bg-zinc-800 border-r-2 border-white flex items-center justify-center font-black text-base md:text-lg text-white uppercase tracking-wider active:scale-98 relative cursor-pointer"
              >
                <span>BLACK</span>
                <RenderChipBadge amount={getBetOnType('outside_black')} bet={findTypeBet('outside_black')} />
              </button>
              <button
                onClick={() => handleOutsideClick('outside_odd', oddPockets, 1)}
                onMouseEnter={() => setHighlight(oddPockets)}
                onMouseLeave={clearHighlight}
                className="flex-1 bg-[#111417] hover:bg-zinc-800 border-r-2 border-white flex items-center justify-center font-black text-base md:text-lg text-white uppercase tracking-wider active:scale-98 relative cursor-pointer"
              >
                <span>ODD</span>
                <RenderChipBadge amount={getBetOnType('outside_odd')} bet={findTypeBet('outside_odd')} />
              </button>
              <button
                onClick={() => handleOutsideClick('outside_high', highPockets, 1)}
                onMouseEnter={() => setHighlight(highPockets)}
                onMouseLeave={clearHighlight}
                className="flex-1 bg-[#111417] hover:bg-zinc-800 flex items-center justify-center font-black text-base md:text-lg text-white uppercase tracking-wider active:scale-98 relative cursor-pointer"
              >
                <span>19-36</span>
                <RenderChipBadge amount={getBetOnType('outside_high')} bet={findTypeBet('outside_high')} />
              </button>
            </div>
          </div>

          {/* Empty space under 2:1 column */}
          <div className="w-20 md:w-24 bg-transparent shrink-0" />
        </div>
      </div>
    </div>
  );
};
