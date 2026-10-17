import React, { useMemo } from 'react';
import { 
  BarChart3, 
  AlertCircle, 
  CheckCircle2, 
  Info
} from 'lucide-react';
import type { Transaction } from '../types/index.ts';
import { 
  calculateCategoryBreakdown, 
  calculateMonthlyTrends, 
  calculateDayOfWeekPattern, 
  generateSpendingInsights, 
  calculateFinancialSummary 
} from '../utils/analytics.ts';
import { MonthlyBarChart, CategoryDistribution, DayOfWeekChart } from '../components/Charts.tsx';
import { formatCurrency } from '../utils/currency.ts';

interface AnalyticsViewProps {
  transactions: Transaction[];
  onOpenAddModal: () => void;
}

export function AnalyticsView({ transactions, onOpenAddModal }: AnalyticsViewProps) {
  const expenses = useMemo(() => transactions.filter(t => t.type === 'expense'), [transactions]);
  const insights = useMemo(() => generateSpendingInsights(transactions), [transactions]);
  const categoryBreakdown = useMemo(() => calculateCategoryBreakdown(transactions), [transactions]);
  const monthlyTrends = useMemo(() => calculateMonthlyTrends(transactions), [transactions]);
  const dayPatterns = useMemo(() => calculateDayOfWeekPattern(transactions), [transactions]);
  const summary = useMemo(() => calculateFinancialSummary(transactions), [transactions]);

  // Statistical calculations
  const totalExpenseAmount = expenses.reduce((sum, t) => sum + t.amount, 0);
  const avgExpensePerTx = expenses.length > 0 ? totalExpenseAmount / expenses.length : 0;
  
  // Unique dates count to calculate true daily average
  const uniqueDates = new Set(expenses.map(e => e.date)).size;
  const avgDailySpend = uniqueDates > 0 ? totalExpenseAmount / uniqueDates : 0;

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-zinc-200 dark:border-zinc-800">
        <div>
          <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-100 tracking-tight">
            Financial Insights & Analytics
          </h1>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
            Spending velocity, weekend distribution, and pattern metrics derived from your ledger.
          </p>
        </div>

        <div className="text-xs font-mono text-zinc-500">
          Analyzed: <strong className="text-zinc-900 dark:text-white">{transactions.length}</strong> total records
        </div>
      </div>

      {/* Summary Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-xs">
          <div className="text-xs text-zinc-500 dark:text-zinc-400 mb-1 font-medium">Average per Transaction</div>
          <div className="text-2xl font-bold font-mono text-zinc-900 dark:text-white">
            {formatCurrency(avgExpensePerTx)}
          </div>
          <div className="text-[11px] text-zinc-400 mt-1">
            Across {expenses.length} expense events
          </div>
        </div>

        <div className="p-5 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-xs">
          <div className="text-xs text-zinc-500 dark:text-zinc-400 mb-1 font-medium">Average Daily Outlay</div>
          <div className="text-2xl font-bold font-mono text-zinc-900 dark:text-white">
            {formatCurrency(avgDailySpend)}
          </div>
          <div className="text-[11px] text-zinc-400 mt-1">
            Across {uniqueDates} active spending days
          </div>
        </div>

        <div className="p-5 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-xs">
          <div className="text-xs text-zinc-500 dark:text-zinc-400 mb-1 font-medium">Income Retention Rate</div>
          <div className="text-2xl font-bold font-mono text-emerald-600 dark:text-emerald-400">
            {summary.savingsRate}%
          </div>
          <div className="text-[11px] text-zinc-400 mt-1">
            Net positive savings margin
          </div>
        </div>

        <div className="p-5 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-xs">
          <div className="text-xs text-zinc-500 dark:text-zinc-400 mb-1 font-medium">Dominant Outlay Category</div>
          <div className="text-2xl font-bold truncate text-zinc-900 dark:text-white">
            {categoryBreakdown[0]?.category || 'N/A'}
          </div>
          <div className="text-[11px] text-zinc-400 mt-1">
            {categoryBreakdown[0] ? `${categoryBreakdown[0].percentage}% of total expenses` : 'No expenses recorded'}
          </div>
        </div>
      </div>

      {/* Spending Pattern Insights Strip */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-zinc-700 dark:text-zinc-300" />
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-white">
            Spending Pattern Highlights
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {insights.map((insight) => (
            <div
              key={insight.id}
              className={`p-4 rounded-xl border transition-all ${
                insight.severity === 'warning'
                  ? 'bg-amber-50/50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900/60'
                  : insight.severity === 'positive'
                  ? 'bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900/60'
                  : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800'
              }`}
            >
              <div className="flex items-start gap-3">
                <div className="mt-0.5 shrink-0">
                  {insight.severity === 'warning' ? (
                    <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                  ) : insight.severity === 'positive' ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  ) : (
                    <Info className="w-4 h-4 text-zinc-600 dark:text-zinc-400" />
                  )}
                </div>
                <div className="space-y-1">
                  <h3 className="text-xs font-bold text-zinc-900 dark:text-white">
                    {insight.title}
                  </h3>
                  <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
                    {insight.description}
                  </p>
                  <p className="text-[11px] font-mono text-zinc-500 pt-0.5">
                    {insight.evidence}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Visual Analytics Grid: 2 Charts Side by Side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Day of Week Spending Pattern */}
        <div className="p-5 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-xs space-y-3">
          <div>
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-white">
              Day of Week Spending Habits
            </h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Aggregated spend by day. Evaluates weekend clustering vs weekday baselines.
            </p>
          </div>
          <DayOfWeekChart data={dayPatterns} />
        </div>

        {/* Category Breakdown */}
        <div className="p-5 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-xs space-y-3">
          <div>
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-white">
              Expense Category Distribution
            </h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Relative weight of top spending categories.
            </p>
          </div>
          <CategoryDistribution data={categoryBreakdown} />
        </div>
      </div>

      {/* Historical Monthly Trend */}
      <div className="p-5 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-xs space-y-3">
        <div>
          <h3 className="text-sm font-semibold text-zinc-900 dark:text-white">
            Historical Inflow vs Outflow
          </h3>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Multi-month trend analysis revealing financial surplus vs deficit periods.
          </p>
        </div>
        <MonthlyBarChart data={monthlyTrends} />
      </div>
    </div>
  );
}
