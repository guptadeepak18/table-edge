import React from 'react';
import { useSimulatorStore } from '../../stores/simulator.store';

export const TopRibbon: React.FC = () => {
  const { spinHistory, hotNumbers, coldNumbers } = useSimulatorStore();

  return (
    <div className="w-full h-14 bg-surface-panel/90 backdrop-blur-md border-b border-white/10 px-4 flex items-center justify-between shadow-md">
      {/* Hot & Cold Statistics Matrix */}
      <div className="flex items-center space-x-6 text-xs font-mono">
        <div className="flex items-center space-x-2">
          <span className="font-bold text-emerald-400 uppercase tracking-wider">HOT</span>
          <div className="flex space-x-1">
            {hotNumbers.map((num, i) => (
              <span key={i} className="px-2 py-0.5 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded font-bold">
                {num}
              </span>
            ))}
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <span className="font-bold text-red-400 uppercase tracking-wider">COLD</span>
          <div className="flex space-x-1">
            {coldNumbers.map((num, i) => (
              <span key={i} className="px-2 py-0.5 bg-red-500/20 text-red-400 border border-red-500/30 rounded font-bold">
                {num}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Outcome History Tape (sliding colored 32x32 tiles) */}
      <div className="flex items-center space-x-2 overflow-x-auto max-w-[50%] py-1">
        <span className="text-xs text-text-muted font-bold mr-1">HISTORY:</span>
        {spinHistory.length === 0 ? (
          <span className="text-xs text-text-muted italic">No spins yet</span>
        ) : (
          spinHistory.map((s, idx) => (
            <div
              key={s.id || idx}
              className={`w-8 h-8 rounded-lg flex items-center justify-center font-felt font-bold text-xs shadow-md border border-white/20 transition-all ${
                s.color === 'red'
                  ? 'bg-[#d32027] text-white'
                  : s.color === 'black'
                  ? 'bg-[#111417] text-white'
                  : 'bg-[#008f39] text-white'
              }`}
            >
              {s.pocketNumber}
            </div>
          ))
        )}
      </div>
    </div>
  );
};
