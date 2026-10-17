import React, { useState } from 'react';
import { 
  Vault, 
  Lock, 
  Unlock, 
  ArrowDownLeft, 
  ArrowUpRight, 
  ShieldCheck, 
  Plus, 
  AlertCircle,
  PiggyBank,
  CheckCircle2
} from 'lucide-react';
import type { SavingsTransaction, UserProfile } from '../types/index.ts';
import { formatCurrency } from '../utils/currency.ts';

interface SavingsVaultViewProps {
  user: UserProfile;
  savingsUnlocked: boolean;
  savingsTransactions: SavingsTransaction[];
  onUnlockVault: (password: string) => Promise<void>;
  onSetupVaultPassword: (password: string) => Promise<void>;
  onLockVault: () => Promise<void>;
  onRecordSavingsTransaction: (tx: {
    date: string;
    type: 'deposit' | 'withdrawal';
    amount: number;
    description: string;
    source: 'balance' | 'external';
  }) => Promise<void>;
}

export function SavingsVaultView({
  user,
  savingsUnlocked,
  savingsTransactions,
  onUnlockVault,
  onSetupVaultPassword,
  onLockVault,
  onRecordSavingsTransaction
}: SavingsVaultViewProps) {
  // Password prompt state
  const [passwordInput, setPasswordInput] = useState('');
  const [unlockError, setUnlockError] = useState<string | null>(null);
  const [isUnlocking, setIsUnlocking] = useState(false);

  // Setup state (for first-time setup)
  const [setupPassword, setSetupPassword] = useState('');
  const [setupConfirm, setSetupConfirm] = useState('');
  const [setupError, setSetupError] = useState<string | null>(null);
  const [isSettingUp, setIsSettingUp] = useState(false);

  // Transaction modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalType, setModalType] = useState<'deposit' | 'withdrawal'>('deposit');
  const [txAmount, setTxAmount] = useState('');
  const [txDate, setTxDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [txDescription, setTxDescription] = useState('');
  const [txSource, setTxSource] = useState<'balance' | 'external'>('balance');
  const [modalError, setModalError] = useState<string | null>(null);
  const [isSubmittingTx, setIsSubmittingTx] = useState(false);

  // Calculate totals
  let totalDeposits = 0;
  let totalWithdrawals = 0;
  for (const t of savingsTransactions) {
    if (t.type === 'deposit') totalDeposits += t.amount;
    if (t.type === 'withdrawal') totalWithdrawals += t.amount;
  }
  const currentBalance = Math.max(0, totalDeposits - totalWithdrawals);

  // Handle Unlock
  const handleUnlockSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setUnlockError(null);
    if (!passwordInput) return;

    try {
      setIsUnlocking(true);
      await onUnlockVault(passwordInput);
      setPasswordInput('');
    } catch (err: any) {
      setUnlockError(err.message || 'Incorrect vault password.');
    } finally {
      setIsUnlocking(false);
    }
  };

  // Handle Initial Setup
  const handleSetupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSetupError(null);

    if (setupPassword.length < 4) {
      setSetupError('Vault password must be at least 4 characters/digits.');
      return;
    }
    if (setupPassword !== setupConfirm) {
      setSetupError('Passwords do not match.');
      return;
    }

    try {
      setIsSettingUp(true);
      await onSetupVaultPassword(setupPassword);
      setSetupPassword('');
      setSetupConfirm('');
    } catch (err: any) {
      setSetupError(err.message || 'Failed to setup vault password.');
    } finally {
      setIsSettingUp(false);
    }
  };

  // Handle Add Savings Record
  const handleRecordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalError(null);

    const num = parseFloat(txAmount);
    if (isNaN(num) || num <= 0) {
      setModalError('Please enter a valid amount.');
      return;
    }
    if (modalType === 'withdrawal' && num > currentBalance) {
      setModalError(`Withdrawal (${formatCurrency(num)}) exceeds available savings balance (${formatCurrency(currentBalance)}).`);
      return;
    }
    if (!txDescription.trim()) {
      setModalError('Description is required.');
      return;
    }

    try {
      setIsSubmittingTx(true);
      await onRecordSavingsTransaction({
        date: txDate,
        type: modalType,
        amount: Math.round(num * 100) / 100,
        description: txDescription.trim(),
        source: txSource
      });
      setIsModalOpen(false);
      setTxAmount('');
      setTxDescription('');
    } catch (err: any) {
      setModalError(err.message || 'Failed to record savings transaction.');
    } finally {
      setIsSubmittingTx(false);
    }
  };

  // STATE 1: Vault password has never been configured
  if (!user.has_savings_password) {
    return (
      <div className="max-w-md mx-auto my-12 p-6 sm:p-8 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-sm space-y-5">
        <div className="w-12 h-12 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 flex items-center justify-center mx-auto">
          <Vault className="w-6 h-6" />
        </div>
        <div className="text-center space-y-1.5">
          <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
            Set Up Your Savings Vault
          </h2>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
            Protect your long-term reserve funds and confidential savings records with a dedicated security PIN.
          </p>
        </div>

        <form onSubmit={handleSetupSubmit} className="space-y-4 pt-2">
          {setupError && (
            <div className="p-3 rounded-lg text-xs font-medium bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
              <span>{setupError}</span>
            </div>
          )}

          <div>
            <label htmlFor="vault-setup-pass" className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
              Create Vault PIN / Password *
            </label>
            <input
              id="vault-setup-pass"
              type="password"
              required
              minLength={4}
              placeholder="••••"
              value={setupPassword}
              onChange={(e) => setSetupPassword(e.target.value)}
              className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-2 text-sm text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100"
            />
            <span className="text-[11px] text-zinc-400 mt-1 block">Minimum 4 characters or digits.</span>
          </div>

          <div>
            <label htmlFor="vault-setup-confirm" className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
              Confirm Vault PIN *
            </label>
            <input
              id="vault-setup-confirm"
              type="password"
              required
              minLength={4}
              placeholder="••••"
              value={setupConfirm}
              onChange={(e) => setSetupConfirm(e.target.value)}
              className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-2 text-sm text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100"
            />
          </div>

          <button
            type="submit"
            disabled={isSettingUp}
            className="w-full py-2.5 px-4 text-xs font-semibold text-white bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-white dark:text-zinc-900 rounded-xl shadow-xs transition-colors disabled:opacity-50"
          >
            {isSettingUp ? 'Configuring Vault...' : 'Activate Savings Vault'}
          </button>
        </form>
      </div>
    );
  }

  // STATE 2: Vault is currently locked for this session
  if (!savingsUnlocked) {
    return (
      <div className="max-w-md mx-auto my-12 p-6 sm:p-8 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-sm space-y-5">
        <div className="w-12 h-12 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto">
          <Lock className="w-6 h-6" />
        </div>
        <div className="text-center space-y-1.5">
          <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
            Savings Vault Protected
          </h2>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
            Enter your secondary savings PIN to unlock your reserve funds and deposit history.
          </p>
        </div>

        <form onSubmit={handleUnlockSubmit} className="space-y-4 pt-2">
          {unlockError && (
            <div className="p-3 rounded-lg text-xs font-medium bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
              <span>{unlockError}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
              Vault PIN / Password
            </label>
            <input
              type="password"
              required
              autoFocus
              placeholder="••••"
              value={passwordInput}
              onChange={(e) => setPasswordInput(e.target.value)}
              className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-2 text-sm text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100"
            />
          </div>

          <button
            type="submit"
            disabled={isUnlocking}
            className="w-full py-2.5 px-4 text-xs font-semibold text-white bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-white dark:text-zinc-900 rounded-xl shadow-xs transition-colors disabled:opacity-50"
          >
            {isUnlocking ? 'Unlocking...' : 'Unlock Savings Vault'}
          </button>
        </form>
      </div>
    );
  }

  // STATE 3: Vault is Unlocked
  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-zinc-200 dark:border-zinc-800">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-100 tracking-tight">
              Savings & Reserve Vault
            </h1>
            <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
              <Unlock className="w-3.5 h-3.5" /> Session Active
            </span>
          </div>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
            Isolated reserve ledger with independent deposits, interest gains, and emergency fund records.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => {
              setModalType('deposit');
              setIsModalOpen(true);
            }}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-xs transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Deposit</span>
          </button>
          <button
            onClick={() => {
              setModalType('withdrawal');
              setIsModalOpen(true);
            }}
            disabled={currentBalance <= 0}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium text-zinc-700 dark:text-zinc-300 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-750 transition-colors disabled:opacity-50"
          >
            <ArrowUpRight className="w-3.5 h-3.5" />
            <span>Withdraw</span>
          </button>
          <button
            onClick={onLockVault}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-zinc-500 hover:text-zinc-900 dark:hover:text-white rounded-lg transition-colors"
            title="Lock Vault"
          >
            <Lock className="w-3.5 h-3.5" />
            <span>Lock</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-5 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-xs">
          <div className="flex items-center justify-between text-zinc-500 text-xs mb-2">
            <span className="font-medium">Current Savings Balance</span>
            <PiggyBank className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-bold font-mono text-emerald-600 dark:text-emerald-400">
            {formatCurrency(currentBalance)}
          </div>
          <div className="mt-2 text-[11px] text-zinc-500 dark:text-zinc-400">
            Secured in reserve account
          </div>
        </div>

        <div className="p-5 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-xs">
          <div className="flex items-center justify-between text-zinc-500 text-xs mb-2">
            <span className="font-medium">Total Deposited</span>
            <ArrowDownLeft className="w-4 h-4 text-zinc-400 dark:text-zinc-500" />
          </div>
          <div className="text-2xl font-bold font-mono text-zinc-900 dark:text-white">
            {formatCurrency(totalDeposits, { showSign: true })}
          </div>
          <div className="mt-2 text-[11px] text-zinc-500 dark:text-zinc-400">
            Across {savingsTransactions.filter(t => t.type === 'deposit').length} deposit(s)
          </div>
        </div>

        <div className="p-5 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-xs">
          <div className="flex items-center justify-between text-zinc-500 text-xs mb-2">
            <span className="font-medium">Total Withdrawn</span>
            <ArrowUpRight className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl font-bold font-mono text-zinc-900 dark:text-white">
            -{formatCurrency(totalWithdrawals)}
          </div>
          <div className="mt-2 text-[11px] text-zinc-500 dark:text-zinc-400">
            Across {savingsTransactions.filter(t => t.type === 'withdrawal').length} withdrawal(s)
          </div>
        </div>
      </div>

      {/* Savings Ledger Table */}
      <div className="rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-zinc-100 dark:border-zinc-800">
          <h3 className="text-sm font-semibold text-zinc-900 dark:text-white">
            Savings Activity Ledger
          </h3>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            History of allocations to and disbursements from reserve savings.
          </p>
        </div>

        {savingsTransactions.length === 0 ? (
          <div className="p-12 text-center text-zinc-500 space-y-2">
            <PiggyBank className="w-8 h-8 mx-auto text-zinc-400" />
            <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              No savings transactions recorded yet.
            </p>
            <p className="text-xs text-zinc-400">
              Deposit surplus funds or set aside emergency money to build your reserve.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-zinc-50 dark:bg-zinc-800/60 text-zinc-500 border-b border-zinc-200 dark:border-zinc-800">
                <tr>
                  <th className="py-2.5 px-4 font-medium">Date</th>
                  <th className="py-2.5 px-4 font-medium">Description</th>
                  <th className="py-2.5 px-4 font-medium">Type</th>
                  <th className="py-2.5 px-4 font-medium">Source</th>
                  <th className="py-2.5 px-4 font-medium text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800 font-sans">
                {savingsTransactions.map(t => (
                  <tr key={t.id} className="hover:bg-zinc-50/60 dark:hover:bg-zinc-800/40">
                    <td className="py-2.5 px-4 text-zinc-500 dark:text-zinc-400 font-mono text-[11px] whitespace-nowrap">
                      {t.date}
                    </td>
                    <td className="py-2.5 px-4 font-medium text-zinc-900 dark:text-white">
                      {t.description}
                    </td>
                    <td className="py-2.5 px-4">
                      <span className={`font-medium ${t.type === 'deposit' ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}>
                        {t.type === 'deposit' ? 'Deposit' : 'Withdrawal'}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 text-zinc-500 dark:text-zinc-400 text-[11px]">
                      {t.source === 'balance' ? 'Main Account Balance' : 'External Deposit'}
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono font-medium whitespace-nowrap">
                      <span className={t.type === 'deposit' ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}>
                        {t.type === 'deposit' ? '+' : '-'}{formatCurrency(t.amount)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Deposit / Withdrawal Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-900/50 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-zinc-900 shadow-xl border border-zinc-200 dark:border-zinc-800 p-6 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-zinc-100 dark:border-zinc-800">
              <h3 className="text-sm font-semibold text-zinc-900 dark:text-white">
                {modalType === 'deposit' ? 'Deposit to Savings' : 'Withdraw from Savings'}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleRecordSubmit} className="space-y-4">
              {modalError && (
                <div className="p-3 rounded-lg text-xs font-medium bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
                  {modalError}
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                  Amount (₹) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  required
                  placeholder="0.00"
                  value={txAmount}
                  onChange={(e) => setTxAmount(e.target.value)}
                  className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-2 text-sm text-zinc-900 dark:text-white font-mono focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                  Date *
                </label>
                <input
                  type="date"
                  required
                  value={txDate}
                  onChange={(e) => setTxDate(e.target.value)}
                  className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-2 text-sm text-zinc-900 dark:text-white font-mono focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                  Description / Purpose *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Monthly emergency reserve deposit"
                  value={txDescription}
                  onChange={(e) => setTxDescription(e.target.value)}
                  className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-2 text-sm text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100"
                />
              </div>

              {modalType === 'deposit' && (
                <div>
                  <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                    Funding Source
                  </label>
                  <select
                    value={txSource}
                    onChange={(e) => setTxSource(e.target.value as any)}
                    className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-2 text-xs text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100"
                  >
                    <option value="balance">Deduct from Main Account Balance</option>
                    <option value="external">Direct External Deposit</option>
                  </select>
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-zinc-100 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  disabled={isSubmittingTx}
                  className="px-4 py-2 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingTx}
                  className="px-4 py-2 text-xs font-semibold text-white bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-white dark:text-zinc-900 rounded-lg shadow-xs transition-colors disabled:opacity-50"
                >
                  {isSubmittingTx ? 'Processing...' : modalType === 'deposit' ? 'Confirm Deposit' : 'Confirm Withdrawal'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
