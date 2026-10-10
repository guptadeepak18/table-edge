import React from 'react';
import { Settings, BarChart2, TrendingUp, Layers, PlaySquare, Maximize2, Box } from 'lucide-react';

interface LeftToolbarProps {
  isRacetrackMode: boolean;
  onToggleRacetrack: () => void;
  onOpenSettings: () => void;
  onOpenStatistics: () => void;
  onOpenPerformance: () => void;
  onOpenSaves: () => void;
  onOpenBacktest: () => void;
  usePhysicalWheel?: boolean;
  onTogglePhysicalWheel?: () => void;
}

export const LeftToolbar: React.FC<LeftToolbarProps> = ({
  isRacetrackMode,
  onToggleRacetrack,
  onOpenSettings,
  onOpenStatistics,
  onOpenPerformance,
  onOpenSaves,
  onOpenBacktest,
  usePhysicalWheel = false,
  onTogglePhysicalWheel,
}) => {
  return (
    <div className="fixed left-3 top-1/2 -translate-y-1/2 z-30 flex flex-col space-y-2 select-none">
      {/* 1. Racetrack Switcher */}
      <button
        onClick={onToggleRacetrack}
        title={isRacetrackMode ? 'Switch to Grid Table' : 'Switch to Oval Racetrack'}
        className={`w-9 h-9 rounded-md border flex items-center justify-center transition shadow-lg ${
          isRacetrackMode
            ? 'bg-[#00e676]/20 border-[#00e676] text-[#00e676]'
            : 'bg-black/70 border-white/20 text-white/70 hover:text-white hover:border-white/40'
        }`}
      >
        <div className="w-5 h-3.5 border-2 border-current rounded-full" />
      </button>

      {/* 2. Statistics Modal */}
      <button
        onClick={onOpenStatistics}
        title="Wheel & Game Statistics"
        className="w-9 h-9 rounded-md bg-black/70 border border-white/20 text-[#00d2b4] hover:text-white hover:border-[#00d2b4] flex items-center justify-center transition shadow-lg cursor-pointer"
      >
        <BarChart2 className="w-4 h-4" />
      </button>

      {/* 3. Performance Log (Cumulative P&L) */}
      <button
        onClick={onOpenPerformance}
        title="P&L Performance Log"
        className="w-9 h-9 rounded-md bg-black/70 border border-white/20 text-white/70 hover:text-white hover:border-white/40 flex items-center justify-center transition shadow-lg cursor-pointer"
      >
        <TrendingUp className="w-4 h-4" />
      </button>

      {/* 3. General Settings Gear */}
      <button
        onClick={onOpenSettings}
        title="General Settings"
        className="w-9 h-9 rounded-md bg-black/70 border border-white/20 text-white/70 hover:text-white hover:border-white/40 flex items-center justify-center transition shadow-lg"
      >
        <Settings className="w-4 h-4" />
      </button>

      {/* 4. Bet Placement Saves (Progression Builder) */}
      <button
        onClick={onOpenSaves}
        title="Bet Placement Saves"
        className="w-9 h-9 rounded-md bg-black/70 border border-white/20 text-white/70 hover:text-white hover:border-white/40 flex items-center justify-center transition shadow-lg"
      >
        <Layers className="w-4 h-4" />
      </button>

      {/* 5. Strategy Testing Engine */}
      <button
        onClick={onOpenBacktest}
        title="Test Strategy Engine"
        className="w-9 h-9 rounded-md bg-black/70 border border-white/20 text-white/70 hover:text-white hover:border-white/40 flex items-center justify-center transition shadow-lg"
      >
        <PlaySquare className="w-4 h-4" />
      </button>

      {/* 6. Physical 3D Wheel Toggle */}
      {onTogglePhysicalWheel && (
        <button
          onClick={onTogglePhysicalWheel}
          title={usePhysicalWheel ? 'Hide 3D Wheel' : 'Show 3D Wheel'}
          className={`w-9 h-9 rounded-md border flex items-center justify-center transition shadow-lg ${
            usePhysicalWheel
              ? 'bg-[#00e676]/20 border-[#00e676] text-[#00e676]'
              : 'bg-black/70 border-white/20 text-white/70 hover:text-white hover:border-white/40'
          }`}
        >
          <Box className="w-4 h-4" />
        </button>
      )}

      {/* 7. Fullscreen */}
      <button
        onClick={() => {
          if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch(() => {});
          } else {
            document.exitFullscreen().catch(() => {});
          }
        }}
        title="Toggle Fullscreen"
        className="w-9 h-9 rounded-md bg-black/70 border border-white/20 text-white/70 hover:text-white hover:border-white/40 flex items-center justify-center transition shadow-lg"
      >
        <Maximize2 className="w-4 h-4" />
      </button>
    </div>
  );
};
