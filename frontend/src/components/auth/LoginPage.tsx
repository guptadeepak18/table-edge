import React, { useState } from 'react';
import { useAuthStore } from '../../stores/auth.store';
import {
  Lock,
  Mail,
  User as UserIcon,
  Phone,
  Eye,
  EyeOff,
  Sparkles,
  ShieldCheck,
  CircleDot,
  Compass,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  KeyRound,
  Zap,
} from 'lucide-react';

interface LoginPageProps {
  onSuccess: () => void;
  initialMode?: 'signin' | 'register' | 'forgot';
}

export const LoginPage: React.FC<LoginPageProps> = ({
  onSuccess,
  initialMode = 'signin',
}) => {
  const [mode, setMode] = useState<'signin' | 'register' | 'forgot'>(initialMode);
  const [showPassword, setShowPassword] = useState(false);

  // Form states
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [phone, setPhone] = useState('');
  const [newPassword, setNewPassword] = useState('');

  const { login, register, forgotPassword, isLoading, error, successMessage, clearMessages } = useAuthStore();

  const handleTabChange = (newMode: 'signin' | 'register' | 'forgot') => {
    clearMessages();
    setMode(newMode);
  };

  // Demo Admin quick-fill & login
  const handleQuickDemoAdmin = async () => {
    clearMessages();
    setEmail('admin@tableedge.com');
    setPassword('AdminPassword123!');
    const ok = await login('admin@tableedge.com', 'AdminPassword123!');
    if (ok) {
      setTimeout(() => onSuccess(), 400);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearMessages();

    if (mode === 'signin') {
      const ok = await login(email, password);
      if (ok) {
        setTimeout(() => onSuccess(), 400);
      }
    } else if (mode === 'register') {
      const ok = await register(email, password, displayName, phone);
      if (ok) {
        setTimeout(() => onSuccess(), 500);
      }
    } else if (mode === 'forgot') {
      await forgotPassword(email, newPassword || undefined);
    }
  };

  return (
    <div className="min-h-screen w-full bg-[#050907] text-white flex flex-col justify-between selection:bg-neon-green selection:text-black">
      {/* 2:1 Column Ratio Master Grid */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 min-h-[calc(100vh-40px)]">
        {/* LEFT COLUMN: 2/3 Ratio Luxury Roulette Artwork & Brand Feature Showcase */}
        <div className="lg:col-span-2 relative min-h-[480px] lg:min-h-full flex flex-col justify-between p-8 md:p-14 overflow-hidden border-b lg:border-b-0 lg:border-r border-white/10">
          {/* Hero Background Image */}
          <div
            className="absolute inset-0 z-0 bg-cover bg-center transition-transform duration-1000 ease-out scale-105"
            style={{ backgroundImage: "url('/roulette_login_hero.jpg')" }}
          >
            {/* Deep Vignette & Glow Overlay */}
            <div className="absolute inset-0 bg-gradient-to-r from-black/95 via-black/75 to-[#050907]/90" />
            <div className="absolute inset-0 bg-radial-gradient from-transparent via-[#06190e]/40 to-[#020804]/95" />
          </div>

          {/* Top Brand Banner */}
          <div className="relative z-10 flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <img
                src="/logo.png"
                alt="TableEdge Logo"
                className="h-14 md:h-18 w-auto object-contain drop-shadow-[0_0_25px_rgba(0,255,135,0.4)]"
              />
              <div>
                <span className="text-[11px] font-mono tracking-widest text-neon-green uppercase font-bold px-2 py-0.5 rounded-md bg-emerald-500/10 border border-emerald-500/20">
                  Institutional v2.0
                </span>
                <p className="text-xs text-text-muted mt-0.5 font-medium">Quantitative Roulette Engine</p>
              </div>
            </div>

            <div className="flex items-center space-x-2 px-3.5 py-2 rounded-xl bg-black/50 border border-emerald-500/30 text-xs font-mono text-emerald-400 backdrop-blur-md">
              <Lock className="w-3.5 h-3.5 text-neon-green" />
              <span>Mandatory Member Access</span>
            </div>
          </div>

          {/* Center Graphic Title & Highlights */}
          <div className="relative z-10 max-w-2xl my-auto py-10 space-y-8">
            <div className="space-y-4">
              <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-neon-green/10 border border-neon-green/30 text-neon-green text-xs font-mono font-bold">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Next-Generation Casino Edge Engineering</span>
              </div>
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-black tracking-tight leading-none text-white drop-shadow-md">
                Precision Roulette <br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-neon-green via-emerald-300 to-teal-200">
                  Analytics & Probability
                </span>
              </h1>
              <p className="text-sm md:text-base text-gray-300/90 leading-relaxed font-normal max-w-xl">
                TableEdge pairs server-verified cryptographic RNG simulation with physical wheel sector tracking and dynamic N-level progression architecture.
              </p>
            </div>

            {/* 3 Pillar Features Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
              <div className="bg-black/60 backdrop-blur-md border border-white/10 hover:border-emerald-500/40 p-4 rounded-2xl transition group">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-neon-green mb-3 group-hover:scale-105 transition-transform">
                  <CircleDot className="w-5 h-5" />
                </div>
                <h2 className="text-sm font-bold text-white mb-1">RNG Lab & Felt</h2>
                <p className="text-xs text-gray-400 leading-normal">
                  High-fidelity European felt, intuitive multi-chip betting, and sub-second 50k Monte Carlo backtesting.
                </p>
              </div>

              <div className="bg-black/60 backdrop-blur-md border border-white/10 hover:border-emerald-500/40 p-4 rounded-2xl transition group">
                <div className="w-10 h-10 rounded-xl bg-teal-500/20 border border-teal-500/30 flex items-center justify-center text-teal-300 mb-3 group-hover:scale-105 transition-transform">
                  <Compass className="w-5 h-5" />
                </div>
                <h2 className="text-sm font-bold text-white mb-1">Dealer Tracker</h2>
                <p className="text-xs text-gray-400 leading-normal">
                  6-segment wheel clustering, drop offset histograms, and directional signature predictions for live play.
                </p>
              </div>

              <div className="bg-black/60 backdrop-blur-md border border-white/10 hover:border-emerald-500/40 p-4 rounded-2xl transition group">
                <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-300 mb-3 group-hover:scale-105 transition-transform">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <h2 className="text-sm font-bold text-white mb-1">SaaS Governance</h2>
                <p className="text-xs text-gray-400 leading-normal">
                  Complete user management, freemium tier switches, and audited progression security.
                </p>
              </div>
            </div>
          </div>

          {/* Bottom Security / Trust Metrics */}
          <div className="relative z-10 pt-6 border-t border-white/10 flex flex-wrap items-center justify-between gap-4 text-xs font-mono text-gray-400">
            <div className="flex items-center space-x-6">
              <span className="flex items-center space-x-1.5">
                <span className="w-2 h-2 rounded-full bg-neon-green animate-pulse" />
                <span>Zero-Latency Engine</span>
              </span>
              <span>•</span>
              <span>Encrypted JWT Sessions</span>
              <span>•</span>
              <span>Aiven Cloud Synced</span>
            </div>
            <div className="text-emerald-400/80 font-semibold">
              European (Single Zero) & American (00) Supported
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: 1/3 Ratio Authentication Form */}
        <div className="lg:col-span-1 bg-[#0a100d]/95 backdrop-blur-2xl p-8 md:p-12 flex flex-col justify-between border-l border-white/10 relative">
          {/* Top Logo & Welcome */}
          <div className="w-full max-w-md mx-auto">
            <div className="text-center mb-6">
              <img
                src="/logo.png"
                alt="TableEdge"
                className="h-16 w-auto mx-auto object-contain mb-3 drop-shadow-[0_0_20px_rgba(0,255,135,0.3)]"
              />
              <h2 className="text-2xl font-black text-white tracking-tight">
                {mode === 'signin' && 'Welcome Back'}
                {mode === 'register' && 'Create Your Account'}
                {mode === 'forgot' && 'Password Recovery'}
              </h2>
              <p className="text-xs text-text-muted mt-1">
                {mode === 'signin' && 'Sign in to access your saved strategies & analytics'}
                {mode === 'register' && 'Join TableEdge today with free tier privileges'}
                {mode === 'forgot' && 'Enter your email to reset your secure credentials'}
              </p>
            </div>

            {/* Quick Demo Admin Banner Button */}
            <div className="mb-6">
              <button
                type="button"
                onClick={handleQuickDemoAdmin}
                className="w-full p-3 rounded-2xl bg-gradient-to-r from-amber-500/20 via-yellow-500/10 to-amber-500/20 border border-amber-500/40 hover:border-amber-400 text-amber-300 hover:text-white transition flex items-center justify-between group shadow-lg cursor-pointer"
                title="Log in immediately as seeded system Administrator"
              >
                <div className="flex items-center space-x-2.5 text-left">
                  <div className="w-8 h-8 rounded-xl bg-amber-500/30 flex items-center justify-center text-amber-300 group-hover:scale-110 transition-transform">
                    <Zap className="w-4 h-4 fill-amber-400" />
                  </div>
                  <div>
                    <div className="text-xs font-bold flex items-center space-x-1.5">
                      <span>One-Click Demo Admin</span>
                      <span className="text-[10px] bg-amber-400 text-black px-1.5 py-0.2 rounded font-black">SUPER</span>
                    </div>
                    <div className="text-[10px] font-mono text-amber-200/80">admin@tableedge.com</div>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-amber-300 group-hover:translate-x-1 transition-transform" />
              </button>
            </div>

            {/* Tab Selection */}
            <div className="grid grid-cols-3 p-1 bg-black/50 rounded-2xl border border-white/10 mb-6 text-xs font-bold">
              <button
                type="button"
                onClick={() => handleTabChange('signin')}
                className={`py-2 rounded-xl transition ${
                  mode === 'signin'
                    ? 'bg-neon-green text-black shadow-md'
                    : 'text-text-muted hover:text-white'
                }`}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => handleTabChange('register')}
                className={`py-2 rounded-xl transition ${
                  mode === 'register'
                    ? 'bg-neon-green text-black shadow-md'
                    : 'text-text-muted hover:text-white'
                }`}
              >
                Register
              </button>
              <button
                type="button"
                onClick={() => handleTabChange('forgot')}
                className={`py-2 rounded-xl transition ${
                  mode === 'forgot'
                    ? 'bg-neon-green text-black shadow-md'
                    : 'text-text-muted hover:text-white'
                }`}
              >
                Recovery
              </button>
            </div>

            {/* Feedback Alerts */}
            {error && (
              <div className="mb-5 p-3.5 bg-red-500/15 border border-red-500/40 rounded-2xl text-xs text-red-200 flex items-start space-x-2.5 animate-fade-in">
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}
            {successMessage && (
              <div className="mb-5 p-3.5 bg-emerald-500/15 border border-emerald-500/40 rounded-2xl text-xs text-emerald-200 flex items-start space-x-2.5 animate-fade-in">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span>{successMessage}</span>
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Extra Register Fields */}
              {mode === 'register' && (
                <>
                  <div>
                    <label className="block text-xs font-bold text-gray-300 mb-1.5">Full Name / Nickname</label>
                    <div className="relative">
                      <UserIcon className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        required
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        placeholder="e.g. Monte Carlo Pro"
                        className="w-full bg-black/40 border border-white/15 focus:border-neon-green rounded-xl py-2.5 pl-10 pr-4 text-xs text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-neon-green transition"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-300 mb-1.5">Phone Number (Optional)</label>
                    <div className="relative">
                      <Phone className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="+1 (555) 000-0000"
                        className="w-full bg-black/40 border border-white/15 focus:border-neon-green rounded-xl py-2.5 pl-10 pr-4 text-xs text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-neon-green transition"
                      />
                    </div>
                  </div>
                </>
              )}

              {/* Email (Always Required) */}
              <div>
                <label className="block text-xs font-bold text-gray-300 mb-1.5">Email Address</label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@tableedge.com"
                    className="w-full bg-black/40 border border-white/15 focus:border-neon-green rounded-xl py-2.5 pl-10 pr-4 text-xs text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-neon-green transition font-mono"
                  />
                </div>
              </div>

              {/* Password for Sign In & Register */}
              {mode !== 'forgot' && (
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-bold text-gray-300">Password</label>
                    {mode === 'signin' && (
                      <button
                        type="button"
                        onClick={() => handleTabChange('forgot')}
                        className="text-[11px] text-emerald-400 hover:text-white transition"
                      >
                        Forgot?
                      </button>
                    )}
                  </div>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••••••"
                      className="w-full bg-black/40 border border-white/15 focus:border-neon-green rounded-xl py-2.5 pl-10 pr-10 text-xs text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-neon-green transition"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white transition"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              )}

              {/* Recovery New Password (Optional or Direct Set) */}
              {mode === 'forgot' && (
                <div>
                  <label className="block text-xs font-bold text-gray-300 mb-1.5">New Password</label>
                  <div className="relative">
                    <KeyRound className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Enter new password"
                      className="w-full bg-black/40 border border-white/15 focus:border-neon-green rounded-xl py-2.5 pl-10 pr-10 text-xs text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-neon-green transition"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white transition"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              )}

              {/* Tag notice on registration */}
              {mode === 'register' && (
                <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-[11px] text-emerald-300">
                  ⚡ New accounts start with the <strong>Free User</strong> tier. You can upgrade to <strong>Pro Subscriber ($12.99/mo)</strong> anytime on your dashboard.
                </div>
              )}

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isLoading}
                className="w-full mt-2 py-3 rounded-xl bg-neon-green hover:bg-emerald-400 text-black font-extrabold text-xs tracking-wider uppercase transition shadow-[0_0_20px_rgba(0,255,135,0.4)] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2 cursor-pointer"
              >
                {isLoading ? (
                  <span className="animate-spin rounded-full h-4 w-4 border-2 border-black border-t-transparent" />
                ) : (
                  <>
                    <span>
                      {mode === 'signin' && 'Sign In to TableEdge'}
                      {mode === 'register' && 'Complete Registration'}
                      {mode === 'forgot' && 'Reset Password'}
                    </span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Bottom Security / Mandatory Signup Notice */}
          <div className="w-full max-w-md mx-auto pt-6 mt-6 border-t border-white/10 text-center text-xs text-text-muted">
            <span className="text-gray-400">
              Account registration is mandatory to access the TableEdge simulation suite.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
