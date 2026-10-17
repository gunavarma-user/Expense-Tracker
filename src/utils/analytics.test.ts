import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateFinancialSummary,
  calculateCategoryBreakdown,
  calculateMonthlyTrends,
  calculateDayOfWeekPattern,
  generateSpendingInsights,
  filterTransactions
} from './analytics.ts';
import type { Transaction, SavingsTransaction } from '../types/index.ts';

const dummyTransactions: Transaction[] = [
  {
    id: 'tx-1',
    user_id: 'user-1',
    date: '2026-09-05',
    title: 'Monthly Allowance',
    amount: 1000,
    type: 'income',
    category: 'Monthly Allowance',
    payment_method: 'Net Banking',
    created_at: '2026-09-05T10:00:00Z',
    updated_at: '2026-09-05T10:00:00Z'
  },
  {
    id: 'tx-2',
    user_id: 'user-1',
    date: '2026-09-06',
    title: 'Campus Canteen Lunch',
    amount: 50,
    type: 'expense',
    category: 'Food & Canteen',
    payment_method: 'UPI / QR',
    created_at: '2026-09-06T12:00:00Z',
    updated_at: '2026-09-06T12:00:00Z'
  },
  {
    id: 'tx-3',
    user_id: 'user-1',
    date: '2026-09-12',
    title: 'Textbook Purchase',
    amount: 150,
    type: 'expense',
    category: 'Books & Stationery',
    payment_method: 'Debit Card',
    created_at: '2026-09-12T14:00:00Z',
    updated_at: '2026-09-12T14:00:00Z'
  },
  {
    id: 'tx-4',
    user_id: 'user-1',
    date: '2026-10-01',
    title: 'Freelance Design Stipend',
    amount: 1200,
    type: 'income',
    category: 'Freelance / Project Stipend',
    payment_method: 'Net Banking',
    created_at: '2026-10-01T09:00:00Z',
    updated_at: '2026-10-01T09:00:00Z'
  },
  {
    id: 'tx-5',
    user_id: 'user-1',
    date: '2026-10-03', // Saturday
    title: 'Weekend Group Dinner',
    amount: 180,
    type: 'expense',
    category: 'Food & Canteen',
    payment_method: 'UPI / QR',
    created_at: '2026-10-03T20:00:00Z',
    updated_at: '2026-10-03T20:00:00Z'
  },
  {
    id: 'tx-6',
    user_id: 'user-1',
    date: '2026-10-10', // Saturday
    title: 'Semester Lab Kit Outlier',
    amount: 600,
    type: 'expense',
    category: 'Tuition & Lab Fees',
    payment_method: 'Debit Card',
    created_at: '2026-10-10T11:00:00Z',
    updated_at: '2026-10-10T11:00:00Z'
  }
];

const dummySavings: SavingsTransaction[] = [
  {
    id: 'stx-1',
    user_id: 'user-1',
    date: '2026-09-07',
    type: 'deposit',
    amount: 200,
    description: 'Initial Emergency Fund Deposit',
    source: 'balance', // transferred from main balance
    created_at: '2026-09-07T10:00:00Z'
  },
  {
    id: 'stx-2',
    user_id: 'user-1',
    date: '2026-10-05',
    type: 'withdrawal',
    amount: 50,
    description: 'Emergency Lab Printout',
    source: 'balance', // returned to main balance
    created_at: '2026-10-05T10:00:00Z'
  }
];

test('calculateFinancialSummary computes balance correctly without double-counting transfers', () => {
  const summary = calculateFinancialSummary(dummyTransactions, dummySavings);

  // Income: 1000 + 1200 = 2200
  assert.equal(summary.totalIncome, 2200);

  // Expenses: 50 + 150 + 180 + 600 = 980
  assert.equal(summary.totalExpense, 980);

  // Savings balance: 200 deposited - 50 withdrawn = 150
  assert.equal(summary.savingsBalance, 150);
  assert.equal(summary.totalSavingsDeposited, 200);
  assert.equal(summary.totalSavingsWithdrawn, 50);

  // Main balance: Income (2200) - Expenses (980) - Transfer to savings (200) + Transfer from savings (50) = 1070
  assert.equal(summary.mainBalance, 1070);

  // Savings rate: (2200 - 980) / 2200 = 1220 / 2200 = 55.45% -> 55%
  assert.equal(summary.savingsRate, 55);
});

test('calculateCategoryBreakdown groups and sorts categories properly', () => {
  const breakdown = calculateCategoryBreakdown(dummyTransactions);

  assert.equal(breakdown.length, 3);
  // Highest is Tuition & Lab Fees (600)
  assert.equal(breakdown[0].category, 'Tuition & Lab Fees');
  assert.equal(breakdown[0].total, 600);
  assert.equal(breakdown[0].count, 1);

  // Second is Food & Canteen (50 + 180 = 230)
  assert.equal(breakdown[1].category, 'Food & Canteen');
  assert.equal(breakdown[1].total, 230);
  assert.equal(breakdown[1].count, 2);

  // Third is Books & Stationery (150)
  assert.equal(breakdown[2].category, 'Books & Stationery');
  assert.equal(breakdown[2].total, 150);

  const sumPercentages = breakdown.reduce((acc, c) => acc + c.percentage, 0);
  assert.ok(Math.abs(sumPercentages - 100) < 0.5, 'Percentages should sum to approximately 100%');
});

test('calculateMonthlyTrends groups by month in chronological order', () => {
  const trends = calculateMonthlyTrends(dummyTransactions);

  assert.equal(trends.length, 2);
  assert.equal(trends[0].month, '2026-09');
  assert.equal(trends[0].income, 1000);
  assert.equal(trends[0].expense, 200); // 50 + 150
  assert.equal(trends[0].net, 800);

  assert.equal(trends[1].month, '2026-10');
  assert.equal(trends[1].income, 1200);
  assert.equal(trends[1].expense, 780); // 180 + 600
  assert.equal(trends[1].net, 420);
});

test('calculateDayOfWeekPattern calculates expense distribution for all 7 days', () => {
  const pattern = calculateDayOfWeekPattern(dummyTransactions);
  assert.equal(pattern.length, 7);
  // Total of all days must equal total expenses: 980
  const total = pattern.reduce((acc, d) => acc + d.totalExpense, 0);
  assert.equal(total, 980);
});

test('generateSpendingInsights discovers anomalies and trends without hallucination', () => {
  const insights = generateSpendingInsights(dummyTransactions);
  assert.ok(insights.length > 0);

  // Should detect month-over-month increase from Sep (200) to Oct (780)
  const mom = insights.find(i => i.id === 'mom-expense-increase');
  assert.ok(mom, 'Should detect month-over-month expense increase');

  // Should detect the $600 outlier
  const outlier = insights.find(i => i.id === 'outlier-expense');
  assert.ok(outlier, 'Should detect statistical expense outlier');

  // Should detect healthy savings rate
  const savings = insights.find(i => i.id === 'healthy-savings-rate');
  assert.ok(savings, 'Should detect healthy net savings rate');
});

test('filterTransactions filters correctly by type, category, and date', () => {
  const onlyIncome = filterTransactions(dummyTransactions, { type: 'income' });
  assert.equal(onlyIncome.length, 2);

  const onlyFood = filterTransactions(dummyTransactions, { category: 'Food & Canteen' });
  assert.equal(onlyFood.length, 2);

  const searchStipend = filterTransactions(dummyTransactions, { searchQuery: 'stipend' });
  assert.equal(searchStipend.length, 1);
  assert.equal(searchStipend[0].title, 'Freelance Design Stipend');
});
