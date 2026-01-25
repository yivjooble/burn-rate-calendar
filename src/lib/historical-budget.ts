import { Transaction, MonthBudget, DayBudget, StoredDailyBudget } from "@/types";
import { isExpense, getFinancialMonthStart, getFinancialMonthEnd } from "./monobank";
import { eachDayOfInterval, format, differenceInDays } from "date-fns";

interface HistoricalBudgetParams {
  transactions: Transaction[];
  excludedTransactionIds: string[];
  monthStart: Date;
  monthEnd: Date;
  storedBudgets?: StoredDailyBudget[];
}

/**
 * Calculate budget summary for a historical month
 */
export function calculateHistoricalMonthSummary({
  transactions,
  excludedTransactionIds,
  monthStart,
  monthEnd,
  storedBudgets = [],
}: HistoricalBudgetParams): MonthBudget {
  // Get all days in the financial month
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const daysInMonth = days.length;

  // Filter transactions for this month
  const monthStartTs = Math.floor(monthStart.getTime() / 1000);
  const monthEndTs = Math.floor(monthEnd.getTime() / 1000);

  // PERF-002: Use Set for O(1) lookup instead of O(n) array.includes()
  const excludedSet = new Set(excludedTransactionIds);

  const monthTransactions = transactions.filter(
    (tx) =>
      tx.time >= monthStartTs &&
      tx.time <= monthEndTs &&
      isExpense(tx, transactions) &&
      !excludedSet.has(tx.id)
  );

  // Group transactions by day
  const txByDay = new Map<string, Transaction[]>();
  monthTransactions.forEach((tx) => {
    const dateKey = format(new Date(tx.time * 1000), "yyyy-MM-dd");
    const existing = txByDay.get(dateKey) || [];
    existing.push(tx);
    txByDay.set(dateKey, existing);
  });

  // Create stored budgets lookup
  const storedByDate = new Map<string, StoredDailyBudget>();
  storedBudgets.forEach((b) => {
    const dateKey = format(new Date(b.date), "yyyy-MM-dd");
    storedByDate.set(dateKey, b);
  });

  // Calculate total spent
  const totalSpent = monthTransactions.reduce(
    (sum, tx) => sum + Math.abs(tx.amount),
    0
  );

  // Calculate daily average
  const dailyAverage = daysInMonth > 0 ? Math.round(totalSpent / daysInMonth) : 0;

  // Try to reconstruct total budget from stored daily limits
  let totalBudget = 0;
  let hasStoredBudgets = false;

  storedBudgets.forEach((b) => {
    totalBudget += b.limit;
    hasStoredBudgets = true;
  });

  // If no stored budgets, estimate based on average daily spend
  if (!hasStoredBudgets) {
    totalBudget = totalSpent; // For historical months without budget data, budget = spent
  }

  // Build daily limits array
  const dailyLimits: DayBudget[] = days.map((day) => {
    const dateKey = format(day, "yyyy-MM-dd");
    const dayTx = txByDay.get(dateKey) || [];
    const stored = storedByDate.get(dateKey);

    const spent = dayTx.reduce((sum, tx) => sum + Math.abs(tx.amount), 0);
    const limit = stored?.limit || dailyAverage;
    const remaining = limit - spent;

    let status: "under" | "warning" | "over" = "under";
    const percentage = limit > 0 ? (spent / limit) * 100 : 0;
    if (percentage >= 100) status = "over";
    else if (percentage >= 80) status = "warning";

    return {
      date: day,
      limit,
      spent,
      remaining,
      transactions: dayTx,
      status,
    };
  });

  return {
    totalBudget,
    totalSpent,
    totalRemaining: totalBudget - totalSpent,
    daysRemaining: 0, // Historical months have 0 days remaining
    dailyLimits,
    dailyAverage,
    isHistorical: true,
  };
}

/**
 * Fetch stored daily budgets for a date range
 */
export async function fetchStoredDailyBudgets(
  fromDate: Date,
  toDate: Date
): Promise<StoredDailyBudget[]> {
  try {
    const from = format(fromDate, "yyyy-MM-dd");
    const to = format(toDate, "yyyy-MM-dd");

    const response = await fetch(
      `/api/db/daily-budgets?from=${from}&to=${to}`,
      { credentials: "include" }
    );

    if (!response.ok) {
      console.error("Failed to fetch daily budgets:", response.status);
      return [];
    }

    const data = await response.json();
    return data.budgets || [];
  } catch (error) {
    console.error("Error fetching daily budgets:", error);
    return [];
  }
}

/**
 * Check if a month is the current financial month
 */
export function isCurrentFinancialMonth(
  selectedMonth: Date,
  financialDayStart: number
): boolean {
  const currentStart = getFinancialMonthStart(new Date(), financialDayStart);
  const selectedStart = getFinancialMonthStart(selectedMonth, financialDayStart);
  return currentStart.getTime() === selectedStart.getTime();
}
