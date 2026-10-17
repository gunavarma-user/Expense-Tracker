import React, { useState, useMemo } from 'react';
import { 
  Plus, 
  Search, 
  Download, 
  Edit2, 
  Trash2, 
  X,
  FileSpreadsheet
} from 'lucide-react';
import type { 
  Transaction, 
  TransactionFilter, 
  TransactionType,
  PaymentMethod 
} from '../types/index.ts';
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES } from '../types/index.ts';
import { filterTransactions } from '../utils/analytics.ts';
import { formatCurrency } from '../utils/currency.ts';

interface TransactionsViewProps {
  transactions: Transaction[];
  onOpenAddModal: () => void;
  onOpenEditModal: (tx: Transaction) => void;
  onDeleteTransaction: (id: string) => void;
}

export function TransactionsView({
  transactions,
  onOpenAddModal,
  onOpenEditModal,
  onDeleteTransaction
}: TransactionsViewProps) {
  const [search, setSearch] = useState('');
  const [type, setType] = useState<TransactionType | 'all'>('all');
  const [category, setCategory] = useState<string>('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [sortBy, setSortBy] = useState<'date_desc' | 'date_asc' | 'amount_desc' | 'amount_asc'>('date_desc');

  const allCategories = useMemo(() => {
    return Array.from(new Set([...EXPENSE_CATEGORIES, ...INCOME_CATEGORIES]));
  }, []);

  const filter: TransactionFilter = useMemo(() => ({
    search: search.trim() || undefined,
    type: type !== 'all' ? type : undefined,
    category: category !== 'all' ? category : undefined,
    startDate: startDate || undefined,
    endDate: endDate || undefined,
    sortBy
  }), [search, type, category, startDate, endDate, sortBy]);

  const filtered = useMemo(() => {
    return filterTransactions(transactions, filter);
  }, [transactions, filter]);

  // Quick stats for filtered subset
  const filteredIncome = useMemo(() => {
    return filtered.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
  }, [filtered]);

  const filteredExpense = useMemo(() => {
    return filtered.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
  }, [filtered]);

  // Export to CSV
  const handleExportCSV = () => {
    if (filtered.length === 0) return;
    const headers = ['ID', 'Date', 'Title', 'Type', 'Category', 'Payment Method', 'Amount', 'Notes'];
    const rows = filtered.map(t => [
      t.id,
      t.date,
      `"${t.title.replace(/"/g, '""')}"`,
      t.type,
      `"${t.category}"`,
      `"${t.payment_method}"`,
      t.amount.toFixed(2),
      `"${(t.notes || '').replace(/"/g, '""')}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `transactions_export_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const hasActiveFilters = search || type !== 'all' || category !== 'all' || startDate || endDate;

  const resetFilters = () => {
    setSearch('');
    setType('all');
    setCategory('all');
    setStartDate('');
    setEndDate('');
    setSortBy('date_desc');
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-zinc-200 dark:border-zinc-800">
        <div>
          <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-100 tracking-tight">
            Transaction Ledger
          </h1>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
            Complete records of cash inflow and outflow with filtering, sorting, and CSV export.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={handleExportCSV}
            disabled={filtered.length === 0}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-zinc-700 dark:text-zinc-300 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-750 transition-colors disabled:opacity-50"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>
          <button
            onClick={onOpenAddModal}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-white dark:text-zinc-900 rounded-lg shadow-xs transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Transaction</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="p-4 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-xs space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Search box */}
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-zinc-400" />
            <input
              type="text"
              placeholder="Search description, notes..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-8 py-1.5 text-xs rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-2.5 top-2 text-zinc-400 hover:text-zinc-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Type dropdown */}
          <div>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as any)}
              className="w-full py-1.5 px-3 text-xs rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100"
            >
              <option value="all">All Types (Income & Expense)</option>
              <option value="expense">Expenses Only</option>
              <option value="income">Income Only</option>
            </select>
          </div>

          {/* Category dropdown */}
          <div>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full py-1.5 px-3 text-xs rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100"
            >
              <option value="all">All Categories</option>
              {allCategories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          {/* Sort order */}
          <div>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="w-full py-1.5 px-3 text-xs rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100"
            >
              <option value="date_desc">Date: Newest First</option>
              <option value="date_asc">Date: Oldest First</option>
              <option value="amount_desc">Amount: Highest First</option>
              <option value="amount_asc">Amount: Lowest First</option>
            </select>
          </div>
        </div>

        {/* Date Filters & Clear Row */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-1 border-t border-zinc-100 dark:border-zinc-800 text-xs">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1.5 text-zinc-500">
              <span>From:</span>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="py-1 px-2 text-xs rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white font-mono"
              />
            </div>
            <div className="flex items-center gap-1.5 text-zinc-500">
              <span>To:</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="py-1 px-2 text-xs rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white font-mono"
              />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-zinc-500 font-mono text-[11px]">
              Showing {filtered.length} of {transactions.length}
            </span>
            {hasActiveFilters && (
              <button
                onClick={resetFilters}
                className="text-xs text-rose-600 dark:text-rose-400 hover:underline flex items-center gap-1"
              >
                <X className="w-3 h-3" />
                <span>Reset Filters</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Filter Totals Strip */}
      <div className="flex flex-wrap items-center justify-between p-3.5 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-xs">
        <div className="flex items-center gap-6">
          <div>
            <span className="text-zinc-500 dark:text-zinc-400">Inflow: </span>
            <span className="text-emerald-600 dark:text-emerald-400 font-semibold">{formatCurrency(filteredIncome, { showSign: true })}</span>
          </div>
          <div>
            <span className="text-zinc-500 dark:text-zinc-400">Outflow: </span>
            <span className="text-rose-600 dark:text-rose-400 font-semibold">-{formatCurrency(filteredExpense)}</span>
          </div>
          <div>
            <span className="text-zinc-500 dark:text-zinc-400">Net Margin: </span>
            <span className={`font-semibold ${filteredIncome >= filteredExpense ? 'text-zinc-900 dark:text-white' : 'text-rose-600 dark:text-rose-400'}`}>
              {formatCurrency(filteredIncome - filteredExpense)}
            </span>
          </div>
        </div>
      </div>

      {/* Transactions Table */}
      <div className="rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-xs overflow-hidden">
        {filtered.length === 0 ? (
          <div className="p-12 text-center text-zinc-500 space-y-2">
            <FileSpreadsheet className="w-8 h-8 mx-auto text-zinc-400" />
            <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              No transactions match your current filters.
            </p>
            <p className="text-xs text-zinc-400">
              Try adjusting your search keywords, category selection, or date range.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-zinc-50 dark:bg-zinc-800/60 text-zinc-500 border-b border-zinc-200 dark:border-zinc-800">
                <tr>
                  <th className="py-3 px-4 font-medium">Date</th>
                  <th className="py-3 px-4 font-medium">Description</th>
                  <th className="py-3 px-4 font-medium">Category</th>
                  <th className="py-3 px-4 font-medium">Method</th>
                  <th className="py-3 px-4 font-medium text-right">Amount</th>
                  <th className="py-3 px-4 font-medium text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800 font-sans">
                {filtered.map((t) => (
                  <tr 
                    key={t.id} 
                    className="hover:bg-zinc-50/70 dark:hover:bg-zinc-800/40 transition-colors"
                  >
                    <td className="py-3 px-4 text-zinc-500 dark:text-zinc-400 font-mono text-[11px] whitespace-nowrap">
                      {t.date}
                    </td>
                    <td className="py-3 px-4 font-medium text-zinc-900 dark:text-white max-w-xs">
                      <span className="truncate block">{t.title}</span>
                      {t.notes && (
                        <div className="text-[11px] text-zinc-400 truncate mt-0.5">
                          {t.notes}
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-4 text-zinc-600 dark:text-zinc-400 whitespace-nowrap">
                      {t.category}
                    </td>
                    <td className="py-3 px-4 text-zinc-500 dark:text-zinc-400 text-[11px] whitespace-nowrap">
                      {t.payment_method}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-medium whitespace-nowrap">
                      <span className={t.type === 'income' ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}>
                        {t.type === 'income' ? '+' : '-'}{formatCurrency(t.amount)}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center whitespace-nowrap">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => onOpenEditModal(t)}
                          className="p-1.5 rounded-md text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                          title="Edit transaction"
                          aria-label={`Edit ${t.title}`}
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => onDeleteTransaction(t.id)}
                          className="p-1.5 rounded-md text-zinc-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                          title="Delete transaction"
                          aria-label={`Delete ${t.title}`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
