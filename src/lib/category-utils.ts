import { Transaction } from "@/types";
import { getMccCategory, getCategoryFromDescription, getCategoryByKey, MCC_CATEGORIES, Category } from "./mcc-categories";

export interface CategoryInfo {
  key: string;
  name: string;
  icon: string;
  color: string;
  isCustom: boolean;
}

export interface CustomCategory {
  id: string;
  name: string;
  icon: string;
  color: string;
}

/**
 * Get category for a transaction considering manual overrides.
 * Priority order:
 * 1. Manual override (transactionCategories)
 * 2. Description-based detection
 * 3. MCC-based detection
 */
export function getTransactionCategory(
  transaction: Transaction,
  transactionCategories: Record<string, string | null>,
  customCategories: CustomCategory[] = []
): CategoryInfo {
  // Priority 1: Manual override
  const manualCategoryId = transactionCategories[transaction.id];
  if (manualCategoryId) {
    // Check custom categories first
    const customCat = customCategories.find(c => c.id === manualCategoryId);
    if (customCat) {
      return {
        key: customCat.id,
        name: customCat.name,
        icon: customCat.icon,
        color: customCat.color,
        isCustom: true
      };
    }
    // Check standard categories
    const standardCat = MCC_CATEGORIES[manualCategoryId];
    if (standardCat) {
      return {
        key: manualCategoryId,
        name: standardCat.name,
        icon: standardCat.icon,
        color: standardCat.color,
        isCustom: false
      };
    }
  }

  // Priority 2: Description-based detection
  const descCategory = getCategoryFromDescription(transaction.description);
  if (descCategory) {
    const cat = getCategoryByKey(descCategory);
    return {
      key: descCategory,
      name: cat.name,
      icon: cat.icon,
      color: cat.color,
      isCustom: false
    };
  }

  // Priority 3: MCC-based detection
  const mccCategory = getMccCategory(transaction.mcc);
  const cat = getCategoryByKey(mccCategory);
  return {
    key: mccCategory,
    name: cat.name,
    icon: cat.icon,
    color: cat.color,
    isCustom: false
  };
}

/**
 * Get just the category key for a transaction (without full info).
 * Useful for grouping and filtering operations.
 */
export function getTransactionCategoryKey(
  transaction: Transaction,
  transactionCategories: Record<string, string | null>
): string {
  // Priority 1: Manual override
  const manualCategoryId = transactionCategories[transaction.id];
  if (manualCategoryId) {
    return manualCategoryId;
  }

  // Priority 2: Description-based detection
  const descCategory = getCategoryFromDescription(transaction.description);
  if (descCategory) {
    return descCategory;
  }

  // Priority 3: MCC-based detection
  return getMccCategory(transaction.mcc);
}

// ============================================
// PHASE 1: CATEGORIES REDESIGN HELPERS
// ============================================

export interface CategoryBudget {
  key: string;
  name: string;
  icon: string;
  color: string;
  spent: number;
  budget: number;
  percentage: number;
  status: "under" | "warning" | "over"; // under=0-80%, warning=80-100%, over=100%+
  trend?: {
    change: number; // percentage change from previous period
    direction: "up" | "down" | "stable";
  };
}

export interface TopCategory {
  key: string;
  name: string;
  icon: string;
  color: string;
  amount: number;
  percentage: number;
  position: 1 | 2 | 3; // 1st, 2nd, 3rd place
}

/**
 * Calculate category budgets with progress tracking
 */
export function calculateCategoryBudgets(
  categories: Array<{ key: string; name: string; icon: string; color: string; total: number }>,
  totalBudget: number,
  options: {
    customBudgets?: Record<string, number>;
    warningThreshold?: number; // default 80%
  } = {}
): CategoryBudget[] {
  const warningThreshold = options.warningThreshold ?? 80;
  const customBudgets = options.customBudgets || {};

  return categories.map((cat) => {
    // Auto-calculate budget based on percentage share
    const autoBudget = totalBudget * (cat.total / categories.reduce((sum, c) => sum + c.total, 0));
    const budget = customBudgets[cat.key] ?? autoBudget;
    const percentage = budget > 0 ? (cat.total / budget) * 100 : 0;

    let status: "under" | "warning" | "over";
    if (percentage >= 100) {
      status = "over";
    } else if (percentage >= warningThreshold) {
      status = "warning";
    } else {
      status = "under";
    }

    return {
      key: cat.key,
      name: cat.name,
      icon: cat.icon,
      color: cat.color,
      spent: cat.total,
      budget,
      percentage: Math.round(percentage * 10) / 10,
      status,
    };
  });
}

/**
 * Get top 3 categories by amount
 */
export function getTopCategories(
  categories: Array<{ key: string; name: string; icon: string; color: string; total: number }>,
  totalExpenses: number,
  limit: number = 3
): TopCategory[] {
  const sorted = [...categories]
    .sort((a, b) => b.total - a.total)
    .slice(0, limit);

  return sorted.map((cat, index) => ({
    key: cat.key,
    name: cat.name,
    icon: cat.icon,
    color: cat.color,
    amount: cat.total,
    percentage: totalExpenses > 0 ? Math.round((cat.total / totalExpenses) * 1000) / 10 : 0,
    position: (index + 1) as 1 | 2 | 3,
  }));
}

/**
 * Compare spending between two periods
 */
export function comparePeriods(
  currentPeriod: number,
  previousPeriod: number
): { change: number; direction: "up" | "down" | "stable"; isIncrease: boolean } {
  if (previousPeriod === 0) {
    return { change: 0, direction: "stable", isIncrease: false };
  }
  
  const change = ((currentPeriod - previousPeriod) / previousPeriod) * 100;
  const isIncrease = change > 0;
  
  let direction: "up" | "down" | "stable";
  if (Math.abs(change) < 1) {
    direction = "stable";
  } else {
    direction = isIncrease ? "up" : "down";
  }

  return {
    change: Math.round(change * 10) / 10,
    direction,
    isIncrease,
  };
}

/**
 * Get warning badge configuration
 */
export function getWarningBadge(status: "under" | "warning" | "over"): {
  icon: string;
  label: string;
  color: string;
  bgColor: string;
} {
  switch (status) {
    case "over":
      return {
        icon: "🔴",
        label: "Перевищено",
        color: "text-red-600",
        bgColor: "bg-red-50",
      };
    case "warning":
      return {
        icon: "⚠️",
        label: "Близько до ліміту",
        color: "text-orange-500",
        bgColor: "bg-orange-50",
      };
    default:
      return {
        icon: "✅",
        label: "В межах норми",
        color: "text-green-600",
        bgColor: "bg-green-50",
      };
  }
}

// ============================================
// PHASE 2: STATISTICS REDESIGN HELPERS
// ============================================

export interface BurnRateData {
  dailyLimit: number;
  actualDailySpent: number;
  burnRate: number; // percentage of daily limit used
  projectedMonthEnd: number;
  daysRemaining: number;
  trend: "accelerating" | "stable" | "decelerating";
  status: "healthy" | "warning" | "critical";
}

export interface KPIData {
  savingsRate: number; // percentage saved
  averageDailySpend: number;
  bestDay: { day: string; amount: number };
  worstDay: { day: string; amount: number };
  weeklyPattern: {
    dayOfWeek: number; // 0-6
    averageAmount: number;
  }[];
}

export interface DayOfWeekAnalysis {
  dayName: string;
  dayIndex: number;
  totalAmount: number;
  transactionCount: number;
  averageAmount: number;
  percentageOfTotal: number;
  isHighest: boolean;
  isLowest: boolean;
}

export interface Insight {
  id: string;
  type: "spending_pattern" | "category_change" | "budget_warning" | "recommendation";
  severity: "info" | "warning" | "alert";
  message: string;
  recommendation?: string;
  icon: string;
}

/**
 * Calculate burn rate data
 */
export function calculateBurnRate(
  totalSpent: number,
  daysInMonth: number,
  currentDay: number,
  totalBudget: number,
  recentDailySpend: number[] // last 7 days
): BurnRateData {
  const daysRemaining = daysInMonth - currentDay;
  const dailyLimit = totalBudget / daysInMonth;
  const actualDailySpent = totalSpent / currentDay;
  const burnRate = (actualDailySpent / dailyLimit) * 100;
  
  // Project month end spending based on recent trend
  const recentAverage = recentDailySpend.length > 0 
    ? recentDailySpend.reduce((a, b) => a + b, 0) / recentDailySpend.length 
    : actualDailySpent;
  const projectedMonthEnd = recentAverage * daysInMonth;
  
  // Determine trend
  const trend = (() => {
    if (recentDailySpend.length < 2) return "stable";
    const recentTrend = recentDailySpend[recentDailySpend.length - 1] - recentDailySpend[0];
    if (recentTrend > 50) return "accelerating";
    if (recentTrend < -50) return "decelerating";
    return "stable";
  })();
  
  // Determine status
  let status: "healthy" | "warning" | "critical";
  if (burnRate > 120 || projectedMonthEnd > totalBudget * 1.2) {
    status = "critical";
  } else if (burnRate > 100 || projectedMonthEnd > totalBudget) {
    status = "warning";
  } else {
    status = "healthy";
  }
  
  return {
    dailyLimit,
    actualDailySpent,
    burnRate: Math.round(burnRate * 10) / 10,
    projectedMonthEnd: Math.round(projectedMonthEnd),
    daysRemaining,
    trend,
    status,
  };
}

/**
 * Calculate KPI data
 */
export function calculateKPIs(
  totalSpent: number,
  totalBudget: number,
  dailySpends: Array<{ date: Date; amount: number }>
): KPIData {
  const savingsRate = totalBudget > 0 
    ? ((totalBudget - totalSpent) / totalBudget) * 100 
    : 0;
    
  const nonZeroDays = dailySpends.filter(d => d.amount > 0);
  const averageDailySpend = nonZeroDays.length > 0 
    ? totalSpent / nonZeroDays.length 
    : 0;
    
  // Find best/worst days
  const sortedByAmount = [...dailySpends].sort((a, b) => b.amount - a.amount);
  const bestDay = sortedByAmount[dailySpends.length - 1] || { day: "Немає", amount: 0 };
  const worstDay = sortedByAmount[0] || { day: "Немає", amount: 0 };
  
  // Weekly pattern
  const weekTotals: Record<number, { total: number; count: number }> = {
    0: { total: 0, count: 0 }, // Sunday
    1: { total: 0, count: 0 },
    2: { total: 0, count: 0 },
    3: { total: 0, count: 0 },
    4: { total: 0, count: 0 },
    5: { total: 0, count: 0 },
    6: { total: 0, count: 0 },
  };
  
  dailySpends.forEach(day => {
    const dayIndex = day.date.getDay();
    weekTotals[dayIndex].total += day.amount;
    weekTotals[dayIndex].count += 1;
  });
  
  const weeklyPattern = Object.entries(weekTotals).map(([day, data]) => ({
    dayOfWeek: parseInt(day),
    averageAmount: data.count > 0 ? data.total / data.count : 0,
  }));
  
  return {
    savingsRate: Math.round(savingsRate * 10) / 10,
    averageDailySpend: Math.round(averageDailySpend),
    bestDay: { 
      day: formatDayName(bestDay.date), 
      amount: bestDay.amount 
    },
    worstDay: { 
      day: formatDayName(worstDay.date), 
      amount: worstDay.amount 
    },
    weeklyPattern,
  };
}

/**
 * Format day name in Ukrainian
 */
function formatDayName(date: Date): string {
  const days = ["Нд", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"];
  return days[date.getDay()];
}

/**
 * Analyze spending by day of week
 */
export function analyzeDayOfWeek(
  dailySpends: Array<{ date: Date; amount: number }>,
  totalSpent: number
): DayOfWeekAnalysis[] {
  const dayNames = ["Неділя", "Понеділок", "Вівторок", "Середа", "Четвер", "П'ятниця", "Субота"];
  
  const dayStats: Record<number, { total: number; count: number }> = {
    0: { total: 0, count: 0 },
    1: { total: 0, count: 0 },
    2: { total: 0, count: 0 },
    3: { total: 0, count: 0 },
    4: { total: 0, count: 0 },
    5: { total: 0, count: 0 },
    6: { total: 0, count: 0 },
  };
  
  dailySpends.forEach(day => {
    const dayIndex = day.date.getDay();
    dayStats[dayIndex].total += day.amount;
    dayStats[dayIndex].count += 1;
  });
  
  const results = Object.entries(dayStats).map(([day, stats]) => {
    const dayIndex = parseInt(day);
    const averageAmount = stats.count > 0 ? stats.total / stats.count : 0;
    const percentage = totalSpent > 0 ? (stats.total / totalSpent) * 100 : 0;
    
    return {
      dayName: dayNames[dayIndex],
      dayIndex,
      totalAmount: stats.total,
      transactionCount: stats.count,
      averageAmount,
      percentageOfTotal: Math.round(percentage * 10) / 10,
      isHighest: false, // Will be set below
      isLowest: false,
    };
  });
  
  // Find highest and lowest
  const amounts = results.map(r => r.totalAmount);
  const maxAmount = Math.max(...amounts);
  const minAmount = Math.min(...amounts);
  
  return results.map(r => ({
    ...r,
    isHighest: r.totalAmount === maxAmount && maxAmount > 0,
    isLowest: r.totalAmount === minAmount && minAmount > 0,
  }));
}

/**
 * Generate automatic insights
 */
export function generateInsights(
  burnRateData: BurnRateData,
  kpiData: KPIData,
  categoryBudgets: CategoryBudget[],
  dayOfWeekAnalysis: DayOfWeekAnalysis[]
): Insight[] {
  const insights: Insight[] = [];
  
  // Burn rate insights
  if (burnRateData.status === "critical") {
    insights.push({
      id: "critical-burn-rate",
      type: "budget_warning",
      severity: "alert",
      icon: "🚨",
      message: `Ви витрачаєте на ${burnRateData.burnRate - 100}% більше за денний ліміт!`,
      recommendation: "Рекомендуємо терміново скоротити витрати.",
    });
  } else if (burnRateData.status === "warning") {
    insights.push({
      id: "warning-burn-rate",
      type: "budget_warning",
      severity: "warning",
      icon: "⚠️",
      message: `Burn rate становить ${burnRateData.burnRate}% - наближаєтесь до перевищення.`,
      recommendation: "Слідкуйте за витратами цього тижня.",
    });
  }
  
  // Day of week patterns
  const highestDay = dayOfWeekAnalysis.find(d => d.isHighest);
  const lowestDay = dayOfWeekAnalysis.find(d => d.isLowest);
  
  if (highestDay && highestDay.percentageOfTotal > 20) {
    insights.push({
      id: "highest-spending-day",
      type: "spending_pattern",
      severity: "info",
      icon: "📊",
      message: `${highestDay.dayName} - найдорожчий день (${highestDay.percentageOfTotal}% від загальних витрат).`,
      recommendation: `Сплануйте бюджет на ${highestDay.dayName.toLowerCase()} заздалегідь.`,
    });
  }
  
  // Category insights
  const overBudgetCategories = categoryBudgets.filter(c => c.status === "over");
  const warningCategories = categoryBudgets.filter(c => c.status === "warning");
  
  overBudgetCategories.slice(0, 2).forEach(cat => {
    insights.push({
      id: `over-budget-${cat.key}`,
      type: "budget_warning",
      severity: "alert",
      icon: "🔴",
      message: `Категорія "${cat.name}" перевищена на ${cat.percentage - 100}%.`,
      recommendation: `Зменшіть витрати в цій категорії або перегляньте бюджет.`,
    });
  });
  
  if (warningCategories.length > 0 && overBudgetCategories.length === 0) {
    const cat = warningCategories[0];
    insights.push({
      id: `warning-${cat.key}`,
      type: "budget_warning",
      severity: "warning",
      icon: "⚠️",
      message: `Категорія "${cat.name}" наближається до ліміту (${cat.percentage}%).`,
    });
  }
  
  // Savings insight
  if (kpiData.savingsRate < 0) {
    insights.push({
      id: "negative-savings",
      type: "recommendation",
      severity: "warning",
      icon: "💰",
      message: `Ви витратили на ${Math.abs(kpiData.savingsRate)}% більше ніж планували.`,
      recommendation: "Проаналізуйте необов'язкові витрати.",
    });
  } else if (kpiData.savingsRate > 20) {
    insights.push({
      id: "good-savings",
      type: "recommendation",
      severity: "info",
      icon: "🎉",
      message: `Чудово! Ви заощаджуєте ${kpiData.savingsRate}% бюджету.`,
    });
  }
  
  return insights.slice(0, 5); // Return top 5 insights
}
