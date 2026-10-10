import React, { useState } from 'react';
import { useSimulatorStore } from '../../stores/simulator.store';
import { useAuthStore } from '../../stores/auth.store';
import { audioService } from '../../services/audio.service';
import {
  Volume2,
  VolumeX,
  Shield,
  CircleDot,
  Compass,
  LayoutGrid,
  User as UserIcon,
  Crown,
  LogIn,
  PlaySquare,
} from 'lucide-react';

interface NavbarProps {
  viewMode: 'hub' | 'moduleA' | 'moduleB' | 'login' | 'dashboard' | 'admin' | 'backtest';
  onSelectView: (view: 'hub' | 'moduleA' | 'moduleB' | 'login' | 'dashboard' | 'admin' | 'backtest') => void;
  onOpenAdminModal?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  viewMode,
  onSelectView,
}) => {
  const { bankroll } = useSimulatorStore();
  const { user } = useAuthStore();
  const [muted, setMuted] = useState(false);

  const toggleMute = () => {
    const next = !muted;
    setMuted(next);
    audioService.setMuted(next);
  };

  const isPro = user?.subscription?.tier_id === 'tier-pro' || user?.is_admin;
  const isAdmin = Boolean(user?.is_admin || user?.role === 'admin');

  return (
    <header className="w-full h-18 bg-[#0a130f]/95 backdrop-blur-md border-b border-white/10 px-4 md:px-8 flex items-center justify-between shadow-xl select-none sticky top-0 z-40">
      {/* Left: Visibly Large Transparent Logo & Navigation */}
      <div className="flex items-center space-x-6">
        <button
          onClick={() => onSelectView('hub')}
          className="flex items-center space-x-3 group cursor-pointer focus:outline-none py-1"
          title="Return to TableEdge Hub"
        >
          {/* Visibly Large Transparent Logo */}
          <img
            src="/logo.png"
            alt="TableEdge Logo"
            className="h-12 md:h-14 w-auto object-contain transition-transform group-hover:scale-105 drop-shadow-[0_0_15px_rgba(0,255,135,0.3)]"
          />
        </button>

        {/* Module Switcher Tabs if in a workspace */}
        {(viewMode === 'moduleA' || viewMode === 'moduleB' || viewMode === 'backtest') && (
          <div className="hidden sm:flex items-center space-x-2">
            <button
              onClick={() => onSelectView('hub')}
              className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-text-muted hover:text-white text-xs font-bold transition flex items-center space-x-1.5"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>Hub</span>
            </button>

            <div className="flex items-center bg-black/40 p-1 rounded-xl border border-white/10">
              <button
                onClick={() => onSelectView('moduleA')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition flex items-center space-x-1.5 ${
                  viewMode === 'moduleA'
                    ? 'bg-emerald-500/20 text-neon-green border border-emerald-500/40 shadow'
                    : 'text-text-muted hover:text-white'
                }`}
              >
                <CircleDot className="w-3.5 h-3.5" />
                <span>Simulator</span>
              </button>

              <button
                onClick={() => onSelectView('moduleB')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition flex items-center space-x-1.5 ${
                  viewMode === 'moduleB'
                    ? 'bg-emerald-500/20 text-neon-green border border-emerald-500/40 shadow'
                    : 'text-text-muted hover:text-white'
                }`}
              >
                <Compass className="w-3.5 h-3.5" />
                <span>Tracker</span>
              </button>

              <button
                onClick={() => onSelectView('backtest')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition flex items-center space-x-1.5 ${
                  viewMode === 'backtest'
                    ? 'bg-emerald-500/20 text-neon-green border border-emerald-500/40 shadow'
                    : 'text-text-muted hover:text-white'
                }`}
              >
                <PlaySquare className="w-3.5 h-3.5" />
                <span>Strategy Studio</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Right Controls: Bankroll, Mute, User Status, Admin */}
      <div className="flex items-center space-x-3">
        {viewMode === 'moduleA' && (
          <div className="px-3 py-1 bg-surface-card border border-white/10 rounded-xl flex items-center space-x-2 text-xs font-mono">
            <span className="text-text-muted">BANKROLL:</span>
            <span className="font-extrabold text-neon-green">${bankroll.toLocaleString()}</span>
          </div>
        )}

        {/* Audio Mute */}
        <button
          onClick={toggleMute}
          className="p-2 text-text-muted hover:text-white rounded-xl hover:bg-white/10 transition"
          title={muted ? 'Unmute Audio' : 'Mute Audio'}
        >
          {muted ? <VolumeX className="w-4 h-4 text-red-400" /> : <Volume2 className="w-4 h-4" />}
        </button>

        {/* Admin Center Button (Visible if user is admin or on hub) */}
        {(isAdmin || viewMode === 'hub' || viewMode === 'admin') && (
          <button
            onClick={() => onSelectView('admin')}
            className={`px-3 py-1.5 rounded-xl border text-xs font-bold transition flex items-center space-x-1.5 ${
              viewMode === 'admin'
                ? 'bg-amber-500/25 border-amber-400 text-amber-300 shadow-[0_0_15px_rgba(245,158,11,0.3)]'
                : 'bg-amber-500/10 hover:bg-amber-500/20 border-amber-500/30 text-amber-300'
            }`}
            title="Open Executive Admin Center"
          >
            <Shield className="w-4 h-4 text-amber-400" />
            <span className="hidden md:inline">Admin Panel</span>
          </button>
        )}

        {/* User Account / Profile Button */}
        {user ? (
          <button
            onClick={() => onSelectView('dashboard')}
            className={`px-3 py-1.5 rounded-xl border transition flex items-center space-x-2 cursor-pointer ${
              viewMode === 'dashboard'
                ? 'bg-emerald-500/20 border-emerald-500/40 text-white'
                : 'bg-white/5 hover:bg-white/10 border-white/10 text-gray-200'
            }`}
            title="View User Dashboard"
          >
            <div className="w-6 h-6 rounded-lg bg-emerald-500/20 text-neon-green flex items-center justify-center text-xs font-bold">
              {isPro ? <Crown className="w-3.5 h-3.5 text-amber-400" /> : <UserIcon className="w-3.5 h-3.5 text-neon-green" />}
            </div>
            <div className="text-left hidden sm:block">
              <div className="text-xs font-bold leading-none">{user.display_name}</div>
              <div className="text-[10px] font-mono leading-none mt-1">
                {isAdmin ? (
                  <span className="text-amber-400 font-bold">Admin</span>
                ) : isPro ? (
                  <span className="text-amber-300 font-bold">★ Pro User</span>
                ) : (
                  <span className="text-emerald-400">Free User</span>
                )}
              </div>
            </div>
          </button>
        ) : (
          <button
            onClick={() => onSelectView('login')}
            className="px-4 py-2 rounded-xl bg-neon-green hover:bg-emerald-400 text-black font-extrabold text-xs transition shadow-md flex items-center space-x-1.5 cursor-pointer"
          >
            <LogIn className="w-3.5 h-3.5" />
            <span>Sign In</span>
          </button>
        )}
      </div>
    </header>
  );
};
