import React from 'react';
import { useAuthStore } from '../../stores/auth.store';
import {
  CircleDot,
  Compass,
  ArrowRight,
  ShieldCheck,
  Cpu,
  Database,
  Sparkles,
  Shield,
  Crown,
  LogIn,
  PlaySquare,
} from 'lucide-react';

interface WelcomeHubProps {
  onSelectModule: (module: 'moduleA' | 'moduleB') => void;
  onSelectView: (view: 'hub' | 'moduleA' | 'moduleB' | 'login' | 'dashboard' | 'admin' | 'backtest') => void;
  onOpenAdmin: () => void;
}

export const WelcomeHub: React.FC<WelcomeHubProps> = ({
  onSelectModule,
  onSelectView,
}) => {
  const { user } = useAuthStore();
  const isPro = user?.subscription?.tier_id === 'tier-pro' || user?.is_admin;
  const isAdmin = Boolean(user?.is_admin || user?.role === 'admin');

  return (
    <div className="min-h-[calc(100vh-72px)] w-full flex flex-col justify-between p-6 md:p-12 max-w-7xl mx-auto">
      {/* Top Banner: User Authentication Context */}
      <div className="mb-4">
        {user ? (
          <div className="p-3.5 bg-gradient-to-r from-emerald-500/10 via-[#0a130f] to-emerald-500/10 border border-emerald-500/20 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-neon-green flex items-center justify-center font-bold">
                {isPro ? <Crown className="w-4 h-4 text-amber-400" /> : <Sparkles className="w-4 h-4 text-emerald-400" />}
              </div>
              <div>
                <span className="text-gray-300">Signed in as </span>
                <strong className="text-white font-mono">{user.display_name}</strong>
                <span className="text-text-muted"> ({user.email})</span>
                <span
                  className={`ml-2 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase ${
                    isAdmin
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                      : isPro
                      ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                      : 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                  }`}
                >
                  {isAdmin ? 'Admin' : isPro ? '★ Pro Subscriber' : 'Free User'}
                </span>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <button
                onClick={() => onSelectView('dashboard')}
                className="px-3.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 text-white font-bold text-xs transition"
              >
                My Dashboard & Subscription
              </button>
            </div>
          </div>
        ) : (
          <div className="p-3.5 bg-[#0a130f]/80 border border-white/10 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
            <div className="flex items-center space-x-2.5 text-text-muted">
              <Sparkles className="w-4 h-4 text-emerald-400" />
              <span>
                Account registration is mandatory to unlock TableEdge. Please sign in or register to enter workspaces.
              </span>
            </div>
            <button
              onClick={() => onSelectView('login')}
              className="px-4 py-1.5 rounded-xl bg-neon-green hover:bg-emerald-400 text-black font-extrabold text-xs transition flex items-center space-x-1.5 shrink-0"
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>Sign In / Register</span>
            </button>
          </div>
        )}
      </div>

      {/* Hero Welcome Section */}
      <div className="text-center space-y-4 max-w-3xl mx-auto pt-2 md:pt-4">
        <div className="inline-flex items-center space-x-2 px-3.5 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-mono font-semibold">
          <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
          <span>TableEdge Intelligence Suite v2.0</span>
        </div>

        <h1 className="text-4xl md:text-5xl lg:text-6xl font-black tracking-tight text-white">
          Quantitative Roulette <span className="text-neon-green">Analytics</span>
        </h1>

        <p className="text-xs md:text-sm text-text-muted leading-relaxed">
          Select an institutional module below to enter your workspace, or access the centralized Admin Panel to configure users, freemium subscription tiers, and module availability.
        </p>
      </div>

      {/* 4 Core Workspace Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 my-8 md:my-10">
        {/* Card 1: Module A — Strategy Simulator */}
        <div
          onClick={() => onSelectModule('moduleA')}
          className="group relative bg-[#0a130f]/90 hover:bg-[#0e1913] border border-white/10 hover:border-neon-green/60 rounded-3xl p-6 shadow-2xl transition-all duration-300 hover:shadow-[0_0_35px_rgba(0,255,135,0.15)] flex flex-col justify-between cursor-pointer transform hover:-translate-y-1"
        >
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-emerald-500/20 to-green-400/20 border border-emerald-500/40 flex items-center justify-center text-neon-green shadow-inner group-hover:scale-110 transition-transform">
                <CircleDot className="w-6 h-6" />
              </div>
              <span className="px-2.5 py-0.5 bg-emerald-500/10 border border-emerald-500/20 rounded-full text-[11px] font-mono font-bold text-emerald-400">
                Module A
              </span>
            </div>

            <h2 className="text-lg font-black text-white tracking-wide mb-1 group-hover:text-neon-green transition-colors">
              Table Simulator
            </h2>
            <p className="text-[11px] font-mono text-emerald-400 uppercase tracking-wider mb-2.5">
              Live Felt & 3D Wheel
            </p>

            <p className="text-xs text-text-muted leading-relaxed mb-4">
              Interactive roulette felt with chip betting, racetrack neighbor bets, physics 3D wheel, and real-time spin telemetry.
            </p>

            <div className="grid grid-cols-2 gap-1.5 mb-5">
              <div className="px-2 py-1 bg-black/40 border border-white/5 rounded-lg text-[10px] font-mono text-gray-300">
                • Interactive Felt
              </div>
              <div className="px-2 py-1 bg-black/40 border border-white/5 rounded-lg text-[10px] font-mono text-gray-300">
                • 3D Physics Wheel
              </div>
              <div className="px-2 py-1 bg-black/40 border border-white/5 rounded-lg text-[10px] font-mono text-gray-300">
                • Racetrack Felt
              </div>
              <div className="px-2 py-1 bg-black/40 border border-white/5 rounded-lg text-[10px] font-mono text-gray-300">
                • Fast Mode
              </div>
            </div>
          </div>

          <div className="pt-3.5 border-t border-white/10 flex items-center justify-between">
            <span className="text-xs font-bold text-text-muted group-hover:text-white transition-colors">
              Enter Table
            </span>
            <div className="w-8 h-8 rounded-xl bg-neon-green text-black flex items-center justify-center font-bold shadow-[0_0_15px_rgba(0,255,135,0.4)] group-hover:translate-x-1 transition-transform">
              <ArrowRight className="w-4 h-4" />
            </div>
          </div>
        </div>

        {/* Card 2: Strategy Studio & Monte Carlo Lab */}
        <div
          onClick={() => onSelectView('backtest')}
          className="group relative bg-[#0a130f]/90 hover:bg-[#0e1913] border border-emerald-500/30 hover:border-emerald-400/80 rounded-3xl p-6 shadow-2xl transition-all duration-300 hover:shadow-[0_0_35px_rgba(0,255,135,0.25)] flex flex-col justify-between cursor-pointer transform hover:-translate-y-1"
        >
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-emerald-500/25 to-teal-400/25 border border-emerald-500/50 flex items-center justify-center text-[#00ff87] shadow-inner group-hover:scale-110 transition-transform">
                <PlaySquare className="w-6 h-6" />
              </div>
              <span className="px-2.5 py-0.5 bg-emerald-500/20 border border-emerald-500/40 rounded-full text-[11px] font-mono font-extrabold text-[#00ff87]">
                Studio Lab
              </span>
            </div>

            <h2 className="text-lg font-black text-white tracking-wide mb-1 group-hover:text-[#00ff87] transition-colors">
              Strategy Studio
            </h2>
            <p className="text-[11px] font-mono text-emerald-400 uppercase tracking-wider mb-2.5">
              Monte Carlo & Automations
            </p>

            <p className="text-xs text-text-muted leading-relaxed mb-4">
              Multi-session simulations ($N$ sessions $\times$ $N$ spins), structured condition builder cards, spaghetti envelope visualizer, and dual CSV exports.
            </p>

            <div className="grid grid-cols-2 gap-1.5 mb-5">
              <div className="px-2 py-1 bg-black/40 border border-white/5 rounded-lg text-[10px] font-mono text-gray-300">
                • N-Session Loops
              </div>
              <div className="px-2 py-1 bg-black/40 border border-white/5 rounded-lg text-[10px] font-mono text-gray-300">
                • Rule Automations
              </div>
              <div className="px-2 py-1 bg-black/40 border border-white/5 rounded-lg text-[10px] font-mono text-gray-300">
                • Spaghetti Canvas
              </div>
              <div className="px-2 py-1 bg-black/40 border border-white/5 rounded-lg text-[10px] font-mono text-gray-300">
                • Dual CSV Exports
              </div>
            </div>
          </div>

          <div className="pt-3.5 border-t border-white/10 flex items-center justify-between">
            <span className="text-xs font-bold text-text-muted group-hover:text-white transition-colors">
              Open Studio
            </span>
            <div className="w-8 h-8 rounded-xl bg-neon-green text-black flex items-center justify-center font-bold shadow-[0_0_15px_rgba(0,255,135,0.4)] group-hover:translate-x-1 transition-transform">
              <ArrowRight className="w-4 h-4" />
            </div>
          </div>
        </div>

        {/* Card 3: Module B — Dealer Signature Tracker */}
        <div
          onClick={() => onSelectModule('moduleB')}
          className="group relative bg-[#0a130f]/90 hover:bg-[#0e1913] border border-white/10 hover:border-neon-green/60 rounded-3xl p-6 shadow-2xl transition-all duration-300 hover:shadow-[0_0_35px_rgba(0,255,135,0.15)] flex flex-col justify-between cursor-pointer transform hover:-translate-y-1"
        >
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-emerald-500/20 to-teal-400/20 border border-emerald-500/40 flex items-center justify-center text-neon-green shadow-inner group-hover:scale-110 transition-transform">
                <Compass className="w-6 h-6" />
              </div>
              <span className="px-2.5 py-0.5 bg-emerald-500/10 border border-emerald-500/20 rounded-full text-[11px] font-mono font-bold text-emerald-400">
                Module B
              </span>
            </div>

            <h2 className="text-lg font-black text-white tracking-wide mb-1 group-hover:text-neon-green transition-colors">
              Dealer Tracker
            </h2>
            <p className="text-[11px] font-mono text-emerald-400 uppercase tracking-wider mb-2.5">
              Physical Pattern Detection
            </p>

            <p className="text-xs text-text-muted leading-relaxed mb-4">
              Designed for live tables. Rapid one-handed keypad input, 6-segment wheel clustering, drop offsets, and sector prediction.
            </p>

            <div className="grid grid-cols-2 gap-1.5 mb-5">
              <div className="px-2 py-1 bg-black/40 border border-white/5 rounded-lg text-[10px] font-mono text-gray-300">
                • One-Hand Keypad
              </div>
              <div className="px-2 py-1 bg-black/40 border border-white/5 rounded-lg text-[10px] font-mono text-gray-300">
                • 6-Segment Wheel
              </div>
              <div className="px-2 py-1 bg-black/40 border border-white/5 rounded-lg text-[10px] font-mono text-gray-300">
                • CW/CCW Offsets
              </div>
              <div className="px-2 py-1 bg-black/40 border border-white/5 rounded-lg text-[10px] font-mono text-gray-300">
                • Sector Predictor
              </div>
            </div>
          </div>

          <div className="pt-3.5 border-t border-white/10 flex items-center justify-between">
            <span className="text-xs font-bold text-text-muted group-hover:text-white transition-colors">
              Enter Tracker
            </span>
            <div className="w-8 h-8 rounded-xl bg-neon-green text-black flex items-center justify-center font-bold shadow-[0_0_15px_rgba(0,255,135,0.4)] group-hover:translate-x-1 transition-transform">
              <ArrowRight className="w-4 h-4" />
            </div>
          </div>
        </div>

        {/* Card 4: Admin Management Panel */}
        <div
          onClick={() => onSelectView('admin')}
          className="group relative bg-gradient-to-br from-[#12140e] via-[#0a130f] to-[#060a08] hover:border-amber-400/60 border border-amber-500/30 rounded-3xl p-6 shadow-2xl transition-all duration-300 hover:shadow-[0_0_35px_rgba(245,158,11,0.15)] flex flex-col justify-between cursor-pointer transform hover:-translate-y-1"
        >
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-500/20 to-yellow-400/20 border border-amber-500/40 flex items-center justify-center text-amber-300 shadow-inner group-hover:scale-110 transition-transform">
                <Shield className="w-6 h-6" />
              </div>
              <span className="px-2.5 py-0.5 bg-amber-500/15 border border-amber-500/30 rounded-full text-[11px] font-mono font-bold text-amber-300">
                Admin Panel
              </span>
            </div>

            <h2 className="text-lg font-black text-white tracking-wide mb-1 group-hover:text-amber-300 transition-colors">
              Admin Center
            </h2>
            <p className="text-[11px] font-mono text-amber-400 uppercase tracking-wider mb-2.5">
              Users & SaaS Governance
            </p>

            <p className="text-xs text-text-muted leading-relaxed mb-4">
              User lifecycle management, custom freemium tiers, limits, password resets, and audit trail logs.
            </p>

            <div className="grid grid-cols-2 gap-1.5 mb-5">
              <div className="px-2 py-1 bg-black/40 border border-amber-500/15 rounded-lg text-[10px] font-mono text-amber-200/80">
                • User Accounts
              </div>
              <div className="px-2 py-1 bg-black/40 border border-amber-500/15 rounded-lg text-[10px] font-mono text-amber-200/80">
                • Tier Architect
              </div>
              <div className="px-2 py-1 bg-black/40 border border-amber-500/15 rounded-lg text-[10px] font-mono text-amber-200/80">
                • Password Reset
              </div>
              <div className="px-2 py-1 bg-black/40 border border-amber-500/15 rounded-lg text-[10px] font-mono text-amber-200/80">
                • Audit Trail
              </div>
            </div>
          </div>

          <div className="pt-3.5 border-t border-white/10 flex items-center justify-between">
            <span className="text-xs font-bold text-amber-300 group-hover:text-white transition-colors">
              Open Admin
            </span>
            <div className="w-8 h-8 rounded-xl bg-amber-400 text-black flex items-center justify-center font-bold shadow-[0_0_15px_rgba(245,158,11,0.4)] group-hover:translate-x-1 transition-transform">
              <ArrowRight className="w-4 h-4" />
            </div>
          </div>
        </div>
      </div>

      {/* Trust & Architecture Badges Footer */}
      <div className="border-t border-white/10 pt-6 flex flex-wrap items-center justify-between gap-4 text-xs font-mono text-text-muted">
        <div className="flex items-center space-x-6">
          <div className="flex items-center space-x-2">
            <Cpu className="w-4 h-4 text-emerald-400" />
            <span>FastAPI Python Engine</span>
          </div>
          <div className="flex items-center space-x-2">
            <Database className="w-4 h-4 text-emerald-400" />
            <span>PostgreSQL Database</span>
          </div>
          <div className="flex items-center space-x-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>Encrypted Authentication</span>
          </div>
        </div>

        <div className="flex items-center space-x-4">
          <button
            onClick={() => onSelectView('admin')}
            className="text-amber-300 hover:text-white transition underline underline-offset-4"
          >
            Admin Panel
          </button>
        </div>
      </div>
    </div>
  );
};
