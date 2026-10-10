import React from 'react';
import { useSimulatorStore } from '../../stores/simulator.store';
import { CHIP_DENOMINATIONS, getChipClass, formatChipLabel } from '../../utils/chipUtils';

export { CHIP_DENOMINATIONS };

interface ChipDenominationDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ChipDenominationDrawer: React.FC<ChipDenominationDrawerProps> = ({ isOpen, onClose }) => {
  const { selectedChip, selectChip, currency } = useSimulatorStore();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 pointer-events-none select-none">
      {/* Click-outside backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/40 pointer-events-auto transition-opacity"
        onClick={onClose}
      />

      {/* Floating Horizontal Capsule directly above bottom bar (Screenshot 1: media_1789995406320.png) */}
      <div className="absolute bottom-[100px] left-1/2 -translate-x-1/2 z-50 pointer-events-auto animate-scale-up">
        <div className="bg-[#0b1016]/95 border-2 border-white/20 rounded-2xl px-5 py-4 shadow-[0_10px_40px_rgba(0,0,0,0.9)] backdrop-blur-md flex items-center space-x-2.5 sm:space-x-3.5">
          {CHIP_DENOMINATIONS.map((val) => {
            const isSelected = selectedChip === val;
            return (
              <button
                key={val}
                onClick={() => {
                  selectChip(val);
                  onClose();
                }}
                title={`Select ${formatChipLabel(val, currency.symbol)} chip`}
                className={`relative flex items-center justify-center transition-all duration-150 cursor-pointer ${
                  isSelected
                    ? 'scale-115 -translate-y-1'
                    : 'hover:scale-108 hover:-translate-y-0.5 opacity-90 hover:opacity-100'
                }`}
              >
                {/* Chip Graphic with authentic rim stripes & white center disk */}
                <div
                  className={`${getChipClass(val)} w-13 h-13 sm:w-14 sm:h-14 text-xs font-black shadow-xl ${
                    isSelected
                      ? 'ring-4 ring-white shadow-[0_0_28px_rgba(255,255,255,0.95)]'
                      : 'border-2 border-white/30'
                  }`}
                >
                  <span className="chip-label">{formatChipLabel(val, currency.symbol)}</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
