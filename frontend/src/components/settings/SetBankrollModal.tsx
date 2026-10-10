import React, { useState, useEffect } from 'react';
import { useSimulatorStore } from '../../stores/simulator.store';

interface SetBankrollModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SetBankrollModal: React.FC<SetBankrollModalProps> = ({ isOpen, onClose }) => {
  const { bankroll, setBankroll, currency } = useSimulatorStore();
  const [val, setVal] = useState(bankroll.toString());

  useEffect(() => {
    if (isOpen) {
      setVal(bankroll.toString());
    }
  }, [isOpen, bankroll]);

  if (!isOpen) return null;

  const handleAdd = (amount: number) => {
    const current = Number(val) || 0;
    setVal(Math.max(0, current + amount).toString());
  };

  const handleSet = () => {
    const num = Math.max(1, Number(val) || 1000);
    setBankroll(num);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs select-none animate-fade-in p-4">
      <div className="fixed inset-0" onClick={onClose} />

      {/* Modal matching exact visual in Screenshot 2 (media_1789995440065.png) */}
      <div className="relative w-full max-w-sm bg-[#0d1217]/98 border border-purple-500/30 rounded-2xl p-6 shadow-[0_0_50px_rgba(0,0,0,0.9)] z-10 flex flex-col items-center space-y-4">
        {/* Title */}
        <h3 className="text-xs font-black tracking-[0.25em] text-gray-300 uppercase">
          SET BANKROLL
        </h3>

        {/* Numeric Input Field */}
        <div className="w-full relative flex items-center">
          <span className="absolute left-4 text-gray-400 font-mono font-bold text-2xl select-none pointer-events-none">
            {currency.symbol}
          </span>
          <input
            type="number"
            value={val}
            onChange={(e) => setVal(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSet();
              if (e.key === 'Escape') onClose();
            }}
            className="w-full bg-[#070b0e] border border-white/20 rounded-xl py-3 pl-10 pr-4 text-center font-mono font-bold text-2xl text-white outline-none focus:border-purple-400/80 transition"
            autoFocus
          />
        </div>

        {/* Quick Increment Buttons */}
        <div className="w-full grid grid-cols-3 gap-2">
          <button
            type="button"
            onClick={() => handleAdd(100)}
            className="py-2.5 bg-[#161d24] hover:bg-[#202932] border border-white/15 rounded-lg text-xs font-bold text-gray-300 tracking-wide transition active:scale-95 cursor-pointer"
          >
            +{currency.symbol}100
          </button>
          <button
            type="button"
            onClick={() => handleAdd(500)}
            className="py-2.5 bg-[#161d24] hover:bg-[#202932] border border-white/15 rounded-lg text-xs font-bold text-gray-300 tracking-wide transition active:scale-95 cursor-pointer"
          >
            +{currency.symbol}500
          </button>
          <button
            type="button"
            onClick={() => handleAdd(1000)}
            className="py-2.5 bg-[#161d24] hover:bg-[#202932] border border-white/15 rounded-lg text-xs font-bold text-gray-300 tracking-wide transition active:scale-95 cursor-pointer"
          >
            +{currency.symbol}1000
          </button>
        </div>

        {/* Action Buttons: CANCEL & SET */}
        <div className="w-full grid grid-cols-2 gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="py-3 bg-[#182028] hover:bg-[#222d38] border border-white/15 rounded-xl text-xs font-black uppercase tracking-wider text-gray-300 transition active:scale-95 cursor-pointer"
          >
            CANCEL
          </button>
          <button
            type="button"
            onClick={handleSet}
            className="py-3 bg-[#182028] hover:bg-[#222d38] border border-white/25 rounded-xl text-xs font-black uppercase tracking-wider text-white transition active:scale-95 cursor-pointer shadow-lg"
          >
            SET
          </button>
        </div>
      </div>
    </div>
  );
};
