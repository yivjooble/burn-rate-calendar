import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-utils";

interface TransactionData {
  id: string;
  amount: number;
  description: string;
  mcc: number;
  time: number;
  currencyCode?: number;
}

interface BudgetRequest {
  totalBudget: number;
  currentBalance: number;
  transactions: TransactionData[];
  startDate: string;
  endDate: string;
  financialMonthStart?: number;
}

interface DayBudget {
  date: string;
  limit: number;
  confidence: number; // 0-1, how confident AI is in this prediction
  reasoning?: string; // AI explanation for the limit
}

/**
 * POST /api/ai/budget-distribution
 * AI-powered budget distribution based on spending patterns
 */
export async function POST(request: NextRequest) {
  try {
    const userId = await requireAuth();
    const body: BudgetRequest = await request.json();

    const { totalBudget, currentBalance, transactions, startDate, endDate, financialMonthStart = 1 } = body;

    // Validate input
    if (!totalBudget || !currentBalance || !transactions || !startDate || !endDate) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Calculate available budget for distribution
    const availableBudget = Math.max(0, currentBalance);
    
    // Get date range
    const start = new Date(startDate);
    const end = new Date(endDate);
    const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    
    // Analyze spending patterns
    const spendingAnalysis = analyzeSpendingPatterns(transactions, start, financialMonthStart);
    
    // Generate AI-powered daily budgets
    const dailyBudgets = generateAIBudgets(availableBudget, days, spendingAnalysis, start);
    
    return NextResponse.json({
      dailyBudgets,
      analysis: spendingAnalysis,
      usedBudget: availableBudget,
      totalDays: days
    });

  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json(
      { error: "Failed to generate AI budget distribution" },
      { status: 500 }
    );
  }
}

function analyzeSpendingPatterns(transactions: TransactionData[], startDate: Date, financialMonthStart: number) {
  // Filter expenses only
  const expenses = transactions.filter(tx => tx.amount < 0);
  
  // Group by day of week and month
  const dayOfWeekPatterns: Record<number, number> = {};
  const monthlyPatterns: Record<number, number> = {};
  const categoryPatterns: Record<number, number> = {};
  
  expenses.forEach(tx => {
    const date = new Date(tx.time * 1000);
    const dayOfWeek = date.getDay();
    const month = date.getMonth();
    const mcc = tx.mcc;
    
    dayOfWeekPatterns[dayOfWeek] = (dayOfWeekPatterns[dayOfWeek] || 0) + Math.abs(tx.amount);
    monthlyPatterns[month] = (monthlyPatterns[month] || 0) + Math.abs(tx.amount);
    categoryPatterns[mcc] = (categoryPatterns[mcc] || 0) + Math.abs(tx.amount);
  });
  
  // Calculate average daily spending by day of week
  const dayOfWeekAverages: Record<number, number> = {};
  Object.entries(dayOfWeekPatterns).forEach(([day, total]) => {
    const dayNum = parseInt(day);
    const weeksCount = expenses.length / 7; // Rough estimate
    dayOfWeekAverages[dayNum] = total / Math.max(1, weeksCount);
  });
  
  // Identify high-spending categories
  const topCategories = Object.entries(categoryPatterns)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 5)
    .map(([mcc, amount]) => ({ mcc: parseInt(mcc), amount }));
  
  // Calculate seasonal factors
  const currentMonth = startDate.getMonth();
  const seasonalFactor = calculateSeasonalFactor(monthlyPatterns, currentMonth);
  
  return {
    dayOfWeekAverages,
    topCategories,
    seasonalFactor,
    totalTransactions: expenses.length,
    averageDailySpending: expenses.reduce((sum, tx) => sum + Math.abs(tx.amount), 0) / Math.max(1, 30),
    financialMonthStart
  };
}

function calculateSeasonalFactor(monthlyPatterns: Record<number, number>, currentMonth: number): number {
  const months = Object.keys(monthlyPatterns).map(m => parseInt(m));
  if (months.length === 0) return 1.0;
  
  const currentMonthSpending = monthlyPatterns[currentMonth] || 0;
  const averageMonthlySpending = Object.values(monthlyPatterns).reduce((sum, val) => sum + val, 0) / months.length;
  
  return averageMonthlySpending > 0 ? currentMonthSpending / averageMonthlySpending : 1.0;
}

function generateAIBudgets(availableBudget: number, days: number, analysis: any, startDate: Date): DayBudget[] {
  const budgets: DayBudget[] = [];
  const { dayOfWeekAverages, seasonalFactor, averageDailySpending } = analysis;
  
  // Calculate base daily budget
  const baseDailyBudget = availableBudget / days;
  
  for (let i = 0; i < days; i++) {
    const currentDate = new Date(startDate);
    currentDate.setDate(startDate.getDate() + i);
    
    const dayOfWeek = currentDate.getDay();
    const dayOfWeekAverage = dayOfWeekAverages[dayOfWeek] || 0;
    const averageSpending = averageDailySpending || baseDailyBudget;
    
    // Calculate weight based on historical spending patterns
    let weight = 1.0;
    if (dayOfWeekAverage > 0 && averageSpending > 0) {
      weight = (dayOfWeekAverage / averageSpending) * seasonalFactor;
    }
    
    // Apply some smoothing to avoid extreme variations
    weight = Math.max(0.3, Math.min(3.0, weight));
    
    // Calculate daily limit with AI reasoning
    const limit = baseDailyBudget * weight;
    const confidence = calculateConfidence(dayOfWeekAverage, averageSpending, analysis.totalTransactions);
    
    let reasoning = "";
    if (weight > 1.2) {
      reasoning = `Higher spending expected (${(weight * 100).toFixed(0)}% of average)`;
    } else if (weight < 0.8) {
      reasoning = `Lower spending expected (${(weight * 100).toFixed(0)}% of average)`;
    } else {
      reasoning = "Normal spending expected";
    }
    
    budgets.push({
      date: currentDate.toISOString().split('T')[0],
      limit: Math.round(limit),
      confidence,
      reasoning
    });
  }
  
  return budgets;
}

function calculateConfidence(daySpending: number, averageSpending: number, totalTransactions: number): number {
  // Higher confidence with more data points
  const dataConfidence = Math.min(1.0, totalTransactions / 100);
  
  // Higher confidence for consistent patterns
  const patternConsistency = averageSpending > 0 ? 1.0 - Math.abs(daySpending - averageSpending) / averageSpending : 0.5;
  
  return (dataConfidence + patternConsistency) / 2;
}
