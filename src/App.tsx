import React, { useState, useEffect, useCallback } from 'react';
import { Menu, Plus, Sun, Moon } from 'lucide-react';
import type { 
  UserProfile, 
  Transaction, 
  SavingsTransaction 
} from './types/index.ts';
import { Sidebar, type TabType } from './components/Sidebar.tsx';
import { AuthView } from './views/AuthView.tsx';
import { DashboardView } from './views/DashboardView.tsx';
import { TransactionsView } from './views/TransactionsView.tsx';
import { SavingsVaultView } from './views/SavingsVaultView.tsx';
import { AnalyticsView } from './views/AnalyticsView.tsx';
import { SettingsView } from './views/SettingsView.tsx';
import { TransactionModal } from './components/TransactionModal.tsx';
import { ConfirmationDialog } from './components/ConfirmationDialog.tsx';
import { OtpModal } from './components/OtpModal.tsx';

export default function App() {
  // Theme state
  const [isDark, setIsDark] = useState<boolean>(() => {
    const saved = localStorage.getItem('theme');
    if (saved) return saved === 'dark';
    return false; // Default to clean, warm light mode
  });

  useEffect(() => {
    const root = document.documentElement;
    if (isDark) {
      root.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      root.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [isDark]);

  const toggleTheme = () => setIsDark(prev => !prev);

  // Auth state
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('auth_token'));
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);

  // App navigation state
  const [activeTab, setActiveTab] = useState<TabType>('dashboard');
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);

  // Financial data state
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [savingsTransactions, setSavingsTransactions] = useState<SavingsTransaction[]>([]);
  const [savingsUnlocked, setSavingsUnlocked] = useState(false);

  // Modals state
  const [isAddEditModalOpen, setIsAddEditModalOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [deleteTxId, setDeleteTxId] = useState<string | null>(null);

  // OTP Modal state for contact verification
  const [otpModalState, setOtpModalState] = useState<{
    isOpen: boolean;
    target: string;
    type: 'email' | 'phone';
  }>({
    isOpen: false,
    target: '',
    type: 'email'
  });

  // Fetch helper with auth header
  const authFetch = useCallback(async (url: string, options: RequestInit = {}) => {
    const currentToken = localStorage.getItem('auth_token');
    const headers = new Headers(options.headers || {});
    if (currentToken) {
      headers.set('Authorization', `Bearer ${currentToken}`);
    }
    if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
      headers.set('Content-Type', 'application/json');
    }
    const res = await fetch(url, { ...options, headers });
    if (res.status === 401) {
      // Session expired
      localStorage.removeItem('auth_token');
      setToken(null);
      setUser(null);
    }
    return res;
  }, []);

  // Load Transactions & Savings
  const loadFinancialData = useCallback(async () => {
    if (!token) return;
    try {
      // 1. Transactions
      const txRes = await authFetch('/api/transactions');
      if (txRes.ok) {
        const txData = await txRes.json();
        setTransactions(txData.transactions || []);
      }

      // 2. Savings status
      const savStatusRes = await authFetch('/api/savings/status');
      if (savStatusRes.ok) {
        const savData = await savStatusRes.json();
        setSavingsUnlocked(savData.unlocked);

        // If unlocked, fetch savings ledger
        if (savData.unlocked) {
          const savTxRes = await authFetch('/api/savings/transactions');
          if (savTxRes.ok) {
            const ledgerData = await savTxRes.json();
            setSavingsTransactions(ledgerData.transactions || []);
          }
        }
      }
    } catch (err) {
      console.error('Error loading data:', err);
    }
  }, [token, authFetch]);

  // Initial user authentication check on mount
  useEffect(() => {
    async function checkAuth() {
      const storedToken = localStorage.getItem('auth_token');
      if (!storedToken) {
        setIsAuthLoading(false);
        return;
      }

      try {
        const res = await fetch('/api/auth/me', {
          headers: { Authorization: `Bearer ${storedToken}` }
        });
        if (res.ok) {
          const data = await res.json();
          setUser(data.user);
          setToken(storedToken);
          setSavingsUnlocked(Boolean(data.user.savings_unlocked));
        } else {
          localStorage.removeItem('auth_token');
          setToken(null);
          setUser(null);
        }
      } catch (err) {
        console.error('Failed to verify session:', err);
      } finally {
        setIsAuthLoading(false);
      }
    }
    checkAuth();
  }, []);

  // When token/user changes, fetch data
  useEffect(() => {
    if (user && token) {
      loadFinancialData();
    }
  }, [user, token, loadFinancialData]);

  // Login handler
  const handleLoginSuccess = (loggedInUser: UserProfile, newToken: string) => {
    localStorage.setItem('auth_token', newToken);
    setToken(newToken);
    setUser(loggedInUser);
    setActiveTab('dashboard');
  };

  // Logout handler
  const handleLogout = async () => {
    try {
      await authFetch('/api/auth/logout', { method: 'POST' });
    } catch {
      // ignore
    } finally {
      localStorage.removeItem('auth_token');
      setToken(null);
      setUser(null);
      setTransactions([]);
      setSavingsTransactions([]);
      setSavingsUnlocked(false);
    }
  };

  // Transaction CRUD handlers
  const handleSaveTransaction = async (txData: Partial<Transaction>) => {
    if (editingTransaction) {
      // Update
      const res = await authFetch(`/api/transactions/${editingTransaction.id}`, {
        method: 'PUT',
        body: JSON.stringify(txData)
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to update transaction.');
      }
    } else {
      // Create
      const res = await authFetch('/api/transactions', {
        method: 'POST',
        body: JSON.stringify(txData)
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to record transaction.');
      }
    }
    await loadFinancialData();
  };

  const handleConfirmDelete = async () => {
    if (!deleteTxId) return;
    try {
      const res = await authFetch(`/api/transactions/${deleteTxId}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        setTransactions(prev => prev.filter(t => t.id !== deleteTxId));
      }
    } finally {
      setDeleteTxId(null);
    }
  };

  // Savings Vault Handlers
  const handleUnlockVault = async (password: string) => {
    const res = await authFetch('/api/savings/unlock', {
      method: 'POST',
      body: JSON.stringify({ password })
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Incorrect savings password.');
    }
    setSavingsUnlocked(true);
    await loadFinancialData();
  };

  const handleSetupVaultPassword = async (password: string) => {
    const res = await authFetch('/api/savings/setup', {
      method: 'POST',
      body: JSON.stringify({ password })
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Failed to setup savings password.');
    }
    if (user) {
      setUser({ ...user, has_savings_password: true });
    }
    setSavingsUnlocked(true);
    await loadFinancialData();
  };

  const handleLockVault = async () => {
    await authFetch('/api/savings/lock', { method: 'POST' });
    setSavingsUnlocked(false);
    setSavingsTransactions([]);
  };

  const handleRecordSavingsTransaction = async (tx: {
    date: string;
    type: 'deposit' | 'withdrawal';
    amount: number;
    description: string;
    source: 'balance' | 'external';
  }) => {
    const res = await authFetch('/api/savings/transactions', {
      method: 'POST',
      body: JSON.stringify(tx)
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to record savings entry.');
    }
    await loadFinancialData();
  };

  // Contact Updates & OTP Verification
  const handleUpdateContact = async (email?: string, phone?: string) => {
    const res = await authFetch('/api/auth/update-contact', {
      method: 'POST',
      body: JSON.stringify({ email, phone })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to update contact info.');
    setUser(data.user);
  };

  const handleTriggerVerify = async (type: 'email' | 'phone', target: string) => {
    const res = await authFetch('/api/auth/send-otp', {
      method: 'POST',
      body: JSON.stringify({ type, target })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to dispatch OTP.');
    
    setOtpModalState({
      isOpen: true,
      target,
      type
    });
  };

  const handleVerifyOtp = async (code: string) => {
    const res = await authFetch('/api/auth/verify-otp', {
      method: 'POST',
      body: JSON.stringify({
        target: otpModalState.target,
        type: otpModalState.type,
        code
      })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Verification failed.');
    setUser(data.user);
  };

  const handleResendOtp = async () => {
    const res = await authFetch('/api/auth/send-otp', {
      method: 'POST',
      body: JSON.stringify({
        target: otpModalState.target,
        type: otpModalState.type
      })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to resend OTP.');
  };

  const handleChangePassword = async (currentPassword: string, newPassword: string) => {
    const res = await authFetch('/api/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword, newPassword })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to update password.');
  };

  const handleChangeSavingsPassword = async (currentPassword: string, newPassword: string) => {
    const res = await authFetch('/api/savings/setup', {
      method: 'POST',
      body: JSON.stringify({ currentPassword, password: newPassword })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to update savings password.');
    if (user) setUser({ ...user, has_savings_password: true });
    setSavingsUnlocked(true);
  };

  // Loading screen
  if (isAuthLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-950 text-zinc-500 text-xs font-medium">
        Loading RupeeTrail...
      </div>
    );
  }

  // Not logged in: Show AuthView
  if (!user || !token) {
    return (
      <AuthView
        onLoginSuccess={handleLoginSuccess}
        isDark={isDark}
        onToggleTheme={toggleTheme}
      />
    );
  }

  // Logged In: Main Application Shell
  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 flex font-sans antialiased">
      {/* Sidebar Navigation */}
      <Sidebar
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        user={user}
        savingsUnlocked={savingsUnlocked}
        onLogout={handleLogout}
        isDark={isDark}
        onToggleTheme={toggleTheme}
        isMobileOpen={isMobileNavOpen}
        onCloseMobile={() => setIsMobileNavOpen(false)}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 lg:pl-64">
        {/* Top Mobile Bar */}
        <header className="lg:hidden flex items-center justify-between p-4 bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 sticky top-0 z-30">
          <button
            onClick={() => setIsMobileNavOpen(true)}
            className="p-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300"
            aria-label="Open navigation menu"
          >
            <Menu className="w-5 h-5" />
          </button>
          <span className="font-semibold text-xs tracking-tight text-zinc-900 dark:text-white">
            RupeeTrail
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={toggleTheme}
              className="p-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300"
              aria-label="Toggle theme"
            >
              {isDark ? <Sun className="w-4 h-4 text-amber-500" /> : <Moon className="w-4 h-4 text-zinc-600" />}
            </button>
            <button
              onClick={() => {
                setEditingTransaction(null);
                setIsAddEditModalOpen(true);
              }}
              className="p-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-zinc-100 dark:text-zinc-900"
              aria-label="Add transaction"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* Dynamic Page Views */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          {activeTab === 'dashboard' && (
            <DashboardView
              user={user}
              transactions={transactions}
              savingsTransactions={savingsTransactions}
              savingsUnlocked={savingsUnlocked}
              onOpenAddModal={() => {
                setEditingTransaction(null);
                setIsAddEditModalOpen(true);
              }}
              onNavigateToSavings={() => setActiveTab('savings')}
              onNavigateToTransactions={() => setActiveTab('transactions')}
            />
          )}

          {activeTab === 'transactions' && (
            <TransactionsView
              transactions={transactions}
              onOpenAddModal={() => {
                setEditingTransaction(null);
                setIsAddEditModalOpen(true);
              }}
              onOpenEditModal={(tx) => {
                setEditingTransaction(tx);
                setIsAddEditModalOpen(true);
              }}
              onDeleteTransaction={(id) => setDeleteTxId(id)}
            />
          )}

          {activeTab === 'savings' && (
            <SavingsVaultView
              user={user}
              savingsUnlocked={savingsUnlocked}
              savingsTransactions={savingsTransactions}
              onUnlockVault={handleUnlockVault}
              onSetupVaultPassword={handleSetupVaultPassword}
              onLockVault={handleLockVault}
              onRecordSavingsTransaction={handleRecordSavingsTransaction}
            />
          )}

          {activeTab === 'analytics' && (
            <AnalyticsView
              transactions={transactions}
              onOpenAddModal={() => {
                setEditingTransaction(null);
                setIsAddEditModalOpen(true);
              }}
            />
          )}

          {activeTab === 'settings' && (
            <SettingsView
              user={user}
              onUpdateContact={handleUpdateContact}
              onTriggerVerify={handleTriggerVerify}
              onChangePassword={handleChangePassword}
              onChangeSavingsPassword={handleChangeSavingsPassword}
            />
          )}
        </main>
      </div>

      {/* Global Modals */}
      <TransactionModal
        isOpen={isAddEditModalOpen}
        onClose={() => {
          setIsAddEditModalOpen(false);
          setEditingTransaction(null);
        }}
        onSave={handleSaveTransaction}
        initialData={editingTransaction}
      />

      <ConfirmationDialog
        isOpen={Boolean(deleteTxId)}
        title="Delete Transaction"
        message="Are you sure you want to permanently delete this transaction? This action cannot be undone and will update your balance."
        confirmLabel="Delete Record"
        isDestructive={true}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteTxId(null)}
      />

      <OtpModal
        isOpen={otpModalState.isOpen}
        target={otpModalState.target}
        purpose={otpModalState.type === 'email' ? 'verify_email' : 'verify_phone'}
        onClose={() => setOtpModalState(prev => ({ ...prev, isOpen: false }))}
        onVerify={handleVerifyOtp}
        onResend={handleResendOtp}
      />
    </div>
  );
}
