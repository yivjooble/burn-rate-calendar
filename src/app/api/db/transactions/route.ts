import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getAllUserTransactions, saveUserTransactions, DbUserTransaction } from "@/lib/db";
import { requireAuth } from "@/lib/auth-utils";
import { saveTransactionsSchema, validateInput, ValidationError } from "@/lib/validation";

export async function GET() {
  try {
    const userId = await requireAuth();
    const transactions = await getAllUserTransactions(userId);
    
    // Convert to frontend format
    const formatted = transactions.map(tx => ({
      id: tx.id,
      time: tx.time,
      description: tx.description,
      mcc: tx.mcc,
      amount: tx.amount,
      balance: tx.balance,
      cashbackAmount: tx.cashback_amount,
      currencyCode: tx.currency_code,
      comment: tx.comment,
    }));
    return NextResponse.json(formatted);
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Error getting transactions:", error);
    return NextResponse.json({ error: "Failed to get transactions" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const userId = await requireAuth();
    const body = await request.json();
    
    // Validate input
    const { transactions } = validateInput(saveTransactionsSchema, body);
    
    // Convert from frontend format to DB format
    const dbTransactions: Omit<DbUserTransaction, "user_id">[] = transactions.map(tx => ({
      id: tx.id,
      account_id: tx.accountId || null,
      time: tx.time,
      description: tx.description,
      mcc: tx.mcc,
      amount: tx.amount,
      balance: tx.balance,
      cashback_amount: tx.cashbackAmount,
      currency_code: tx.currencyCode,
      comment: tx.comment || null,
    }));
    
    await saveUserTransactions(userId, dbTransactions);
    return NextResponse.json({ success: true, count: dbTransactions.length });
  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Error saving transactions:", error);
    return NextResponse.json({ error: "Failed to save transactions" }, { status: 500 });
  }
}
