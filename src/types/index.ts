export interface UserProfile {
  id: string;
  username: string;
  email: string | null;
  email_verified: boolean;
  phone: string | null;
  phone_verified: boolean;
  has_savings_password: boolean;
  savings_unlocked?: boolean;
  created_at: string;
}

export type TransactionType = 'income' | 'expense';

export type PaymentMethod = 
  | 'UPI / QR' 
  | 'Cash' 
  | 'Debit Card' 
  | 'Credit Card' 
  | 'Net Banking';

export const EXPENSE_CATEGORIES = [
  'Food & Canteen',
  'Tuition & Lab Fees',
  'Books & Stationery',
  'Transport & Metro',
  'Hostel & Rent',
  'Tech & Subscriptions',
  'Healthcare & Fitness',
  'Entertainment & Leisure',
  'Shopping & Apparel',
  'Miscellaneous'
] as const;

export const INCOME_CATEGORIES = [
  'Freelance / Project Stipend',
  'Monthly Allowance',
  'Scholarship / Grant',
  'Part-time Tutoring',
  'Prize Money / Hackathon',
  'Investment / Returns',
  'Other Income'
] as const;

export type Category = 
  | typeof EXPENSE_CATEGORIES[number] 
  | typeof INCOME_CATEGORIES[number] 
  | string;

export interface Transaction {
  id: string;
  user_id: string;
  date: string; // YYYY-MM-DD
  title: string;
  amount: number;
  type: TransactionType;
  category: Category;
  payment_method: PaymentMethod;
  notes?: string;
  is_sample?: boolean;
  created_at: string;
  updated_at: string;
}

export type SavingsTransactionType = 'deposit' | 'withdrawal';
export type SavingsSource = 'balance' | 'external';

export interface SavingsTransaction {
  id: string;
  user_id: string;
  date: string; // YYYY-MM-DD
  type: SavingsTransactionType;
  amount: number;
  description: string;
  source: SavingsSource; // 'balance' means money moved to/from main account
  created_at: string;
}

export interface FinancialSummary {
  mainBalance: number;
  totalIncome: number;
  totalExpense: number;
  savingsBalance: number;
  totalSavingsDeposited: number;
  totalSavingsWithdrawn: number;
  savingsRate: number; // percentage (0-100)
}

export interface CategorySummary {
  category: string;
  total: number;
  count: number;
  percentage: number;
  average: number;
}

export interface MonthlyTrend {
  month: string; // YYYY-MM
  label: string; // e.g. "Sep 2026"
  income: number;
  expense: number;
  savings: number;
  net: number;
}

export interface DayOfWeekPattern {
  dayName: string; // "Monday", etc.
  dayIndex: number; // 0-6
  totalExpense: number;
  transactionCount: number;
  averageExpense: number;
}

export interface SpendingInsight {
  id: string;
  type: 'increase' | 'decrease' | 'anomaly' | 'pattern' | 'milestone' | 'info';
  title: string;
  description: string;
  evidence: string;
  severity: 'neutral' | 'positive' | 'warning';
}

export interface TransactionFilter {
  searchQuery?: string;
  type?: 'all' | 'income' | 'expense';
  category?: string;
  paymentMethod?: string;
  startDate?: string;
  endDate?: string;
  sortBy?: 'date_desc' | 'date_asc' | 'amount_desc' | 'amount_asc';
}
