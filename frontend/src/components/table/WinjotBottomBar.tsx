import React, { useState, useRef } from 'react';
import { useSimulatorStore } from '../../stores/simulator.store';
import { ChipDenominationDrawer } from './ChipDenominationDrawer';
import { SetBankrollModal } from '../settings/SetBankrollModal';
import { getChipClass, formatChipLabel, formatMoney } from '../../utils/chipUtils';

interface WinjotBottomBarProps {
  onSpin: () => void;
  isSpinning: boolean;
}

export const WinjotBottomBar: React.FC<WinjotBottomBarProps> = ({ onSpin, isSpinning }) => {
  const {
    bankroll,
    currency,
    activeBets,
    lastSpinResult,
    selectedChip,
    doubleBets,
    undoLastBet,
    clearBoard,
    rebet,
    lastBets,
    sessionProfit,
  } = useSimulatorStore();

  const [isChipDrawerOpen, setIsChipDrawerOpen] = useState(false);
  const [isBankrollModalOpen, setIsBankrollModalOpen] = useState(false);

  // Long press state & timer for UNDO button (removes all bets on felt)
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isUndoPressing, setIsUndoPressing] = useState(false);
  const longPressFiredRef = useRef(false);

  const totalCurrentBet = activeBets.reduce((sum, b) => sum + b.amount, 0);
  const lastWin = lastSpinResult ? lastSpinResult.totalPayout : 0;
  const lastBet = lastSpinResult ? lastSpinResult.totalBet : 0;
  const netWin = lastSpinResult ? lastSpinResult.netWin : 0;
  const profitLoss = sessionProfit;

  const canRebet = lastBets.length > 0 && !isSpinning;
  const canUndo = activeBets.length > 0 && !isSpinning;
  const canDouble = activeBets.length > 0 && !isSpinning;
  const canSpin = activeBets.length > 0 && !isSpinning;

  const handleUndoPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    if (!canUndo) return;
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

  return (
    <>
      <div className="w-full bg-[#050b08]/95 border-t border-white/10 select-none flex flex-col items-center py-4 px-4 shadow-2xl relative z-30">
        
        {/* 1. Status Bar Capsule (Doubled size & height matching Screenshot 1: media_1790003020697.png) */}
        <div className="flex items-center bg-[#0d141d]/95 border border-white/20 rounded-xl mb-4 overflow-hidden shadow-2xl divide-x divide-white/20 max-w-6xl w-full justify-between">
          {/* BANKROLL - Clickable to open Set Bankroll modal */}
          <div
            onClick={() => setIsBankrollModalOpen(true)}
            title="Click to set bankroll"
            className="flex-1 px-4 md:px-6 py-3.5 md:py-4 flex items-center justify-between cursor-pointer hover:bg-white/10 transition group"
          >
            <span style={{ fontFamily: 'Calibri, Candara, Segoe, "Segoe UI", Optima, Arial, sans-serif' }} className="text-xs md:text-sm text-gray-400 uppercase tracking-wider group-hover:text-emerald-400 transition">
              BANKROLL
            </span>
            <span style={{ fontFamily: 'Calibri, Candara, Segoe, "Segoe UI", Optima, Arial, sans-serif', fontWeight: 700 }} className="text-white text-xl md:text-2xl tracking-tight ml-2">
              {currency.symbol}{formatMoney(bankroll)}
            </span>
          </div>

          {/* BET */}
          <div className="flex-1 px-4 md:px-6 py-3.5 md:py-4 flex items-center justify-between">
            <span style={{ fontFamily: 'Calibri, Candara, Segoe, "Segoe UI", Optima, Arial, sans-serif' }} className="text-xs md:text-sm text-gray-400 uppercase tracking-wider group-hover:text-emerald-400 transition">BET</span>
            <span style={{ fontFamily: 'Calibri, Candara, Segoe, "Segoe UI", Optima, Arial, sans-serif', fontWeight: 700 }} className="text-white text-xl md:text-2xl tracking-tight ml-2">
              {currency.symbol}{formatMoney(totalCurrentBet)}
            </span>
          </div>

          {/* LAST WIN */}
          <div className="flex-1 px-4 md:px-6 py-3.5 md:py-4 flex items-center justify-between">
            <span style={{ fontFamily: 'Calibri, Candara, Segoe, "Segoe UI", Optima, Arial, sans-serif' }} className="text-xs md:text-sm text-gray-400 uppercase tracking-wider">LAST WIN</span>
            <span style={{ fontFamily: 'Calibri, Candara, Segoe, "Segoe UI", Optima, Arial, sans-serif', fontWeight: 700 }} className="text-white text-xl md:text-2xl tracking-tight ml-2">
              {currency.symbol}{formatMoney(lastWin)}
            </span>
          </div>

          {/* LAST BET */}
          <div className="flex-1 px-4 md:px-6 py-3.5 md:py-4 flex items-center justify-between">
            <span style={{ fontFamily: 'Calibri, Candara, Segoe, "Segoe UI", Optima, Arial, sans-serif' }} className="text-xs md:text-sm text-gray-400 uppercase tracking-wider">LAST BET</span>
            <span style={{ fontFamily: 'Calibri, Candara, Segoe, "Segoe UI", Optima, Arial, sans-serif', fontWeight: 700 }} className="text-white text-xl md:text-2xl tracking-tight ml-2">
              {currency.symbol}{formatMoney(lastBet)}
            </span>
          </div>

          {/* NET WIN */}
          <div className="flex-1 px-4 md:px-6 py-3.5 md:py-4 flex items-center justify-between">
            <span style={{ fontFamily: 'Calibri, Candara, Segoe, "Segoe UI", Optima, Arial, sans-serif' }} className="text-xs md:text-sm text-gray-400 uppercase tracking-wider">NET WIN</span>
            <span style={{ fontFamily: 'Calibri, Candara, Segoe, "Segoe UI", Optima, Arial, sans-serif', fontWeight: 700 }} className={`text-xl md:text-2xl tracking-tight ml-2 ${netWin >= 0 ? 'text-[#00e676]' : 'text-[#ff3b30]'}`}>
              {netWin >= 0 ? `+${currency.symbol}${formatMoney(netWin)}` : `-${currency.symbol}${formatMoney(Math.abs(netWin))}`}
            </span>
          </div>

          {/* PROFIT/LOSS */}
          <div className="flex-1 px-4 md:px-6 py-3.5 md:py-4 flex items-center justify-between">
            <span style={{ fontFamily: 'Calibri, Candara, Segoe, "Segoe UI", Optima, Arial, sans-serif' }} className="text-xs md:text-sm text-gray-400 uppercase tracking-wider">PROFIT/LOSS</span>
            <span style={{ fontFamily: 'Calibri, Candara, Segoe, "Segoe UI", Optima, Arial, sans-serif', fontWeight: 700 }} className={`text-xl md:text-2xl tracking-tight ml-2 ${profitLoss >= 0 ? 'text-[#00e676]' : 'text-[#ff3b30]'}`}>
              {profitLoss >= 0 ? `+${currency.symbol}${formatMoney(profitLoss)}` : `-${currency.symbol}${formatMoney(Math.abs(profitLoss))}`}
            </span>
          </div>
        </div>

        {/* 2. Control Action Bar */}
        <div className="w-full flex items-center justify-center max-w-5xl px-4">
          <div className="flex items-center space-x-3 sm:space-x-5">
            {/* 1. SPIN Button */}
            <button
              onClick={onSpin}
              disabled={!canSpin}
              className={`w-28 sm:w-36 py-3.5 md:py-4 rounded-xl font-black text-sm md:text-base tracking-wider uppercase shadow-xl transition active:scale-95 cursor-pointer ${
                canSpin
                  ? 'bg-gradient-to-b from-[#ffffff] to-[#dcdcdc] text-black hover:brightness-110 shadow-[0_4px_12px_rgba(0,0,0,0.6)]'
                  : 'bg-[#4b5563]/60 text-white/50 cursor-not-allowed opacity-40'
              }`}
            >
              SPIN
            </button>

            {/* 2. REBET Button */}
            <button
              onClick={rebet}
              disabled={!canRebet}
              title="Rebet previous spin placement"
              className={`w-28 sm:w-36 py-3.5 md:py-4 rounded-xl font-black text-sm md:text-base tracking-wider uppercase shadow-xl transition active:scale-95 cursor-pointer ${
                canRebet
                  ? 'bg-gradient-to-b from-[#ffffff] to-[#dcdcdc] text-black hover:brightness-110 shadow-[0_4px_12px_rgba(0,0,0,0.6)]'
                  : 'bg-[#4b5563]/60 text-white/50 cursor-not-allowed opacity-40'
              }`}
            >
              REBET
            </button>

            {/* 3. Chip Denomination Selector */}
            <div className="relative">
              <button
                onClick={() => setIsChipDrawerOpen(prev => !prev)}
                title="Click to select chip denomination"
                className={`${getChipClass(selectedChip)} w-16 h-16 md:w-18 md:h-18 text-sm md:text-base font-black shadow-2xl transform hover:scale-110 active:scale-95 transition cursor-pointer ring-4 ring-white shadow-[0_0_20px_rgba(255,255,255,0.8)]`}
              >
                <span className="chip-label">{formatChipLabel(selectedChip, currency.symbol)}</span>
              </button>
            </div>

            {/* 4. DOUBLE Button */}
            <button
              onClick={doubleBets}
              disabled={!canDouble}
              className={`w-28 sm:w-36 py-3.5 md:py-4 rounded-xl font-black text-sm md:text-base tracking-wider uppercase shadow-xl transition active:scale-95 cursor-pointer ${
                canDouble
                  ? 'bg-gradient-to-b from-[#ffffff] to-[#dcdcdc] text-black hover:brightness-110 shadow-[0_4px_12px_rgba(0,0,0,0.6)]'
                  : 'bg-[#4b5563]/60 text-white/50 cursor-not-allowed opacity-40'
              }`}
            >
              DOUBLE
            </button>

            {/* 5. UNDO Button (Short press: Undo last bet | Long press: Clear all bets) */}
            <button
              onPointerDown={handleUndoPointerDown}
              onPointerUp={handleUndoPointerUp}
              onPointerLeave={handleUndoPointerLeave}
              onPointerCancel={handleUndoPointerLeave}
              onClick={handleUndoClick}
              disabled={!canUndo}
              title="Click to Undo last bet • Hold (long press) to clear all bets from the felt"
              className={`relative overflow-hidden select-none w-28 sm:w-36 py-3.5 md:py-4 rounded-xl font-black text-sm md:text-base tracking-wider uppercase shadow-xl transition active:scale-95 cursor-pointer ${
                canUndo
                  ? 'bg-gradient-to-b from-[#ffffff] to-[#dcdcdc] text-black hover:brightness-110 shadow-[0_4px_12px_rgba(0,0,0,0.6)]'
                  : 'bg-[#4b5563]/60 text-white/50 cursor-not-allowed opacity-40'
              }`}
            >
              {/* Animated fill indicator during hold */}
              {isUndoPressing && (
                <span
                  className="absolute inset-0 bg-red-600/35 pointer-events-none origin-left"
                  style={{
                    animation: 'undoProgress 600ms linear forwards',
                  }}
                />
              )}
              <span className="relative z-10 flex items-center justify-center">
                {isUndoPressing ? 'CLEAR ALL...' : 'UNDO'}
              </span>
            </button>
          </div>
        </div>
      </div>


      {/* Chip Denomination Floating Drawer */}
      <ChipDenominationDrawer
        isOpen={isChipDrawerOpen}
        onClose={() => setIsChipDrawerOpen(false)}
      />

      {/* Set Bankroll Modal */}
      <SetBankrollModal
        isOpen={isBankrollModalOpen}
        onClose={() => setIsBankrollModalOpen(false)}
      />

      <style>{`
        @keyframes undoProgress {
          from { transform: scaleX(0); }
          to { transform: scaleX(1); }
        }
      `}</style>
    </>
  );
};
