import React, { useEffect, useState } from 'react';
import type { SpinResult } from '../../stores/simulator.store';
import { useSimulatorStore } from '../../stores/simulator.store';

interface FeltResultCardProps {
  result: SpinResult | null;
  onDismiss: () => void;
  duration?: number;
}

export const FeltResultCard: React.FC<FeltResultCardProps> = ({
  result,
  onDismiss,
  duration = 1700,
}) => {
  const { currency } = useSimulatorStore();
  const [isFadingOut, setIsFadingOut] = useState(false);

  useEffect(() => {
    if (!result) {
      setIsFadingOut(false);
      return;
    }
    setIsFadingOut(false);

    const fadeTimer = setTimeout(() => {
      setIsFadingOut(true);
    }, Math.max(200, duration - 200));

    const dismissTimer = setTimeout(() => {
      onDismiss();
    }, duration);

    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(dismissTimer);
    };
  }, [result, onDismiss, duration]);

  if (!result) return null;

  const isWin = result.netWin >= 0;

  return (
    <div
      onClick={onDismiss}
      className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-40 cursor-pointer select-none transition-all duration-200 ${
        isFadingOut ? 'opacity-0 scale-95 pointer-events-none' : 'opacity-100 animate-scale-up'
      }`}
    >
      <div className="min-w-[260px] sm:min-w-[300px] px-8 py-5 bg-[#0b1016]/95 border border-purple-500/40 rounded-2xl shadow-[0_0_40px_rgba(0,0,0,0.85)] flex flex-col items-center justify-center backdrop-blur-md transition-all hover:scale-102">
        <span className="text-[12px] font-black uppercase tracking-widest text-gray-300">
          NET WIN
        </span>
        <span
          className={`text-3xl sm:text-4xl font-black font-sans tracking-tight mt-1.5 ${
            isWin ? 'text-[#00e676] drop-shadow-[0_0_12px_rgba(0,230,118,0.5)]' : 'text-[#ff3b30] drop-shadow-[0_0_12px_rgba(255,59,48,0.5)]'
          }`}
        >
          {isWin ? `+${currency.symbol}${result.netWin.toLocaleString()}` : `-${currency.symbol}${Math.abs(result.netWin).toLocaleString()}`}
        </span>
      </div>
    </div>
  );
};
