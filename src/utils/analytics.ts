import type { 
  Transaction, 
  SavingsTransaction, 
  FinancialSummary, 
  CategorySummary, 
  MonthlyTrend, 
  DayOfWeekPattern, 
  SpendingInsight,
  TransactionFilter 
} from '../types/index.ts';

/**
 * Calculates current liquid balance and savings balance without double-counting.
 * Transfers to savings (source === 'balance') deduct from liquid balance.
 * Withdrawals to main balance (source === 'balance') credit liquid balance.
 */
export function calculateFinancialSummary(
  transactions: Transaction[],
  savingsTransactions: SavingsTransaction[] = []
): FinancialSummary {
  let totalIncome = 0;
  let totalExpense = 0;

  for (const t of transactions) {
    if (t.type === 'income') {
      totalIncome += t.amount;
    } else if (t.type === 'expense') {
      totalExpense += t.amount;
    }
  }

  let totalSavingsDeposited = 0;
  let totalSavingsWithdrawn = 0;
  let internalTransfersToSavings = 0;
  let internalTransfersFromSavings = 0;

  for (const st of savingsTransactions) {
    if (st.type === 'deposit') {
      totalSavingsDeposited += st.amount;
      if (st.source === 'balance') {
        internalTransfersToSavings += st.amount;
      }
    } else if (st.type === 'withdrawal') {
      totalSavingsWithdrawn += st.amount;
      if (st.source === 'balance') {
        internalTransfersFromSavings += st.amount;
      }
    }
  }

  const savingsBalance = Math.max(0, totalSavingsDeposited - totalSavingsWithdrawn);
  
  // Liquid balance = Income - Expenses - Internal savings deposits + Internal savings withdrawals
  const mainBalance = totalIncome - totalExpense - internalTransfersToSavings + internalTransfersFromSavings;

  const savingsRate = totalIncome > 0 
    ? Math.max(0, Math.min(100, Math.round(((totalIncome - totalExpense) / totalIncome) * 100))) 
    : 0;

  return {
    mainBalance: Math.round(mainBalance * 100) / 100,
    totalIncome: Math.round(totalIncome * 100) / 100,
    totalExpense: Math.round(totalExpense * 100) / 100,
    savingsBalance: Math.round(savingsBalance * 100) / 100,
    totalSavingsDeposited: Math.round(totalSavingsDeposited * 100) / 100,
    totalSavingsWithdrawn: Math.round(totalSavingsWithdrawn * 100) / 100,
    savingsRate
  };
}

/**
 * Filters and sorts transactions deterministically.
 */
export function filterTransactions(
  transactions: Transaction[],
  filter: TransactionFilter
): Transaction[] {
  return transactions.filter(t => {
    if (filter.type && filter.type !== 'all' && t.type !== filter.type) {
      return false;
    }
    if (filter.category && filter.category !== 'all' && t.category !== filter.category) {
      return false;
    }
    if (filter.paymentMethod && filter.paymentMethod !== 'all' && t.payment_method !== filter.paymentMethod) {
      return false;
    }
    if (filter.startDate && t.date < filter.startDate) {
      return false;
    }
    if (filter.endDate && t.date > filter.endDate) {
      return false;
    }
    if (filter.searchQuery) {
      const q = filter.searchQuery.toLowerCase();
      const matchTitle = t.title.toLowerCase().includes(q);
      const matchCategory = t.category.toLowerCase().includes(q);
      const matchNotes = t.notes ? t.notes.toLowerCase().includes(q) : false;
      const matchAmount = t.amount.toString().includes(q);
      if (!matchTitle && !matchCategory && !matchNotes && !matchAmount) {
        return false;
      }
    }
    return true;
  }).sort((a, b) => {
    switch (filter.sortBy) {
      case 'date_asc':
        return a.date.localeCompare(b.date) || a.created_at.localeCompare(b.created_at);
      case 'amount_desc':
        return b.amount - a.amount;
      case 'amount_asc':
        return a.amount - b.amount;
      case 'date_desc':
      default:
        return b.date.localeCompare(a.date) || b.created_at.localeCompare(a.created_at);
    }
  });
}

/**
 * Computes expense distribution grouped by category.
 */
export function calculateCategoryBreakdown(transactions: Transaction[]): CategorySummary[] {
  const expenseTransactions = transactions.filter(t => t.type === 'expense');
  const totalExpense = expenseTransactions.reduce((sum, t) => sum + t.amount, 0);

  if (totalExpense === 0) return [];

  const map = new Map<string, { total: number; count: number }>();

  for (const t of expenseTransactions) {
    const existing = map.get(t.category) || { total: 0, count: 0 };
    existing.total += t.amount;
    existing.count += 1;
    map.set(t.category, existing);
  }

  const results: CategorySummary[] = [];
  for (const [category, data] of map.entries()) {
    results.push({
      category,
      total: Math.round(data.total * 100) / 100,
      count: data.count,
      percentage: Math.round((data.total / totalExpense) * 1000) / 10,
      average: Math.round((data.total / data.count) * 100) / 100
    });
  }

  return results.sort((a, b) => b.total - a.total);
}

/**
 * Groups financial data into monthly buckets (YYYY-MM).
 */
export function calculateMonthlyTrends(transactions: Transaction[]): MonthlyTrend[] {
  if (transactions.length === 0) return [];

  const map = new Map<string, { income: number; expense: number }>();

  for (const t of transactions) {
    const monthKey = t.date.slice(0, 7); // YYYY-MM
    const existing = map.get(monthKey) || { income: 0, expense: 0 };
    if (t.type === 'income') {
      existing.income += t.amount;
    } else {
      existing.expense += t.amount;
    }
    map.set(monthKey, existing);
  }

  const sortedMonths = Array.from(map.keys()).sort();
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  return sortedMonths.map(month => {
    const data = map.get(month)!;
    const [year, m] = month.split('-');
    const monthIndex = parseInt(m, 10) - 1;
    const label = `${monthNames[monthIndex]} ${year}`;
    const net = Math.round((data.income - data.expense) * 100) / 100;

    return {
      month,
      label,
      income: Math.round(data.income * 100) / 100,
      expense: Math.round(data.expense * 100) / 100,
      savings: Math.max(0, net),
      net
    };
  });
}

/**
 * Computes day-of-week spending patterns (Sunday=0 to Saturday=6).
 */
export function calculateDayOfWeekPattern(transactions: Transaction[]): DayOfWeekPattern[] {
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const accumulators = dayNames.map((dayName, idx) => ({
    dayName,
    dayIndex: idx,
    totalExpense: 0,
    transactionCount: 0,
    averageExpense: 0
  }));

  const expenseTx = transactions.filter(t => t.type === 'expense');

  for (const t of expenseTx) {
    // Note: t.date is YYYY-MM-DD
    const dateObj = new Date(`${t.date}T12:00:00Z`);
    const day = dateObj.getUTCDay();
    accumulators[day].totalExpense += t.amount;
    accumulators[day].transactionCount += 1;
  }

  for (const item of accumulators) {
    item.totalExpense = Math.round(item.totalExpense * 100) / 100;
    item.averageExpense = item.transactionCount > 0 
      ? Math.round((item.totalExpense / item.transactionCount) * 100) / 100 
      : 0;
  }

  return accumulators;
}

/**
 * Algorithmic Pattern Analysis (Rule-Based EDA).
 * Generates verified insights only from actual transactions, without fabrication.
 */
export function generateSpendingInsights(transactions: Transaction[]): SpendingInsight[] {
  const insights: SpendingInsight[] = [];
  const expenses = transactions.filter(t => t.type === 'expense');

  if (expenses.length < 3) {
    insights.push({
      id: 'insufficient-data',
      type: 'info',
      title: 'Awaiting Historical Spending Data',
      description: 'Record at least 3 transactions to unlock comparative spending patterns and trend detection.',
      evidence: `Currently recorded: ${expenses.length} expense transaction(s).`,
      severity: 'neutral'
    });
    return insights;
  }

  // 1. Month-over-Month Comparison
  const monthlyTrends = calculateMonthlyTrends(transactions);
  if (monthlyTrends.length >= 2) {
    const currentMonth = monthlyTrends[monthlyTrends.length - 1];
    const prevMonth = monthlyTrends[monthlyTrends.length - 2];

    const diff = currentMonth.expense - prevMonth.expense;
    if (prevMonth.expense > 0) {
      const pctChange = Math.round((diff / prevMonth.expense) * 100);
      if (Math.abs(pctChange) >= 5) {
        if (pctChange > 0) {
          insights.push({
            id: 'mom-expense-increase',
            type: 'increase',
            title: `Monthly Spending Rose by ${pctChange}%`,
            description: `You spent ${formatCurrency(currentMonth.expense)} in ${currentMonth.label} compared to ${formatCurrency(prevMonth.expense)} in ${prevMonth.label}.`,
            evidence: `Variance: +${formatCurrency(diff)} (+${pctChange}%)`,
            severity: 'warning'
          });
        } else {
          insights.push({
            id: 'mom-expense-decrease',
            type: 'decrease',
            title: `Monthly Spending Decreased by ${Math.abs(pctChange)}%`,
            description: `Expenditure decreased from ${formatCurrency(prevMonth.expense)} in ${prevMonth.label} to ${formatCurrency(currentMonth.expense)} in ${currentMonth.label}.`,
            evidence: `Savings gained: ${formatCurrency(Math.abs(diff))} (${pctChange}%)`,
            severity: 'positive'
          });
        }
      }
    }
  }

  // 2. Highest Spending Category Dominance
  const categoryBreakdown = calculateCategoryBreakdown(transactions);
  if (categoryBreakdown.length > 0) {
    const top = categoryBreakdown[0];
    if (top.percentage >= 35) {
      insights.push({
        id: 'category-dominance',
        type: 'pattern',
        title: `${top.category} Dominates Expenses (${top.percentage}%)`,
        description: `More than one-third of your overall spending goes towards ${top.category}.`,
        evidence: `Total: ${formatCurrency(top.total)} across ${top.count} transactions.`,
        severity: top.percentage >= 50 ? 'warning' : 'neutral'
      });
    }
  }

  // 3. Weekend vs Weekday Outlay Pattern (Classic EDA feature)
  const dayPatterns = calculateDayOfWeekPattern(transactions);
  const weekendSpend = dayPatterns[0].totalExpense + dayPatterns[6].totalExpense; // Sun + Sat
  const weekdaySpend = dayPatterns.slice(1, 6).reduce((acc, d) => acc + d.totalExpense, 0);

  const weekendDailyAvg = weekendSpend / 2;
  const weekdayDailyAvg = weekdaySpend / 5;

  if (weekendDailyAvg > 0 && weekdayDailyAvg > 0) {
    const ratio = weekendDailyAvg / weekdayDailyAvg;
    if (ratio >= 1.35) {
      const surplusPct = Math.round((ratio - 1) * 100);
      insights.push({
        id: 'weekend-surge',
        type: 'pattern',
        title: `Weekend Spending Surge Detected (+${surplusPct}%)`,
        description: `Average daily spending on weekends (${formatCurrency(weekendDailyAvg)}) significantly exceeds weekdays (${formatCurrency(weekdayDailyAvg)}).`,
        evidence: `Saturday & Sunday accounted for ${formatCurrency(weekendSpend)} total.`,
        severity: 'neutral'
      });
    }
  }

  // 4. Outlier Transaction Detection (Statistical threshold)
  const amounts = expenses.map(e => e.amount);
  const mean = amounts.reduce((a, b) => a + b, 0) / amounts.length;
  const outlierThreshold = mean * 2.2;
  const outliers = expenses.filter(e => e.amount >= outlierThreshold && e.amount >= 200);

  if (outliers.length > 0) {
    const largest = outliers.reduce((prev, curr) => curr.amount > prev.amount ? curr : prev);
    insights.push({
      id: 'outlier-expense',
      type: 'anomaly',
      title: `Single Largest Outlay: "${largest.title}"`,
      description: `A single expense of ${formatCurrency(largest.amount)} was recorded on ${largest.date} (${largest.category}), which is ${Math.round(largest.amount / mean)}x higher than your average expense (${formatCurrency(mean)}).`,
      evidence: `Transaction ID: ${largest.id.slice(0, 8)}...`,
      severity: 'warning'
    });
  }

  // 5. Savings Rate Assessment
  const summary = calculateFinancialSummary(transactions);
  if (summary.totalIncome > 0) {
    if (summary.savingsRate >= 25) {
      insights.push({
        id: 'healthy-savings-rate',
        type: 'milestone',
        title: `Strong Net Savings Rate: ${summary.savingsRate}%`,
        description: `You are retaining ${summary.savingsRate}% of recorded income after accounting for all expenditures.`,
        evidence: `Income: ${formatCurrency(summary.totalIncome)} | Net Retained: ${formatCurrency(summary.totalIncome - summary.totalExpense)}`,
        severity: 'positive'
      });
    } else if (summary.savingsRate < 5 && summary.totalExpense > 0) {
      insights.push({
        id: 'low-savings-alert',
        type: 'pattern',
        title: `Expenses Consuming >95% of Income`,
        description: `Your current expenditure represents ${Math.round((summary.totalExpense / summary.totalIncome) * 100)}% of your recorded income.`,
        evidence: `Remaining margin: ${formatCurrency(summary.totalIncome - summary.totalExpense)}`,
        severity: 'warning'
      });
    }
  }

  return insights;
}

function formatCurrency(val: number): string {
  return `₹${val.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
