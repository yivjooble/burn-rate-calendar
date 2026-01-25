import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  getUserDailyBudgets,
  saveUserDailyBudget,
  getUserDailyBudget,
} from "@/lib/db";
import { requireAuth } from "@/lib/auth-utils";

// Security constants
const MAX_DATE_RANGE_DAYS = 366; // Maximum allowed date range (1 year)
const MAX_BUDGETS_PER_REQUEST = 100; // Maximum budgets in single POST request

// Zod schema for input validation (SEC-003)
const dailyBudgetSchema = z.object({
  date: z.string().refine((val) => !isNaN(Date.parse(val)), {
    message: "Invalid date format",
  }),
  limit: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER),
  spent: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER),
  balance: z.number().int().min(-Number.MAX_SAFE_INTEGER).max(Number.MAX_SAFE_INTEGER),
});

const postBodySchema = z.object({
  budgets: z.array(dailyBudgetSchema).max(MAX_BUDGETS_PER_REQUEST, {
    message: `Maximum ${MAX_BUDGETS_PER_REQUEST} budgets per request`,
  }),
  preserveHistorical: z.boolean().optional().default(false),
});

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

    // SEC-001: Validate date range to prevent DoS
    const daysDiff = Math.ceil((toDate.getTime() - fromDate.getTime()) / (1000 * 60 * 60 * 24));
    if (daysDiff < 0) {
      return NextResponse.json(
        { error: "from date must be before to date" },
        { status: 400 }
      );
    }
    if (daysDiff > MAX_DATE_RANGE_DAYS) {
      return NextResponse.json(
        { error: `Date range cannot exceed ${MAX_DATE_RANGE_DAYS} days` },
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
    // Log sanitized error (avoid exposing stack traces)
    console.error("Error getting daily budgets:", error instanceof Error ? error.message : "Unknown error");
    return NextResponse.json(
      { error: "Failed to get daily budgets" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/db/daily-budgets
 * Save multiple daily budgets (batch operation)
 *
 * Body:
 * - budgets: Array of { date, limit, spent, balance }
 * - preserveHistorical: boolean (default: false) - if true, don't overwrite past days
 */
export async function POST(request: NextRequest) {
  try {
    const userId = await requireAuth();
    const rawBody = await request.json();

    // SEC-002 & SEC-003: Validate input with Zod schema
    const parseResult = postBodySchema.safeParse(rawBody);
    if (!parseResult.success) {
      return NextResponse.json(
        { error: parseResult.error.issues[0]?.message || "Invalid request body" },
        { status: 400 }
      );
    }

    const { budgets, preserveHistorical } = parseResult.data;
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    // Process validated budgets
    for (const budget of budgets) {
      const { date, limit, spent, balance } = budget;
      const budgetDate = new Date(date);

      // Normalize to start of day for comparison
      const normalizedBudgetDate = new Date(budgetDate);
      normalizedBudgetDate.setUTCHours(0, 0, 0, 0);

      // If preserveHistorical is true and date is in the past, check if record exists
      if (preserveHistorical && normalizedBudgetDate < today) {
        const existingBudget = await getUserDailyBudget(userId, normalizedBudgetDate);
        if (existingBudget) {
          // Skip - don't overwrite historical data
          continue;
        }
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
    // Log sanitized error (avoid exposing stack traces)
    console.error("Error saving daily budgets:", error instanceof Error ? error.message : "Unknown error");
    return NextResponse.json(
      { error: "Failed to save daily budgets" },
      { status: 500 }
    );
  }
}
