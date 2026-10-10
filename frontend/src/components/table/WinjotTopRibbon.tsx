import React from 'react';
import { useSimulatorStore } from '../../stores/simulator.store';

const RED_SET = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);

interface WinjotTopRibbonProps {
  onOpenStatistics?: () => void;
}

export const WinjotTopRibbon: React.FC<WinjotTopRibbonProps> = ({ onOpenStatistics }) => {
  const { spinHistory, hotNumbers, coldNumbers, historyDisplayCount } = useSimulatorStore();

  const getPocketColorClass = (pocket: number | string) => {
    if (pocket === 0 || pocket === '00' || pocket === '0') return 'bg-[#008f39] text-white';
    if (RED_SET.has(Number(pocket))) return 'bg-[#c8191d] text-white';
    return 'bg-[#111417] text-white';
  };

  const displayedHistory = spinHistory.slice(0, historyDisplayCount);

  return (
    <div className="w-full py-3.5 flex items-center justify-center select-none px-4">
      <div className="flex items-center justify-between w-full max-w-[1520px]">
        
        {/* Outcome History Tape: clickable to open Statistics */}
        <div
          onClick={onOpenStatistics}
          title="Click to view full Statistics & Wheel Distribution"
          className="flex items-center space-x-2 overflow-x-auto flex-1 p-1 cursor-pointer hover:opacity-95 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
        >
          {displayedHistory.length === 0 ? (
            <div className="flex space-x-2 opacity-60">
              {[13, 36, 21, 5, 34, 13, 3, 2, 6, 28, 2, 16].slice(0, historyDisplayCount).map((p, i) => (
                <div
                  key={i}
                  className={`w-12 h-12 md:w-13 md:h-13 rounded-lg flex items-center justify-center font-black text-base md:text-lg border-2 border-white/80 shadow-lg shrink-0 ${getPocketColorClass(p)}`}
                >
                  {p}
                </div>
              ))}
            </div>
          ) : (
            displayedHistory.map((s, idx) => (
              <div
                key={s.id || idx}
                className={`w-12 h-12 md:w-13 md:h-13 rounded-lg flex items-center justify-center font-black text-base md:text-lg border-2 border-white/80 shadow-lg shrink-0 transition-transform ${getPocketColorClass(s.pocketNumber)}`}
              >
                {s.pocketNumber}
              </div>
            ))
          )}
        </div>

        {/* Prominent Separator & Hot / Cold Matrix (clickable to open Statistics) */}
        <div
          onClick={onOpenStatistics}
          title="Click to view full Statistics & Wheel Distribution"
          className="flex items-center space-x-6 ml-6 md:ml-10 pl-6 md:pl-10 border-l-2 border-white/20 bg-black/60 rounded-xl p-2 shrink-0 shadow-2xl cursor-pointer hover:bg-white/10 transition"
        >
          {/* HOT Section */}
          <div className="flex items-center space-x-2.5">
            <span className="text-orange-500 font-black text-xs md:text-sm tracking-widest uppercase">HOT</span>
            <div className="flex space-x-2">
              {hotNumbers.slice(0, 5).map((num, i) => (
                <span
                  key={i}
                  className={`w-12 h-12 md:w-13 md:h-13 rounded-lg flex items-center justify-center font-black text-base md:text-lg border-2 border-white/80 shadow-lg ${getPocketColorClass(num)}`}
                >
                  {num}
                </span>
              ))}
            </div>
          </div>

          {/* COLD Section */}
          <div className="flex items-center space-x-2.5">
            <span className="text-cyan-400 font-black text-xs md:text-sm tracking-widest uppercase">COLD</span>
            <div className="flex space-x-2">
              {coldNumbers.slice(0, 5).map((num, i) => (
                <span
                  key={i}
                  className={`w-12 h-12 md:w-13 md:h-13 rounded-lg flex items-center justify-center font-black text-base md:text-lg border-2 border-white/80 shadow-lg ${getPocketColorClass(num)}`}
                >
                  {num}
                </span>
              ))}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};
