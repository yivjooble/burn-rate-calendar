import { Transaction, DayBudget, MonthBudget, InflationPrediction } from "@/types";
import { isExpense, isIncome, groupTransactionsByDay, getFinancialMonthStart, getFinancialMonthEnd } from "./monobank";
import {
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  format,
  isWeekend,
  addMonths,
  differenceInDays,
} from "date-fns";
import { getUserDailyBudgets } from "./db";

interface SpendingPattern {
  weekdayAvg: number;
  weekendAvg: number;
  dayOfMonthMultipliers: number[];
}

interface AIBudgetResponse {
  dailyBudgets: Array<{
    date: string;
    limit: number;
    confidence: number;
    reasoning: string;
  }>;
}

export function analyzeSpendingPattern(
  transactions: Transaction[],
  includedTransactionIds?: string[]
): SpendingPattern {
  const expenses = transactions.filter((tx) => isExpense(tx, transactions, includedTransactionIds));
  const grouped = groupTransactionsByDay(expenses);

  let weekdayTotal = 0;
  let weekdayCount = 0;
  let weekendTotal = 0;
  let weekendCount = 0;

  const dayOfMonthTotals: number[] = new Array(31).fill(0);
  const dayOfMonthCounts: number[] = new Array(31).fill(0);

  grouped.forEach((txs, dateStr) => {
    const date = new Date(dateStr);
    const dayTotal = txs.reduce((sum, tx) => sum + Math.abs(tx.amount), 0);
    const dayOfMonth = date.getDate() - 1;

    dayOfMonthTotals[dayOfMonth] += dayTotal;
    dayOfMonthCounts[dayOfMonth]++;

    if (isWeekend(date)) {
      weekendTotal += dayTotal;
      weekendCount++;
    } else {
      weekdayTotal += dayTotal;
      weekdayCount++;
    }
  });

  const weekdayAvg = weekdayCount > 0 ? weekdayTotal / weekdayCount : 0;
  const weekendAvg = weekendCount > 0 ? weekendTotal / weekendCount : 0;

  const overallAvg = (weekdayTotal + weekendTotal) / (weekdayCount + weekendCount) || 1;

  const dayOfMonthMultipliers = dayOfMonthTotals.map((total, i) => {
    if (dayOfMonthCounts[i] === 0) return 1;
    return (total / dayOfMonthCounts[i]) / overallAvg;
  });

  return {
    weekdayAvg,
    weekendAvg,
    dayOfMonthMultipliers,
  };
}

export async function distributeBudget(
  totalBudget: number,
  currentDate: Date,
  pastTransactions: Transaction[],
  currentMonthTransactions: Transaction[],
  excludedTransactionIds: string[] = [],
  currentBalance?: number,
  userId?: string,
  useAI: boolean = true,
  financialMonthStartDay: number = 1,
  skipHistoricalLimits: boolean = false, // When true, don't use saved historical limits (for budget recalculation)
  includedTransactionIds: string[] = [] // Override auto-exclusion for these transactions
): Promise<MonthBudget> {
  // Use financial month boundaries instead of calendar month
  const monthStart = financialMonthStartDay === 1
    ? startOfMonth(currentDate)
    : getFinancialMonthStart(currentDate, financialMonthStartDay);
  const monthEnd = financialMonthStartDay === 1
    ? endOfMonth(currentDate)
    : getFinancialMonthEnd(currentDate, financialMonthStartDay);
  const allDays = eachDayOfInterval({ start: monthStart, end: monthEnd });

  const pattern = analyzeSpendingPattern(pastTransactions, includedTransactionIds);
  const currentGrouped = groupTransactionsByDay(currentMonthTransactions);

  let totalSpent = 0;
  currentMonthTransactions
    .filter((tx) => isExpense(tx, currentMonthTransactions, includedTransactionIds) && !excludedTransactionIds.includes(tx.id))
    .forEach((tx) => {
      totalSpent += Math.abs(tx.amount);
    });

  const today = new Date();
  today.setHours(0, 0, 0, 0); // Normalize to start of day for proper comparison
  const futureDays = allDays.filter((d) => d >= today);
  const remainingBudget = totalBudget - totalSpent;

  const weights = futureDays.map((day) => {
    const dayOfMonth = day.getDate() - 1;
    let weight = pattern.dayOfMonthMultipliers[dayOfMonth] || 1;

    if (isWeekend(day) && pattern.weekendAvg > pattern.weekdayAvg) {
      weight *= 1.2;
    }

    return { day, weight };
  });

  const totalWeight = weights.reduce((sum, w) => sum + w.weight, 0);

  const baseDailyLimit = totalBudget / allDays.length;

  // Try AI-powered budget distribution if enabled and userId is provided
  let aiDailyLimits: DayBudget[] | null = null;
  if (useAI && userId && currentBalance !== undefined) {
    try {
      // Get transactions for AI analysis (last 30-90 days)
      const analysisTransactions = pastTransactions.slice(-90); // Last 90 transactions

      const aiResponse = await fetch("/api/ai/budget-distribution", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          totalBudget,
          remainingBudget,
          transactions: analysisTransactions,
          startDate: monthStart.toISOString().split('T')[0],
          endDate: monthEnd.toISOString().split('T')[0],
          financialMonthStart: financialMonthStartDay
        }),
        credentials: "include",
      });
      
      if (aiResponse.ok) {
        const aiData = await aiResponse.json();
        
        // Convert AI budgets to DayBudget format
        aiDailyLimits = aiData.dailyBudgets.map((aiBudget: AIBudgetResponse['dailyBudgets'][0]) => {
          const date = new Date(aiBudget.date);
          const dateKey = format(date, "yyyy-MM-dd");
          const dayTransactions = currentGrouped.get(dateKey) || [];
          const daySpent = dayTransactions
            .filter((tx) => isExpense(tx, currentMonthTransactions, includedTransactionIds) && !excludedTransactionIds.includes(tx.id))
            .reduce((sum, tx) => sum + Math.abs(tx.amount), 0);
          
          return {
            date,
            limit: aiBudget.limit,
            spent: Math.round(daySpent),
            remaining: aiBudget.limit - Math.round(daySpent),
            transactions: dayTransactions,
            status: daySpent >= aiBudget.limit ? "over" : daySpent >= aiBudget.limit * 0.8 ? "warning" : "under",
            confidence: aiBudget.confidence,
            reasoning: aiBudget.reasoning
          };
        });
      }
    } catch {
      // AI budget distribution failed, fall back to traditional method
    }
  }

  // Get historical daily budgets if userId is provided and we're not skipping them
  // Skip historical limits when budget has been manually changed (to allow full recalculation)
  const historicalBudgets: Map<string, { limit: number; spent: number; balance: number }> = new Map();
  if (userId && !skipHistoricalLimits) {
    try {
      // Use financial month boundaries for historical budgets
      const savedBudgets = await getUserDailyBudgets(userId, monthStart, monthEnd);
      savedBudgets.forEach(budget => {
        const dateKey = format(budget.date, "yyyy-MM-dd");
        historicalBudgets.set(dateKey, {
          limit: budget.limit,
          spent: budget.spent,
          balance: budget.balance
        });
      });
    } catch {
      // Failed to load historical budgets
    }
  }

  const dailyLimits: DayBudget[] = allDays.map((day) => {
    const dateKey = format(day, "yyyy-MM-dd");
    const dayTransactions = currentGrouped.get(dateKey) || [];
    const daySpent = dayTransactions
      .filter((tx) => isExpense(tx, currentMonthTransactions, includedTransactionIds) && !excludedTransactionIds.includes(tx.id))
      .reduce((sum, tx) => sum + Math.abs(tx.amount), 0);

    let limit: number;
    
    // Check if this day is in the past (before today)
    const dayNormalized = new Date(day);
    dayNormalized.setHours(0, 0, 0, 0);

    if (dayNormalized < today) {
      // For past days, use saved historical limit if available, otherwise use base daily limit
      const historicalBudget = historicalBudgets.get(dateKey);
      if (historicalBudget) {
        limit = historicalBudget.limit;
      } else {
        // For past days without historical budget, use base daily limit
        // This ensures past days have reasonable limits for display purposes
        limit = baseDailyLimit;
      }
    } else {
      // For today and future days, use AI predictions if available, otherwise fallback to traditional method
      if (aiDailyLimits) {
        // Use AI-generated limits
        const aiBudget = aiDailyLimits.find(b => format(b.date, "yyyy-MM-dd") === dateKey);
        if (aiBudget) {
          limit = aiBudget.limit;
        } else {
          // Fallback to traditional method if AI didn't generate budget for this day
          // FIX: Always use remaining budget, not card balance (ignores already spent funds)
          const availableBudget = Math.max(0, remainingBudget);
          limit = availableBudget / Math.max(futureDays.length, 1);
        }
      } else {
        // Traditional method when AI is disabled or failed
        // FIX: Always use remaining budget, not card balance (ignores already spent funds)
        const availableBudget = Math.max(0, remainingBudget);
        limit = availableBudget / Math.max(futureDays.length, 1);
      }
    }

    const remaining = limit - daySpent;
    const percentage = limit > 0 ? (daySpent / limit) * 100 : 0;
    
    let status: "under" | "warning" | "over";

    if (percentage >= 100) {
      status = "over";
    } else if (percentage >= 80) {
      status = "warning";
    } else {
      status = "under";
    }

    return {
      date: day,
      limit: Math.round(limit),
      spent: Math.round(daySpent),
      remaining: Math.round(remaining),
      transactions: dayTransactions,
      status,
    };
  });

  const aiRecommendation = generateRecommendation(
    totalBudget,
    totalSpent,
    futureDays.length,
    pattern
  );

  return {
    totalBudget,
    totalSpent: Math.round(totalSpent),
    totalRemaining: Math.round(remainingBudget),
    daysRemaining: futureDays.length,
    dailyLimits,
    aiRecommendation,
    currentBalance,
  };
}

function generateRecommendation(
  totalBudget: number,
  totalSpent: number,
  daysRemaining: number,
  pattern: SpendingPattern
): string {
  const percentSpent = (totalSpent / totalBudget) * 100;
  const dailyBudget = (totalBudget - totalSpent) / daysRemaining;

  if (percentSpent > 80 && daysRemaining > 7) {
    return `⚠️ Ви витратили ${percentSpent.toFixed(0)}% бюджету. Рекомендований денний ліміт: ${(dailyBudget / 100).toFixed(0)} грн`;
  }

  if (pattern.weekendAvg > pattern.weekdayAvg * 1.5) {
    return `📊 Ваші витрати у вихідні на ${((pattern.weekendAvg / pattern.weekdayAvg - 1) * 100).toFixed(0)}% вищі. Плануйте бюджет відповідно.`;
  }

  if (daysRemaining <= 3 && totalSpent < totalBudget * 0.7) {
    return `✅ Відмінно! У вас залишилось ${((totalBudget - totalSpent) / 100).toFixed(0)} грн на ${daysRemaining} дні.`;
  }

  return `💡 Денний ліміт: ${(dailyBudget / 100).toFixed(0)} грн. Тримайтесь плану!`;
}

export function predictInflation(
  transactions: Transaction[],
  currentBalance: number,
  includedTransactionIds?: string[]
): InflationPrediction {
  const expenses = transactions.filter((tx) => isExpense(tx, transactions, includedTransactionIds));
  const incomes = transactions.filter((tx) => isIncome(tx, transactions, includedTransactionIds));

  const totalExpenses = expenses.reduce((sum, tx) => sum + Math.abs(tx.amount), 0);
  const totalIncome = incomes.reduce((sum, tx) => sum + tx.amount, 0);

  const daysInPeriod = transactions.length > 0
    ? differenceInDays(
        new Date(Math.max(...transactions.map((tx) => tx.time)) * 1000),
        new Date(Math.min(...transactions.map((tx) => tx.time)) * 1000)
      ) || 1
    : 30;

  const dailyBurnRate = (totalExpenses - totalIncome) / daysInPeriod;
  const monthlyBurnRate = dailyBurnRate * 30;

  const monthsUntilZero = monthlyBurnRate > 0
    ? currentBalance / monthlyBurnRate
    : Infinity;

  const yearlyProjection: { month: string; balance: number }[] = [];
  let projectedBalance = currentBalance;
  const today = new Date();

  for (let i = 0; i < 12; i++) {
    const futureDate = addMonths(today, i);
    yearlyProjection.push({
      month: format(futureDate, "MMM yyyy"),
      balance: Math.max(0, Math.round(projectedBalance)),
    });
    projectedBalance -= monthlyBurnRate;
  }

  const variance = calculateVariance(
    expenses.map((tx) => Math.abs(tx.amount))
  );
  const confidence = Math.max(0.3, Math.min(0.95, 1 - variance / (totalExpenses / expenses.length || 1)));

  return {
    currentBalance,
    predictedBalance: Math.max(0, Math.round(currentBalance - monthlyBurnRate * 12)),
    monthlyBurnRate: Math.round(monthlyBurnRate),
    monthsUntilZero: Math.round(monthsUntilZero * 10) / 10,
    yearlyProjection,
    confidence,
  };
}

function calculateVariance(values: number[]): number {
  if (values.length === 0) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const squaredDiffs = values.map((v) => Math.pow(v - mean, 2));
  return Math.sqrt(squaredDiffs.reduce((a, b) => a + b, 0) / values.length);
}
