import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Navbar } from './components/common/Navbar';
import { WelcomeHub } from './components/common/WelcomeHub';
import { WinjotTopRibbon } from './components/table/WinjotTopRibbon';
import { WinjotFelt } from './components/table/WinjotFelt';
import { WinjotBottomBar } from './components/table/WinjotBottomBar';
import { LeftToolbar } from './components/toolbar/LeftToolbar';
import { GeneralSettingsDrawer } from './components/settings/GeneralSettingsDrawer';
import { PerformanceLogDrawer } from './components/table/PerformanceLogDrawer';
import { ProgressionDrawer } from './components/strategy/ProgressionDrawer';
import { BacktestModal } from './components/backtest/BacktestModal';
import { DealerTracker } from './components/tracker/DealerTracker';
import { AdminModal } from './components/admin/AdminModal';
import { AdminPage } from './components/admin/AdminPage';
import { LoginPage } from './components/auth/LoginPage';
import { UserDashboard } from './components/user/UserDashboard';
import { WinjotWheelModal } from './components/wheel/WinjotWheelModal';
import { FeltResultCard } from './components/table/FeltResultCard';
import { StatisticsModal } from './components/table/StatisticsModal';
import { StrategyStudioPage } from './components/backtest/StrategyStudioPage';
import type { SpinResult } from './stores/simulator.store';
import { useSimulatorStore } from './stores/simulator.store';
import { useAuthStore } from './stores/auth.store';
import { AlertTriangle, X } from 'lucide-react';

export const App: React.FC = () => {
  const token = useAuthStore((state) => state.token);
  const user = useAuthStore((state) => state.user);

  // Navigation View Mode: Strictly 'login' if unauthenticated
  const [viewMode, setViewMode] = useState<'hub' | 'moduleA' | 'moduleB' | 'login' | 'dashboard' | 'admin' | 'backtest'>(() => {
    const savedToken = localStorage.getItem('tableedge_token');
    const savedUser = localStorage.getItem('tableedge_user');
    return savedToken && savedUser ? 'hub' : 'login';
  });

  // Strict Mandatory Authentication Guard: Redirect to login immediately if not signed up / logged in
  useEffect(() => {
    if (!token || !user) {
      if (viewMode !== 'login') {
        setViewMode('login');
      }
    }
  }, [token, user, viewMode]);

  useEffect(() => {
    // Restore authentication profile
    useAuthStore.getState().fetchMe();
    // Fetch historical hot/cold stats computed across all recorded database spins
    useSimulatorStore.getState().fetchDatabaseHotColdStats();
    // Fetch historical spins for statistics modal & distribution analysis
    useSimulatorStore.getState().fetchHistoricalSpins(500);
    // Fetch saved strategies from database
    useSimulatorStore.getState().fetchStrategiesFromDb();
  }, []);

  // Winjot Table Modes
  const [isRacetrackMode, setIsRacetrackMode] = useState(false);

  // Modals & Drawers
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isStatisticsOpen, setIsStatisticsOpen] = useState(false);
  const [isPerformanceOpen, setIsPerformanceOpen] = useState(false);
  const [isSavesOpen, setIsSavesOpen] = useState(false);
  const [isBacktestOpen, setIsBacktestOpen] = useState(false);
  const [isAdminModalOpen, setIsAdminModalOpen] = useState(false);

  // Global Escape key listener: closes any open sidebar drawers or modals
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isAdminModalOpen) {
          setIsAdminModalOpen(false);
        } else if (isBacktestOpen) {
          setIsBacktestOpen(false);
        } else if (isStatisticsOpen) {
          setIsStatisticsOpen(false);
        } else if (isSettingsOpen) {
          setIsSettingsOpen(false);
        } else if (isSavesOpen) {
          setIsSavesOpen(false);
        } else if (isPerformanceOpen) {
          setIsPerformanceOpen(false);
        }
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [
    isAdminModalOpen,
    isBacktestOpen,
    isStatisticsOpen,
    isSettingsOpen,
    isSavesOpen,
    isPerformanceOpen,
  ]);

  // Spin Wheel Modal & Felt Result states
  const [activeWheelResult, setActiveWheelResult] = useState<SpinResult | null>(null);
  const [isWheelModalOpen, setIsWheelModalOpen] = useState(false);
  const [feltResult, setFeltResult] = useState<SpinResult | null>(null);
  const hasFinalizedRef = useRef(false);

  const {
    tableFeltColor,
    isSpinning,
    fastMode,
    triggerSpin,
    finalizeSpin,
    clearBoard,
    contradictingBetWarning,
    clearContradictingWarning,
  } = useSimulatorStore();

  const handleSpin = async () => {
    // Dismiss existing result banner
    setFeltResult(null);
    hasFinalizedRef.current = false;

    const res = await triggerSpin();
    if (!res) return;

    if (fastMode) {
      finalizeSpin(res);
      clearBoard(false);
      setFeltResult(res);
    } else {
      setActiveWheelResult(res);
      setIsWheelModalOpen(true);
    }
  };

  const handleBallLand = useCallback(() => {
    if (activeWheelResult && !hasFinalizedRef.current) {
      hasFinalizedRef.current = true;
      finalizeSpin(activeWheelResult);
      // NOTE: do NOT clearBoard here — chips stay visible until wheel closes
    }
  }, [activeWheelResult, finalizeSpin]);

  const handleWheelComplete = useCallback(() => {
    if (activeWheelResult) {
      if (!hasFinalizedRef.current) {
        hasFinalizedRef.current = true;
        finalizeSpin(activeWheelResult);
      }
      clearBoard(false);
      setFeltResult(activeWheelResult);
      setIsWheelModalOpen(false);
      setActiveWheelResult(null);
    }
  }, [activeWheelResult, finalizeSpin, clearBoard]);

  return (
    <div className="min-h-screen bg-bg-primary text-white flex flex-col font-sans select-none relative">
      {/* Floating Contradicting Bet Toast Warning Banner */}
      {contradictingBetWarning && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 bg-[#dc2626] border-2 border-white/90 text-white font-black px-6 py-3 rounded-2xl shadow-[0_8px_30px_rgba(0,0,0,0.8)] flex items-center space-x-3 animate-fade-in">
          <AlertTriangle className="w-5 h-5 text-amber-300 shrink-0" />
          <span className="text-sm tracking-wide">{contradictingBetWarning}</span>
          <button
            onClick={clearContradictingWarning}
            className="ml-2 p-1 hover:bg-black/20 rounded-full transition cursor-pointer"
          >
            <X className="w-4 h-4 text-white" />
          </button>
        </div>
      )}

      {/* Top Navbar (Hidden on login page for full 2:1 immersion) */}
      {viewMode !== 'login' && (
        <Navbar
          viewMode={viewMode}
          onSelectView={setViewMode}
          onOpenAdminModal={() => setIsAdminModalOpen(true)}
        />
      )}

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col">
        {viewMode === 'login' ? (
          <LoginPage
            onSuccess={() => setViewMode('hub')}
          />
        ) : viewMode === 'admin' ? (
          <AdminPage onBackToHub={() => setViewMode('hub')} />
        ) : viewMode === 'dashboard' ? (
          <UserDashboard onSelectView={setViewMode} />
        ) : viewMode === 'backtest' ? (
          <StrategyStudioPage
            onBackToTable={() => setViewMode('moduleA')}
            onBackToHub={() => setViewMode('hub')}
          />
        ) : viewMode === 'hub' ? (
          <WelcomeHub
            onSelectModule={(mod) => setViewMode(mod)}
            onSelectView={setViewMode}
            onOpenAdmin={() => setViewMode('admin')}
          />
        ) : viewMode === 'moduleA' ? (
          <div
            className="flex-1 flex flex-col justify-between relative min-h-[calc(100vh-72px)] overflow-x-hidden"
            style={{
              background: `radial-gradient(ellipse at 50% 45%, ${tableFeltColor || '#0b3d24'} 0%, #06190e 65%, #020804 100%)`,
            }}
          >
            {/* Winjot Floating Left Toolbar */}
            <LeftToolbar
              isRacetrackMode={isRacetrackMode}
              onToggleRacetrack={() => setIsRacetrackMode(!isRacetrackMode)}
              onOpenSettings={() => setIsSettingsOpen(true)}
              onOpenStatistics={() => setIsStatisticsOpen(true)}
              onOpenPerformance={() => setIsPerformanceOpen(true)}
              onOpenSaves={() => setIsSavesOpen(true)}
              onOpenBacktest={() => setViewMode('backtest')}
            />

            {/* Winjot Top Ribbon (Outcome square tiles + HOT/COLD matrix) */}
            <WinjotTopRibbon onOpenStatistics={() => setIsStatisticsOpen(true)} />

            {/* Table Center Stage with Floating Felt Result Card */}
            <div className="flex-1 flex flex-col items-center justify-center px-2 sm:px-4 py-1 relative max-w-[1540px] mx-auto w-full">
              <WinjotFelt isRacetrackMode={isRacetrackMode} />

              {/* Felt Win/Loss Notification Banner */}
              <FeltResultCard
                result={feltResult}
                duration={fastMode ? 1100 : 1700}
                onDismiss={() => setFeltResult(null)}
              />
            </div>

            {/* Winjot Segmented Status & Action Bar */}
            <WinjotBottomBar onSpin={handleSpin} isSpinning={isSpinning} />

            {/* Wheel Spin Overlay Modal */}
            <WinjotWheelModal
              isOpen={isWheelModalOpen}
              spinResult={activeWheelResult}
              onBallLand={handleBallLand}
              onComplete={handleWheelComplete}
            />
          </div>
        ) : (
          <DealerTracker />
        )}
      </main>

      {/* Drawers & Modals */}
      <GeneralSettingsDrawer isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
      <StatisticsModal isOpen={isStatisticsOpen} onClose={() => setIsStatisticsOpen(false)} />
      <PerformanceLogDrawer isOpen={isPerformanceOpen} onClose={() => setIsPerformanceOpen(false)} />
      <ProgressionDrawer isOpen={isSavesOpen} onClose={() => setIsSavesOpen(false)} />
      <BacktestModal
        isOpen={isBacktestOpen}
        onClose={() => setIsBacktestOpen(false)}
        onOpenStudio={() => {
          setIsBacktestOpen(false);
          setViewMode('backtest');
        }}
      />
      <AdminModal isOpen={isAdminModalOpen} onClose={() => setIsAdminModalOpen(false)} />

      {/* Responsible Gaming Footer (§9.4) */}
      {viewMode !== 'login' && (
        <footer className="w-full py-2 bg-surface-panel/80 border-t border-white/5 text-center text-[11px] text-text-muted font-mono tracking-wide">
          TableEdge is a practice and analytical research tool only. No real-money wagering occurs in this product. Gamble responsibly.
        </footer>
      )}
    </div>
  );
};

export default App;
