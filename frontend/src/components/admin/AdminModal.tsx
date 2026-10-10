import React, { useEffect, useState } from 'react';
import { X, Shield, History, CheckCircle, Save, Sliders } from 'lucide-react';
import { useSimulatorStore } from '../../stores/simulator.store';

interface AdminModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AdminModal: React.FC<AdminModalProps> = ({ isOpen, onClose }) => {
  const { historyDisplayCount, setHistoryDisplayCount } = useSimulatorStore();

  const [tiers, setTiers] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'tiers' | 'simulator' | 'audit'>('tiers');
  const [selectedTier, setSelectedTier] = useState<string>('');
  const [editedConfigs, setEditedConfigs] = useState<Record<string, any>>({});
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    fetchTiers();
    fetchAuditLogs();
  }, [isOpen]);

  const fetchTiers = async () => {
    try {
      const res = await fetch('/api/admin/tiers');
      if (res.ok) {
        const data = await res.json();
        setTiers(data);
        if (data.length > 0 && !selectedTier) {
          setSelectedTier(data[0].id);
          setEditedConfigs(data[0].config || {});
        }
      }
    } catch (e) {
      console.warn("Failed to fetch admin tiers:", e);
    }
  };

  const fetchAuditLogs = async () => {
    try {
      const res = await fetch('/api/admin/audit-logs');
      if (res.ok) {
        const data = await res.json();
        setAuditLogs(data);
      }
    } catch (e) {
      console.warn("Failed to fetch audit logs:", e);
    }
  };

  // Close on Escape key press
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const currentTierObj = tiers.find(t => t.id === selectedTier);

  const handleSaveConfig = async (key: string, value: any) => {
    try {
      const res = await fetch(`/api/admin/tiers/${selectedTier}/config`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          changed_by_user_id: 'admin-super',
          config_key: key,
          new_value: value,
        }),
      });

      if (res.ok) {
        setStatusMsg(`Updated ${key} successfully!`);
        setTimeout(() => setStatusMsg(null), 3000);
        fetchTiers();
        fetchAuditLogs();
      }
    } catch (e) {
      console.error("Config update failed:", e);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4 animate-fade-in">
      <div className="w-full max-w-3xl bg-surface-panel border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <Shield className="w-5 h-5 text-accent-gold" />
            <div>
              <h2 className="text-lg font-black text-white uppercase tracking-wider">Admin Configuration Panel</h2>
              <p className="text-xs text-text-muted">Manage dynamic runtime tier entitlements, table settings & audit logs</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-text-muted hover:text-white rounded-lg transition cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="px-6 pt-4 flex space-x-2 border-b border-white/10 text-xs font-bold">
          <button
            onClick={() => setActiveTab('tiers')}
            className={`pb-3 px-3 transition border-b-2 cursor-pointer ${
              activeTab === 'tiers'
                ? 'border-neon-green text-neon-green'
                : 'border-transparent text-text-muted hover:text-white'
            }`}
          >
            Tier Configuration & Limits
          </button>
          <button
            onClick={() => setActiveTab('simulator')}
            className={`pb-3 px-3 transition border-b-2 flex items-center space-x-1.5 cursor-pointer ${
              activeTab === 'simulator'
                ? 'border-neon-green text-neon-green'
                : 'border-transparent text-text-muted hover:text-white'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>Simulator Display Settings</span>
          </button>
          <button
            onClick={() => setActiveTab('audit')}
            className={`pb-3 px-3 transition border-b-2 flex items-center space-x-1.5 cursor-pointer ${
              activeTab === 'audit'
                ? 'border-neon-green text-neon-green'
                : 'border-transparent text-text-muted hover:text-white'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            <span>Audit Trail ({auditLogs.length})</span>
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto flex-1">
          {statusMsg && (
            <div className="mb-4 p-3 bg-emerald-500/20 border border-emerald-500/40 rounded-xl text-emerald-400 text-xs font-bold flex items-center space-x-2">
              <CheckCircle className="w-4 h-4" />
              <span>{statusMsg}</span>
            </div>
          )}

          {activeTab === 'tiers' && (
            <div className="space-y-6">
              {/* Tier Selector */}
              <div>
                <label className="text-xs text-text-muted font-bold block mb-1">SELECT SUBSCRIPTION TIER</label>
                <div className="grid grid-cols-2 gap-3">
                  {tiers.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => {
                        setSelectedTier(t.id);
                        setEditedConfigs(t.config || {});
                      }}
                      className={`p-3 rounded-xl border text-left transition cursor-pointer ${
                        selectedTier === t.id
                          ? 'bg-emerald-500/20 border-emerald-500 text-white font-bold'
                          : 'bg-surface-card border-white/10 text-text-muted hover:text-white'
                      }`}
                    >
                      <div className="text-sm font-extrabold">{t.name} Tier</div>
                      <div className="text-xs text-text-muted mt-0.5">
                        ${(t.price_cents / 100).toFixed(2)}/mo
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Dynamic Feature Limits Form */}
              {currentTierObj && (
                <div className="bg-surface-card border border-white/10 rounded-2xl p-5 space-y-4">
                  <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                    Dynamic Config Keys for {currentTierObj.name}
                  </h4>

                  {/* Max Saved Strategies */}
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-sm font-bold text-white">Max Saved Strategies</span>
                      <p className="text-xs text-text-muted">Maximum betting progression strategies stored</p>
                    </div>
                    <div className="flex items-center space-x-2">
                      <input
                        type="number"
                        value={editedConfigs['max_saved_strategies'] ?? 1}
                        onChange={e => setEditedConfigs({ ...editedConfigs, max_saved_strategies: Number(e.target.value) })}
                        className="w-24 px-2 py-1 bg-black/40 border border-white/20 rounded-lg text-white font-mono text-sm"
                      />
                      <button
                        onClick={() => handleSaveConfig('max_saved_strategies', editedConfigs['max_saved_strategies'])}
                        className="p-1.5 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 rounded-lg cursor-pointer"
                      >
                        <Save className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Max Backtest Sessions */}
                  <div className="flex items-center justify-between border-t border-white/10 pt-3">
                    <div>
                      <span className="text-sm font-bold text-white">Max Backtest Sessions</span>
                      <p className="text-xs text-text-muted">Per-run Monte Carlo session cap</p>
                    </div>
                    <div className="flex items-center space-x-2">
                      <input
                        type="number"
                        value={editedConfigs['max_backtest_sessions'] ?? 100}
                        onChange={e => setEditedConfigs({ ...editedConfigs, max_backtest_sessions: Number(e.target.value) })}
                        className="w-24 px-2 py-1 bg-black/40 border border-white/20 rounded-lg text-white font-mono text-sm"
                      />
                      <button
                        onClick={() => handleSaveConfig('max_backtest_sessions', editedConfigs['max_backtest_sessions'])}
                        className="p-1.5 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 rounded-lg cursor-pointer"
                      >
                        <Save className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Module B Access Gate */}
                  <div className="flex items-center justify-between border-t border-white/10 pt-3">
                    <div>
                      <span className="text-sm font-bold text-white">Module B (Dealer Signature Tracker)</span>
                      <p className="text-xs text-text-muted">Grants access to live table spin logging and sector predictions</p>
                    </div>
                    <button
                      onClick={() => {
                        const next = !editedConfigs['can_access_module_b'];
                        setEditedConfigs({ ...editedConfigs, can_access_module_b: next });
                        handleSaveConfig('can_access_module_b', next);
                      }}
                      className={`px-3 py-1 rounded-xl text-xs font-bold border transition cursor-pointer ${
                        editedConfigs['can_access_module_b']
                          ? 'bg-neon-green/20 border-neon-green text-neon-green'
                          : 'bg-white/10 border-white/20 text-text-muted'
                      }`}
                    >
                      {editedConfigs['can_access_module_b'] ? 'Enabled' : 'Locked'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'simulator' && (
            <div className="space-y-6">
              <div className="bg-surface-card border border-white/10 rounded-2xl p-5 space-y-5">
                <div>
                  <h4 className="text-sm font-black text-white uppercase tracking-wider">
                    Felt & Ribbon Display Configurations
                  </h4>
                  <p className="text-xs text-text-muted mt-1">
                    Control how many past spin outcomes are rendered on the top ribbon tape with horizontal scrolling.
                  </p>
                </div>

                {/* Historical Numbers Count (1 to N) */}
                <div className="space-y-3 border-t border-white/10 pt-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-sm font-bold text-white">Historical Numbers Count</span>
                      <p className="text-xs text-text-muted">
                        Number of past spins shown on the top tape (1 - 100)
                      </p>
                    </div>
                    <div className="flex items-center space-x-2">
                      <input
                        type="number"
                        min={1}
                        max={100}
                        value={historyDisplayCount}
                        onChange={e => setHistoryDisplayCount(Number(e.target.value) || 1)}
                        className="w-20 px-3 py-1.5 bg-black/50 border border-emerald-500/50 rounded-lg text-emerald-400 font-mono font-bold text-sm text-center"
                      />
                    </div>
                  </div>

                  <div className="flex items-center space-x-4">
                    <span className="text-xs text-text-muted">1</span>
                    <input
                      type="range"
                      min={1}
                      max={100}
                      value={historyDisplayCount}
                      onChange={e => setHistoryDisplayCount(Number(e.target.value))}
                      className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer accent-neon-green"
                    />
                    <span className="text-xs text-text-muted">100</span>
                  </div>

                  <div className="p-3 bg-black/40 rounded-xl border border-white/10 text-xs text-gray-300">
                    Currently displaying the latest <span className="text-neon-green font-bold">{historyDisplayCount}</span> spin numbers. Scroll horizontally across the top tape to browse.
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'audit' && (
            <div className="space-y-3">
              {auditLogs.length === 0 ? (
                <div className="text-center py-8 text-xs text-text-muted italic">
                  No configuration modifications recorded yet.
                </div>
              ) : (
                auditLogs.map((log) => (
                  <div key={log.id} className="p-3 bg-surface-card border border-white/10 rounded-xl text-xs font-mono">
                    <div className="flex items-center justify-between text-text-muted mb-1">
                      <span>Changed by: {log.changed_by}</span>
                      <span>{new Date(log.changed_at).toLocaleString()}</span>
                    </div>
                    <div className="text-white">
                      Tier: <span className="font-bold text-neon-green">{log.tier_id}</span> | Old:{' '}
                      <span className="text-red-400">{JSON.stringify(log.old_value)}</span> → New:{' '}
                      <span className="text-emerald-400 font-bold">{JSON.stringify(log.new_value)}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
