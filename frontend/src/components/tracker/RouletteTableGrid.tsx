import React, { useState } from 'react';
import { Undo2, Trash2, Target } from 'lucide-react';

const RED_NUMBERS = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);

// Standard roulette felt layout:
// Row 1 (top): 3, 6, 9, 12, 15, 18, 21, 24, 27, 30, 33, 36
// Row 2 (mid): 2, 5, 8, 11, 14, 17, 20, 23, 26, 29, 32, 35
// Row 3 (btm): 1, 4, 7, 10, 13, 16, 19, 22, 25, 28, 31, 34
const ROW_TOP = [3, 6, 9, 12, 15, 18, 21, 24, 27, 30, 33, 36];
const ROW_MID = [2, 5, 8, 11, 14, 17, 20, 23, 26, 29, 32, 35];
const ROW_BTM = [1, 4, 7, 10, 13, 16, 19, 22, 25, 28, 31, 34];

interface Props {
  topNumbers: Array<number | '00'>;
  lastNumber: number | '00' | null;
  targetNumber?: number | '00' | null;
  isUsa: boolean;
  onSpin: (n: number | '00') => void;
  onUndo?: () => void;
  onClear?: () => void;
  recentNumbers?: Array<number | '00'>;
}

export const RouletteTableGrid: React.FC<Props> = ({
  topNumbers,
  lastNumber,
  targetNumber,
  isUsa,
  onSpin,
  onUndo,
  onClear,
  recentNumbers = [],
}) => {
  const [quickInput, setQuickInput] = useState('');
  const topSet = new Set(topNumbers.map(String));
  const centerNum = topNumbers[6]; // index 6 is the centre of 13

  // Quick keyboard entry submission
  const handleQuickSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = quickInput.trim();
    if (!trimmed) return;

    if (trimmed === '00' && isUsa) {
      onSpin('00');
      setQuickInput('');
      return;
    }

    const n = Number(trimmed);
    if (!isNaN(n) && n >= 0 && n <= 36) {
      onSpin(n);
      setQuickInput('');
    }
  };

  // Cell style generator matching Simulator WinjotFelt & Reference UI
  const renderCell = (num: number | '00', isZeroCol: boolean = false) => {
    const s = String(num);
    const isGreen = s === '0' || s === '00';
    const isRed = !isGreen && RED_NUMBERS.has(Number(num));
    const isTarget = targetNumber !== undefined && targetNumber !== null && String(targetNumber) === s;
    const isTop = topSet.has(s);
    const isCenter = centerNum !== undefined && String(centerNum) === s;
    const isLast = lastNumber !== null && String(lastNumber) === s;

    // Authentic Color Palette
    let bgStyle = isGreen ? 'bg-[#008f39] hover:bg-emerald-600' : isRed ? 'bg-[#c8191d] hover:bg-red-600' : 'bg-[#111417] hover:bg-zinc-800';

    return (
      <button
        key={s}
        type="button"
        onClick={() => onSpin(num)}
        className={`w-full h-full flex items-center justify-center font-black transition-all active:scale-95 cursor-pointer relative select-none ${bgStyle} ${
          isZeroCol ? 'text-2xl md:text-3xl' : 'text-xl md:text-2xl'
        } ${
          isTarget || isCenter
            ? 'ring-2 ring-[#00f2fe] bg-[#00f2fe]/20 shadow-[0_0_18px_rgba(0,242,254,0.7)] z-20 scale-[1.02]'
            : isLast
            ? 'ring-2 ring-amber-300 ring-offset-1 ring-offset-black shadow-[0_0_12px_rgba(251,191,36,0.7)] z-10'
            : isTop
            ? 'ring-1 ring-[#00ff87]/60 z-5'
            : ''
        }`}
      >
        <span className="text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] tracking-tight">
          {s}
        </span>

        {/* Prediction Target Indicator Pips */}
        {(isTarget || isCenter) && (
          <span className="absolute top-1 right-1 flex items-center justify-center w-3 h-3 rounded-full bg-[#00f2fe] text-black text-[8px] font-bold">
            <Target className="w-2.5 h-2.5" />
          </span>
        )}
      </button>
    );
  };

  return (
    <div className="flex flex-col gap-3">
      {/* ── Search / Keyboard Entry Box matching reference UI ── */}
      <form onSubmit={handleQuickSubmit} className="relative w-full">
        <input
          type="text"
          value={quickInput}
          onChange={(e) => setQuickInput(e.target.value.replace(/[^0-9]/g, ''))}
          placeholder="Type number or click table..."
          maxLength={2}
          className="w-full bg-[#0a1015] border border-white/15 focus:border-[#f59e0b] rounded-xl px-4 py-2.5 text-xs text-white placeholder-zinc-500 outline-none transition shadow-inner font-sans text-center"
        />
        {quickInput && (
          <button
            type="submit"
            className="absolute right-2 top-1/2 -translate-y-1/2 px-2.5 py-1 bg-[#f59e0b] text-black text-[11px] font-black rounded-lg cursor-pointer"
          >
            Enter
          </button>
        )}
      </form>

      {/* ── Authentic Casino Felt (Simulator Style) ── */}
      <div className="w-full border border-white/20 rounded-xl shadow-2xl bg-black/60 overflow-hidden relative">
        <div className="flex relative min-h-[170px] sm:min-h-[190px]">

          {/* ─ Left: Zero Column (Docked Vertically Across All 3 Rows) ─ */}
          <div className="w-12 sm:w-16 flex flex-col border-r border-white/20 relative shrink-0">
            {isUsa ? (
              <>
                <div className="flex-1 border-b border-white/20 relative">
                  {renderCell('00', true)}
                </div>
                <div className="flex-1 relative">
                  {renderCell(0, true)}
                </div>
              </>
            ) : (
              <div className="flex-1 h-full relative">
                {renderCell(0, true)}
              </div>
            )}
          </div>

          {/* ─ Center: 3×12 Main Numbers Grid ─ */}
          <div className="flex-1 flex flex-col relative min-w-0">
            {/* Row 1 (Top): 3, 6, 9 … 36 */}
            <div className="flex flex-1 border-b border-white/20 relative">
              {ROW_TOP.map((num, idx) => (
                <div
                  key={num}
                  className={`flex-1 relative flex ${idx < 11 ? 'border-r border-white/20' : ''}`}
                >
                  {renderCell(num)}
                </div>
              ))}
            </div>

            {/* Row 2 (Mid): 2, 5, 8 … 35 */}
            <div className="flex flex-1 border-b border-white/20 relative">
              {ROW_MID.map((num, idx) => (
                <div
                  key={num}
                  className={`flex-1 relative flex ${idx < 11 ? 'border-r border-white/20' : ''}`}
                >
                  {renderCell(num)}
                </div>
              ))}
            </div>

            {/* Row 3 (Btm): 1, 4, 7 … 34 */}
            <div className="flex flex-1 relative">
              {ROW_BTM.map((num, idx) => (
                <div
                  key={num}
                  className={`flex-1 relative flex ${idx < 11 ? 'border-r border-white/20' : ''}`}
                >
                  {renderCell(num)}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Action Buttons matching reference UI: Stacked Undo & Clear ── */}
      <div className="flex flex-col gap-2 pt-1">
        {onUndo && (
          <button
            type="button"
            onClick={onUndo}
            disabled={recentNumbers.length === 0}
            className="w-full py-2.5 bg-white/[0.04] hover:bg-white/[0.08] active:bg-white/[0.12] border border-white/10 disabled:opacity-30 disabled:cursor-not-allowed rounded-xl text-xs font-bold text-gray-300 hover:text-white flex items-center justify-center gap-2 cursor-pointer transition shadow-sm"
          >
            <Undo2 className="w-4 h-4 text-gray-300" />
            <span>Undo</span>
          </button>
        )}
        {onClear && (
          <button
            type="button"
            onClick={onClear}
            disabled={recentNumbers.length === 0}
            className="w-full py-2.5 bg-white/[0.04] hover:bg-white/[0.08] active:bg-white/[0.12] border border-white/10 disabled:opacity-30 disabled:cursor-not-allowed rounded-xl text-xs font-bold text-gray-300 hover:text-white flex items-center justify-center gap-2 cursor-pointer transition shadow-sm"
          >
            <Trash2 className="w-4 h-4 text-gray-300" />
            <span>Clear</span>
          </button>
        )}
      </div>
    </div>
  );
};
