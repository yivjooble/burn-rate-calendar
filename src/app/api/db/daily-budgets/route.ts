import { NextRequest, NextResponse } from "next/server";
import {
  getUserDailyBudgets,
  saveUserDailyBudget,
} from "@/lib/db";
import { requireAuth } from "@/lib/auth-utils";

/**
 * GET /api/db/daily-budgets?from=2024-01-01&to=2024-01-31
 * Get all daily budgets for a user within a date range
 */
export async function GET(request: NextRequest) {
  try {
    const userId = await requireAuth();
    const { searchParams } = new URL(request.url);
    const fromStr = searchParams.get("from");
    const toStr = searchParams.get("to");

    if (!fromStr || !toStr) {
      return NextResponse.json(
        { error: "Missing from or to date" },
        { status: 400 }
      );
    }

    const fromDate = new Date(fromStr);
    const toDate = new Date(toStr);

    if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
      return NextResponse.json(
        { error: "Invalid date format" },
        { status: 400 }
      );
    }

    const budgets = await getUserDailyBudgets(userId, fromDate, toDate);

    return NextResponse.json({
      budgets: budgets.map((b) => ({
        date: b.date.toISOString(),
        limit: b.limit,
        spent: b.spent,
        balance: b.balance,
      })),
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Error getting daily budgets:", error);
    return NextResponse.json(
      { error: "Failed to get daily budgets" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/db/daily-budgets
 * Save multiple daily budgets (batch operation)
 */
export async function POST(request: NextRequest) {
  try {
    const userId = await requireAuth();
    const body = await request.json();

    if (!Array.isArray(body.budgets)) {
      return NextResponse.json(
        { error: "budgets must be an array" },
        { status: 400 }
      );
    }

    // Validate and save each budget
    for (const budget of body.budgets) {
      const { date, limit, spent, balance } = budget;

      if (!date || limit === undefined || spent === undefined || balance === undefined) {
        return NextResponse.json(
          { error: "Each budget must have date, limit, spent, and balance" },
          { status: 400 }
        );
      }

      const budgetDate = new Date(date);
      if (isNaN(budgetDate.getTime())) {
        return NextResponse.json(
          { error: "Invalid date format" },
          { status: 400 }
        );
      }

      await saveUserDailyBudget(
        userId,
        budgetDate,
        limit,
        spent,
        balance
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Error saving daily budgets:", error);
    return NextResponse.json(
      { error: "Failed to save daily budgets" },
      { status: 500 }
    );
  }
}
