import React, { useState } from 'react';
import { 
  Wallet, 
  ArrowDownRight, 
  ArrowUpRight, 
  Plus, 
  Lock, 
  Unlock,
  TrendingUp, 
  TrendingDown,
  ArrowRight
} from 'lucide-react';
import type { 
  Transaction, 
  SavingsTransaction, 
  UserProfile 
} from '../types/index.ts';
import { 
  calculateFinancialSummary, 
  calculateCategoryBreakdown, 
  calculateMonthlyTrends 
} from '../utils/analytics.ts';
import { formatCurrency } from '../utils/currency.ts';
import { MonthlyBarChart, CategoryDistribution } from '../components/Charts.tsx';

interface DashboardViewProps {
  user: UserProfile;
  transactions: Transaction[];
  savingsTransactions: SavingsTransaction[];
  savingsUnlocked: boolean;
  onOpenAddModal: () => void;
  onNavigateToSavings: () => void;
  onNavigateToTransactions: () => void;
}

export function DashboardView({
  user,
  transactions,
  savingsTransactions,
  savingsUnlocked,
  onOpenAddModal,
  onNavigateToSavings,
  onNavigateToTransactions
}: DashboardViewProps) {
  const [period, setPeriod] = useState<'all' | 'month' | 'year'>('all');

  // Filter transactions by period
  const filteredTx = React.useMemo(() => {
    if (period === 'all') return transactions;
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = String(now.getMonth() + 1).padStart(2, '0');

    if (period === 'month') {
      const ym = `${currentYear}-${currentMonth}`;
      return transactions.filter(t => t.date.startsWith(ym));
    }
    if (period === 'year') {
      return transactions.filter(t => t.date.startsWith(String(currentYear)));
    }
    return transactions;
  }, [transactions, period]);

  // Derived summaries
  const summary = React.useMemo(() => {
    return calculateFinancialSummary(filteredTx, savingsTransactions);
  }, [filteredTx, savingsTransactions]);

  const categoryBreakdown = React.useMemo(() => {
    return calculateCategoryBreakdown(filteredTx);
  }, [filteredTx]);

  const monthlyTrends = React.useMemo(() => {
    return calculateMonthlyTrends(transactions);
  }, [transactions]);

  // Month-over-month spending comparison
  const momComparison = React.useMemo(() => {
    if (monthlyTrends.length < 2) return null;
    const curr = monthlyTrends[monthlyTrends.length - 1];
    const prev = monthlyTrends[monthlyTrends.length - 2];
    if (prev.expense === 0) return null;
    const diff = curr.expense - prev.expense;
    const pct = Math.abs(Math.round((diff / prev.expense) * 100));
    return {
      isIncrease: diff > 0,
      pct,
      diff,
      currLabel: curr.label,
      prevLabel: prev.label
    };
  }, [monthlyTrends]);

  const recentTx = [...transactions]
    .sort((a, b) => b.date.localeCompare(a.date) || b.created_at.localeCompare(a.created_at))
    .slice(0, 5);

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Top Header & Period Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-zinc-200 dark:border-zinc-800">
        <div>
          <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-100 tracking-tight">
            Financial Dashboard
          </h1>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
            Real-time balance, spending velocity, and category pattern summary for {user.username}.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Period selector */}
          <div className="flex rounded-lg bg-zinc-100 dark:bg-zinc-800 p-0.5 text-xs font-medium text-zinc-600 dark:text-zinc-400">
            <button
              onClick={() => setPeriod('all')}
              className={`px-3 py-1.5 rounded-md transition-colors ${
                period === 'all'
                  ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white shadow-xs font-semibold'
                  : 'hover:text-zinc-900 dark:hover:text-white'
              }`}
            >
              All Time
            </button>
            <button
              onClick={() => setPeriod('month')}
              className={`px-3 py-1.5 rounded-md transition-colors ${
                period === 'month'
                  ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white shadow-xs font-semibold'
                  : 'hover:text-zinc-900 dark:hover:text-white'
              }`}
            >
              This Month
            </button>
            <button
              onClick={() => setPeriod('year')}
              className={`px-3 py-1.5 rounded-md transition-colors ${
                period === 'year'
                  ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white shadow-xs font-semibold'
                  : 'hover:text-zinc-900 dark:hover:text-white'
              }`}
            >
              This Year
            </button>
          </div>

          <button
            onClick={onOpenAddModal}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium text-white bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-white dark:text-zinc-900 rounded-lg shadow-xs transition-colors shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Transaction</span>
          </button>
        </div>
      </div>

      {/* Month-over-Month Variance Strip */}
      {momComparison && (
        <div className="flex items-center justify-between p-3.5 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-xs">
          <div className="flex items-center gap-2">
            {momComparison.isIncrease ? (
              <TrendingUp className="w-4 h-4 text-rose-500" />
            ) : (
              <TrendingDown className="w-4 h-4 text-emerald-500" />
            )}
            <span className="text-zinc-700 dark:text-zinc-300">
              {momComparison.isIncrease ? (
                <>Monthly spending increased by <strong className="text-rose-600 dark:text-rose-400">+{momComparison.pct}%</strong> ({formatCurrency(Math.abs(momComparison.diff))}) compared to last month.</>
              ) : (
                <>Monthly spending decreased by <strong className="text-emerald-600 dark:text-emerald-400">-{momComparison.pct}%</strong> ({formatCurrency(Math.abs(momComparison.diff))}) compared to last month.</>
              )}
            </span>
          </div>
          <span className="text-[11px] text-zinc-400 hidden sm:inline">
            Verified Trends
          </span>
        </div>
      )}

      {/* Primary Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Main Balance */}
        <div className="p-5 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-xs">
          <div className="flex items-center justify-between text-zinc-500 text-xs mb-2">
            <span className="font-medium">Main Balance</span>
            <Wallet className="w-4 h-4 text-zinc-400 dark:text-zinc-500" />
          </div>
          <div className="text-2xl font-bold font-mono tracking-tight text-zinc-900 dark:text-white">
            {formatCurrency(summary.mainBalance)}
          </div>
          <div className="mt-2 text-[11px] text-zinc-500 dark:text-zinc-400">
            Available liquid reserve
          </div>
        </div>

        {/* Total Income */}
        <div className="p-5 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-xs">
          <div className="flex items-center justify-between text-zinc-500 text-xs mb-2">
            <span className="font-medium">Total Inflow</span>
            <ArrowDownRight className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-bold font-mono tracking-tight text-emerald-600 dark:text-emerald-400">
            {formatCurrency(summary.totalIncome, { showSign: true })}
          </div>
          <div className="mt-2 text-[11px] text-zinc-500 dark:text-zinc-400">
            {filteredTx.filter(t => t.type === 'income').length} income source(s)
          </div>
        </div>

        {/* Total Expenses */}
        <div className="p-5 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-xs">
          <div className="flex items-center justify-between text-zinc-500 text-xs mb-2">
            <span className="font-medium">Total Outflow</span>
            <ArrowUpRight className="w-4 h-4 text-rose-500" />
          </div>
          <div className="text-2xl font-bold font-mono tracking-tight text-rose-600 dark:text-rose-400">
            -{formatCurrency(summary.totalExpense)}
          </div>
          <div className="mt-2 text-[11px] text-zinc-500 dark:text-zinc-400">
            {filteredTx.filter(t => t.type === 'expense').length} expense item(s)
          </div>
        </div>

        {/* Savings Vault Balance */}
        <div 
          onClick={onNavigateToSavings}
          className="p-5 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-xs cursor-pointer hover:border-zinc-400 dark:hover:border-zinc-700 transition-colors"
        >
          <div className="flex items-center justify-between text-zinc-500 text-xs mb-2">
            <span className="font-medium">Savings Vault</span>
            {savingsUnlocked ? (
              <Unlock className="w-4 h-4 text-emerald-500" />
            ) : (
              <Lock className="w-4 h-4 text-amber-500" />
            )}
          </div>
          {savingsUnlocked ? (
            <div className="text-2xl font-bold font-mono tracking-tight text-emerald-600 dark:text-emerald-400">
              {formatCurrency(summary.savingsBalance)}
            </div>
          ) : (
            <div className="text-sm font-medium text-amber-600 dark:text-amber-400 flex items-center gap-1.5 py-1.5">
              <span>PIN Protected</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </div>
          )}
          <div className="mt-2 text-[11px] text-zinc-500 dark:text-zinc-400 flex items-center justify-between">
            <span>{savingsUnlocked ? 'Vault accessible' : 'Click to unlock'}</span>
            <span className="font-mono">{summary.savingsRate}% saved</span>
          </div>
        </div>
      </div>

      {/* Empty State */}
      {transactions.length === 0 && (
        <div className="p-10 rounded-2xl bg-white dark:bg-zinc-900 border border-dashed border-zinc-300 dark:border-zinc-800 text-center space-y-4">
          <div className="w-12 h-12 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 flex items-center justify-center mx-auto">
            <Wallet className="w-6 h-6" />
          </div>
          <div className="max-w-md mx-auto space-y-1.5">
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-white">
              No transactions recorded yet
            </h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
              Record your first expense or income, and RupeeTrail will track your spending patterns, categories, and monthly margins automatically.
            </p>
          </div>
          <div className="pt-2">
            <button
              onClick={onOpenAddModal}
              className="px-5 py-2.5 text-xs font-semibold text-white bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-white dark:text-zinc-900 rounded-xl shadow-xs transition-colors"
            >
              + Record Transaction
            </button>
          </div>
        </div>
      )}

      {/* Charts Section: Monthly Trends + Category Breakdown */}
      {transactions.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Monthly Comparison Bar Chart */}
          <div className="lg:col-span-2 p-5 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-xs space-y-3">
            <div>
              <h3 className="text-sm font-semibold text-zinc-900 dark:text-white">
                Monthly Inflow & Outflow Trends
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Historical monthly comparison of cash inflow and outflow.
              </p>
            </div>
            <div className="pt-2 overflow-x-auto">
              <MonthlyBarChart data={monthlyTrends} />
            </div>
          </div>

          {/* Category Distribution */}
          <div className="p-5 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-xs space-y-3">
            <div>
              <h3 className="text-sm font-semibold text-zinc-900 dark:text-white">
                Expenses by Category
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Ranked breakdown of current expenses.
              </p>
            </div>
            <div className="pt-2">
              <CategoryDistribution data={categoryBreakdown} />
            </div>
          </div>
        </div>
      )}

      {/* Recent Transactions List */}
      {recentTx.length > 0 && (
        <div className="p-5 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-zinc-900 dark:text-white">
                Recent Ledger Activity
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Latest 5 entries across accounts.
              </p>
            </div>
            <button
              onClick={onNavigateToTransactions}
              className="text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:text-zinc-950 dark:hover:text-white inline-flex items-center gap-1"
            >
              <span>View all entries</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="overflow-x-auto pt-1">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-zinc-100 dark:border-zinc-800 text-zinc-400 dark:text-zinc-500 text-[11px]">
                  <th className="py-2.5 px-3 font-medium">Date</th>
                  <th className="py-2.5 px-3 font-medium">Description</th>
                  <th className="py-2.5 px-3 font-medium">Category</th>
                  <th className="py-2.5 px-3 font-medium">Payment</th>
                  <th className="py-2.5 px-3 font-medium text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800 font-sans">
                {recentTx.map(t => (
                  <tr key={t.id} className="hover:bg-zinc-50/60 dark:hover:bg-zinc-800/40">
                    <td className="py-2.5 px-3 text-zinc-500 dark:text-zinc-400 font-mono text-[11px] whitespace-nowrap">
                      {t.date}
                    </td>
                    <td className="py-2.5 px-3 font-medium text-zinc-900 dark:text-white truncate max-w-[200px]">
                      {t.title}
                    </td>
                    <td className="py-2.5 px-3 text-zinc-600 dark:text-zinc-400">
                      {t.category}
                    </td>
                    <td className="py-2.5 px-3 text-zinc-500 dark:text-zinc-400 text-[11px]">
                      {t.payment_method}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono font-medium">
                      <span className={t.type === 'income' ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}>
                        {t.type === 'income' ? '+' : '-'}{formatCurrency(t.amount)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
