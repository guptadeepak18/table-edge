import React, { useState, useEffect } from 'react';
import type { WheelRotationMode } from '../../stores/simulator.store';
import { useSimulatorStore, POPULAR_CURRENCIES } from '../../stores/simulator.store';
import { ChevronDown, X, Pipette } from 'lucide-react';

interface GeneralSettingsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export const GeneralSettingsDrawer: React.FC<GeneralSettingsDrawerProps> = ({ isOpen, onClose }) => {
  const {
    rules,
    setRules,
    currency,
    setCurrency,
    fastMode,
    setFastMode,
    usePhysicalWheel,
    setPhysicalWheel,
    rotationMode,
    setRotationMode,
    setFeltColor,
    bankroll,
    setBankroll,
  } = useSimulatorStore();

  const [isRulesDropdownOpen, setIsRulesDropdownOpen] = useState(false);
  const [isCurrencyDropdownOpen, setIsCurrencyDropdownOpen] = useState(false);
  const [isColorPickerOpen, setIsColorPickerOpen] = useState(false);
  const [isBankrollModalOpen, setIsBankrollModalOpen] = useState(false);
  const [tempBankroll, setTempBankroll] = useState(bankroll);

  // RGB color state
  const [rgbR, setRgbR] = useState(15);
  const [rgbG, setRgbG] = useState(56);
  const [rgbB, setRgbB] = useState(36);

  // Close on Escape key press: closes sub-modals first, then the drawer
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        if (isColorPickerOpen) {
          setIsColorPickerOpen(false);
        } else if (isBankrollModalOpen) {
          setIsBankrollModalOpen(false);
        } else if (isRulesDropdownOpen) {
          setIsRulesDropdownOpen(false);
        } else if (isCurrencyDropdownOpen) {
          setIsCurrencyDropdownOpen(false);
        } else {
          onClose();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isColorPickerOpen, isBankrollModalOpen, isRulesDropdownOpen, isCurrencyDropdownOpen, onClose]);

  if (!isOpen) return null;

  const handleApplyColor = () => {
    const hex = `#${((1 << 24) + (rgbR << 16) + (rgbG << 8) + rgbB).toString(16).slice(1)}`;
    setFeltColor(hex);
    setIsColorPickerOpen(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex select-none animate-fade-in">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-xs" onClick={onClose} />

      {/* Left Drawer Panel (Exact Winjot layout from Reference Images 2 & 3) */}
      <div className="relative w-72 md:w-80 h-full bg-[#080d0b] border-r border-white/20 shadow-2xl flex flex-col p-5 text-white z-10 overflow-y-auto">
        {/* Drawer Header */}
        <div className="flex items-center justify-between border-b border-white/10 pb-3 mb-5">
          <h3 className="font-extrabold text-xs tracking-widest text-white uppercase">
            GENERAL SETTINGS
          </h3>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-white transition">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-6 flex-1 text-xs">
          {/* 1. GAME RULES */}
          <div className="space-y-3">
            <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block">
              GAME RULES
            </span>

            {/* Dropdown (Exact Winjot Dropdown with blue highlight from Image 3) */}
            <div className="relative">
              <button
                onClick={() => setIsRulesDropdownOpen(!isRulesDropdownOpen)}
                className="w-full py-2 px-3 bg-[#111614] hover:bg-[#18201d] border border-white/20 rounded flex items-center justify-between text-xs font-bold text-white transition"
              >
                <span>{rules}</span>
                <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
              </button>

              {isRulesDropdownOpen && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-[#111614] border border-white/20 rounded shadow-xl overflow-hidden z-20">
                  <button
                    onClick={() => {
                      setRules('USA');
                      setIsRulesDropdownOpen(false);
                    }}
                    className={`w-full py-2 px-3 text-left text-xs font-bold transition ${
                      rules === 'USA' ? 'bg-[#2563eb] text-white' : 'text-gray-300 hover:bg-white/10'
                    }`}
                  >
                    USA
                  </button>
                  <button
                    onClick={() => {
                      setRules('EUR');
                      setIsRulesDropdownOpen(false);
                    }}
                    className={`w-full py-2 px-3 text-left text-xs font-bold transition ${
                      rules === 'EUR' ? 'bg-[#2563eb] text-white' : 'text-gray-300 hover:bg-white/10'
                    }`}
                  >
                    EUR
                  </button>
                </div>
              )}
            </div>

            {/* Fast Mode Toggle */}
            <div className="flex items-center justify-between py-1">
              <span className="text-[11px] font-bold text-gray-300 uppercase">FAST MODE</span>
              <button
                onClick={() => setFastMode(!fastMode)}
                className={`w-10 h-5 rounded-full transition-colors relative border border-white/20 ${
                  fastMode ? 'bg-[#00e676]' : 'bg-[#1a221f]'
                }`}
              >
                <div
                  className={`w-4 h-4 rounded-full bg-white absolute top-0.5 transition-transform ${
                    fastMode ? 'left-5' : 'left-0.5'
                  }`}
                />
              </button>
            </div>
          </div>

          {/* 2. CURRENCY SELECTOR */}
          <div className="space-y-2 border-t border-white/10 pt-4">
            <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block">
              CURRENCY
            </span>

            <div className="relative">
              <button
                onClick={() => setIsCurrencyDropdownOpen(!isCurrencyDropdownOpen)}
                className="w-full py-2 px-3 bg-[#111614] hover:bg-[#18201d] border border-white/20 rounded flex items-center justify-between text-xs font-bold text-white transition"
              >
                <div className="flex items-center space-x-2 truncate">
                  <span className="w-5 text-center text-amber-400 font-bold shrink-0">{currency.symbol}</span>
                  <span className="text-white font-mono shrink-0">{currency.code}</span>
                  <span className="text-gray-400 font-normal truncate">({currency.name})</span>
                </div>
                <ChevronDown className="w-3.5 h-3.5 text-gray-400 shrink-0 ml-2" />
              </button>

              {isCurrencyDropdownOpen && (
                <div className="absolute top-full left-0 right-0 mt-1 max-h-56 overflow-y-auto bg-[#111614] border border-white/20 rounded shadow-2xl z-30 divide-y divide-white/5">
                  {POPULAR_CURRENCIES.map((curr) => {
                    const isSelected = curr.code === currency.code;
                    return (
                      <button
                        key={curr.code}
                        onClick={() => {
                          setCurrency(curr);
                          setIsCurrencyDropdownOpen(false);
                        }}
                        className={`w-full py-2 px-3 flex items-center justify-between text-xs transition cursor-pointer ${
                          isSelected ? 'bg-[#2563eb] text-white font-bold' : 'text-gray-300 hover:bg-white/10'
                        }`}
                      >
                        <div className="flex items-center space-x-2.5 truncate">
                          <span className={`w-5 text-center font-bold shrink-0 ${isSelected ? 'text-white' : 'text-amber-400'}`}>
                            {curr.symbol}
                          </span>
                          <span className="font-mono shrink-0">{curr.code}</span>
                          <span className={`text-[11px] truncate ${isSelected ? 'text-blue-100' : 'text-gray-400'}`}>
                            - {curr.name}
                          </span>
                        </div>
                        {isSelected && <span className="text-[11px] font-black shrink-0 ml-1">✓</span>}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* 3. REAL MODE / PHYSICAL WHEEL */}
          <div className="space-y-3 border-t border-white/10 pt-4">
            <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block">
              REAL MODE
            </span>
            <div className="flex items-center justify-between py-1">
              <span className="text-[11px] font-bold text-gray-300 uppercase">USE PHYSICAL WHEEL</span>
              <button
                onClick={() => setPhysicalWheel(!usePhysicalWheel)}
                className={`w-10 h-5 rounded-full transition-colors relative border border-white/20 ${
                  usePhysicalWheel ? 'bg-[#00e676]' : 'bg-[#1a221f]'
                }`}
              >
                <div
                  className={`w-4 h-4 rounded-full bg-white absolute top-0.5 transition-transform ${
                    usePhysicalWheel ? 'left-5' : 'left-0.5'
                  }`}
                />
              </button>
            </div>
          </div>

          {/* 3. WHEEL ROTATION (User's specific requirement) */}
          <div className="space-y-2 border-t border-white/10 pt-4">
            <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block">
              WHEEL ROTATION
            </span>
            <div className="grid grid-cols-3 gap-1.5">
              {(['cw', 'ccw', 'alternating'] as WheelRotationMode[]).map((mode) => (
                <button
                  key={mode}
                  onClick={() => setRotationMode(mode)}
                  className={`py-1.5 px-2 rounded border text-[10px] font-bold uppercase transition ${
                    rotationMode === mode
                      ? 'bg-[#2563eb] border-[#2563eb] text-white'
                      : 'bg-[#111614] border-white/20 text-gray-400 hover:text-white'
                  }`}
                >
                  {mode === 'cw' ? 'CW' : mode === 'ccw' ? 'CCW' : 'ALT'}
                </button>
              ))}
            </div>
          </div>

          {/* 4. VISUAL STYLE / COLOR */}
          <div className="space-y-2 border-t border-white/10 pt-4 relative">
            <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block">
              VISUAL STYLE
            </span>
            <button
              onClick={() => setIsColorPickerOpen(!isColorPickerOpen)}
              className="w-full py-2.5 bg-gradient-to-b from-[#2a363f] to-[#12181d] hover:from-[#374550] hover:to-[#1a2228] border border-white/30 rounded font-bold text-xs uppercase tracking-wider text-white shadow transition active:scale-98"
            >
              COLOR
            </button>

            {/* Color Picker Popover (Exact Winjot Popover from Reference Image 5) */}
            {isColorPickerOpen && (
              <div className="absolute left-full top-0 ml-3 w-60 bg-[#151c19] border border-white/20 rounded-xl p-3 shadow-2xl z-50 text-xs space-y-3">
                {/* 2D Gradient Hue Box */}
                <div
                  className="w-full h-24 rounded-lg relative overflow-hidden border border-white/20 cursor-crosshair"
                  style={{
                    background: `linear-gradient(to bottom, transparent, #000), linear-gradient(to right, #fff, rgb(${rgbR}, ${rgbG}, ${rgbB}))`,
                  }}
                >
                  <div className="w-3.5 h-3.5 rounded-full border-2 border-white absolute top-1/3 left-2/3 shadow" />
                </div>

                {/* Swatch & EyeDropper */}
                <div className="flex items-center space-x-2">
                  <Pipette className="w-4 h-4 text-gray-400" />
                  <div
                    className="w-7 h-7 rounded-full border border-white/40 shadow-inner"
                    style={{ backgroundColor: `rgb(${rgbR}, ${rgbG}, ${rgbB})` }}
                  />
                  {/* Rainbow Hue Slider */}
                  <input
                    type="range"
                    min="0"
                    max="255"
                    value={rgbG}
                    onChange={(e) => setRgbG(Number(e.target.value))}
                    className="flex-1 h-2 rounded-lg cursor-pointer appearance-none bg-gradient-to-r from-red-500 via-green-500 to-blue-500"
                  />
                </div>

                {/* RGB Numeric Inputs */}
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <input
                      type="number"
                      min="0"
                      max="255"
                      value={rgbR}
                      onChange={(e) => setRgbR(Number(e.target.value))}
                      className="w-full px-1.5 py-1 bg-black/50 border border-white/20 rounded text-center text-white text-xs"
                    />
                    <span className="text-[10px] text-gray-400 block text-center mt-0.5">R</span>
                  </div>
                  <div>
                    <input
                      type="number"
                      min="0"
                      max="255"
                      value={rgbG}
                      onChange={(e) => setRgbG(Number(e.target.value))}
                      className="w-full px-1.5 py-1 bg-black/50 border border-white/20 rounded text-center text-white text-xs"
                    />
                    <span className="text-[10px] text-gray-400 block text-center mt-0.5">G</span>
                  </div>
                  <div>
                    <input
                      type="number"
                      min="0"
                      max="255"
                      value={rgbB}
                      onChange={(e) => setRgbB(Number(e.target.value))}
                      className="w-full px-1.5 py-1 bg-black/50 border border-white/20 rounded text-center text-white text-xs"
                    />
                    <span className="text-[10px] text-gray-400 block text-center mt-0.5">B</span>
                  </div>
                </div>

                <button
                  onClick={handleApplyColor}
                  className="w-full py-1.5 bg-[#00e676] hover:bg-[#00c864] text-black font-extrabold text-xs uppercase rounded transition"
                >
                  Apply Color
                </button>
              </div>
            )}
          </div>

          {/* 5. DISPLAY MODE */}
          <div className="space-y-2 border-t border-white/10 pt-4">
            <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block">
              DISPLAY MODE
            </span>
            <button
              onClick={() => {
                if (!document.fullscreenElement) {
                  document.documentElement.requestFullscreen().catch(() => {});
                } else {
                  document.exitFullscreen().catch(() => {});
                }
              }}
              className="w-full py-2.5 bg-gradient-to-b from-[#2a363f] to-[#12181d] hover:from-[#374550] hover:to-[#1a2228] border border-white/30 rounded font-bold text-xs uppercase tracking-wider text-white shadow transition active:scale-98"
            >
              EXIT FULL SCREEN
            </button>
          </div>

          {/* 6. FINANCES / SET BANKROLL */}
          <div className="space-y-2 border-t border-white/10 pt-4">
            <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block">
              FINANCES
            </span>
            <button
              onClick={() => setIsBankrollModalOpen(true)}
              className="w-full py-2.5 bg-gradient-to-b from-[#2a363f] to-[#12181d] hover:from-[#374550] hover:to-[#1a2228] border border-white/30 rounded font-bold text-xs uppercase tracking-wider text-white shadow transition active:scale-98"
            >
              SET BANKROLL
            </button>
          </div>
        </div>

        {/* Close Button */}
        <div className="pt-4 border-t border-white/10">
          <button
            onClick={onClose}
            className="w-full py-2 bg-white/10 hover:bg-white/20 text-white font-bold text-xs uppercase tracking-wider rounded transition"
          >
            CLOSE
          </button>
        </div>
      </div>

      {/* Set Bankroll Modal */}
      {isBankrollModalOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-[#111614] border border-white/20 rounded-xl p-5 w-80 space-y-4 shadow-2xl">
            <h4 className="font-extrabold text-xs uppercase tracking-wider text-white">SET BANKROLL</h4>
            <div className="relative flex items-center">
              <span className="absolute left-3 text-gray-400 font-mono font-bold text-base select-none pointer-events-none">
                {currency.symbol}
              </span>
              <input
                type="number"
                value={tempBankroll}
                onChange={(e) => setTempBankroll(Number(e.target.value))}
                className="w-full pl-8 pr-3 py-2 bg-black/60 border border-white/20 rounded text-white font-mono text-base outline-none focus:border-blue-500"
              />
            </div>
            <div className="flex space-x-2 pt-2">
              <button
                onClick={() => setIsBankrollModalOpen(false)}
                className="flex-1 py-1.5 bg-white/10 text-white rounded text-xs font-bold"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setBankroll(tempBankroll);
                  setIsBankrollModalOpen(false);
                }}
                className="flex-1 py-1.5 bg-[#2563eb] hover:bg-blue-500 text-white rounded text-xs font-bold"
              >
                Set
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
