import React, { useState, useMemo } from 'react';
import { 
  X, 
  FileText, 
  Download, 
  Calendar, 
  FileSpreadsheet, 
  CheckCircle2, 
  AlertCircle,
  Clock,
  Sparkles
} from 'lucide-react';
import type { Transaction, UserProfile } from '../types/index.ts';
import { exportTransactionsToPdf, exportTransactionsToWord } from '../utils/statementExport.ts';
import { formatCurrency } from '../utils/currency.ts';

interface StatementExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: UserProfile;
  transactions: Transaction[];
  initialStartDate?: string;
  initialEndDate?: string;
}

export function StatementExportModal({
  isOpen,
  onClose,
  user,
  transactions,
  initialStartDate = '',
  initialEndDate = ''
}: StatementExportModalProps) {
  const [startDate, setStartDate] = useState(initialStartDate);
  const [endDate, setEndDate] = useState(initialEndDate);
  const [typeFilter, setTypeFilter] = useState<'all' | 'income' | 'expense'>('all');
  const [format, setFormat] = useState<'pdf' | 'docx' | 'csv'>('pdf');
  const [isExporting, setIsExporting] = useState(false);
  const [exportSuccessMsg, setExportSuccessMsg] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);

  // Sync initial dates if provided
  React.useEffect(() => {
    if (initialStartDate) setStartDate(initialStartDate);
    if (initialEndDate) setEndDate(initialEndDate);
  }, [initialStartDate, initialEndDate]);

  // Quick preset dates
  const handlePreset = (preset: 'this_month' | 'last_30' | 'last_90' | 'fy' | 'all') => {
    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);

    if (preset === 'all') {
      setStartDate('');
      setEndDate('');
      return;
    }

    if (preset === 'this_month') {
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      setStartDate(`${year}-${month}-01`);
      setEndDate(todayStr);
      return;
    }

    if (preset === 'last_30') {
      const past = new Date();
      past.setDate(past.getDate() - 30);
      setStartDate(past.toISOString().slice(0, 10));
      setEndDate(todayStr);
      return;
    }

    if (preset === 'last_90') {
      const past = new Date();
      past.setDate(past.getDate() - 90);
      setStartDate(past.toISOString().slice(0, 10));
      setEndDate(todayStr);
      return;
    }

    if (preset === 'fy') {
      // Indian Financial Year: April 1 to March 31
      const currentYear = now.getFullYear();
      const currentMonth = now.getMonth(); // 0-indexed (April is 3)
      const fyStartYear = currentMonth >= 3 ? currentYear : currentYear - 1;
      setStartDate(`${fyStartYear}-04-01`);
      setEndDate(todayStr);
      return;
    }
  };

  // Filter transactions according to selected date range and type
  const filteredRecords = useMemo(() => {
    return transactions.filter(t => {
      if (startDate && t.date < startDate) return false;
      if (endDate && t.date > endDate) return false;
      if (typeFilter !== 'all' && t.type !== typeFilter) return false;
      return true;
    });
  }, [transactions, startDate, endDate, typeFilter]);

  // Financial summary for matching selection
  const totalInflow = filteredRecords
    .filter(t => t.type === 'income')
    .reduce((sum, t) => sum + t.amount, 0);

  const totalOutflow = filteredRecords
    .filter(t => t.type === 'expense')
    .reduce((sum, t) => sum + t.amount, 0);

  const netSavings = totalInflow - totalOutflow;

  const handleExport = async (selectedFormat: 'pdf' | 'docx' | 'csv' = format) => {
    setExportSuccessMsg(null);
    setExportError(null);

    if (filteredRecords.length === 0) {
      setExportError('No transactions match the selected date range and filter.');
      return;
    }

    try {
      setIsExporting(true);

      if (selectedFormat === 'pdf') {
        await exportTransactionsToPdf({
          user,
          transactions: filteredRecords,
          startDate: startDate || undefined,
          endDate: endDate || undefined
        });
        setExportSuccessMsg('PDF Transaction Statement downloaded successfully.');
      } else if (selectedFormat === 'docx') {
        await exportTransactionsToWord({
          user,
          transactions: filteredRecords,
          startDate: startDate || undefined,
          endDate: endDate || undefined
        });
        setExportSuccessMsg('Word Document (.docx) statement downloaded successfully.');
      } else if (selectedFormat === 'csv') {
        const headers = ['ID', 'Date', 'Title', 'Type', 'Category', 'Payment Method', 'Amount (INR)', 'Notes'];
        const rows = filteredRecords.map(t => [
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
        link.setAttribute('download', `transactions_export_${startDate || 'all'}_to_${endDate || 'all'}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setExportSuccessMsg('CSV spreadsheet downloaded successfully.');
      }
    } catch (err: any) {
      console.error('Export error:', err);
      setExportError(err.message || 'Failed to generate statement.');
    } finally {
      setIsExporting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl max-w-xl w-full overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center border border-indigo-200 dark:border-indigo-900/60">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Extract & Download Transactions Statement
              </h2>
              <p className="text-xs text-slate-500">
                Official statement in PDF or Word document format with Indian Rupee (₹) amounts.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto space-y-5">
          {/* Status Banners */}
          {exportSuccessMsg && (
            <div className="p-3 rounded-lg text-xs font-medium bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{exportSuccessMsg}</span>
            </div>
          )}

          {exportError && (
            <div className="p-3 rounded-lg text-xs font-medium bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{exportError}</span>
            </div>
          )}

          {/* Quick Preset Buttons */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
              Quick Date Presets
            </label>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => handlePreset('this_month')}
                className="px-2.5 py-1 text-xs rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-indigo-50 hover:text-indigo-600 dark:hover:bg-indigo-950/60 dark:hover:text-indigo-400 transition-colors"
              >
                This Month
              </button>
              <button
                type="button"
                onClick={() => handlePreset('last_30')}
                className="px-2.5 py-1 text-xs rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-indigo-50 hover:text-indigo-600 dark:hover:bg-indigo-950/60 dark:hover:text-indigo-400 transition-colors"
              >
                Last 30 Days
              </button>
              <button
                type="button"
                onClick={() => handlePreset('last_90')}
                className="px-2.5 py-1 text-xs rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-indigo-50 hover:text-indigo-600 dark:hover:bg-indigo-950/60 dark:hover:text-indigo-400 transition-colors"
              >
                Last 3 Months
              </button>
              <button
                type="button"
                onClick={() => handlePreset('fy')}
                className="px-2.5 py-1 text-xs rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-indigo-50 hover:text-indigo-600 dark:hover:bg-indigo-950/60 dark:hover:text-indigo-400 transition-colors"
              >
                Financial Year (FY)
              </button>
              <button
                type="button"
                onClick={() => handlePreset('all')}
                className="px-2.5 py-1 text-xs rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-indigo-50 hover:text-indigo-600 dark:hover:bg-indigo-950/60 dark:hover:text-indigo-400 transition-colors"
              >
                All Time
              </button>
            </div>
          </div>

          {/* Date Range Selection */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="export-start-date" className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Start Date (Inclusive)
              </label>
              <div className="relative">
                <input
                  id="export-start-date"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>
            </div>

            <div>
              <label htmlFor="export-end-date" className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                End Date (Inclusive)
              </label>
              <div className="relative">
                <input
                  id="export-end-date"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>
            </div>
          </div>

          {/* Transaction Type Filter */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Include In Statement
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setTypeFilter('all')}
                className={`py-2 px-3 text-xs rounded-lg border text-center font-medium transition-all ${
                  typeFilter === 'all'
                    ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 shadow-xs'
                    : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                }`}
              >
                All (Income & Outlay)
              </button>
              <button
                type="button"
                onClick={() => setTypeFilter('expense')}
                className={`py-2 px-3 text-xs rounded-lg border text-center font-medium transition-all ${
                  typeFilter === 'expense'
                    ? 'border-rose-600 bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 shadow-xs'
                    : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                }`}
              >
                Expenses Only
              </button>
              <button
                type="button"
                onClick={() => setTypeFilter('income')}
                className={`py-2 px-3 text-xs rounded-lg border text-center font-medium transition-all ${
                  typeFilter === 'income'
                    ? 'border-emerald-600 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 shadow-xs'
                    : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                }`}
              >
                Income Only
              </button>
            </div>
          </div>

          {/* Live Preview Summary Strip */}
          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800 space-y-2">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-800 dark:text-slate-200">
              <span className="flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
                Live Extraction Preview
              </span>
              <span className="font-mono text-indigo-600 dark:text-indigo-400">
                {filteredRecords.length} records matching
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2 pt-1 font-mono text-xs">
              <div className="p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800">
                <div className="text-[10px] text-slate-500 font-sans">Total Inflow</div>
                <div className="font-semibold text-emerald-600 dark:text-emerald-400 mt-0.5 truncate">
                  {formatCurrency(totalInflow, { showSign: true })}
                </div>
              </div>

              <div className="p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800">
                <div className="text-[10px] text-slate-500 font-sans">Total Outflow</div>
                <div className="font-semibold text-rose-600 dark:text-rose-400 mt-0.5 truncate">
                  -{formatCurrency(totalOutflow)}
                </div>
              </div>

              <div className="p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800">
                <div className="text-[10px] text-slate-500 font-sans">Net Margin</div>
                <div className={`font-semibold mt-0.5 truncate ${netSavings >= 0 ? 'text-indigo-600 dark:text-indigo-400' : 'text-rose-600'}`}>
                  {formatCurrency(netSavings)}
                </div>
              </div>
            </div>
          </div>

          {/* Document Format Cards */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
              Select Output Document Format
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* PDF Format Card */}
              <div
                onClick={() => setFormat('pdf')}
                className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                  format === 'pdf'
                    ? 'border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/30 ring-1 ring-indigo-600'
                    : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center font-bold text-xs shrink-0">
                    PDF
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-900 dark:text-white">
                      PDF Statement Document
                    </div>
                    <div className="text-[11px] text-slate-500">
                      Standard banking layout, colored KPI cards & ledger table
                    </div>
                  </div>
                </div>
              </div>

              {/* Word Format Card */}
              <div
                onClick={() => setFormat('docx')}
                className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                  format === 'docx'
                    ? 'border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/30 ring-1 ring-indigo-600'
                    : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold text-xs shrink-0">
                    DOCX
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-900 dark:text-white">
                      Word Document (.docx)
                    </div>
                    <div className="text-[11px] text-slate-500">
                      Editable Microsoft Word statement with ₹ currency formatting
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer Actions */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-850 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-[11px] text-slate-400">
            {startDate || endDate ? `Filtered: ${startDate || 'earliest'} to ${endDate || 'latest'}` : 'Exporting all recorded transactions'}
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-slate-700 rounded-lg transition-colors"
            >
              Cancel
            </button>

            <button
              type="button"
              disabled={isExporting || filteredRecords.length === 0}
              onClick={() => handleExport(format)}
              className="inline-flex items-center justify-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 rounded-lg shadow-sm transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              <span>
                {isExporting 
                  ? 'Generating Statement...' 
                  : `Download ${format === 'pdf' ? 'PDF Statement' : 'Word Document'}`}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
