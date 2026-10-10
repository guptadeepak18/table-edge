import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../../stores/auth.store';
import {
  Users,
  Shield,
  CreditCard,
  Sliders,
  FileText,
  UserPlus,
  Search,
  CheckCircle2,
  AlertTriangle,
  Key,
  Edit2,
  Trash2,
  RefreshCw,
  ArrowLeft,
  DollarSign,
  Activity,
  Layers,
  X,
  Plus,
  Sparkles,
  Radio,
  Globe,
  Building2,
  Star,
  Check,
} from 'lucide-react';

interface AdminCasinoConfig {
  id: string;
  name: string;
  casino_id: string;
  provider: string;
  is_default: boolean;
  is_active: boolean;
  notes?: string;
  created_at: string;
}

interface AdminPageProps {

  onBackToHub: () => void;
}

interface AdminUser {
  id: string;
  email: string;
  display_name: string;
  role: string;
  is_admin: boolean;
  is_active: boolean;
  phone: string;
  notes: string;
  created_at: string | null;
  last_login_at: string | null;
  subscription: {
    tier_id: string;
    tier_name: string;
    price_cents: number;
    status: string;
    current_period_end: string | null;
  };
}

interface AdminTier {
  id: string;
  name: string;
  price_cents: number;
  billing_frequency?: string;
  model_type?: string;
  description?: string;
  badge_text?: string;
  is_active: boolean;
  config: Record<string, any>;
}

interface AuditLog {
  id: string;
  tier_id: string;
  changed_by: string;
  old_value: any;
  new_value: any;
  changed_at: string;
}

const API_BASE = '/api';

export const AdminPage: React.FC<AdminPageProps> = ({ onBackToHub }) => {
  const { token } = useAuthStore();

  const [activeTab, setActiveTab] = useState<'users' | 'tiers' | 'modules' | 'audit' | 'casinos'>('users');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Casino Operators state
  const [casinos, setCasinos] = useState<AdminCasinoConfig[]>([]);
  const [isCasinoModalOpen, setIsCasinoModalOpen] = useState(false);
  const [editingCasino, setEditingCasino] = useState<AdminCasinoConfig | null>(null);
  const [deletingCasino, setDeletingCasino] = useState<AdminCasinoConfig | null>(null);

  const [casinoName, setCasinoName] = useState('');
  const [casinoIdCode, setCasinoIdCode] = useState('');
  const [casinoProvider, setCasinoProvider] = useState('pragmatic');
  const [casinoIsDefault, setCasinoIsDefault] = useState(false);
  const [casinoIsActive, setCasinoIsActive] = useState(true);
  const [casinoNotes, setCasinoNotes] = useState('');


  // Overview stats
  const [overview, setOverview] = useState<{
    total_users: number;
    active_users: number;
    suspended_users: number;
    total_tiers: number;
    total_subscriptions: number;
    estimated_mrr_dollars: number;
    tier_distribution: Record<string, number>;
  }>({
    total_users: 0,
    active_users: 0,
    suspended_users: 0,
    total_tiers: 0,
    total_subscriptions: 0,
    estimated_mrr_dollars: 0,
    tier_distribution: {},
  });

  // User management
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'suspended'>('all');
  const [tierFilter, setTierFilter] = useState<string>('all');

  // User Modals
  const [isCreateUserModalOpen, setIsCreateUserModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<AdminUser | null>(null);
  const [resetPasswordUser, setResetPasswordUser] = useState<AdminUser | null>(null);
  const [deletingUser, setDeletingUser] = useState<AdminUser | null>(null);

  // Create User Form
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [newUserDisplayName, setNewUserDisplayName] = useState('');
  const [newUserRole, setNewUserRole] = useState<'user' | 'admin'>('user');
  const [newUserTierId, setNewUserTierId] = useState('tier-free');
  const [newUserPhone, setNewUserPhone] = useState('');
  const [newUserNotes, setNewUserNotes] = useState('');
  const [newUserIsActive, setNewUserIsActive] = useState(true);

  // Password reset input
  const [newPasswordValue, setNewPasswordValue] = useState('');

  // Tiers & Freemium configs
  const [tiers, setTiers] = useState<AdminTier[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);

  // Tier Architect Modal states
  const [isTierModalOpen, setIsTierModalOpen] = useState(false);
  const [editingTier, setEditingTier] = useState<AdminTier | null>(null);
  const [deletingTier, setDeletingTier] = useState<AdminTier | null>(null);

  const [tierName, setTierName] = useState('');
  const [tierId, setTierId] = useState('');
  const [tierPriceDollars, setTierPriceDollars] = useState(0);
  const [tierBillingFrequency, setTierBillingFrequency] = useState('monthly');
  const [tierModelType, setTierModelType] = useState('subscription');
  const [tierDescription, setTierDescription] = useState('');
  const [tierBadgeText, setTierBadgeText] = useState('');
  const [tierIsActive, setTierIsActive] = useState(true);

  // Core knobs
  const [tierMaxStrategies, setTierMaxStrategies] = useState<number>(5);
  const [tierIsUnlimitedStrategies, setTierIsUnlimitedStrategies] = useState(false);
  const [tierMaxBacktests, setTierMaxBacktests] = useState<number>(1000);
  const [tierIsUnlimitedBacktests, setTierIsUnlimitedBacktests] = useState(false);
  const [tierCanAccessModuleB, setTierCanAccessModuleB] = useState(true);
  const [tierCanUseRacetrack, setTierCanUseRacetrack] = useState(true);
  const [tierCanExportCsv, setTierCanExportCsv] = useState(true);
  const [tierPrioritySupport, setTierPrioritySupport] = useState(false);

  // Dynamic custom playground knobs
  const [customParams, setCustomParams] = useState<
    Array<{ key: string; value: string; type: 'boolean' | 'number' | 'string' }>
  >([]);
  const [newCustomKey, setNewCustomKey] = useState('');
  const [newCustomVal, setNewCustomVal] = useState('');
  const [newCustomType, setNewCustomType] = useState<'boolean' | 'number' | 'string'>('string');

  // Feature flags
  const [moduleAActive, setModuleAActive] = useState(true);
  const [moduleBActive, setModuleBActive] = useState(true);

  const authHeaders = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };

  // Fetch all admin data
  const fetchData = async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      // 1. Overview
      const ovRes = await fetch(`${API_BASE}/admin/overview`, { headers: authHeaders });
      if (ovRes.ok) {
        setOverview(await ovRes.json());
      }

      // 2. Users
      const usersRes = await fetch(`${API_BASE}/admin/users`, { headers: authHeaders });
      if (usersRes.ok) {
        setUsers(await usersRes.json());
      }

      // 3. Tiers
      const tiersRes = await fetch(`${API_BASE}/admin/tiers`, { headers: authHeaders });
      if (tiersRes.ok) {
        setTiers(await tiersRes.json());
      }

      // 4. Audit Logs
      const auditRes = await fetch(`${API_BASE}/admin/audit-logs`, { headers: authHeaders });
      if (auditRes.ok) {
        setAuditLogs(await auditRes.json());
      }

      // 5. Casino Operators
      const casinosRes = await fetch(`${API_BASE}/admin/casinos`, { headers: authHeaders });
      if (casinosRes.ok) {
        setCasinos(await casinosRes.json());
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load administrative data.');
    } finally {
      setLoading(false);
    }
  };

  const openCreateCasinoModal = () => {
    setEditingCasino(null);
    setCasinoName('');
    setCasinoIdCode('');
    setCasinoProvider('pragmatic');
    setCasinoIsDefault(casinos.length === 0);
    setCasinoIsActive(true);
    setCasinoNotes('');
    setIsCasinoModalOpen(true);
  };

  const openEditCasinoModal = (c: AdminCasinoConfig) => {
    setEditingCasino(c);
    setCasinoName(c.name);
    setCasinoIdCode(c.casino_id);
    setCasinoProvider(c.provider || 'pragmatic');
    setCasinoIsDefault(c.is_default);
    setCasinoIsActive(c.is_active);
    setCasinoNotes(c.notes || '');
    setIsCasinoModalOpen(true);
  };

  const handleSaveCasino = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!casinoName || !casinoIdCode) return;
    try {
      if (editingCasino) {
        const res = await fetch(`${API_BASE}/admin/casinos/${editingCasino.id}`, {
          method: 'PUT',
          headers: authHeaders,
          body: JSON.stringify({
            name: casinoName,
            casino_id: casinoIdCode.trim(),
            provider: casinoProvider,
            is_default: casinoIsDefault,
            is_active: casinoIsActive,
            notes: casinoNotes,
          }),
        });
        if (!res.ok) throw new Error('Failed to update casino operator');
        setSuccess(`Casino operator "${casinoName}" updated successfully.`);
      } else {
        const res = await fetch(`${API_BASE}/admin/casinos`, {
          method: 'POST',
          headers: authHeaders,
          body: JSON.stringify({
            name: casinoName,
            casino_id: casinoIdCode.trim(),
            provider: casinoProvider,
            is_default: casinoIsDefault,
            is_active: casinoIsActive,
            notes: casinoNotes,
          }),
        });
        if (!res.ok) throw new Error('Failed to create casino operator');
        setSuccess(`Casino operator "${casinoName}" added successfully.`);
      }
      setIsCasinoModalOpen(false);
      fetchData();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleSetDefaultCasino = async (c: AdminCasinoConfig) => {
    try {
      const res = await fetch(`${API_BASE}/admin/casinos/${c.id}/default`, {
        method: 'PUT',
        headers: authHeaders,
      });
      if (!res.ok) throw new Error('Failed to set default casino');
      setSuccess(`Set "${c.name}" (${c.casino_id}) as system default casino.`);
      fetchData();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleDeleteCasino = async () => {
    if (!deletingCasino) return;
    try {
      const res = await fetch(`${API_BASE}/admin/casinos/${deletingCasino.id}`, {
        method: 'DELETE',
        headers: authHeaders,
      });
      if (!res.ok) throw new Error('Failed to delete casino operator');
      setSuccess(`Deleted casino operator "${deletingCasino.name}".`);
      setDeletingCasino(null);
      fetchData();
    } catch (err: any) {
      setError(err.message);
    }
  };


  useEffect(() => {
    fetchData();
  }, [token]);

  // Handle User Status Toggle (Suspend / Enable)
  const handleToggleStatus = async (user: AdminUser) => {
    const nextStatus = !user.is_active;
    try {
      const res = await fetch(`${API_BASE}/admin/users/${user.id}/status`, {
        method: 'PATCH',
        headers: authHeaders,
        body: JSON.stringify({ is_active: nextStatus }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Failed to toggle status');
      setSuccess(`User ${user.email} status updated to ${nextStatus ? 'ACTIVE' : 'SUSPENDED'}.`);
      fetchData();
    } catch (err: any) {
      setError(err.message);
    }
  };

  // Handle Create User
  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API_BASE}/admin/users`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          email: newUserEmail,
          password: newUserPassword,
          display_name: newUserDisplayName,
          role: newUserRole,
          tier_id: newUserTierId,
          phone: newUserPhone,
          notes: newUserNotes,
          is_active: newUserIsActive,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Failed to create user');
      setSuccess(`User ${newUserEmail} created successfully.`);
      setIsCreateUserModalOpen(false);
      // Reset form
      setNewUserEmail('');
      setNewUserPassword('');
      setNewUserDisplayName('');
      setNewUserPhone('');
      setNewUserNotes('');
      fetchData();
    } catch (err: any) {
      setError(err.message);
    }
  };

  // Handle Edit User
  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    try {
      const res = await fetch(`${API_BASE}/admin/users/${editingUser.id}`, {
        method: 'PUT',
        headers: authHeaders,
        body: JSON.stringify({
          email: editingUser.email,
          display_name: editingUser.display_name,
          role: editingUser.role,
          tier_id: editingUser.subscription.tier_id,
          phone: editingUser.phone,
          notes: editingUser.notes,
          is_active: editingUser.is_active,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Failed to update user');
      setSuccess(`User ${editingUser.email} updated successfully.`);
      setEditingUser(null);
      fetchData();
    } catch (err: any) {
      setError(err.message);
    }
  };

  // Handle Admin Reset Password
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetPasswordUser || !newPasswordValue) return;
    try {
      const res = await fetch(`${API_BASE}/admin/users/${resetPasswordUser.id}/reset-password`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ new_password: newPasswordValue }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Failed to reset password');
      setSuccess(`Password for ${resetPasswordUser.email} successfully updated.`);
      setResetPasswordUser(null);
      setNewPasswordValue('');
    } catch (err: any) {
      setError(err.message);
    }
  };

  // Handle Delete User
  const handleDeleteUser = async () => {
    if (!deletingUser) return;
    try {
      const res = await fetch(`${API_BASE}/admin/users/${deletingUser.id}`, {
        method: 'DELETE',
        headers: authHeaders,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Failed to delete user');
      setSuccess(`User ${deletingUser.email} permanently removed.`);
      setDeletingUser(null);
      fetchData();
    } catch (err: any) {
      setError(err.message);
    }
  };

  // Open Create Tier Modal
  const openCreateTierModal = () => {
    setEditingTier(null);
    setTierName('');
    setTierId('');
    setTierPriceDollars(9.99);
    setTierBillingFrequency('monthly');
    setTierModelType('subscription');
    setTierDescription('Full institutional quantitative suite');
    setTierBadgeText('POPULAR');
    setTierIsActive(true);

    setTierMaxStrategies(10);
    setTierIsUnlimitedStrategies(false);
    setTierMaxBacktests(5000);
    setTierIsUnlimitedBacktests(false);
    setTierCanAccessModuleB(true);
    setTierCanUseRacetrack(true);
    setTierCanExportCsv(true);
    setTierPrioritySupport(false);
    setCustomParams([]);
    setIsTierModalOpen(true);
  };

  // Open Edit Tier Modal
  const openEditTierModal = (tier: AdminTier) => {
    setEditingTier(tier);
    setTierName(tier.name);
    setTierId(tier.id);
    setTierPriceDollars(tier.price_cents / 100);
    setTierBillingFrequency(tier.billing_frequency || 'monthly');
    setTierModelType(tier.model_type || 'subscription');
    setTierDescription(tier.description || '');
    setTierBadgeText(tier.badge_text || '');
    setTierIsActive(tier.is_active);

    const cfg = tier.config || {};
    const maxStrat = cfg.max_saved_strategies ?? 1;
    setTierIsUnlimitedStrategies(maxStrat >= 999999 || maxStrat === -1);
    setTierMaxStrategies(maxStrat >= 999999 ? 999999 : maxStrat);

    const maxBt = cfg.max_backtest_sessions ?? 100;
    setTierIsUnlimitedBacktests(maxBt >= 999999 || maxBt === -1);
    setTierMaxBacktests(maxBt >= 999999 ? 50000 : maxBt);

    setTierCanAccessModuleB(Boolean(cfg.can_access_module_b));
    setTierCanUseRacetrack(Boolean(cfg.can_use_racetrack));
    setTierCanExportCsv(Boolean(cfg.can_export_csv ?? true));
    setTierPrioritySupport(Boolean(cfg.priority_support ?? false));

    // Extract custom parameters that aren't the standard 6
    const standardKeys = [
      'max_saved_strategies',
      'max_backtest_sessions',
      'can_access_module_b',
      'can_use_racetrack',
      'can_export_csv',
      'priority_support',
    ];
    const customList: Array<{ key: string; value: string; type: 'boolean' | 'number' | 'string' }> = [];
    Object.entries(cfg).forEach(([k, v]) => {
      if (!standardKeys.includes(k)) {
        const type = typeof v === 'boolean' ? 'boolean' : typeof v === 'number' ? 'number' : 'string';
        customList.push({ key: k, value: String(v), type });
      }
    });
    setCustomParams(customList);
    setIsTierModalOpen(true);
  };

  // Add a custom parameter to the tier architect
  const handleAddCustomParam = () => {
    if (!newCustomKey.trim()) return;
    setCustomParams([
      ...customParams,
      {
        key: newCustomKey.trim().toLowerCase().replace(/\s+/g, '_'),
        value: newCustomVal.trim(),
        type: newCustomType,
      },
    ]);
    setNewCustomKey('');
    setNewCustomVal('');
  };

  // Remove a custom parameter
  const handleRemoveCustomParam = (index: number) => {
    setCustomParams(customParams.filter((_, i) => i !== index));
  };

  // Save Tier (Create or Update)
  const handleSaveTier = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const compiledConfigs: Record<string, any> = {
        max_saved_strategies: tierIsUnlimitedStrategies ? 999999 : Number(tierMaxStrategies),
        max_backtest_sessions: tierIsUnlimitedBacktests ? 999999 : Number(tierMaxBacktests),
        can_access_module_b: tierCanAccessModuleB,
        can_use_racetrack: tierCanUseRacetrack,
        can_export_csv: tierCanExportCsv,
        priority_support: tierPrioritySupport,
      };

      // Add custom dynamic parameters
      customParams.forEach((param) => {
        if (param.type === 'boolean') {
          compiledConfigs[param.key] = param.value === 'true' || param.value === '1';
        } else if (param.type === 'number') {
          compiledConfigs[param.key] = Number(param.value) || 0;
        } else {
          compiledConfigs[param.key] = param.value;
        }
      });

      const payload = {
        id: editingTier ? editingTier.id : tierId.trim() || undefined,
        name: tierName.trim(),
        price_cents: Math.round(Number(tierPriceDollars) * 100),
        billing_frequency: tierBillingFrequency,
        model_type: tierModelType,
        description: tierDescription.trim() || undefined,
        badge_text: tierBadgeText.trim() || undefined,
        is_active: tierIsActive,
        configs: compiledConfigs,
      };

      const endpoint = editingTier
        ? `${API_BASE}/admin/tiers/${editingTier.id}`
        : `${API_BASE}/admin/tiers`;
      const method = editingTier ? 'PUT' : 'POST';

      const res = await fetch(endpoint, {
        method,
        headers: authHeaders,
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Failed to save tier');

      setSuccess(`Subscription Tier "${tierName}" successfully ${editingTier ? 'updated' : 'created'}!`);
      setIsTierModalOpen(false);
      fetchData();
    } catch (err: any) {
      setError(err.message);
    }
  };

  // Delete Tier
  const handleDeleteTier = async () => {
    if (!deletingTier) return;
    try {
      const res = await fetch(`${API_BASE}/admin/tiers/${deletingTier.id}`, {
        method: 'DELETE',
        headers: authHeaders,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Failed to delete tier');

      setSuccess(`Tier ${deletingTier.name} deleted.`);
      setDeletingTier(null);
      fetchData();
    } catch (err: any) {
      setError(err.message);
    }
  };

  // Toggle Tier Active Status
  const handleToggleTierStatus = async (tier: AdminTier) => {
    try {
      const res = await fetch(`${API_BASE}/admin/tiers/${tier.id}`, {
        method: 'PUT',
        headers: authHeaders,
        body: JSON.stringify({
          name: tier.name,
          price_cents: tier.price_cents,
          billing_frequency: tier.billing_frequency || 'monthly',
          model_type: tier.model_type || 'subscription',
          description: tier.description,
          badge_text: tier.badge_text,
          is_active: !tier.is_active,
        }),
      });
      if (res.ok) {
        setSuccess(`Tier ${tier.name} status updated to ${!tier.is_active ? 'ACTIVE' : 'DRAFT/PAUSED'}`);
        fetchData();
      }
    } catch (err: any) {
      setError(err.message);
    }
  };

  // Filtered users list
  const filteredUsers = users.filter((u) => {
    const matchesSearch =
      u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.display_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.phone?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus =
      statusFilter === 'all' ||
      (statusFilter === 'active' && u.is_active) ||
      (statusFilter === 'suspended' && !u.is_active);
    const matchesTier = tierFilter === 'all' || u.subscription?.tier_id === tierFilter;
    return matchesSearch && matchesStatus && matchesTier;
  });

  return (
    <div className="min-h-screen bg-[#070d0a] text-white flex flex-col selection:bg-neon-green selection:text-black">
      {/* Top Admin Header Bar */}
      <header className="h-16 bg-[#0a130f]/95 border-b border-white/10 px-6 md:px-12 flex items-center justify-between sticky top-0 z-40 backdrop-blur-md">
        <div className="flex items-center space-x-4">
          <button
            onClick={onBackToHub}
            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 hover:text-white transition flex items-center space-x-1.5 text-xs font-bold"
            title="Return to TableEdge Hub"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Hub</span>
          </button>

          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-300">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h1 className="text-base font-black text-white tracking-wide">Admin Control Center</h1>
                <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-[10px] font-mono font-black border border-amber-500/30">
                  SUPERUSER
                </span>
              </div>
              <p className="text-[11px] text-text-muted font-mono">Full SaaS & User Management</p>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={fetchData}
            disabled={loading}
            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 hover:text-white transition"
            title="Refresh Admin Data"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-neon-green' : ''}`} />
          </button>

          <div className="px-3 py-1 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-[11px] font-mono text-emerald-400 flex items-center space-x-1.5">
            <span className="w-2 h-2 rounded-full bg-neon-green animate-pulse" />
            <span>Engine Online</span>
          </div>
        </div>
      </header>

      {/* Main Admin Body */}
      <main className="flex-1 p-6 md:p-12 max-w-7xl mx-auto w-full space-y-8">
        {/* Feedback Messages */}
        {success && (
          <div className="p-4 bg-emerald-500/15 border border-emerald-500/40 rounded-2xl text-xs text-emerald-200 flex items-center justify-between shadow-lg animate-fade-in">
            <div className="flex items-center space-x-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{success}</span>
            </div>
            <button onClick={() => setSuccess(null)} className="text-emerald-400 hover:text-white">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
        {error && (
          <div className="p-4 bg-red-500/15 border border-red-500/40 rounded-2xl text-xs text-red-200 flex items-center justify-between shadow-lg animate-fade-in">
            <div className="flex items-center space-x-2.5">
              <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
              <span>{error}</span>
            </div>
            <button onClick={() => setError(null)} className="text-red-400 hover:text-white">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Executive Metrics Overview Bar */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-[#0e1913]/90 border border-white/10 rounded-2xl p-5 shadow-lg">
            <div className="flex items-center justify-between text-text-muted text-xs font-mono mb-2">
              <span>TOTAL USERS</span>
              <Users className="w-4 h-4 text-neon-green" />
            </div>
            <div className="text-2xl md:text-3xl font-black font-mono text-white">
              {overview.total_users}
            </div>
            <div className="text-[11px] text-emerald-400 font-mono mt-1">
              {overview.active_users} active • {overview.suspended_users} suspended
            </div>
          </div>

          <div className="bg-[#0e1913]/90 border border-white/10 rounded-2xl p-5 shadow-lg">
            <div className="flex items-center justify-between text-text-muted text-xs font-mono mb-2">
              <span>ACTIVE TIERS</span>
              <Layers className="w-4 h-4 text-teal-300" />
            </div>
            <div className="text-2xl md:text-3xl font-black font-mono text-white">
              {overview.total_tiers}
            </div>
            <div className="text-[11px] text-gray-400 font-mono mt-1">
              Customizable Plans
            </div>
          </div>

          <div className="bg-[#0e1913]/90 border border-white/10 rounded-2xl p-5 shadow-lg">
            <div className="flex items-center justify-between text-text-muted text-xs font-mono mb-2">
              <span>ESTIMATED MRR</span>
              <DollarSign className="w-4 h-4 text-amber-400" />
            </div>
            <div className="text-2xl md:text-3xl font-black font-mono text-amber-300">
              ${overview.estimated_mrr_dollars.toFixed(2)}
            </div>
            <div className="text-[11px] text-amber-200/70 font-mono mt-1">
              {overview.total_subscriptions} total subscriptions
            </div>
          </div>

          <div className="bg-[#0e1913]/90 border border-white/10 rounded-2xl p-5 shadow-lg">
            <div className="flex items-center justify-between text-text-muted text-xs font-mono mb-2">
              <span>PLATFORM HEALTH</span>
              <Activity className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-2xl md:text-3xl font-black font-mono text-neon-green">
              100%
            </div>
            <div className="text-[11px] text-emerald-400 font-mono mt-1">
              Database & Auth Synced
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center space-x-2 border-b border-white/10 pb-2">
          <button
            onClick={() => setActiveTab('users')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center space-x-2 ${
              activeTab === 'users'
                ? 'bg-neon-green text-black shadow-md'
                : 'text-text-muted hover:text-white hover:bg-white/5'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>User Accounts & Lifecycle</span>
          </button>

          <button
            onClick={() => setActiveTab('tiers')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center space-x-2 ${
              activeTab === 'tiers'
                ? 'bg-neon-green text-black shadow-md'
                : 'text-text-muted hover:text-white hover:bg-white/5'
            }`}
          >
            <CreditCard className="w-4 h-4" />
            <span>Subscription Tiers & Freemium Playground</span>
          </button>

          <button
            onClick={() => setActiveTab('modules')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center space-x-2 ${
              activeTab === 'modules'
                ? 'bg-neon-green text-black shadow-md'
                : 'text-text-muted hover:text-white hover:bg-white/5'
            }`}
          >
            <Sliders className="w-4 h-4" />
            <span>Module Availability</span>
          </button>

          <button
            onClick={() => setActiveTab('audit')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center space-x-2 ${
              activeTab === 'audit'
                ? 'bg-neon-green text-black shadow-md'
                : 'text-text-muted hover:text-white hover:bg-white/5'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>Audit Trail</span>
          </button>

          <button
            onClick={() => setActiveTab('casinos')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center space-x-2 ${
              activeTab === 'casinos'
                ? 'bg-neon-green text-black shadow-md'
                : 'text-text-muted hover:text-white hover:bg-white/5'
            }`}
          >
            <Radio className="w-4 h-4" />
            <span>Casino Feeds & Operators</span>
          </button>
        </div>

        {/* TAB 1: USERS & LIFECYCLE MANAGEMENT */}
        {activeTab === 'users' && (
          <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-3 flex-1">
                <div className="relative min-w-[260px] flex-1 max-w-md">
                  <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search by email, name, or phone..."
                    className="w-full bg-black/40 border border-white/10 rounded-xl py-2 pl-10 pr-4 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-neon-green transition"
                  />
                </div>

                <select
                  value={statusFilter}
                  onChange={(e: any) => setStatusFilter(e.target.value)}
                  className="bg-black/40 border border-white/10 rounded-xl py-2 px-3 text-xs text-gray-300 focus:outline-none focus:border-neon-green"
                >
                  <option value="all">All Statuses</option>
                  <option value="active">Active Only</option>
                  <option value="suspended">Suspended Only</option>
                </select>

                <select
                  value={tierFilter}
                  onChange={(e) => setTierFilter(e.target.value)}
                  className="bg-black/40 border border-white/10 rounded-xl py-2 px-3 text-xs text-gray-300 focus:outline-none focus:border-neon-green"
                >
                  <option value="all">All Tiers</option>
                  {tiers.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>

              <button
                onClick={() => setIsCreateUserModalOpen(true)}
                className="px-4 py-2.5 bg-neon-green hover:bg-emerald-400 text-black font-extrabold text-xs rounded-xl shadow-lg transition flex items-center space-x-2 cursor-pointer shrink-0"
              >
                <UserPlus className="w-4 h-4" />
                <span>Create New User</span>
              </button>
            </div>

            {/* Users Data Table */}
            <div className="bg-[#0a130f]/90 border border-white/10 rounded-3xl overflow-hidden shadow-2xl">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-black/40 text-text-muted font-mono uppercase text-[10px] tracking-wider border-b border-white/10">
                    <tr>
                      <th className="py-3.5 px-5">User Profile</th>
                      <th className="py-3.5 px-4">Role</th>
                      <th className="py-3.5 px-4">Subscription Tier</th>
                      <th className="py-3.5 px-4">Status</th>
                      <th className="py-3.5 px-4">Phone / Notes</th>
                      <th className="py-3.5 px-4">Registered</th>
                      <th className="py-3.5 px-5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {filteredUsers.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-12 text-center text-text-muted">
                          No users found matching current filters.
                        </td>
                      </tr>
                    ) : (
                      filteredUsers.map((u) => {
                        const isUserPro = u.subscription?.tier_id === 'tier-pro';
                        return (
                          <tr key={u.id} className="hover:bg-white/[0.02] transition">
                            <td className="py-3.5 px-5">
                              <div className="flex items-center space-x-3">
                                <div className="w-8 h-8 rounded-full bg-emerald-500/20 text-neon-green font-bold flex items-center justify-center text-xs">
                                  {u.display_name ? u.display_name.charAt(0).toUpperCase() : 'U'}
                                </div>
                                <div>
                                  <div className="font-bold text-white">{u.display_name}</div>
                                  <div className="font-mono text-text-muted text-[11px]">{u.email}</div>
                                </div>
                              </div>
                            </td>

                            <td className="py-3.5 px-4">
                              <span
                                className={`px-2 py-0.5 rounded-md font-mono text-[10px] font-black uppercase ${
                                  u.is_admin
                                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                    : 'bg-white/5 text-gray-300'
                                }`}
                              >
                                {u.role}
                              </span>
                            </td>

                            <td className="py-3.5 px-4">
                              <span
                                className={`px-2.5 py-0.5 rounded-full font-mono text-[10px] font-black uppercase ${
                                  isUserPro
                                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                                    : 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                                }`}
                              >
                                {u.subscription?.tier_name || u.subscription?.tier_id}
                              </span>
                            </td>

                            <td className="py-3.5 px-4">
                              <button
                                onClick={() => handleToggleStatus(u)}
                                className={`px-2.5 py-0.5 rounded-full font-mono text-[10px] font-bold uppercase cursor-pointer transition ${
                                  u.is_active
                                    ? 'bg-emerald-500/20 text-neon-green hover:bg-emerald-500/30'
                                    : 'bg-red-500/20 text-red-300 hover:bg-red-500/30'
                                }`}
                                title="Click to toggle Active / Suspended status"
                              >
                                {u.is_active ? '● Active' : '✕ Suspended'}
                              </button>
                            </td>

                            <td className="py-3.5 px-4 text-text-muted font-mono text-[11px]">
                              <div>{u.phone || '—'}</div>
                              {u.notes && (
                                <div className="text-[10px] text-gray-400 italic truncate max-w-[120px]">
                                  {u.notes}
                                </div>
                              )}
                            </td>

                            <td className="py-3.5 px-4 text-text-muted font-mono text-[11px]">
                              {u.created_at ? new Date(u.created_at).toLocaleDateString() : '—'}
                            </td>

                            <td className="py-3.5 px-5 text-right">
                              <div className="flex items-center justify-end space-x-1.5">
                                <button
                                  onClick={() => setEditingUser({ ...u })}
                                  className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white transition"
                                  title="Edit User Details"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>

                                <button
                                  onClick={() => {
                                    setResetPasswordUser(u);
                                    setNewPasswordValue('');
                                  }}
                                  className="p-1.5 rounded-lg bg-white/5 hover:bg-amber-500/20 text-gray-300 hover:text-amber-300 transition"
                                  title="Reset Password"
                                >
                                  <Key className="w-3.5 h-3.5" />
                                </button>

                                <button
                                  onClick={() => setDeletingUser(u)}
                                  className="p-1.5 rounded-lg bg-white/5 hover:bg-red-500/20 text-gray-300 hover:text-red-400 transition"
                                  title="Delete User"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: SUBSCRIPTION TIERS & FREEMIUM PLAYGROUND */}
        {activeTab === 'tiers' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-black text-white flex items-center space-x-2">
                  <CreditCard className="w-5 h-5 text-neon-green" />
                  <span>Subscription Tiers & Freemium Playground</span>
                </h2>
                <p className="text-xs text-text-muted mt-1">
                  Create new subscription models, define custom pricing, billing frequencies, feature knobs, and arbitrary experimental parameters.
                </p>
              </div>

              <button
                onClick={openCreateTierModal}
                className="px-5 py-2.5 bg-neon-green hover:bg-emerald-400 text-black font-extrabold text-xs rounded-xl shadow-[0_0_20px_rgba(0,255,135,0.3)] transition flex items-center space-x-2 cursor-pointer shrink-0"
              >
                <Plus className="w-4 h-4" />
                <span>Create New Tier</span>
              </button>
            </div>

            {/* Tiers Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {tiers.map((t) => {
                const isFree = t.id === 'tier-free';
                const isPro = t.id === 'tier-pro';
                const cfg = t.config || {};
                const customKeys = Object.keys(cfg).filter(
                  (k) =>
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
                    key={t.id}
                    className={`p-6 rounded-3xl border shadow-2xl flex flex-col justify-between transition-all duration-300 relative overflow-hidden ${
                      isPro
                        ? 'bg-gradient-to-br from-amber-500/10 via-[#0a130f] to-[#050907] border-amber-500/40'
                        : isFree
                        ? 'bg-[#0a130f] border-white/10'
                        : 'bg-gradient-to-br from-emerald-500/10 via-[#0a130f] to-[#050907] border-emerald-500/30'
                    }`}
                  >
                    {/* Top Tier Header */}
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center space-x-2">
                          <span className="text-[10px] font-mono uppercase tracking-widest text-text-muted">
                            {t.id}
                          </span>
                          {t.badge_text && (
                            <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-[9px] font-mono font-black border border-amber-500/30">
                              {t.badge_text}
                            </span>
                          )}
                        </div>

                        <button
                          onClick={() => handleToggleTierStatus(t)}
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold transition cursor-pointer ${
                            t.is_active
                              ? 'bg-emerald-500/20 text-neon-green border border-emerald-500/30'
                              : 'bg-gray-800 text-gray-400 border border-gray-700'
                          }`}
                          title="Click to toggle Active / Draft status"
                        >
                          {t.is_active ? '● Active' : '○ Draft/Paused'}
                        </button>
                      </div>

                      <h3 className="text-xl font-black text-white">{t.name}</h3>
                      <p className="text-xs text-text-muted mt-0.5 line-clamp-2">
                        {t.description || 'Customizable gaming tier configured in Admin.'}
                      </p>

                      {/* Pricing Display */}
                      <div className="my-4 pb-4 border-b border-white/10 flex items-baseline justify-between">
                        <div>
                          <span className="text-3xl font-mono font-black text-neon-green">
                            ${(t.price_cents / 100).toFixed(2)}
                          </span>
                          <span className="text-xs font-mono text-text-muted ml-1.5 capitalize">
                            / {t.billing_frequency || 'monthly'}
                          </span>
                        </div>
                        <span className="text-[10px] font-mono uppercase tracking-wider text-gray-400 px-2 py-0.5 rounded bg-black/40 border border-white/5">
                          {t.model_type || 'subscription'}
                        </span>
                      </div>

                      {/* Config Knobs Summary */}
                      <div className="space-y-2 text-xs font-mono">
                        <div className="flex items-center justify-between text-gray-300">
                          <span className="text-text-muted">Saved Strategies:</span>
                          <span className="font-bold text-white">
                            {cfg.max_saved_strategies >= 999999 || cfg.max_saved_strategies === -1
                              ? 'Unlimited'
                              : cfg.max_saved_strategies ?? 1}
                          </span>
                        </div>

                        <div className="flex items-center justify-between text-gray-300">
                          <span className="text-text-muted">Monte Carlo Spins:</span>
                          <span className="font-bold text-white">
                            {cfg.max_backtest_sessions >= 999999 || cfg.max_backtest_sessions === -1
                              ? 'Unlimited'
                              : (cfg.max_backtest_sessions ?? 100).toLocaleString()}
                          </span>
                        </div>

                        <div className="flex items-center justify-between text-gray-300">
                          <span className="text-text-muted">Module B Tracker:</span>
                          <span
                            className={`font-bold ${
                              cfg.can_access_module_b ? 'text-neon-green' : 'text-gray-500'
                            }`}
                          >
                            {cfg.can_access_module_b ? '✓ Unlocked' : '✕ Locked'}
                          </span>
                        </div>

                        <div className="flex items-center justify-between text-gray-300">
                          <span className="text-text-muted">Racetrack Felt:</span>
                          <span
                            className={`font-bold ${
                              cfg.can_use_racetrack ? 'text-neon-green' : 'text-gray-500'
                            }`}
                          >
                            {cfg.can_use_racetrack ? '✓ Unlocked' : '✕ Locked'}
                          </span>
                        </div>

                        {/* Custom Dynamic Parameters Pills */}
                        {customKeys.length > 0 && (
                          <div className="pt-2 border-t border-white/5 mt-3 space-y-1">
                            <div className="text-[10px] text-amber-300 font-bold uppercase tracking-wider">
                              Custom Parameters:
                            </div>
                            <div className="flex flex-wrap gap-1.5 pt-1">
                              {customKeys.map((k) => (
                                <span
                                  key={k}
                                  className="px-2 py-0.5 rounded-md bg-white/5 border border-white/10 text-[10px] text-gray-300"
                                >
                                  {k}: <strong className="text-neon-green">{String(cfg[k])}</strong>
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Tier Action Buttons */}
                    <div className="pt-5 mt-5 border-t border-white/10 flex items-center justify-between">
                      <button
                        onClick={() => openEditTierModal(t)}
                        className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-bold text-gray-300 hover:text-white transition flex items-center space-x-1.5"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                        <span>Edit Tier & Knobs</span>
                      </button>

                      {!isFree && (
                        <button
                          onClick={() => setDeletingTier(t)}
                          className="p-1.5 rounded-xl bg-white/5 hover:bg-red-500/20 text-gray-400 hover:text-red-400 transition"
                          title="Delete Custom Tier"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* TAB 3: MODULE AVAILABILITY SWITCHES */}
        {activeTab === 'modules' && (
          <div className="space-y-6">
            <h2 className="text-lg font-black text-white">Application Module Availability & Circuit Breakers</h2>
            <p className="text-xs text-text-muted">Globally enable or pause modules for platform maintenance.</p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-[#0a130f] border border-white/10 rounded-3xl p-6 flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-white">Module A: Strategy Simulator</h3>
                  <p className="text-xs text-text-muted mt-1">RNG Felt & Monte Carlo Engine</p>
                </div>
                <button
                  onClick={() => setModuleAActive(!moduleAActive)}
                  className={`px-4 py-2 rounded-xl text-xs font-bold font-mono transition ${
                    moduleAActive ? 'bg-neon-green text-black' : 'bg-red-500/20 text-red-300'
                  }`}
                >
                  {moduleAActive ? 'ACTIVE' : 'DISABLED'}
                </button>
              </div>

              <div className="bg-[#0a130f] border border-white/10 rounded-3xl p-6 flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-white">Module B: Dealer Tracker</h3>
                  <p className="text-xs text-text-muted mt-1">Physical Wheel Pattern Engine</p>
                </div>
                <button
                  onClick={() => setModuleBActive(!moduleBActive)}
                  className={`px-4 py-2 rounded-xl text-xs font-bold font-mono transition ${
                    moduleBActive ? 'bg-neon-green text-black' : 'bg-red-500/20 text-red-300'
                  }`}
                >
                  {moduleBActive ? 'ACTIVE' : 'DISABLED'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: AUDIT TRAIL */}
        {activeTab === 'audit' && (
          <div className="space-y-6">
            <h2 className="text-lg font-black text-white">Immutable Administrative Audit Trail</h2>
            <div className="bg-[#0a130f]/90 border border-white/10 rounded-3xl overflow-hidden shadow-2xl">
              <table className="w-full text-left text-xs">
                <thead className="bg-black/40 text-text-muted font-mono uppercase text-[10px] tracking-wider border-b border-white/10">
                  <tr>
                    <th className="py-3.5 px-5">Timestamp</th>
                    <th className="py-3.5 px-4">Admin Actor</th>
                    <th className="py-3.5 px-4">Tier Target</th>
                    <th className="py-3.5 px-4">Modification Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 font-mono text-[11px]">
                  {auditLogs.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-12 text-center text-text-muted">
                        No audit logs recorded yet.
                      </td>
                    </tr>
                  ) : (
                    auditLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-white/[0.02] transition">
                        <td className="py-3.5 px-5 text-gray-400">
                          {new Date(log.changed_at).toLocaleString()}
                        </td>
                        <td className="py-3.5 px-4 text-emerald-400 font-bold">
                          {log.changed_by}
                        </td>
                        <td className="py-3.5 px-4 text-amber-300">{log.tier_id}</td>
                        <td className="py-3.5 px-4 text-gray-300">
                          <span className="text-gray-500">{JSON.stringify(log.old_value)}</span>
                          <span className="mx-2 text-neon-green">➔</span>
                          <span className="text-neon-green font-bold">
                            {JSON.stringify(log.new_value)}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 5: CASINO FEEDS & OPERATORS */}
        {activeTab === 'casinos' && (
          <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-black text-white flex items-center space-x-2">
                  <Radio className="w-5 h-5 text-neon-green" />
                  <span>Live Casino Feeds & Operator ID Gateway</span>
                </h2>
                <p className="text-xs text-text-muted mt-1">
                  Manage seeded and custom Casino Operator IDs (e.g. <span className="font-mono text-emerald-400">ppcdk00000003716</span>) for Pragmatic Play DGA WebSocket streams. Configured IDs are instantly accessible system-wide across all user sessions.
                </p>
              </div>

              <button
                onClick={openCreateCasinoModal}
                className="px-4 py-2.5 bg-neon-green hover:bg-emerald-400 text-black font-extrabold text-xs rounded-xl shadow-lg flex items-center space-x-2 transition cursor-pointer self-start md:self-auto"
              >
                <Plus className="w-4 h-4" />
                <span>Add Casino Operator</span>
              </button>
            </div>

            {/* Quick Metrics */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-[#0e1913]/90 border border-white/10 rounded-2xl p-4 shadow-md">
                <span className="text-[10px] font-mono text-text-muted uppercase tracking-wider block mb-1">
                  Configured Operators
                </span>
                <div className="text-2xl font-black font-mono text-white">{casinos.length}</div>
                <span className="text-[10px] text-emerald-400 font-mono">Persisted in Database</span>
              </div>

              <div className="bg-[#0e1913]/90 border border-white/10 rounded-2xl p-4 shadow-md">
                <span className="text-[10px] font-mono text-text-muted uppercase tracking-wider block mb-1">
                  Active System Default
                </span>
                <div className="text-sm font-black font-mono text-amber-300 truncate mt-1">
                  {casinos.find((c) => c.is_default)?.casino_id || 'None'}
                </div>
                <span className="text-[10px] text-gray-400 font-mono">
                  {casinos.find((c) => c.is_default)?.name || 'No default selected'}
                </span>
              </div>

              <div className="bg-[#0e1913]/90 border border-white/10 rounded-2xl p-4 shadow-md">
                <span className="text-[10px] font-mono text-text-muted uppercase tracking-wider block mb-1">
                  Supported Stream Ingest
                </span>
                <div className="text-sm font-black font-mono text-cyan-400 mt-1">
                  Pragmatic DGA WebSocket
                </div>
                <span className="text-[10px] text-gray-400 font-mono">Low-latency live stream</span>
              </div>
            </div>

            {/* Casino Operators Table */}
            <div className="bg-[#0a130f]/90 border border-white/10 rounded-3xl overflow-hidden shadow-2xl">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-black/40 text-text-muted font-mono uppercase text-[10px] tracking-wider border-b border-white/10">
                    <tr>
                      <th className="py-3.5 px-5">Operator Name</th>
                      <th className="py-3.5 px-4">Casino ID Code</th>
                      <th className="py-3.5 px-4">Provider</th>
                      <th className="py-3.5 px-4">Default Status</th>
                      <th className="py-3.5 px-4">Notes</th>
                      <th className="py-3.5 px-5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 font-mono text-[11px]">
                    {casinos.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-12 text-center text-text-muted">
                          No casino operators configured yet. Click "Add Casino Operator" to seed an ID.
                        </td>
                      </tr>
                    ) : (
                      casinos.map((c) => (
                        <tr key={c.id} className="hover:bg-white/[0.02] transition">
                          <td className="py-3.5 px-5 font-bold text-white font-sans text-xs">
                            <div className="flex items-center space-x-2">
                              <span>{c.name}</span>
                              {c.is_default && (
                                <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                              )}
                            </div>
                          </td>
                          <td className="py-3.5 px-4">
                            <span className="px-2.5 py-1 rounded-lg bg-black/60 border border-white/15 text-emerald-400 font-mono font-bold">
                              {c.casino_id}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-cyan-300 uppercase text-[10px]">
                            {c.provider || 'pragmatic'}
                          </td>
                          <td className="py-3.5 px-4">
                            {c.is_default ? (
                              <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-bold">
                                SYSTEM DEFAULT
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-full bg-white/5 text-gray-400 border border-white/10 text-[10px]">
                                SECONDARY
                              </span>
                            )}
                          </td>
                          <td className="py-3.5 px-4 text-gray-400 font-sans text-[11px] max-w-xs truncate">
                            {c.notes || '—'}
                          </td>
                          <td className="py-3.5 px-5 text-right">
                            <div className="flex items-center justify-end space-x-2">
                              {!c.is_default && (
                                <button
                                  onClick={() => handleSetDefaultCasino(c)}
                                  className="px-2.5 py-1 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/25 text-[10px] font-bold transition cursor-pointer"
                                  title="Set as Default Casino"
                                >
                                  Make Default
                                </button>
                              )}
                              <button
                                onClick={() => openEditCasinoModal(c)}
                                className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white transition cursor-pointer"
                                title="Edit Casino"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => setDeletingCasino(c)}
                                className="p-1.5 rounded-lg bg-white/5 hover:bg-red-500/20 text-gray-400 hover:text-red-400 transition cursor-pointer"
                                title="Delete Casino"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* TIER ARCHITECT MODAL: CREATE OR EDIT SUBSCRIPTION TIER */}
      {isTierModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-[#0a130f] border border-white/15 rounded-3xl p-6 md:p-8 max-w-2xl w-full shadow-2xl space-y-6 my-8 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-white/10">
              <h3 className="text-xl font-black text-white flex items-center space-x-2">
                <CreditCard className="w-5 h-5 text-neon-green" />
                <span>{editingTier ? `Edit Tier: ${editingTier.name}` : 'Create New Subscription Tier'}</span>
              </h3>
              <button onClick={() => setIsTierModalOpen(false)} className="text-gray-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveTier} className="space-y-6 text-xs">
              {/* SECTION 1: BASIC INFORMATION */}
              <div className="space-y-3.5">
                <h4 className="text-xs font-mono font-bold text-neon-green uppercase tracking-wider">
                  1. Tier Identity & Brand
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label className="block text-gray-300 mb-1 font-bold">Tier Display Name *</label>
                    <input
                      type="text"
                      required
                      value={tierName}
                      onChange={(e) => {
                        setTierName(e.target.value);
                        if (!editingTier) {
                          setTierId(`tier-${e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`);
                        }
                      }}
                      placeholder="e.g. Diamond VIP"
                      className="w-full bg-black/50 border border-white/10 rounded-xl py-2 px-3 text-white focus:outline-none focus:border-neon-green"
                    />
                  </div>

                  <div>
                    <label className="block text-gray-300 mb-1 font-bold">Unique Tier Identifier</label>
                    <input
                      type="text"
                      required
                      disabled={Boolean(editingTier)}
                      value={tierId}
                      onChange={(e) => setTierId(e.target.value)}
                      placeholder="tier-diamond-vip"
                      className="w-full bg-black/50 border border-white/10 rounded-xl py-2 px-3 text-white font-mono focus:outline-none focus:border-neon-green disabled:opacity-50"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label className="block text-gray-300 mb-1 font-bold">Freemium / Model Type</label>
                    <select
                      value={tierModelType}
                      onChange={(e) => setTierModelType(e.target.value)}
                      className="w-full bg-black/50 border border-white/10 rounded-xl py-2 px-3 text-white focus:outline-none focus:border-neon-green"
                    >
                      <option value="subscription">Paid Recurring Subscription</option>
                      <option value="freemium">Freemium Free Model</option>
                      <option value="lifetime">One-time Lifetime Pass</option>
                      <option value="trial">Free Trial Sandbox</option>
                      <option value="experimental">Experimental / Sandbox</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-gray-300 mb-1 font-bold">Badge Text (Optional)</label>
                    <input
                      type="text"
                      value={tierBadgeText}
                      onChange={(e) => setTierBadgeText(e.target.value)}
                      placeholder="e.g. WHALE, POPULAR, BEST VALUE"
                      className="w-full bg-black/50 border border-white/10 rounded-xl py-2 px-3 text-white font-mono uppercase focus:outline-none focus:border-neon-green"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-gray-300 mb-1 font-bold">Description / Value Proposition</label>
                  <input
                    type="text"
                    value={tierDescription}
                    onChange={(e) => setTierDescription(e.target.value)}
                    placeholder="Short description shown to users on their upgrade page"
                    className="w-full bg-black/50 border border-white/10 rounded-xl py-2 px-3 text-white focus:outline-none focus:border-neon-green"
                  />
                </div>
              </div>

              {/* SECTION 2: PRICING & BILLING FREQUENCY */}
              <div className="space-y-3.5 pt-4 border-t border-white/10">
                <h4 className="text-xs font-mono font-bold text-neon-green uppercase tracking-wider">
                  2. Pricing & Billing Frequency
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label className="block text-gray-300 mb-1 font-bold">Price ($ USD)</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-mono">$</span>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        required
                        value={tierPriceDollars}
                        onChange={(e) => setTierPriceDollars(parseFloat(e.target.value) || 0)}
                        className="w-full bg-black/50 border border-white/10 rounded-xl py-2 pl-7 pr-3 text-white font-mono focus:outline-none focus:border-neon-green"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-gray-300 mb-1 font-bold">Billing Frequency</label>
                    <select
                      value={tierBillingFrequency}
                      onChange={(e) => setTierBillingFrequency(e.target.value)}
                      className="w-full bg-black/50 border border-white/10 rounded-xl py-2 px-3 text-white focus:outline-none focus:border-neon-green capitalize"
                    >
                      <option value="monthly">Monthly (Renews every 30 days)</option>
                      <option value="quarterly">Quarterly (Renews every 3 months)</option>
                      <option value="bi-annual">Bi-Annual (Renews every 6 months)</option>
                      <option value="annual">Annual (Renews every 365 days)</option>
                      <option value="lifetime">Lifetime Access (Non-recurring)</option>
                      <option value="weekly">Weekly (Renews every 7 days)</option>
                      <option value="trial">14-Day Free Trial</option>
                      <option value="one-time">One-Time Payment</option>
                    </select>
                  </div>
                </div>

                <div className="flex items-center space-x-2 pt-1">
                  <input
                    type="checkbox"
                    id="tierActiveCheck"
                    checked={tierIsActive}
                    onChange={(e) => setTierIsActive(e.target.checked)}
                    className="rounded border-white/20 bg-black/40 text-neon-green focus:ring-neon-green"
                  />
                  <label htmlFor="tierActiveCheck" className="text-gray-300 font-bold">
                    Tier is active and visible for user subscription upgrades
                  </label>
                </div>
              </div>

              {/* SECTION 3: CORE FEATURE KNOBS */}
              <div className="space-y-3.5 pt-4 border-t border-white/10">
                <h4 className="text-xs font-mono font-bold text-neon-green uppercase tracking-wider">
                  3. Quota Limits & Module Permissions
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-gray-300 font-bold">Max Saved Betting Strategies</label>
                      <label className="flex items-center space-x-1 cursor-pointer text-[10px] text-neon-green">
                        <input
                          type="checkbox"
                          checked={tierIsUnlimitedStrategies}
                          onChange={(e) => setTierIsUnlimitedStrategies(e.target.checked)}
                          className="rounded text-neon-green"
                        />
                        <span>Unlimited</span>
                      </label>
                    </div>
                    <input
                      type="number"
                      disabled={tierIsUnlimitedStrategies}
                      value={tierIsUnlimitedStrategies ? 999999 : tierMaxStrategies}
                      onChange={(e) => setTierMaxStrategies(parseInt(e.target.value, 10) || 1)}
                      className="w-full bg-black/50 border border-white/10 rounded-xl py-2 px-3 text-white font-mono focus:outline-none focus:border-neon-green disabled:opacity-40"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-gray-300 font-bold">Max Backtest Sessions / Run</label>
                      <label className="flex items-center space-x-1 cursor-pointer text-[10px] text-neon-green">
                        <input
                          type="checkbox"
                          checked={tierIsUnlimitedBacktests}
                          onChange={(e) => setTierIsUnlimitedBacktests(e.target.checked)}
                          className="rounded text-neon-green"
                        />
                        <span>Unlimited</span>
                      </label>
                    </div>
                    <input
                      type="number"
                      disabled={tierIsUnlimitedBacktests}
                      value={tierIsUnlimitedBacktests ? 999999 : tierMaxBacktests}
                      onChange={(e) => setTierMaxBacktests(parseInt(e.target.value, 10) || 100)}
                      className="w-full bg-black/50 border border-white/10 rounded-xl py-2 px-3 text-white font-mono focus:outline-none focus:border-neon-green disabled:opacity-40"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-2">
                  <div className="flex items-center justify-between p-3 bg-black/40 rounded-xl border border-white/5">
                    <span className="font-bold text-gray-300">Module B Dealer Tracker</span>
                    <input
                      type="checkbox"
                      checked={tierCanAccessModuleB}
                      onChange={(e) => setTierCanAccessModuleB(e.target.checked)}
                      className="rounded text-neon-green w-4 h-4"
                    />
                  </div>

                  <div className="flex items-center justify-between p-3 bg-black/40 rounded-xl border border-white/5">
                    <span className="font-bold text-gray-300">Racetrack Neighbor Felt</span>
                    <input
                      type="checkbox"
                      checked={tierCanUseRacetrack}
                      onChange={(e) => setTierCanUseRacetrack(e.target.checked)}
                      className="rounded text-neon-green w-4 h-4"
                    />
                  </div>

                  <div className="flex items-center justify-between p-3 bg-black/40 rounded-xl border border-white/5">
                    <span className="font-bold text-gray-300">Export CSV & Data</span>
                    <input
                      type="checkbox"
                      checked={tierCanExportCsv}
                      onChange={(e) => setTierCanExportCsv(e.target.checked)}
                      className="rounded text-neon-green w-4 h-4"
                    />
                  </div>

                  <div className="flex items-center justify-between p-3 bg-black/40 rounded-xl border border-white/5">
                    <span className="font-bold text-gray-300">Priority Support & Fast Engine</span>
                    <input
                      type="checkbox"
                      checked={tierPrioritySupport}
                      onChange={(e) => setTierPrioritySupport(e.target.checked)}
                      className="rounded text-neon-green w-4 h-4"
                    />
                  </div>
                </div>
              </div>

              {/* SECTION 4: EXPERIMENTAL / DYNAMIC CUSTOM PARAMETERS PLAYGROUND */}
              <div className="space-y-3.5 pt-4 border-t border-white/10">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-mono font-bold text-amber-300 uppercase tracking-wider flex items-center space-x-1.5">
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>4. Dynamic Feature Playground & Custom Knobs</span>
                    </h4>
                    <p className="text-[11px] text-text-muted mt-0.5">
                      Add any custom parameter to test business hypotheses, gated VIP perks, or trial constraints.
                    </p>
                  </div>
                </div>

                {/* Existing Custom Parameters */}
                {customParams.length > 0 && (
                  <div className="space-y-2">
                    {customParams.map((p, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between p-2.5 bg-black/50 border border-white/10 rounded-xl"
                      >
                        <div className="flex items-center space-x-3">
                          <span className="font-mono text-neon-green font-bold">{p.key}</span>
                          <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-white/10 text-gray-400">
                            {p.type}
                          </span>
                          <span className="font-mono text-gray-200 text-xs">= {p.value}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveCustomParam(idx)}
                          className="text-gray-400 hover:text-red-400 p-1"
                          title="Remove Parameter"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Add Custom Parameter Form */}
                <div className="p-3 bg-black/40 border border-dashed border-white/15 rounded-xl space-y-2.5">
                  <span className="text-[11px] font-bold text-gray-300">Add Custom Parameter</span>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <input
                      type="text"
                      value={newCustomKey}
                      onChange={(e) => setNewCustomKey(e.target.value)}
                      placeholder="Parameter key (e.g. api_quota)"
                      className="bg-black/60 border border-white/10 rounded-lg py-1.5 px-2.5 text-xs text-white focus:outline-none focus:border-neon-green font-mono"
                    />

                    <select
                      value={newCustomType}
                      onChange={(e: any) => setNewCustomType(e.target.value)}
                      className="bg-black/60 border border-white/10 rounded-lg py-1.5 px-2.5 text-xs text-white focus:outline-none focus:border-neon-green"
                    >
                      <option value="string">String</option>
                      <option value="number">Number</option>
                      <option value="boolean">Boolean</option>
                    </select>

                    <input
                      type="text"
                      value={newCustomVal}
                      onChange={(e) => setNewCustomVal(e.target.value)}
                      placeholder="Value (e.g. true, 500, gold)"
                      className="bg-black/60 border border-white/10 rounded-lg py-1.5 px-2.5 text-xs text-white focus:outline-none focus:border-neon-green font-mono"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={handleAddCustomParam}
                    disabled={!newCustomKey.trim()}
                    className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white text-xs font-bold rounded-lg transition flex items-center space-x-1.5 disabled:opacity-40"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Attach Parameter</span>
                  </button>
                </div>
              </div>

              {/* Submit Buttons */}
              <div className="flex items-center justify-end space-x-3 pt-4 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setIsTierModalOpen(false)}
                  className="px-4 py-2 bg-white/5 hover:bg-white/10 text-gray-300 font-bold rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 bg-neon-green hover:bg-emerald-400 text-black font-extrabold rounded-xl shadow-lg"
                >
                  {editingTier ? 'Save Tier Configuration' : 'Create Subscription Tier'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: DELETE TIER CONFIRMATION */}
      {deletingTier && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0a130f] border border-red-500/30 rounded-3xl p-6 md:p-8 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center space-x-3 text-red-400">
              <AlertTriangle className="w-6 h-6" />
              <h3 className="text-lg font-black text-white">Delete Subscription Tier?</h3>
            </div>

            <p className="text-xs text-gray-300 leading-relaxed">
              Are you sure you want to delete <strong className="text-white">{deletingTier.name}</strong> ({deletingTier.id})? Any existing users currently assigned to this tier will be smoothly reassigned to the Free Tier.
            </p>

            <div className="flex items-center justify-end space-x-3 pt-4 border-t border-white/10 text-xs">
              <button
                type="button"
                onClick={() => setDeletingTier(null)}
                className="px-4 py-2 bg-white/5 hover:bg-white/10 text-gray-300 font-bold rounded-xl"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteTier}
                className="px-5 py-2 bg-red-600 hover:bg-red-500 text-white font-extrabold rounded-xl shadow-lg"
              >
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: CREATE USER */}
      {isCreateUserModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0a130f] border border-white/15 rounded-3xl p-6 md:p-8 max-w-lg w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <h3 className="text-lg font-black text-white flex items-center space-x-2">
                <UserPlus className="w-5 h-5 text-neon-green" />
                <span>Create New User</span>
              </h3>
              <button onClick={() => setIsCreateUserModalOpen(false)} className="text-gray-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateUser} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-gray-300 mb-1 font-bold">Email Address *</label>
                <input
                  type="email"
                  required
                  value={newUserEmail}
                  onChange={(e) => setNewUserEmail(e.target.value)}
                  placeholder="user@example.com"
                  className="w-full bg-black/40 border border-white/10 rounded-xl py-2 px-3 text-white focus:outline-none focus:border-neon-green"
                />
              </div>

              <div>
                <label className="block text-gray-300 mb-1 font-bold">Temporary Password *</label>
                <input
                  type="text"
                  required
                  value={newUserPassword}
                  onChange={(e) => setNewUserPassword(e.target.value)}
                  placeholder="Min 8 characters"
                  className="w-full bg-black/40 border border-white/10 rounded-xl py-2 px-3 text-white focus:outline-none focus:border-neon-green font-mono"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-gray-300 mb-1 font-bold">Display Name</label>
                  <input
                    type="text"
                    value={newUserDisplayName}
                    onChange={(e) => setNewUserDisplayName(e.target.value)}
                    placeholder="Full name"
                    className="w-full bg-black/40 border border-white/10 rounded-xl py-2 px-3 text-white focus:outline-none focus:border-neon-green"
                  />
                </div>

                <div>
                  <label className="block text-gray-300 mb-1 font-bold">Role</label>
                  <select
                    value={newUserRole}
                    onChange={(e: any) => setNewUserRole(e.target.value)}
                    className="w-full bg-black/40 border border-white/10 rounded-xl py-2 px-3 text-white focus:outline-none focus:border-neon-green"
                  >
                    <option value="user">Standard User</option>
                    <option value="admin">Administrator</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-gray-300 mb-1 font-bold">Initial Subscription Tier</label>
                  <select
                    value={newUserTierId}
                    onChange={(e) => setNewUserTierId(e.target.value)}
                    className="w-full bg-black/40 border border-white/10 rounded-xl py-2 px-3 text-white focus:outline-none focus:border-neon-green"
                  >
                    {tiers.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-gray-300 mb-1 font-bold">Phone (Optional)</label>
                  <input
                    type="text"
                    value={newUserPhone}
                    onChange={(e) => setNewUserPhone(e.target.value)}
                    placeholder="+1 (555) 000-0000"
                    className="w-full bg-black/40 border border-white/10 rounded-xl py-2 px-3 text-white focus:outline-none focus:border-neon-green"
                  />
                </div>
              </div>

              <div>
                <label className="block text-gray-300 mb-1 font-bold">Administrative Notes</label>
                <textarea
                  value={newUserNotes}
                  onChange={(e) => setNewUserNotes(e.target.value)}
                  placeholder="Internal notes about this user account..."
                  rows={2}
                  className="w-full bg-black/40 border border-white/10 rounded-xl py-2 px-3 text-white focus:outline-none focus:border-neon-green"
                />
              </div>

              <div className="flex items-center space-x-2 pt-2">
                <input
                  type="checkbox"
                  id="newUserActive"
                  checked={newUserIsActive}
                  onChange={(e) => setNewUserIsActive(e.target.checked)}
                  className="rounded border-white/20 bg-black/40 text-neon-green focus:ring-neon-green"
                />
                <label htmlFor="newUserActive" className="text-gray-300 font-bold">
                  Enable account immediately upon creation
                </label>
              </div>

              <div className="flex items-center justify-end space-x-3 pt-4 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setIsCreateUserModalOpen(false)}
                  className="px-4 py-2 bg-white/5 hover:bg-white/10 text-gray-300 font-bold rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-neon-green hover:bg-emerald-400 text-black font-extrabold rounded-xl shadow-lg"
                >
                  Create User
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: EDIT USER */}
      {editingUser && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0a130f] border border-white/15 rounded-3xl p-6 md:p-8 max-w-lg w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <h3 className="text-lg font-black text-white flex items-center space-x-2">
                <Edit2 className="w-5 h-5 text-neon-green" />
                <span>Edit User: {editingUser.email}</span>
              </h3>
              <button onClick={() => setEditingUser(null)} className="text-gray-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUpdateUser} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-gray-300 mb-1 font-bold">Display Name</label>
                <input
                  type="text"
                  value={editingUser.display_name}
                  onChange={(e) => setEditingUser({ ...editingUser, display_name: e.target.value })}
                  className="w-full bg-black/40 border border-white/10 rounded-xl py-2 px-3 text-white focus:outline-none focus:border-neon-green"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-gray-300 mb-1 font-bold">Role</label>
                  <select
                    value={editingUser.role}
                    onChange={(e) => setEditingUser({ ...editingUser, role: e.target.value })}
                    className="w-full bg-black/40 border border-white/10 rounded-xl py-2 px-3 text-white focus:outline-none focus:border-neon-green"
                  >
                    <option value="user">User</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>

                <div>
                  <label className="block text-gray-300 mb-1 font-bold">Subscription Tier</label>
                  <select
                    value={editingUser.subscription?.tier_id || 'tier-free'}
                    onChange={(e) =>
                      setEditingUser({
                        ...editingUser,
                        subscription: { ...editingUser.subscription, tier_id: e.target.value },
                      })
                    }
                    className="w-full bg-black/40 border border-white/10 rounded-xl py-2 px-3 text-white focus:outline-none focus:border-neon-green"
                  >
                    {tiers.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-gray-300 mb-1 font-bold">Phone Number</label>
                <input
                  type="text"
                  value={editingUser.phone || ''}
                  onChange={(e) => setEditingUser({ ...editingUser, phone: e.target.value })}
                  className="w-full bg-black/40 border border-white/10 rounded-xl py-2 px-3 text-white focus:outline-none focus:border-neon-green"
                />
              </div>

              <div>
                <label className="block text-gray-300 mb-1 font-bold">Notes</label>
                <textarea
                  value={editingUser.notes || ''}
                  onChange={(e) => setEditingUser({ ...editingUser, notes: e.target.value })}
                  rows={2}
                  className="w-full bg-black/40 border border-white/10 rounded-xl py-2 px-3 text-white focus:outline-none focus:border-neon-green"
                />
              </div>

              <div className="flex items-center space-x-2 pt-2">
                <input
                  type="checkbox"
                  id="editUserActive"
                  checked={editingUser.is_active}
                  onChange={(e) => setEditingUser({ ...editingUser, is_active: e.target.checked })}
                  className="rounded border-white/20 bg-black/40 text-neon-green focus:ring-neon-green"
                />
                <label htmlFor="editUserActive" className="text-gray-300 font-bold">
                  Account Active (Uncheck to suspend)
                </label>
              </div>

              <div className="flex items-center justify-end space-x-3 pt-4 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="px-4 py-2 bg-white/5 hover:bg-white/10 text-gray-300 font-bold rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-neon-green hover:bg-emerald-400 text-black font-extrabold rounded-xl shadow-lg"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: RESET PASSWORD */}
      {resetPasswordUser && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0a130f] border border-white/15 rounded-3xl p-6 md:p-8 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <h3 className="text-lg font-black text-white flex items-center space-x-2">
                <Key className="w-5 h-5 text-amber-400" />
                <span>Reset User Password</span>
              </h3>
              <button onClick={() => setResetPasswordUser(null)} className="text-gray-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-text-muted">
              Enter a new secure password for <strong className="text-white">{resetPasswordUser.email}</strong>.
            </p>

            <form onSubmit={handleResetPassword} className="space-y-4 text-xs">
              <div>
                <label className="block text-gray-300 mb-1 font-bold">New Password</label>
                <input
                  type="text"
                  required
                  value={newPasswordValue}
                  onChange={(e) => setNewPasswordValue(e.target.value)}
                  placeholder="Enter new password"
                  className="w-full bg-black/40 border border-white/10 rounded-xl py-2 px-3 text-white focus:outline-none focus:border-neon-green font-mono"
                />
              </div>

              <div className="flex items-center justify-end space-x-3 pt-3 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setResetPasswordUser(null)}
                  className="px-4 py-2 bg-white/5 hover:bg-white/10 text-gray-300 font-bold rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-amber-400 hover:bg-amber-300 text-black font-extrabold rounded-xl shadow-lg"
                >
                  Set New Password
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: DELETE USER CONFIRMATION */}
      {deletingUser && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0a130f] border border-red-500/30 rounded-3xl p-6 md:p-8 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center space-x-3 text-red-400">
              <AlertTriangle className="w-6 h-6" />
              <h3 className="text-lg font-black text-white">Permanently Delete User?</h3>
            </div>

            <p className="text-xs text-gray-300 leading-relaxed">
              Are you sure you want to delete <strong className="text-white">{deletingUser.email}</strong>? This action will purge their profile, subscriptions, and saved data from the database.
            </p>

            <div className="flex items-center justify-end space-x-3 pt-4 border-t border-white/10 text-xs">
              <button
                type="button"
                onClick={() => setDeletingUser(null)}
                className="px-4 py-2 bg-white/5 hover:bg-white/10 text-gray-300 font-bold rounded-xl"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteUser}
                className="px-5 py-2 bg-red-600 hover:bg-red-500 text-white font-extrabold rounded-xl shadow-lg"
              >
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: CREATE OR EDIT CASINO OPERATOR */}
      {isCasinoModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#0a130f] border border-white/15 rounded-3xl p-6 md:p-8 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <h3 className="text-lg font-black text-white flex items-center space-x-2">
                <Radio className="w-5 h-5 text-neon-green" />
                <span>{editingCasino ? 'Edit Casino Operator' : 'Add New Casino Operator'}</span>
              </h3>
              <button onClick={() => setIsCasinoModalOpen(false)} className="text-gray-400 hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveCasino} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-gray-300 mb-1 font-bold">Operator Label *</label>
                <input
                  type="text"
                  required
                  value={casinoName}
                  onChange={(e) => setCasinoName(e.target.value)}
                  placeholder="e.g. Pragmatic Play Live VIP"
                  className="w-full bg-black/40 border border-white/10 rounded-xl py-2 px-3 text-white focus:outline-none focus:border-neon-green"
                />
              </div>

              <div>
                <label className="block text-gray-300 mb-1 font-bold">Casino Operator ID Code *</label>
                <input
                  type="text"
                  required
                  value={casinoIdCode}
                  onChange={(e) => setCasinoIdCode(e.target.value)}
                  placeholder="e.g. ppcdk00000003716"
                  className="w-full bg-black/40 border border-white/10 rounded-xl py-2 px-3 text-white focus:outline-none focus:border-neon-green font-mono"
                />
                <span className="text-[10px] text-text-muted mt-1 block">
                  Captured from Pragmatic DGA WebSocket subscription or DevTools.
                </span>
              </div>

              <div>
                <label className="block text-gray-300 mb-1 font-bold">Live Feed Provider</label>
                <select
                  value={casinoProvider}
                  onChange={(e) => setCasinoProvider(e.target.value)}
                  className="w-full bg-black/40 border border-white/10 rounded-xl py-2 px-3 text-white focus:outline-none focus:border-neon-green"
                >
                  <option value="pragmatic">Pragmatic Play Live (DGA)</option>
                  <option value="evolution">Evolution Gaming</option>
                  <option value="playtech">Playtech Live</option>
                  <option value="custom">Custom DGA Stream</option>
                </select>
              </div>

              <div>
                <label className="block text-gray-300 mb-1 font-bold">Notes / Description (Optional)</label>
                <textarea
                  value={casinoNotes}
                  onChange={(e) => setCasinoNotes(e.target.value)}
                  placeholder="Operator notes or table access tier..."
                  rows={2}
                  className="w-full bg-black/40 border border-white/10 rounded-xl py-2 px-3 text-white focus:outline-none focus:border-neon-green"
                />
              </div>

              <div className="flex items-center space-x-2 pt-1">
                <input
                  type="checkbox"
                  id="casinoDefaultCheck"
                  checked={casinoIsDefault}
                  onChange={(e) => setCasinoIsDefault(e.target.checked)}
                  className="rounded border-white/20 bg-black/40 text-neon-green focus:ring-neon-green"
                />
                <label htmlFor="casinoDefaultCheck" className="text-gray-300 font-bold cursor-pointer">
                  Set as system-wide default casino operator
                </label>
              </div>

              <div className="flex items-center justify-end space-x-3 pt-3 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setIsCasinoModalOpen(false)}
                  className="px-4 py-2 bg-white/5 hover:bg-white/10 text-gray-300 font-bold rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-neon-green hover:bg-emerald-400 text-black font-extrabold rounded-xl shadow-lg cursor-pointer"
                >
                  {editingCasino ? 'Save Changes' : 'Add Operator'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: DELETE CASINO CONFIRMATION */}
      {deletingCasino && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0a130f] border border-red-500/30 rounded-3xl p-6 md:p-8 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center space-x-3 text-red-400">
              <AlertTriangle className="w-6 h-6" />
              <h3 className="text-lg font-black text-white">Delete Casino Operator?</h3>
            </div>

            <p className="text-xs text-gray-300 leading-relaxed">
              Are you sure you want to remove <strong className="text-white">{deletingCasino.name}</strong> ({deletingCasino.casino_id}) from the database?
            </p>

            <div className="flex items-center justify-end space-x-3 pt-4 border-t border-white/10 text-xs">
              <button
                type="button"
                onClick={() => setDeletingCasino(null)}
                className="px-4 py-2 bg-white/5 hover:bg-white/10 text-gray-300 font-bold rounded-xl cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteCasino}
                className="px-5 py-2 bg-red-600 hover:bg-red-500 text-white font-extrabold rounded-xl shadow-lg cursor-pointer"
              >
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
