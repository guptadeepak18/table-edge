import React, { useState, useEffect } from 'react';
import { useSimulatorStore } from '../../stores/simulator.store';
import { X, Plus, Layers, Trash2, Edit2, Check, FolderOpen, RotateCcw } from 'lucide-react';

interface ProgressionDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ProgressionDrawer: React.FC<ProgressionDrawerProps> = ({ isOpen, onClose }) => {
  const {
    strategies,
    currentStrategyId,
    currency,
    activeBets,
    fetchStrategiesFromDb,
    createStrategy,
    loadStrategy,
    deleteStrategy,
    renameStrategy,
    addLevel,
    removeLevel,
    saveBoardToLevel,
    saveBoardAsNewLevel,
    loadBoardFromLevel,
    clearLevel,
    clearAllLevels,
  } = useSimulatorStore();

  const [isCreating, setIsCreating] = useState(false);
  const [newStrategyName, setNewStrategyName] = useState('');
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameText, setRenameText] = useState('');

  useEffect(() => {
    if (isOpen) {
      fetchStrategiesFromDb();
    }
  }, [isOpen]);

  // Close on Escape key press: cancels create/rename forms first, then closes drawer
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        if (isCreating) {
          setIsCreating(false);
        } else if (isRenaming) {
          setIsRenaming(false);
        } else {
          onClose();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isCreating, isRenaming, onClose]);

  if (!isOpen) return null;

  const currentStrategy = strategies.find(s => s.id === currentStrategyId) || null;
  const levels = currentStrategy ? currentStrategy.levels : [];

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStrategyName.trim()) return;
    createStrategy(newStrategyName.trim());
    setNewStrategyName('');
    setIsCreating(false);
  };

  const handleStartRename = () => {
    if (!currentStrategy) return;
    setRenameText(currentStrategy.name);
    setIsRenaming(true);
  };

  const handleRenameSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!renameText.trim() || !currentStrategy) return;
    renameStrategy(currentStrategy.id, renameText.trim());
    setIsRenaming(false);
  };

  const handleDeleteStrategy = () => {
    if (!currentStrategy) return;
    if (window.confirm(`Delete strategy "${currentStrategy.name}" and all its levels?`)) {
      deleteStrategy(currentStrategy.id);
    }
  };

  const handleClearAll = () => {
    if (!currentStrategy) return;
    if (window.confirm(`Clear all saved level placements for "${currentStrategy.name}"?`)) {
      clearAllLevels();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex select-none animate-fade-in">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-xs" onClick={onClose} />

      {/* Left Drawer Panel */}
      <div className="relative w-84 sm:w-96 h-full bg-[#080d0b] border-r border-white/20 shadow-2xl flex flex-col text-white z-10 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/10 bg-[#101915] shrink-0">
          <div className="flex items-center space-x-2">
            <Layers className="w-4 h-4 text-emerald-400" />
            <h3 className="font-extrabold text-xs tracking-widest text-white uppercase">
              Bet Strategies & Levels
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-white transition rounded hover:bg-white/10 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Main Content Area */}
        {strategies.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
            <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mb-4 shadow-lg shadow-emerald-950/40">
              <Layers className="w-7 h-7" />
            </div>
            <h4 className="font-extrabold text-sm text-white uppercase tracking-wider mb-1">
              No Strategies Available
            </h4>
            <p className="text-xs text-gray-400 leading-relaxed max-w-[260px] mb-6">
              Create a new strategy to save and progression bet levels on the board. Strategies are persisted directly in the database.
            </p>
            <form onSubmit={handleCreateSubmit} className="w-full space-y-3 max-w-[280px]">
              <input
                type="text"
                autoFocus
                value={newStrategyName}
                onChange={(e) => setNewStrategyName(e.target.value)}
                placeholder="Strategy name (e.g. Martingale, Tier et Tout)..."
                className="w-full px-3 py-2 bg-[#121f18] border border-emerald-500/40 rounded-xl text-xs text-white placeholder-gray-500 focus:outline-none focus:border-emerald-400 text-center"
              />
              <button
                type="submit"
                disabled={!newStrategyName.trim()}
                className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-black text-xs uppercase tracking-wider rounded-xl transition cursor-pointer flex items-center justify-center space-x-1.5 shadow-lg shadow-emerald-900/40"
              >
                <Plus className="w-4 h-4" />
                <span>Create First Strategy</span>
              </button>
            </form>
          </div>
        ) : (
          <>
            {/* Strategy Selector & Management Card */}
            <div className="p-4 bg-[#0c1410] border-b border-white/10 shrink-0 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-wider text-emerald-400 flex items-center space-x-1.5">
                  <FolderOpen className="w-3.5 h-3.5" />
                  <span>Active Strategy</span>
                </span>

                {!isCreating && (
                  <button
                    onClick={() => setIsCreating(true)}
                    className="px-2 py-0.5 bg-emerald-600 hover:bg-emerald-500 rounded text-[10px] font-bold text-white flex items-center space-x-1 transition cursor-pointer"
                  >
                    <Plus className="w-3 h-3" />
                    <span>New Strategy</span>
                  </button>
                )}
              </div>

              {/* Creation Form */}
              {isCreating ? (
                <form onSubmit={handleCreateSubmit} className="space-y-2 bg-[#14221b] border border-emerald-500/30 rounded-xl p-3">
                  <span className="text-[11px] font-bold text-gray-300 block">Create New Strategy</span>
                  <input
                    type="text"
                    autoFocus
                    value={newStrategyName}
                    onChange={(e) => setNewStrategyName(e.target.value)}
                    placeholder="e.g. Martingale Red, Tier et Tout..."
                    className="w-full px-2.5 py-1.5 bg-[#09110d] border border-white/20 rounded text-xs text-white focus:outline-none focus:border-emerald-400"
                  />
                  <div className="flex justify-end space-x-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setIsCreating(false)}
                      className="px-2.5 py-1 bg-white/10 hover:bg-white/20 text-gray-300 rounded text-[11px] font-bold transition cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={!newStrategyName.trim()}
                      className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white rounded text-[11px] font-bold transition cursor-pointer"
                    >
                      Create
                    </button>
                  </div>
                </form>
              ) : isRenaming ? (
                <form onSubmit={handleRenameSubmit} className="flex items-center space-x-2">
                  <input
                    type="text"
                    autoFocus
                    value={renameText}
                    onChange={(e) => setRenameText(e.target.value)}
                    className="flex-1 px-2.5 py-1 bg-[#14221b] border border-white/20 rounded text-xs text-white focus:outline-none focus:border-emerald-400"
                  />
                  <button
                    type="submit"
                    className="p-1.5 bg-emerald-600 hover:bg-emerald-500 rounded text-white cursor-pointer"
                    title="Save Name"
                  >
                    <Check className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsRenaming(false)}
                    className="p-1.5 bg-white/10 hover:bg-white/20 rounded text-gray-400 hover:text-white cursor-pointer"
                    title="Cancel"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </form>
              ) : (
                <div className="flex items-center space-x-2">
                  {/* Load Strategy Dropdown */}
                  <select
                    value={currentStrategyId}
                    onChange={(e) => loadStrategy(e.target.value)}
                    className="flex-1 bg-[#131f18] border border-white/20 rounded-lg px-2.5 py-2 text-white font-bold text-xs focus:outline-none cursor-pointer"
                  >
                    <option value="" className="bg-[#0b1410] text-emerald-400 font-semibold">
                      None (Freestyle)
                    </option>
                    {strategies.map((s) => {
                      const activeLevelsCount = s.levels.filter(l => l.placements.length > 0).length;
                      return (
                        <option key={s.id} value={s.id} className="bg-[#0b1410] text-white">
                          {s.name} ({activeLevelsCount}/{s.levels.length} loaded)
                        </option>
                      );
                    })}
                  </select>

                  <button
                    onClick={handleStartRename}
                    disabled={!currentStrategy}
                    title={currentStrategy ? "Rename Strategy" : "Select a strategy to rename"}
                    className={`p-2 bg-[#131f18] border border-white/20 rounded-lg transition ${
                      currentStrategy ? 'hover:bg-white/10 text-gray-300 hover:text-white cursor-pointer' : 'opacity-30 cursor-not-allowed text-gray-600'
                    }`}
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>

                  <button
                    onClick={handleDeleteStrategy}
                    disabled={!currentStrategy}
                    title={currentStrategy ? "Delete Strategy" : "Select a strategy to delete"}
                    className={`p-2 bg-[#131f18] border border-white/20 rounded-lg transition ${
                      currentStrategy ? 'hover:bg-red-500/20 text-gray-300 hover:text-red-400 cursor-pointer' : 'opacity-30 cursor-not-allowed text-gray-600'
                    }`}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>

            {/* Levels Subtitle */}
            <div className="px-5 pt-3 pb-2 shrink-0">
              <p className="text-[10px] font-mono text-gray-400 uppercase tracking-wide leading-relaxed">
                {currentStrategy
                  ? "TAP LEVEL TO ADD TO BOARD • TAP SAVE TO REMEMBER CURRENT BOARD"
                  : "FREESTYLE MODE • NO PROGRESSION STRATEGY LOADED"}
              </p>
            </div>

            {/* Level Rows for Active Strategy */}
            <div className="space-y-2 flex-1 overflow-y-auto px-5 py-1">
              {!currentStrategy ? (
                <div className="py-10 text-center px-4 space-y-3">
                  <div className="w-12 h-12 mx-auto rounded-2xl bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-center text-emerald-400">
                    <Layers className="w-6 h-6" />
                  </div>
                  <h5 className="font-bold text-sm text-white">Freestyle Mode Active</h5>
                  <p className="text-xs text-gray-400 leading-relaxed max-w-[260px] mx-auto">
                    No strategy is currently loaded. Bets placed on the table are tracked under Freestyle.
                  </p>
                  <p className="text-[11px] text-emerald-400/90 font-mono">
                    Select a strategy above or click &ldquo;New Strategy&rdquo; to use progression levels.
                  </p>
                </div>
              ) : levels.length === 0 ? (
                <div className="py-8 text-center text-xs text-text-muted font-mono space-y-2">
                  <p>No levels saved in this strategy yet.</p>
                  <p className="text-[11px] text-gray-500">Click below to add a level or save your current felt bets.</p>
                </div>
              ) : (
                levels.map((lvl) => {
                  const hasBets = lvl.placements.length > 0;
                  return (
                    <div
                      key={`strat-level-${lvl.levelNumber}`}
                      className="flex items-center justify-between bg-[#111614] hover:bg-[#18201d] border border-white/15 rounded-xl px-3 py-2.5 transition group"
                    >
                      {/* Click left side to add level bets to board */}
                      <button
                        onClick={() => loadBoardFromLevel(lvl.levelNumber)}
                        disabled={!hasBets}
                        className="flex-1 text-left flex items-baseline space-x-2 disabled:opacity-40 cursor-pointer min-w-0 pr-2"
                        title={hasBets ? "Click to place this level's bets onto the table felt" : "Level is empty - place chips on table and click SAVE"}
                      >
                        <span className="font-extrabold text-xs text-white uppercase tracking-wider shrink-0">
                          LEVEL {lvl.levelNumber}
                        </span>
                        {hasBets ? (
                          <span className="font-mono text-xs font-black text-emerald-400 truncate">
                            - {currency.symbol}{lvl.totalWager.toLocaleString()} ({lvl.placements.length} bets)
                          </span>
                        ) : (
                          <span className="text-[10px] font-mono text-gray-500 italic">
                            empty
                          </span>
                        )}
                      </button>

                      {/* Right Action buttons */}
                      <div className="flex items-center space-x-1.5 shrink-0">
                        {/* Save table bets to this level */}
                        <button
                          onClick={() => saveBoardToLevel(lvl.levelNumber)}
                          className="px-2.5 py-1 bg-gradient-to-b from-[#22352b] to-[#12221a] hover:from-[#2e473a] hover:to-[#1a3326] border border-emerald-500/40 hover:border-emerald-400 rounded-lg text-[10px] font-black tracking-wider text-emerald-300 uppercase transition active:scale-95 cursor-pointer shadow-sm"
                          title="Save current felt bets into this level"
                        >
                          {hasBets ? 'UPDATE' : 'SAVE'}
                        </button>

                        {/* Clear bets from this level */}
                        {hasBets && (
                          <button
                            onClick={() => clearLevel(lvl.levelNumber)}
                            title="Clear bets from this level"
                            className="p-1.5 text-gray-400 hover:text-amber-300 hover:bg-white/5 rounded-lg transition cursor-pointer"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                          </button>
                        )}

                        {/* Delete this level entirely */}
                        <button
                          onClick={() => removeLevel(lvl.levelNumber)}
                          title={`Delete Level ${lvl.levelNumber}`}
                          className="p-1.5 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Bottom Actions: + ADD EMPTY LEVEL, + SAVE BOARD AS LEVEL, CLEAR ALL BETS */}
            <div className="p-4 border-t border-white/10 space-y-2 bg-[#0a100d] shrink-0">
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => {
                    if (!currentStrategy) {
                      setIsCreating(true);
                    } else {
                      addLevel();
                    }
                  }}
                  className="py-2 px-2 bg-[#121a15] hover:bg-emerald-900/25 border border-emerald-500/30 hover:border-emerald-500/60 rounded-lg font-black text-xs uppercase tracking-wider text-emerald-300 flex items-center justify-center space-x-1 transition cursor-pointer"
                  title={currentStrategy ? "Add a new empty progression level" : "Create a strategy to add levels"}
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>+ ADD LEVEL</span>
                </button>

                <button
                  onClick={() => {
                    if (!currentStrategy) {
                      setIsCreating(true);
                    } else {
                      saveBoardAsNewLevel();
                    }
                  }}
                  disabled={activeBets.length === 0}
                  className="py-2 px-2 bg-[#121a15] hover:bg-emerald-900/25 disabled:opacity-40 disabled:pointer-events-none border border-emerald-500/30 hover:border-emerald-500/60 rounded-lg font-black text-xs uppercase tracking-wider text-emerald-300 flex items-center justify-center space-x-1 transition cursor-pointer"
                  title={activeBets.length > 0 ? (currentStrategy ? "Append current board bets as a new level" : "Create a strategy to save current bets") : "Place bets on table first"}
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>+ SAVE BOARD</span>
                </button>
              </div>

              <button
                onClick={handleClearAll}
                disabled={!currentStrategy || levels.length === 0 || levels.every(l => l.placements.length === 0)}
                className="w-full py-1.5 bg-red-950/20 hover:bg-red-950/40 disabled:opacity-30 border border-red-500/20 rounded-lg font-bold text-[11px] uppercase tracking-widest text-red-400 transition cursor-pointer"
              >
                CLEAR ALL BETS
              </button>
            </div>
          </>
        )}

        {/* Close Button at bottom */}
        <div className="p-4 border-t border-white/10 bg-[#080d0b] shrink-0">
          <button
            onClick={onClose}
            className="w-full py-2 bg-white/10 hover:bg-white/20 text-white font-black text-xs uppercase tracking-wider rounded-lg transition cursor-pointer"
          >
            CLOSE
          </button>
        </div>
      </div>
    </div>
  );
};
