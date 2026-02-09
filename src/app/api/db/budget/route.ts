import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth-utils";
import { getAllUserTransactions, getUserTransactions } from "@/lib/db";
import { getFinancialMonthBoundaries } from "@/lib/monobank";
import { distributeBudget } from "@/lib/budget-ai";
import { convertToUAH, CurrencyRate } from "@/lib/db";
import { fetchCurrencyRates } from "@/lib/mono-sync";

interface BudgetDay {
  date: string;
  limit: number;
  spent: number;
  remaining: number;
  status: "under" | "warning" | "over";
}

interface BudgetResponse {
  totalBudget: number;
  totalSpent: number;
  totalRemaining: number;
  daysRemaining: number;
  dailyLimits: BudgetDay[];
  currentBalance?: number;
  dailyAverage?: number;
}

export async function GET(request: NextRequest) {
  try {
    const userId = await requireAuth();
    const searchParams = request.nextUrl.searchParams;
    const accountId = searchParams.get("accountId") || undefined;
    const month = searchParams.get("month"); // ISO date string for historical months

    // Fetch currency rates
    const rates: CurrencyRate[] = await fetchCurrencyRates();

    // Get all transactions for the user
    const transactions = await getAllUserTransactions(userId, accountId);

    // Determine the financial month to calculate
    let fromTime: number;
    let toTime: number;
    let currentDate: Date;

    if (month) {
      // Historical month request
      const monthDate = new Date(month);
      const financialDayStart = 1; // Default to 1st of month
      
      // Calculate financial month boundaries
      const year = monthDate.getFullYear();
      const monthStart = new Date(year, monthDate.getMonth(), financialDayStart);
      const monthEnd = new Date(year, monthDate.getMonth() + 1, financialDayStart - 1);
      
      fromTime = Math.floor(monthStart.getTime() / 1000);
      toTime = Math.floor(monthEnd.getTime() / 1000);
      currentDate = monthDate;
    } else {
      // Current financial month
      currentDate = new Date();
      const { from, to } = getFinancialMonthBoundaries(currentDate, 1);
      fromTime = from;
      toTime = to;
    }

    // Filter transactions to current financial month
    const currentMonthTx = transactions.filter(
      (tx) => tx.time >= fromTime && tx.time <= toTime
    );

    // Convert to UAH for budget calculation
    const transactionsInUAH = currentMonthTx.map((tx) => ({
      ...tx,
      amount: Math.round(convertToUAH(tx.amount, tx.currency_code, rates)),
    }));

    // Get account balance (from transactions or settings)
    const latestTx = transactions[0];
    const currentBalance = latestTx ? latestTx.balance : 0;
    const budgetAmount = currentBalance;

    // Calculate budget using AI distribution
    const budget = await distributeBudget(
      budgetAmount,
      currentDate,
      transactions,
      transactionsInUAH,
      [], // excludedTransactionIds - should be fetched separately
      budgetAmount,
      userId,
      true, // useAIBudget
      1, // financialMonthStart
      false, // skipHistoricalLimits
      [] // includedTransactionIds - should be fetched separately
    );

    // Transform to response format
    const response: BudgetResponse = {
      totalBudget: budget.totalBudget,
      totalSpent: budget.totalSpent,
      totalRemaining: budget.totalRemaining,
      daysRemaining: budget.daysRemaining,
      dailyLimits: budget.dailyLimits.map((day) => ({
        date: day.date instanceof Date ? day.date.toISOString() : day.date,
        limit: day.limit,
        spent: day.spent,
        remaining: day.limit - day.spent,
        status: day.status,
      })),
      currentBalance: budget.currentBalance,
      dailyAverage: budget.dailyAverage,
    };

    return NextResponse.json(response);
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Error calculating budget:", error);
    return NextResponse.json({ error: "Failed to calculate budget" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = await requireAuth();
    const body = await request.json();

    // Trigger budget recalculation and save
    // This endpoint can be used to force recalculation after settings change
    const { accountId, forceRecalculate } = body;

    // For now, just return success
    // The actual calculation happens client-side for better UX
    // This endpoint can be expanded for server-side calculations if needed

    return NextResponse.json({ 
      success: true,
      message: "Budget recalculation triggered on client side" 
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Error saving budget:", error);
    return NextResponse.json({ error: "Failed to save budget" }, { status: 500 });
  }
}
