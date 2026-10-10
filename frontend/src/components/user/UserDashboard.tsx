import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../../stores/auth.store';
import {
  User,
  Crown,
  Shield,
  CheckCircle2,
  Zap,
  CircleDot,
  Compass,
  ArrowRight,
  LogOut,
  Calendar,
  Mail,
  Phone,
  Clock,
  Sparkles,
  Check,
  CreditCard,
  RefreshCw,
  Star,
} from 'lucide-react';

interface UserDashboardProps {
  onSelectView: (view: 'hub' | 'moduleA' | 'moduleB' | 'admin' | 'login') => void;
}

interface AvailableTier {
  id: string;
  name: string;
  price_cents: number;
  billing_frequency: string;
  model_type: string;
  description: string;
  badge_text: string;
  config: Record<string, any>;
}

const API_BASE = '/api';

export const UserDashboard: React.FC<UserDashboardProps> = ({ onSelectView }) => {
  const { user, logout, upgradeSubscription, isLoading, error, successMessage, clearMessages } =
    useAuthStore();

  const [availableTiers, setAvailableTiers] = useState<AvailableTier[]>([]);
  const [loadingTiers, setLoadingTiers] = useState(false);
  const [tierInFlight, setTierInFlight] = useState<string | null>(null);

  // Fetch active tiers from backend
  const fetchTiers = async () => {
    setLoadingTiers(true);
    try {
      const res = await fetch(`${API_BASE}/auth/tiers`);
      if (res.ok) {
        const data: AvailableTier[] = await res.json();
        setAvailableTiers(data);
      }
    } catch (err) {
      console.error('Failed to load active subscription tiers', err);
    } finally {
      setLoadingTiers(false);
    }
  };

  useEffect(() => {
    fetchTiers();
  }, []);

  if (!user) {
    return (
      <div className="min-h-[calc(100vh-64px)] flex flex-col items-center justify-center p-6 text-center">
        <div className="p-4 rounded-full bg-white/5 border border-white/10 mb-4">
          <User className="w-8 h-8 text-text-muted" />
        </div>
        <h2 className="text-xl font-bold text-white mb-2">No Active Session</h2>
        <p className="text-xs text-text-muted mb-6">
          Please sign in to view your user dashboard and subscription details.
        </p>
        <button
          onClick={() => onSelectView('login')}
          className="px-6 py-2.5 bg-neon-green text-black font-bold text-xs rounded-xl shadow-lg hover:bg-emerald-400 transition cursor-pointer"
        >
          Go to Sign In
        </button>
      </div>
    );
  }

  const currentTierId = user.subscription?.tier_id || 'tier-free';
  const currentTierName = user.subscription?.tier?.name || (currentTierId === 'tier-free' ? 'Free Member' : 'Pro Subscriber');
  const isPaid = currentTierId !== 'tier-free';
  const currentConfigs = user.subscription?.configs || {};

  const handleSelectTier = async (tier: AvailableTier) => {
    if (tier.id === currentTierId) return;
    setTierInFlight(tier.id);
    clearMessages();
    await upgradeSubscription(tier.id, tier.name);
    setTierInFlight(null);
    fetchTiers();
  };

  return (
    <div className="min-h-[calc(100vh-64px)] w-full p-6 md:p-12 max-w-7xl mx-auto space-y-10">
      {/* Top Welcome & Navigation Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-white/10">
        <div className="flex items-center space-x-4">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-emerald-500/20 to-teal-400/20 border border-emerald-500/30 flex items-center justify-center text-neon-green shadow-xl">
            {isPaid ? <Crown className="w-8 h-8 text-amber-400" /> : <User className="w-8 h-8 text-neon-green" />}
          </div>
          <div>
            <div className="flex items-center space-x-2.5">
              <h1 className="text-2xl md:text-3xl font-black text-white">{user.display_name}</h1>
              {user.is_admin && (
                <span className="px-2.5 py-0.5 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-300 text-[10px] font-mono font-black uppercase">
                  Admin
                </span>
              )}
              <span
                className={`px-3 py-0.5 rounded-full text-xs font-mono font-bold uppercase border ${
                  isPaid
                    ? 'bg-amber-500/15 text-amber-300 border-amber-500/40 shadow-[0_0_15px_rgba(245,158,11,0.2)]'
                    : 'bg-gray-800 text-gray-300 border-gray-700'
                }`}
              >
                {isPaid ? `★ ${currentTierName}` : 'Free User'}
              </span>
            </div>
            <p className="text-xs text-text-muted font-mono mt-0.5">{user.email}</p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center space-x-3">
          {user.is_admin && (
            <button
              onClick={() => onSelectView('admin')}
              className="px-4 py-2 bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/40 text-amber-300 text-xs font-bold rounded-xl transition flex items-center space-x-1.5 cursor-pointer"
            >
              <Shield className="w-4 h-4" />
              <span>Admin Center</span>
            </button>
          )}

          <button
            onClick={() => {
              logout();
              onSelectView('login');
            }}
            className="px-4 py-2 bg-white/5 hover:bg-red-500/20 border border-white/10 hover:border-red-500/40 text-gray-300 hover:text-red-300 text-xs font-bold rounded-xl transition flex items-center space-x-1.5 cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign Out</span>
          </button>
        </div>
      </div>

      {/* Alert Messages */}
      {successMessage && (
        <div className="p-4 rounded-2xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-200 text-xs font-bold flex items-center space-x-2 shadow-lg animate-fade-in">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}
      {error && (
        <div className="p-4 rounded-2xl bg-red-500/15 border border-red-500/40 text-red-200 text-xs font-bold flex items-center space-x-2 shadow-lg animate-fade-in">
          <span>{error}</span>
        </div>
      )}

      {/* Section 1: User Profile & Current Subscription Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Account Profile Details */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-surface-panel/90 border border-white/10 rounded-3xl p-6 shadow-xl space-y-4">
            <h2 className="text-sm font-black uppercase tracking-wider text-text-muted font-mono flex items-center space-x-2">
              <User className="w-4 h-4 text-neon-green" />
              <span>Profile Credentials</span>
            </h2>

            <div className="space-y-3 text-xs">
              <div className="flex items-center justify-between py-2 border-b border-white/5">
                <span className="text-text-muted flex items-center space-x-1.5">
                  <Mail className="w-3.5 h-3.5" />
                  <span>Email</span>
                </span>
                <span className="font-mono text-white truncate max-w-[180px]">{user.email}</span>
              </div>

              <div className="flex items-center justify-between py-2 border-b border-white/5">
                <span className="text-text-muted flex items-center space-x-1.5">
                  <Phone className="w-3.5 h-3.5" />
                  <span>Phone</span>
                </span>
                <span className="font-mono text-white">{user.phone || 'Not provided'}</span>
              </div>

              <div className="flex items-center justify-between py-2 border-b border-white/5">
                <span className="text-text-muted flex items-center space-x-1.5">
                  <Calendar className="w-3.5 h-3.5" />
                  <span>Member Since</span>
                </span>
                <span className="font-mono text-white">
                  {user.created_at ? new Date(user.created_at).toLocaleDateString() : 'Active'}
                </span>
              </div>

              <div className="flex items-center justify-between py-2">
                <span className="text-text-muted flex items-center space-x-1.5">
                  <Clock className="w-3.5 h-3.5" />
                  <span>Last Login</span>
                </span>
                <span className="font-mono text-white">
                  {user.last_login_at ? new Date(user.last_login_at).toLocaleTimeString() : 'Just now'}
                </span>
              </div>
            </div>
          </div>

          {/* Quick Launch Cards */}
          <div className="bg-surface-panel/90 border border-white/10 rounded-3xl p-6 shadow-xl space-y-3">
            <h2 className="text-sm font-black uppercase tracking-wider text-text-muted font-mono mb-2">
              Launch Workspace
            </h2>

            <button
              onClick={() => onSelectView('moduleA')}
              className="w-full p-3 bg-surface-card hover:bg-white/10 border border-white/10 hover:border-neon-green/40 rounded-2xl flex items-center justify-between transition group cursor-pointer"
            >
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-neon-green flex items-center justify-center">
                  <CircleDot className="w-4 h-4" />
                </div>
                <div className="text-left">
                  <div className="text-xs font-bold text-white group-hover:text-neon-green transition">
                    RNG Strategy Simulator
                  </div>
                  <div className="text-[10px] text-text-muted">Module A Workspace</div>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-gray-400 group-hover:translate-x-1 transition-transform" />
            </button>

            <button
              onClick={() => onSelectView('moduleB')}
              className="w-full p-3 bg-surface-card hover:bg-white/10 border border-white/10 hover:border-teal-400/40 rounded-2xl flex items-center justify-between transition group cursor-pointer"
            >
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 rounded-xl bg-teal-500/20 text-teal-300 flex items-center justify-center">
                  <Compass className="w-4 h-4" />
                </div>
                <div className="text-left">
                  <div className="text-xs font-bold text-white group-hover:text-teal-300 transition">
                    Dealer Signature Tracker
                  </div>
                  <div className="text-[10px] text-text-muted">Module B Workspace</div>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-gray-400 group-hover:translate-x-1 transition-transform" />
            </button>
          </div>
        </div>

        {/* Right Column: Active Subscription Status & Limits */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-surface-panel/90 border border-white/10 rounded-3xl p-8 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-80 h-80 bg-neon-green/5 rounded-full blur-3xl pointer-events-none" />

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
              <div>
                <span className="text-xs font-mono font-bold text-emerald-400 uppercase tracking-wider flex items-center space-x-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-neon-green" />
                  <span>Your Current Subscription</span>
                </span>
                <h2 className="text-2xl font-black text-white mt-1">{currentTierName}</h2>
                {user.subscription?.tier?.description && (
                  <p className="text-xs text-text-muted mt-1 max-w-xl">
                    {user.subscription.tier.description}
                  </p>
                )}
              </div>
              <div className="flex items-center space-x-2">
                <div
                  className={`px-3.5 py-1.5 rounded-full text-xs font-black uppercase font-mono border ${
                    isPaid
                      ? 'bg-amber-500/20 border-amber-500/40 text-amber-300 shadow-[0_0_20px_rgba(245,158,11,0.3)]'
                      : 'bg-gray-800 border-gray-700 text-gray-400'
                  }`}
                >
                  {isPaid ? 'Active Paid Tier' : 'Freemium Member'}
                </div>
              </div>
            </div>

            {/* Active Tier Capabilities Breakdown */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 my-6">
              <div
                className={`p-4 rounded-2xl border ${
                  isPaid ? 'bg-amber-500/10 border-amber-500/30' : 'bg-surface-card border-white/5'
                }`}
              >
                <div className="flex items-center space-x-2 text-xs font-bold text-white mb-2">
                  <Check className="w-4 h-4 text-neon-green" />
                  <span>Max Saved Strategies</span>
                </div>
                <p className="text-sm font-mono font-extrabold text-neon-green">
                  {currentConfigs.max_saved_strategies >= 999999 || currentConfigs.max_saved_strategies === -1
                    ? 'Unlimited (999,999)'
                    : `${currentConfigs.max_saved_strategies ?? 1} Saved Strategies`}
                </p>
              </div>

              <div
                className={`p-4 rounded-2xl border ${
                  isPaid ? 'bg-amber-500/10 border-amber-500/30' : 'bg-surface-card border-white/5'
                }`}
              >
                <div className="flex items-center space-x-2 text-xs font-bold text-white mb-2">
                  <Check className="w-4 h-4 text-neon-green" />
                  <span>Monte Carlo Backtest Spins</span>
                </div>
                <p className="text-sm font-mono font-extrabold text-neon-green">
                  {currentConfigs.max_backtest_sessions >= 999999 || currentConfigs.max_backtest_sessions === -1
                    ? 'Unlimited Runs'
                    : `${(currentConfigs.max_backtest_sessions ?? 100).toLocaleString()} Spins / Run`}
                </p>
              </div>

              <div
                className={`p-4 rounded-2xl border ${
                  isPaid ? 'bg-amber-500/10 border-amber-500/30' : 'bg-surface-card border-white/5'
                }`}
              >
                <div className="flex items-center space-x-2 text-xs font-bold text-white mb-2">
                  <Check className="w-4 h-4 text-neon-green" />
                  <span>Module B Dealer Tracker</span>
                </div>
                <p className="text-sm font-mono font-extrabold text-neon-green">
                  {currentConfigs.can_access_module_b ? 'Unlocked & Active' : 'Locked / Restricted'}
                </p>
              </div>

              <div
                className={`p-4 rounded-2xl border ${
                  isPaid ? 'bg-amber-500/10 border-amber-500/30' : 'bg-surface-card border-white/5'
                }`}
              >
                <div className="flex items-center space-x-2 text-xs font-bold text-white mb-2">
                  <Check className="w-4 h-4 text-neon-green" />
                  <span>Interactive Racetrack Felt</span>
                </div>
                <p className="text-sm font-mono font-extrabold text-neon-green">
                  {currentConfigs.can_use_racetrack ? 'Unlocked & Active' : 'Locked / Restricted'}
                </p>
              </div>
            </div>

            {/* Custom Parameters (if configured on active tier) */}
            {Object.keys(currentConfigs).some(
              (k) =>
                ![
                  'max_saved_strategies',
                  'max_backtest_sessions',
                  'can_access_module_b',
                  'can_use_racetrack',
                  'can_export_csv',
                  'priority_support',
                ].includes(k)
            ) && (
              <div className="mt-4 p-4 rounded-2xl bg-white/[0.03] border border-white/10">
                <div className="text-[11px] font-mono uppercase tracking-wider text-amber-300 font-bold mb-2 flex items-center space-x-1.5">
                  <Star className="w-3.5 h-3.5" />
                  <span>Additional Active Parameters</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(currentConfigs)
                    .filter(
                      ([k]) =>
                        ![
                          'max_saved_strategies',
                          'max_backtest_sessions',
                          'can_access_module_b',
                          'can_use_racetrack',
                          'can_export_csv',
                          'priority_support',
                        ].includes(k)
                    )
                    .map(([k, v]) => (
                      <span
                        key={k}
                        className="px-2.5 py-1 rounded-lg bg-black/40 border border-white/10 text-xs text-gray-300 font-mono"
                      >
                        {k}: <strong className="text-neon-green">{String(v)}</strong>
                      </span>
                    ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Section 2: Dynamic Available Subscription Tiers Showcase */}
      <div className="space-y-6 pt-6 border-t border-white/10">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-neon-green/10 border border-neon-green/30 text-neon-green text-xs font-mono font-bold mb-2">
              <CreditCard className="w-3.5 h-3.5" />
              <span>Subscription Architect & Pricing</span>
            </div>
            <h2 className="text-2xl font-black text-white">Choose Your Plan</h2>
            <p className="text-xs text-text-muted mt-1">
              Select any plan created by the platform admin to instantly switch or unlock capabilities.
            </p>
          </div>

          <button
            onClick={fetchTiers}
            disabled={loadingTiers}
            className="self-start md:self-auto px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 text-xs font-bold rounded-xl transition flex items-center space-x-1.5 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loadingTiers ? 'animate-spin text-neon-green' : ''}`} />
            <span>Refresh Plans</span>
          </button>
        </div>

        {/* Tiers Grid */}
        {loadingTiers && availableTiers.length === 0 ? (
          <div className="py-16 text-center text-text-muted text-xs font-mono flex flex-col items-center justify-center space-y-3">
            <RefreshCw className="w-6 h-6 animate-spin text-neon-green" />
            <span>Loading active subscription plans...</span>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {availableTiers.map((tier) => {
              const isCurrent = tier.id === currentTierId;
              const cfg = tier.config || {};
              const priceDollars = (tier.price_cents / 100).toFixed(2);
              const customParamsList = Object.entries(cfg).filter(
                ([k]) =>
                  ![
                    'max_saved_strategies',
                    'max_backtest_sessions',
                    'can_access_module_b',
                    'can_use_racetrack',
                    'can_export_csv',
                    'priority_support',
                  ].includes(k)
              );

              return (
                <div
                  key={tier.id}
                  className={`rounded-3xl border p-7 flex flex-col justify-between transition-all duration-300 relative overflow-hidden ${
                    isCurrent
                      ? 'bg-gradient-to-b from-emerald-500/15 via-[#0a1510] to-[#060c09] border-neon-green/60 shadow-[0_0_35px_rgba(0,255,135,0.15)] ring-1 ring-neon-green/40'
                      : 'bg-[#0a130f]/90 hover:bg-[#0d1a14] border-white/10 hover:border-white/20 shadow-xl'
                  }`}
                >
                  {/* Top Badge & Header */}
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <span className="px-2.5 py-0.5 rounded-full bg-white/5 border border-white/10 text-[10px] font-mono uppercase tracking-wider text-gray-400">
                        {tier.model_type || 'subscription'}
                      </span>

                      {tier.badge_text && (
                        <span className="px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-[10px] font-mono font-black uppercase border border-amber-500/30">
                          {tier.badge_text}
                        </span>
                      )}
                    </div>

                    <h3 className="text-2xl font-black text-white">{tier.name}</h3>
                    <p className="text-xs text-text-muted mt-1 min-h-[36px]">
                      {tier.description || 'Custom plan defined by administrator.'}
                    </p>

                    {/* Pricing */}
                    <div className="my-6 pb-6 border-b border-white/10">
                      <div className="flex items-baseline space-x-1.5">
                        <span className="text-3xl md:text-4xl font-mono font-black text-white">
                          ${priceDollars}
                        </span>
                        <span className="text-xs font-mono text-text-muted capitalize">
                          / {tier.billing_frequency || 'monthly'}
                        </span>
                      </div>
                      <div className="text-[11px] text-gray-400 font-mono mt-1">
                        {tier.price_cents === 0 ? 'Free to use' : 'Billed dynamically according to frequency'}
                      </div>
                    </div>

                    {/* Core Features Knobs */}
                    <div className="space-y-3 text-xs mb-6">
                      <div className="flex items-center justify-between py-1">
                        <span className="text-gray-300">Saved Strategies</span>
                        <span className="font-mono font-bold text-white">
                          {cfg.max_saved_strategies >= 999999 || cfg.max_saved_strategies === -1
                            ? 'Unlimited'
                            : cfg.max_saved_strategies ?? 1}
                        </span>
                      </div>

                      <div className="flex items-center justify-between py-1">
                        <span className="text-gray-300">Monte Carlo Spins</span>
                        <span className="font-mono font-bold text-white">
                          {cfg.max_backtest_sessions >= 999999 || cfg.max_backtest_sessions === -1
                            ? 'Unlimited'
                            : (cfg.max_backtest_sessions ?? 100).toLocaleString()}
                        </span>
                      </div>

                      <div className="flex items-center justify-between py-1">
                        <span className="text-gray-300">Module B Dealer Tracker</span>
                        <span
                          className={`font-mono font-bold ${
                            cfg.can_access_module_b ? 'text-neon-green' : 'text-gray-500'
                          }`}
                        >
                          {cfg.can_access_module_b ? '✓ Enabled' : '✕ Disabled'}
                        </span>
                      </div>

                      <div className="flex items-center justify-between py-1">
                        <span className="text-gray-300">Racetrack Neighbor Felt</span>
                        <span
                          className={`font-mono font-bold ${
                            cfg.can_use_racetrack ? 'text-neon-green' : 'text-gray-500'
                          }`}
                        >
                          {cfg.can_use_racetrack ? '✓ Enabled' : '✕ Disabled'}
                        </span>
                      </div>

                      <div className="flex items-center justify-between py-1">
                        <span className="text-gray-300">CSV Export</span>
                        <span
                          className={`font-mono font-bold ${
                            cfg.can_export_csv ? 'text-neon-green' : 'text-gray-500'
                          }`}
                        >
                          {cfg.can_export_csv ? '✓ Enabled' : '✕ Disabled'}
                        </span>
                      </div>

                      <div className="flex items-center justify-between py-1">
                        <span className="text-gray-300">Priority Support</span>
                        <span
                          className={`font-mono font-bold ${
                            cfg.priority_support ? 'text-neon-green' : 'text-gray-500'
                          }`}
                        >
                          {cfg.priority_support ? '✓ Included' : '✕ Standard'}
                        </span>
                      </div>

                      {/* Custom Parameters Pills */}
                      {customParamsList.length > 0 && (
                        <div className="pt-2 border-t border-white/5 space-y-1.5">
                          <span className="text-[10px] font-mono font-bold uppercase text-amber-300">
                            Custom Playground Parameters:
                          </span>
                          <div className="flex flex-wrap gap-1.5">
                            {customParamsList.map(([key, val]) => (
                              <span
                                key={key}
                                className="px-2 py-0.5 rounded bg-white/5 border border-white/10 text-[10px] text-gray-300 font-mono"
                              >
                                {key}: <strong className="text-neon-green">{String(val)}</strong>
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* CTA Switch / Upgrade Button */}
                  <div className="pt-6 border-t border-white/10">
                    {isCurrent ? (
                      <button
                        disabled
                        className="w-full py-3 px-4 rounded-xl bg-emerald-500/20 border border-neon-green/40 text-neon-green font-mono font-bold text-xs flex items-center justify-center space-x-2 cursor-default"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Current Active Plan</span>
                      </button>
                    ) : (
                      <button
                        onClick={() => handleSelectTier(tier)}
                        disabled={tierInFlight === tier.id || isLoading}
                        className={`w-full py-3 px-4 rounded-xl text-xs font-extrabold transition flex items-center justify-center space-x-2 cursor-pointer disabled:opacity-50 ${
                          tier.price_cents > 0
                            ? 'bg-gradient-to-r from-amber-400 to-yellow-400 hover:from-amber-300 hover:to-yellow-300 text-black shadow-[0_0_20px_rgba(245,158,11,0.3)]'
                            : 'bg-white/10 hover:bg-white/20 text-white border border-white/20'
                        }`}
                      >
                        {tierInFlight === tier.id ? (
                          <span className="animate-spin rounded-full h-4 w-4 border-2 border-current border-t-transparent" />
                        ) : (
                          <>
                            <Zap className="w-4 h-4" />
                            <span>
                              {tier.price_cents > 0 ? `Switch to ${tier.name}` : `Select ${tier.name}`}
                            </span>
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
