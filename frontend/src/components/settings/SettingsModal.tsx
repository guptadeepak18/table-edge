import React, { useState } from 'react';
import type { WheelRotationMode } from '../../stores/simulator.store';
import { useSimulatorStore } from '../../stores/simulator.store';
import { X, Check } from 'lucide-react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const FELT_COLORS = [
  { name: 'Classic Green', color: '#0b3d24' },
  { name: 'Midnight Navy', color: '#0b1d3d' },
  { name: 'Casino Burgundy', color: '#3d0b17' },
  { name: 'Charcoal Black', color: '#18181b' },
];

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
  const {
    rules,
    setRules,
    fastMode,
    setFastMode,
    rotationMode,
    setRotationMode,
    tableFeltColor,
    setFeltColor,
    bankroll,
    setBankroll,
  } = useSimulatorStore();

  const [inputBankroll, setInputBankroll] = useState(bankroll);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
      <div className="w-full max-w-md bg-surface-panel border border-white/10 rounded-2xl shadow-2xl p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <h2 className="text-lg font-black text-white uppercase tracking-wider">General Settings</h2>
          <button onClick={onClose} className="p-2 text-text-muted hover:text-white rounded-lg transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 1. Wheel Rules Toggle (EUR vs USA) */}
        <div className="space-y-2">
          <label className="text-xs text-text-muted font-bold block">WHEEL RULES & HOUSE EDGE</label>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => setRules('EUR')}
              className={`p-3 rounded-xl border text-left transition ${
                rules === 'EUR'
                  ? 'bg-emerald-500/20 border-emerald-500 text-white font-bold'
                  : 'bg-surface-card border-white/10 text-text-muted'
              }`}
            >
              <div className="text-sm">European (EUR)</div>
              <div className="text-xs text-text-muted mt-0.5">37 Pockets (2.70% Edge)</div>
            </button>
            <button
              onClick={() => setRules('USA')}
              className={`p-3 rounded-xl border text-left transition ${
                rules === 'USA'
                  ? 'bg-emerald-500/20 border-emerald-500 text-white font-bold'
                  : 'bg-surface-card border-white/10 text-text-muted'
              }`}
            >
              <div className="text-sm">American (USA)</div>
              <div className="text-xs text-text-muted mt-0.5">38 Pockets (5.26% Edge)</div>
            </button>
          </div>
        </div>

        {/* 2. Wheel Rotation Direction (CW, CCW, Alternating) */}
        <div className="space-y-2">
          <label className="text-xs text-text-muted font-bold block">3D WHEEL ROTATION MODE</label>
          <div className="grid grid-cols-3 gap-2">
            {(['alternating', 'cw', 'ccw'] as WheelRotationMode[]).map((mode) => (
              <button
                key={mode}
                onClick={() => setRotationMode(mode)}
                className={`py-2 px-3 rounded-xl border text-center text-xs capitalize transition ${
                  rotationMode === mode
                    ? 'bg-neon-green/20 border-neon-green text-neon-green font-bold'
                    : 'bg-surface-card border-white/10 text-text-muted hover:text-white'
                }`}
              >
                {mode === 'cw' ? 'Clockwise' : mode === 'ccw' ? 'Anticlockwise' : 'Alternating'}
              </button>
            ))}
          </div>
        </div>

        {/* 3. Fast Mode vs 3D Wheel */}
        <div className="flex items-center justify-between p-3 bg-surface-card border border-white/10 rounded-xl">
          <div>
            <div className="text-sm font-bold text-white">Fast Mode (Instant Spin)</div>
            <div className="text-xs text-text-muted">Resolves spins in 200ms without 3D animation</div>
          </div>
          <button
            onClick={() => setFastMode(!fastMode)}
            className={`w-12 h-6 rounded-full transition-colors relative ${fastMode ? 'bg-neon-green' : 'bg-white/20'}`}
          >
            <div
              className={`w-5 h-5 rounded-full bg-black absolute top-0.5 transition-transform ${
                fastMode ? 'left-6.5' : 'left-0.5'
              }`}
            />
          </button>
        </div>

        {/* 4. Table Felt Color Picker */}
        <div className="space-y-2">
          <label className="text-xs text-text-muted font-bold block">TABLE FELT COLOR</label>
          <div className="flex space-x-3">
            {FELT_COLORS.map((item) => {
              const isSelected = tableFeltColor === item.color;
              return (
                <button
                  key={item.color}
                  onClick={() => setFeltColor(item.color)}
                  className={`w-10 h-10 rounded-xl border-2 transition flex items-center justify-center ${
                    isSelected ? 'border-neon-green ring-2 ring-neon-green/40' : 'border-white/20'
                  }`}
                  style={{ backgroundColor: item.color }}
                  title={item.name}
                >
                  {isSelected && <Check className="w-4 h-4 text-white drop-shadow" />}
                </button>
              );
            })}
          </div>
        </div>

        {/* 5. Set Starting Bankroll */}
        <div className="space-y-2">
          <label className="text-xs text-text-muted font-bold block">SET ACTIVE BANKROLL ($)</label>
          <div className="flex space-x-2">
            <input
              type="number"
              value={inputBankroll}
              onChange={e => setInputBankroll(Number(e.target.value))}
              className="flex-1 px-3 py-2 bg-surface-card border border-white/10 rounded-xl text-white font-mono text-sm outline-none focus:border-neon-green"
            />
            <button
              onClick={() => {
                setBankroll(inputBankroll);
                onClose();
              }}
              className="px-4 py-2 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 border border-emerald-500/40 font-bold text-xs uppercase rounded-xl transition"
            >
              Apply
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
