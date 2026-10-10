import React, { useState, useEffect } from 'react';
import type { SpinResult } from '../../stores/simulator.store';
import { useSimulatorStore } from '../../stores/simulator.store';
import { WinjotFelt } from './WinjotFelt';
import { getPocketColor } from './RacetrackFelt';
import { X, TrendingUp, TrendingDown, Minus, Grid, Disc } from 'lucide-react';

interface BetInspectionModalProps {
  isOpen: boolean;
  spin: SpinResult | null;
  betIdLabel?: string;
  onClose: () => void;
}

export const BetInspectionModal: React.FC<BetInspectionModalProps> = ({
  isOpen,
  spin,
  betIdLabel,
  onClose,
}) => {
  const { currency } = useSimulatorStore();
  const [feltMode, setFeltMode] = useState<'grid' | 'racetrack'>('grid');

  // Close modal on Escape key press
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen || !spin) return null;

  const pocket = spin.pocketNumber;
  const color = getPocketColor(pocket);
  const isWin = spin.netWin > 0;
  const isLoss = spin.netWin < 0;

  const placedBets = spin.placedBets || [];

  // Descriptive text for pocket
  const pocketNum = Number(pocket);
  const isZero = pocket === 0 || String(pocket) === '00' || String(pocket) === '0';
  const pocketParity = isZero ? '' : pocketNum % 2 === 0 ? 'Even' : 'Odd';
  const pocketRange = isZero ? '' : pocketNum <= 18 ? '1-18 (Low)' : '19-36 (High)';

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center p-2 sm:p-4 bg-black/80 backdrop-blur-md animate-fade-in select-none">
      {/* Click outside to close backdrop */}
      <div className="absolute inset-0 -z-10" onClick={onClose} />

      <div className="relative w-full max-w-[1420px] max-h-[94vh] bg-[#0a1017] border-2 border-white/20 rounded-3xl shadow-[0_24px_70px_rgba(0,0,0,0.95)] text-white flex flex-col overflow-hidden">
        
        {/* ================================================================= */}
        {/* MODAL HEADER                                                      */}
        {/* ================================================================= */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/10 bg-[#121c27] shrink-0">
          <div className="flex items-center space-x-3">
            <span className="px-2.5 py-1 bg-sky-500/20 text-sky-300 border border-sky-400/40 rounded-lg font-black text-xs font-mono tracking-wider">
              {betIdLabel || `Bet #${spin.id.slice(-5)}`}
            </span>

            <span className="px-2.5 py-1 bg-white/10 text-gray-300 border border-white/15 rounded-lg text-xs font-bold tracking-wide">
              {spin.strategyName || 'Freestyle'}
            </span>

            <span className="hidden sm:inline-block text-xs font-mono text-gray-400">
              {new Date(spin.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </span>
          </div>

          {/* View Mode Toggle: [Grid | Racetrack] */}
          <div className="flex items-center space-x-1 bg-black/40 p-1 rounded-xl border border-white/10 text-xs font-bold">
            <button
              onClick={() => setFeltMode('grid')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg transition cursor-pointer ${
                feltMode === 'grid'
                  ? 'bg-sky-500 text-white shadow'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <Grid className="w-3.5 h-3.5" />
              <span>Grid Felt</span>
            </button>
            <button
              onClick={() => setFeltMode('racetrack')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg transition cursor-pointer ${
                feltMode === 'racetrack'
                  ? 'bg-sky-500 text-white shadow'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <Disc className="w-3.5 h-3.5" />
              <span>Racetrack</span>
            </button>
          </div>

          {/* Close button */}
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-gray-400 hover:text-white hover:bg-white/10 transition cursor-pointer"
            title="Close (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ================================================================= */}
        {/* CENTER FELT STAGE (Read-only bets + highlighted winning number)   */}
        {/* ================================================================= */}
        <div className="flex-1 min-h-0 overflow-y-auto overflow-x-auto p-4 flex flex-col items-center justify-center bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-[#0d2a1a]/60 via-[#07130d]/80 to-[#050b07]">
          <div className="w-full flex justify-center py-2">
            <WinjotFelt
              isRacetrackMode={feltMode === 'racetrack'}
              readOnlyBets={placedBets}
              winningPocket={spin.pocketNumber}
            />
          </div>
        </div>

        {/* ================================================================= */}
        {/* BOTTOM SECTION (Seamlessly blended stats, center aligned bets)    */}
        {/* ================================================================= */}
        <div className="bg-[#0e1722] border-t border-white/15 px-5 py-4 shrink-0 shadow-2xl">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 sm:gap-6 max-w-5xl mx-auto items-center">
            
            {/* 1. Rolled Number (No card, blended) */}
            <div className="flex items-center space-x-3.5 px-2 py-1">
              <div
                className={`w-12 h-12 rounded-full flex items-center justify-center font-black text-xl text-white shadow-xl ring-2 ring-yellow-400 shrink-0 ${
                  color === 'red'
                    ? 'bg-[#c8191d]'
                    : color === 'black'
                    ? 'bg-[#111417] border border-white/30'
                    : 'bg-[#008f39]'
                }`}
              >
                {pocket}
              </div>
              <div className="min-w-0">
                <span className="text-[10px] uppercase font-black text-gray-400 tracking-wider block">
                  Rolled Number
                </span>
                <span className="text-sm font-black text-white capitalize truncate block">
                  {color} {pocketParity ? `• ${pocketParity}` : ''}
                </span>
                {pocketRange && (
                  <span className="text-[11px] text-gray-400 block font-mono truncate">
                    {pocketRange}
                  </span>
                )}
              </div>
            </div>

            {/* 2. Total Bet Amount (No card, blended) */}
            <div className="px-2 py-1 flex flex-col justify-center">
              <span className="text-[10px] uppercase font-black text-gray-400 tracking-wider block">
                Bet Amount
              </span>
              <span className="text-xl sm:text-2xl font-black font-mono text-white">
                {currency.symbol}{spin.totalBet.toLocaleString()}
              </span>
              <span className="text-[11px] text-gray-400 font-mono">
                {placedBets.length} {placedBets.length === 1 ? 'placement' : 'placements'}
              </span>
            </div>

            {/* 3. Outcome (Profit / Loss with Amount) (No card, blended) */}
            <div className="px-2 py-1 flex flex-col justify-center">
              <span className="text-[10px] uppercase font-black text-gray-400 tracking-wider block">
                Outcome
              </span>
              <div className="flex items-center space-x-1.5">
                {isWin ? (
                  <TrendingUp className="w-5 h-5 text-[#00e676] shrink-0" />
                ) : isLoss ? (
                  <TrendingDown className="w-5 h-5 text-[#ff3b30] shrink-0" />
                ) : (
                  <Minus className="w-5 h-5 text-gray-400 shrink-0" />
                )}
                <span
                  className={`text-xl sm:text-2xl font-black font-mono ${
                    isWin ? 'text-[#00e676]' : isLoss ? 'text-[#ff3b30]' : 'text-gray-300'
                  }`}
                >
                  {isWin
                    ? `+${currency.symbol}${spin.netWin.toLocaleString()}`
                    : isLoss
                    ? `-${currency.symbol}${Math.abs(spin.netWin).toLocaleString()}`
                    : `${currency.symbol}0`}
                </span>
              </div>
              <span
                className={`text-[10px] font-black uppercase tracking-wider ${
                  isWin ? 'text-[#00e676]' : isLoss ? 'text-[#ff3b30]' : 'text-gray-400'
                }`}
              >
                {isWin ? 'Profit' : isLoss ? 'Loss' : 'Push'}
              </span>
            </div>

            {/* 4. Total Payout (No card, blended) */}
            <div className="px-2 py-1 flex flex-col justify-center">
              <span className="text-[10px] uppercase font-black text-gray-400 tracking-wider block">
                Total Payout
              </span>
              <span className="text-xl sm:text-2xl font-black font-mono text-amber-300">
                {currency.symbol}{spin.totalPayout.toLocaleString()}
              </span>
              <span className="text-[11px] text-gray-400 font-mono truncate">
                Bankroll: {currency.symbol}{spin.resultingBankroll.toLocaleString()}
              </span>
            </div>
          </div>

          {/* Placed Bets Breakdown Ribbon (Center Aligned, blended) */}
          {placedBets.length > 0 && (
            <div className="mt-3.5 pt-3 border-t border-white/10 max-w-5xl mx-auto flex items-center justify-center flex-wrap gap-2 text-[11px] font-mono [scrollbar-width:none]">
              <span className="text-gray-400 font-bold shrink-0 uppercase text-[10px] tracking-wider mr-1">
                Bets Placed:
              </span>
              {placedBets.map((b) => {
                const won = b.coveredPockets.some((p) => String(p) === String(pocket));
                const individualWin = won ? b.amount * (b.multiplier + 1) : 0;
                return (
                  <span
                    key={b.id}
                    className={`shrink-0 px-2.5 py-1 rounded-lg border font-bold flex items-center space-x-1.5 transition ${
                      won
                        ? 'bg-emerald-950/70 border-emerald-500 text-emerald-300 shadow-[0_0_10px_rgba(16,185,129,0.25)]'
                        : 'bg-white/5 border-white/10 text-gray-300'
                    }`}
                  >
                    <span className="capitalize">{b.betType}:</span>
                    <span className="text-white">{currency.symbol}{b.amount}</span>
                    {won && (
                      <span className="text-[#00e676] font-black">
                        (+{currency.symbol}{individualWin})
                      </span>
                    )}
                  </span>
                );
              })}
            </div>
          )}
        </div>

      </div>
    </div>
  );
};
