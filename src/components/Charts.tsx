import React, { useState } from 'react';
import type { MonthlyTrend, CategorySummary, DayOfWeekPattern } from '../types/index.ts';
import { formatCurrency } from '../utils/currency.ts';

interface MonthlyBarChartProps {
  data: MonthlyTrend[];
}

export function MonthlyBarChart({ data }: MonthlyBarChartProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  if (!data || data.length === 0) {
    return (
      <div className="flex h-56 items-center justify-center rounded-xl border border-dashed border-zinc-200 dark:border-zinc-800 text-sm text-zinc-500">
        No monthly historical data recorded yet.
      </div>
    );
  }

  const maxVal = Math.max(...data.map(d => Math.max(d.income, d.expense)), 100);
  const chartHeight = 180;
  const barWidth = 14;
  const gap = 32;
  const chartWidth = Math.max(data.length * (barWidth * 2 + gap) + 60, 480);

  return (
    <div className="w-full overflow-x-auto">
      <div style={{ minWidth: `${chartWidth}px` }} className="relative">
        <svg height={chartHeight + 40} width="100%" viewBox={`0 0 ${chartWidth} ${chartHeight + 40}`} className="overflow-visible font-sans">
          {/* Grid lines */}
          {[0, 0.25, 0.5, 0.75, 1].map((pct, i) => {
            const y = chartHeight - pct * chartHeight + 10;
            const val = Math.round(maxVal * pct);
            return (
              <g key={i}>
                <line x1="45" y1={y} x2={chartWidth - 10} y2={y} stroke="currentColor" strokeOpacity={0.08} />
                <text x="38" y={y + 4} textAnchor="end" className="text-[10px] fill-zinc-400 font-mono">
                  ₹{val.toLocaleString('en-IN')}
                </text>
              </g>
            );
          })}

          {/* Bars */}
          {data.map((item, idx) => {
            const groupX = 60 + idx * (barWidth * 2 + gap);
            const incomeH = (item.income / maxVal) * chartHeight;
            const expenseH = (item.expense / maxVal) * chartHeight;
            const isHovered = hoveredIndex === idx;

            return (
              <g
                key={item.month}
                onMouseEnter={() => setHoveredIndex(idx)}
                onMouseLeave={() => setHoveredIndex(null)}
                className="cursor-pointer transition-opacity"
              >
                {/* Income Bar (Emerald) */}
                <rect
                  x={groupX}
                  y={chartHeight - incomeH + 10}
                  width={barWidth}
                  height={Math.max(incomeH, 2)}
                  rx="3"
                  className="fill-emerald-600 hover:fill-emerald-500 transition-colors"
                />

                {/* Expense Bar (Rose) */}
                <rect
                  x={groupX + barWidth + 4}
                  y={chartHeight - expenseH + 10}
                  width={barWidth}
                  height={Math.max(expenseH, 2)}
                  rx="3"
                  className="fill-rose-500 hover:fill-rose-400 transition-colors"
                />

                {/* Month label */}
                <text
                  x={groupX + barWidth + 2}
                  y={chartHeight + 28}
                  textAnchor="middle"
                  className={`text-[11px] ${isHovered ? 'fill-zinc-900 dark:fill-white font-semibold' : 'fill-zinc-500 dark:fill-zinc-400'}`}
                >
                  {item.label.split(' ')[0]}
                </text>
              </g>
            );
          })}
        </svg>

        {/* Hover Tooltip */}
        {hoveredIndex !== null && data[hoveredIndex] && (
          <div
            className="absolute -top-3 z-10 pointer-events-none rounded-lg bg-zinc-900 px-3 py-2 text-xs text-white shadow-xl dark:bg-zinc-800 border border-zinc-700"
            style={{
              left: `${Math.min(chartWidth - 140, Math.max(10, 60 + hoveredIndex * (barWidth * 2 + gap) - 30))}px`
            }}
          >
            <div className="font-semibold text-zinc-200 mb-1">{data[hoveredIndex].label}</div>
            <div className="flex items-center gap-1.5 text-emerald-400">
              <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" />
              Inflow: {formatCurrency(data[hoveredIndex].income)}
            </div>
            <div className="flex items-center gap-1.5 text-rose-400">
              <span className="w-2 h-2 rounded-full bg-rose-400 inline-block" />
              Outflow: {formatCurrency(data[hoveredIndex].expense)}
            </div>
            <div className="text-zinc-400 text-[10px] mt-1 border-t border-zinc-700 pt-0.5">
              Net Margin: {formatCurrency(data[hoveredIndex].income - data[hoveredIndex].expense)}
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center justify-center gap-6 mt-3 text-xs text-zinc-600 dark:text-zinc-400">
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded bg-emerald-600 inline-block" />
          <span>Inflow</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded bg-rose-500 inline-block" />
          <span>Outflow</span>
        </div>
      </div>
    </div>
  );
}

interface CategoryDistributionProps {
  data: CategorySummary[];
}

const CATEGORY_COLORS = [
  'bg-emerald-600',
  'bg-teal-600',
  'bg-amber-500',
  'bg-rose-500',
  'bg-sky-600',
  'bg-violet-600',
  'bg-orange-500',
  'bg-zinc-600'
];

export function CategoryDistribution({ data }: CategoryDistributionProps) {
  if (!data || data.length === 0) {
    return (
      <div className="flex h-48 items-center justify-center rounded-xl border border-dashed border-zinc-200 dark:border-zinc-800 text-sm text-zinc-500">
        No expense data recorded to categorize.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Visual horizontal split bar */}
      <div className="h-3 w-full rounded-full overflow-hidden flex bg-zinc-100 dark:bg-zinc-800">
        {data.map((cat, idx) => (
          <div
            key={cat.category}
            style={{ width: `${Math.max(cat.percentage, 1.5)}%` }}
            className={`${CATEGORY_COLORS[idx % CATEGORY_COLORS.length]} h-full transition-all`}
            title={`${cat.category}: ${cat.percentage}% (${formatCurrency(cat.total)})`}
          />
        ))}
      </div>

      {/* Category List */}
      <div className="space-y-2.5">
        {data.slice(0, 6).map((cat, idx) => (
          <div key={cat.category} className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-2 min-w-0">
              <span className={`w-2 h-2 rounded-full shrink-0 ${CATEGORY_COLORS[idx % CATEGORY_COLORS.length]}`} />
              <span className="truncate font-medium text-zinc-700 dark:text-zinc-300">
                {cat.category}
              </span>
              <span className="text-zinc-400 text-[11px]">({cat.count} tx)</span>
            </div>
            <div className="flex items-center gap-3 shrink-0 font-mono">
              <span className="text-zinc-900 dark:text-zinc-100 font-medium">{formatCurrency(cat.total)}</span>
              <span className="w-10 text-right text-zinc-500 dark:text-zinc-400">{cat.percentage}%</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

interface DayOfWeekChartProps {
  data: DayOfWeekPattern[];
}

export function DayOfWeekChart({ data }: DayOfWeekChartProps) {
  if (!data || data.length === 0) return null;

  const maxVal = Math.max(...data.map(d => d.totalExpense), 50);

  return (
    <div className="grid grid-cols-7 gap-2 pt-2">
      {data.map((day) => {
        const heightPct = maxVal > 0 ? (day.totalExpense / maxVal) * 100 : 0;
        const isWeekend = day.dayIndex === 0 || day.dayIndex === 6;

        return (
          <div key={day.dayName} className="flex flex-col items-center gap-1.5 text-center">
            <div className="h-28 w-full bg-zinc-100 dark:bg-zinc-800/60 rounded-lg flex flex-col justify-end p-1 relative group">
              <div
                style={{ height: `${Math.max(heightPct, 4)}%` }}
                className={`w-full rounded-sm transition-all ${
                  isWeekend 
                    ? 'bg-amber-500/80 group-hover:bg-amber-500' 
                    : 'bg-zinc-700 dark:bg-zinc-300 group-hover:bg-zinc-900 dark:group-hover:bg-white'
                }`}
              />
              {/* Tooltip on hover */}
              <div className="absolute bottom-full mb-1 hidden group-hover:block z-20 whitespace-nowrap bg-zinc-900 text-white text-[10px] rounded px-2 py-1 shadow-lg pointer-events-none">
                {day.dayName}: {formatCurrency(day.totalExpense)} ({day.transactionCount} tx)
              </div>
            </div>
            <span className="text-[11px] font-medium text-zinc-600 dark:text-zinc-400">
              {day.dayName.slice(0, 3)}
            </span>
            <span className="text-[10px] font-mono text-zinc-500 dark:text-zinc-400">
              {formatCurrency(Math.round(day.totalExpense), { decimals: 0 })}
            </span>
          </div>
        );
      })}
    </div>
  );
}
