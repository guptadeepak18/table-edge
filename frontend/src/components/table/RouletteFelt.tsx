import React from 'react';
import type { PocketValue } from '../../stores/simulator.store';
import { useSimulatorStore } from '../../stores/simulator.store';

const RED_NUMBERS = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);

export const RouletteFelt: React.FC = () => {
  const {
    rules,
    tableFeltColor,
    activeBets,
    placeBet,
  } = useSimulatorStore();

  const isUsa = rules === 'USA';

  // Helper to get total bet on a specific target
  const getBetOnPocket = (pocket: PocketValue) => {
    return activeBets
      .filter(b => b.betType === 'straight' && b.coveredPockets.length === 1 && String(b.coveredPockets[0]) === String(pocket))
      .reduce((sum, b) => sum + b.amount, 0);
  };

  const getBetOnOutside = (type: string) => {
    return activeBets
      .filter(b => b.betType === type)
      .reduce((sum, b) => sum + b.amount, 0);
  };

  // Straight bet click
  const handleStraightClick = (pocket: PocketValue, x: number, y: number) => {
    placeBet({
      betType: 'straight',
      coordinateX: x,
      coordinateY: y,
      coveredPockets: [pocket],
      multiplier: 35,
    });
  };

  // Outside bet clicks
  const handleOutsideClick = (type: string, pockets: PocketValue[], multiplier: number) => {
    placeBet({
      betType: type,
      coordinateX: 0,
      coordinateY: 0,
      coveredPockets: pockets,
      multiplier,
    });
  };

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

  return (
    <div
      className="relative w-full overflow-x-auto rounded-2xl p-6 shadow-2xl border border-white/10"
      style={{ backgroundColor: tableFeltColor }}
    >
      <div className="min-w-[850px] mx-auto select-none">
        {/* Main Grid: 0/00 on left, 3x12 numbers, Columns on right */}
        <div className="flex border-2 border-white/60 rounded-xl overflow-hidden shadow-inner">
          {/* 0 / 00 Column */}
          <div className="w-16 flex flex-col border-r-2 border-white/60">
            {isUsa && (
              <button
                onClick={() => handleStraightClick('00', 0, 0)}
                className="relative flex-1 bg-[#008f39] hover:bg-emerald-600 transition flex items-center justify-center border-b border-white/60 active:scale-95"
              >
                <span className="text-white font-felt text-2xl font-bold">00</span>
                {getBetOnPocket('00') > 0 && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="chip chip-10 w-9 h-9 text-xs">${getBetOnPocket('00')}</span>
                  </div>
                )}
              </button>
            )}
            <button
              onClick={() => handleStraightClick(0, 0, 1)}
              className="relative flex-1 bg-[#008f39] hover:bg-emerald-600 transition flex items-center justify-center active:scale-95"
            >
              <span className="text-white font-felt text-2xl font-bold">0</span>
              {getBetOnPocket(0) > 0 && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="chip chip-10 w-9 h-9 text-xs">${getBetOnPocket(0)}</span>
                </div>
              )}
            </button>
          </div>

          {/* 3x12 Numbers Grid */}
          <div className="flex-1 flex flex-col">
            {/* Row 1 (Top): 3, 6, 9 ... 36 */}
            <div className="flex flex-1 border-b border-white/60">
              {col1.map((num, idx) => {
                const isRed = RED_NUMBERS.has(num);
                const betAmt = getBetOnPocket(num);
                return (
                  <button
                    key={num}
                    onClick={() => handleStraightClick(num, idx, 0)}
                    className={`relative flex-1 h-14 flex items-center justify-center border-r border-white/60 transition ${
                      isRed ? 'bg-[#d32027] hover:bg-red-600' : 'bg-[#111417] hover:bg-zinc-800'
                    } active:scale-95`}
                  >
                    <span className="text-white font-felt text-xl font-bold">{num}</span>
                    {betAmt > 0 && (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="chip chip-10 w-8 h-8 text-xs">${betAmt}</span>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Row 2 (Middle): 2, 5, 8 ... 35 */}
            <div className="flex flex-1 border-b border-white/60">
              {col2.map((num, idx) => {
                const isRed = RED_NUMBERS.has(num);
                const betAmt = getBetOnPocket(num);
                return (
                  <button
                    key={num}
                    onClick={() => handleStraightClick(num, idx, 1)}
                    className={`relative flex-1 h-14 flex items-center justify-center border-r border-white/60 transition ${
                      isRed ? 'bg-[#d32027] hover:bg-red-600' : 'bg-[#111417] hover:bg-zinc-800'
                    } active:scale-95`}
                  >
                    <span className="text-white font-felt text-xl font-bold">{num}</span>
                    {betAmt > 0 && (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="chip chip-10 w-8 h-8 text-xs">${betAmt}</span>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Row 3 (Bottom): 1, 4, 7 ... 34 */}
            <div className="flex flex-1">
              {col3.map((num, idx) => {
                const isRed = RED_NUMBERS.has(num);
                const betAmt = getBetOnPocket(num);
                return (
                  <button
                    key={num}
                    onClick={() => handleStraightClick(num, idx, 2)}
                    className={`relative flex-1 h-14 flex items-center justify-center border-r border-white/60 transition ${
                      isRed ? 'bg-[#d32027] hover:bg-red-600' : 'bg-[#111417] hover:bg-zinc-800'
                    } active:scale-95`}
                  >
                    <span className="text-white font-felt text-xl font-bold">{num}</span>
                    {betAmt > 0 && (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="chip chip-10 w-8 h-8 text-xs">${betAmt}</span>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 2 to 1 Columns */}
          <div className="w-16 flex flex-col">
            <button
              onClick={() => handleOutsideClick('column', col1, 2)}
              className="relative flex-1 h-14 bg-black/30 hover:bg-black/50 border-b border-white/60 flex items-center justify-center text-xs font-bold text-white uppercase tracking-wider"
            >
              2 to 1
              {getBetOnOutside('column') > 0 && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="chip chip-10 w-7 h-7 text-[10px]">${getBetOnOutside('column')}</span>
                </div>
              )}
            </button>
            <button
              onClick={() => handleOutsideClick('column', col2, 2)}
              className="relative flex-1 h-14 bg-black/30 hover:bg-black/50 border-b border-white/60 flex items-center justify-center text-xs font-bold text-white uppercase tracking-wider"
            >
              2 to 1
            </button>
            <button
              onClick={() => handleOutsideClick('column', col3, 2)}
              className="relative flex-1 h-14 bg-black/30 hover:bg-black/50 flex items-center justify-center text-xs font-bold text-white uppercase tracking-wider"
            >
              2 to 1
            </button>
          </div>
        </div>

        {/* Dozens (1st 12, 2nd 12, 3rd 12) */}
        <div className="flex border-x-2 border-b-2 border-white/60 text-sm font-extrabold text-white tracking-wider ml-16 mr-16">
          <button
            onClick={() => handleOutsideClick('dozen', doz1, 2)}
            className="flex-1 py-3 bg-black/25 hover:bg-black/40 border-r border-white/60 uppercase"
          >
            1st 12
          </button>
          <button
            onClick={() => handleOutsideClick('dozen', doz2, 2)}
            className="flex-1 py-3 bg-black/25 hover:bg-black/40 border-r border-white/60 uppercase"
          >
            2nd 12
          </button>
          <button
            onClick={() => handleOutsideClick('dozen', doz3, 2)}
            className="flex-1 py-3 bg-black/25 hover:bg-black/40 uppercase"
          >
            3rd 12
          </button>
        </div>

        {/* Outside Bets (1-18, EVEN, RED, BLACK, ODD, 19-36) */}
        <div className="flex border-x-2 border-b-2 border-white/60 text-sm font-extrabold text-white tracking-wider ml-16 mr-16 rounded-b-xl overflow-hidden">
          <button
            onClick={() => handleOutsideClick('outside_low', lowPockets, 1)}
            className="flex-1 py-3.5 bg-black/30 hover:bg-black/50 border-r border-white/60 uppercase"
          >
            1 to 18
          </button>
          <button
            onClick={() => handleOutsideClick('outside_even', evenPockets, 1)}
            className="flex-1 py-3.5 bg-black/30 hover:bg-black/50 border-r border-white/60 uppercase"
          >
            Even
          </button>
          <button
            onClick={() => handleOutsideClick('outside_red', redPockets, 1)}
            className="flex-1 py-3.5 bg-[#d32027]/80 hover:bg-[#d32027] border-r border-white/60 uppercase flex items-center justify-center space-x-1.5"
          >
            <span className="w-3.5 h-3.5 rounded-full bg-[#d32027] border border-white" />
            <span>Red</span>
          </button>
          <button
            onClick={() => handleOutsideClick('outside_black', blackPockets, 1)}
            className="flex-1 py-3.5 bg-[#111417]/80 hover:bg-[#111417] border-r border-white/60 uppercase flex items-center justify-center space-x-1.5"
          >
            <span className="w-3.5 h-3.5 rounded-full bg-[#111417] border border-white" />
            <span>Black</span>
          </button>
          <button
            onClick={() => handleOutsideClick('outside_odd', oddPockets, 1)}
            className="flex-1 py-3.5 bg-black/30 hover:bg-black/50 border-r border-white/60 uppercase"
          >
            Odd
          </button>
          <button
            onClick={() => handleOutsideClick('outside_high', highPockets, 1)}
            className="flex-1 py-3.5 bg-black/30 hover:bg-black/50 uppercase"
          >
            19 to 36
          </button>
        </div>
      </div>
    </div>
  );
};
