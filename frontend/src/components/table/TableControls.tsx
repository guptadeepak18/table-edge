import React, { useRef, useState } from 'react';
import { useSimulatorStore } from '../../stores/simulator.store';
import { RotateCcw, Copy, Trash2, ArrowUpRight } from 'lucide-react';
import { CHIP_DENOMINATIONS, getChipClass, formatChipLabel } from '../../utils/chipUtils';

interface TableControlsProps {
  onOpenSaves: () => void;
  onOpenBacktest: () => void;
  onOpenSettings: () => void;
}

export const TableControls: React.FC<TableControlsProps> = ({
  onOpenSaves,
  onOpenBacktest,
  onOpenSettings,
}) => {
  const {
    bankroll,
    currency,
    activeBets,
    lastSpinResult,
    selectedChip,
    selectChip,
    undoLastBet,
    doubleBets,
    clearBoard,
    rebet,
    lastBets,
  } = useSimulatorStore();

  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isUndoPressing, setIsUndoPressing] = useState(false);
  const longPressFiredRef = useRef(false);

  const handleUndoPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    if (activeBets.length === 0) return;
    longPressFiredRef.current = false;
    setIsUndoPressing(true);

    longPressTimerRef.current = setTimeout(() => {
      longPressFiredRef.current = true;
      clearBoard(true);
      setIsUndoPressing(false);
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
        longPressTimerRef.current = null;
      }
    }, 600);
  };

  const handleUndoPointerUp = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    setIsUndoPressing(false);
  };

  const handleUndoPointerLeave = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    setIsUndoPressing(false);
  };

  const handleUndoClick = () => {
    if (longPressFiredRef.current) {
      longPressFiredRef.current = false;
      return;
    }
    undoLastBet();
  };

  const totalCurrentBet = activeBets.reduce((sum, b) => sum + b.amount, 0);
  const lastWin = lastSpinResult ? lastSpinResult.totalPayout : 0;
  const netWin = lastSpinResult ? lastSpinResult.netWin : 0;

  return (
    <div className="w-full bg-surface-panel/95 backdrop-blur-md border-t border-white/10 px-6 py-4 flex flex-col space-y-4 shadow-2xl">
      {/* Upper Status Bar */}
      <div className="flex flex-wrap items-center justify-between text-xs font-mono tracking-wider border-b border-white/10 pb-3 gap-y-2">
        <div className="flex items-center space-x-6">
          <div>
            <span className="text-text-muted">BANKROLL: </span>
            <span className="text-white font-extrabold text-sm">${bankroll.toLocaleString()}</span>
          </div>
          <div>
            <span className="text-text-muted">CURRENT BET: </span>
            <span className="text-accent-gold font-extrabold text-sm">${totalCurrentBet.toLocaleString()}</span>
          </div>
          <div>
            <span className="text-text-muted">LAST WIN: </span>
            <span className="text-emerald-400 font-extrabold text-sm">${lastWin.toLocaleString()}</span>
          </div>
          <div>
            <span className="text-text-muted">NET P/L: </span>
            <span className={`font-extrabold text-sm ${netWin >= 0 ? 'text-status-profit' : 'text-status-loss'}`}>
              {netWin >= 0 ? `+$${netWin.toLocaleString()}` : `-$${Math.abs(netWin).toLocaleString()}`}
            </span>
          </div>
        </div>

        {/* Feature Drawers Shortcut Buttons */}
        <div className="flex items-center space-x-2">
          <button
            onClick={onOpenSaves}
            className="px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/20 rounded-lg text-xs font-sans font-semibold text-white transition flex items-center space-x-1"
          >
            <span>Progression Levels</span>
          </button>
          <button
            onClick={onOpenBacktest}
            className="px-3 py-1.5 bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 rounded-lg text-xs font-sans font-bold text-emerald-400 transition flex items-center space-x-1"
          >
            <ArrowUpRight className="w-3.5 h-3.5" />
            <span>Test Strategy</span>
          </button>
          <button
            onClick={onOpenSettings}
            className="px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/20 rounded-lg text-xs font-sans font-semibold text-text-muted hover:text-white transition"
          >
            Settings
          </button>
        </div>
      </div>

      {/* Lower Row: Chip Selector & Betting Action Buttons */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        {/* Chip Denominations */}
        <div className="flex items-center space-x-3">
          <span className="text-xs text-text-muted font-bold mr-1">CHIPS:</span>
          {CHIP_DENOMINATIONS.map((chipVal) => {
            const isSelected = selectedChip === chipVal;
            return (
              <button
                key={chipVal}
                onClick={() => selectChip(chipVal)}
                className={`${getChipClass(chipVal)} w-12 h-12 text-sm transition transform hover:scale-105 ${
                  isSelected ? 'ring-4 ring-neon-green scale-110' : 'opacity-85'
                }`}
              >
                <span className="chip-label">{formatChipLabel(chipVal, currency.symbol)}</span>
              </button>
            );
          })}
        </div>

        {/* Action Controls */}
        <div className="flex items-center space-x-2">
          <button
            onPointerDown={handleUndoPointerDown}
            onPointerUp={handleUndoPointerUp}
            onPointerLeave={handleUndoPointerLeave}
            onPointerCancel={handleUndoPointerLeave}
            onClick={handleUndoClick}
            disabled={activeBets.length === 0}
            title="Click to Undo last bet • Hold to clear all bets"
            className="relative overflow-hidden px-4 py-2 bg-white/10 hover:bg-white/20 disabled:opacity-40 disabled:pointer-events-none rounded-xl text-xs font-bold text-white uppercase tracking-wider flex items-center space-x-1.5 transition active:scale-95 select-none"
          >
            {isUndoPressing && (
              <span
                className="absolute inset-0 bg-red-600/35 pointer-events-none"
                style={{ animation: 'undoProgress 600ms linear forwards' }}
              />
            )}
            <RotateCcw className="w-3.5 h-3.5 relative z-10" />
            <span className="relative z-10">{isUndoPressing ? 'Clear All...' : 'Undo'}</span>
          </button>
          <button
            onClick={doubleBets}
            disabled={activeBets.length === 0}
            className="px-4 py-2 bg-white/10 hover:bg-white/20 disabled:opacity-40 disabled:pointer-events-none rounded-xl text-xs font-bold text-accent-gold uppercase tracking-wider flex items-center space-x-1.5 transition active:scale-95"
          >
            <Copy className="w-3.5 h-3.5" />
            <span>Double (2x)</span>
          </button>
          <button
            onClick={() => clearBoard()}
            disabled={activeBets.length === 0}
            className="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 disabled:opacity-40 disabled:pointer-events-none border border-red-500/30 rounded-xl text-xs font-bold text-red-400 uppercase tracking-wider flex items-center space-x-1.5 transition active:scale-95"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Clear</span>
          </button>
          <button
            onClick={rebet}
            disabled={lastBets.length === 0}
            className="px-4 py-2 bg-emerald-500/20 hover:bg-emerald-500/30 disabled:opacity-40 disabled:pointer-events-none border border-emerald-500/30 rounded-xl text-xs font-bold text-emerald-400 uppercase tracking-wider transition active:scale-95"
          >
            Rebet
          </button>
        </div>
      </div>
    </div>
  );
};
