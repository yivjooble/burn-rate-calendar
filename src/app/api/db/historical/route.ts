import { NextResponse } from "next/server";
import {
  getUserSetting,
  setUserSetting,
  getAllUserTransactions,
  saveUserTransactions,
  deleteUserTransactionsAfter,
  clearUserExcludedTransactions,
  DbUserTransaction
} from "@/lib/db";
import { requireAuth } from "@/lib/auth-utils";
import { historicalTransactionsSchema, historicalMetaSchema, validateInput, ValidationError } from "@/lib/validation";

// GET - retrieve transactions and meta
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type") || "transactions";
  const accountId = searchParams.get("accountId") || undefined;

  try {
    const userId = await requireAuth();

    if (type === "meta") {
      const lastSyncTime = await getUserSetting(userId, "lastSyncTime");
      const historicalDataLoaded = await getUserSetting(userId, "historicalDataLoaded");
      const historicalFromTime = await getUserSetting(userId, "historicalFromTime");
      const historicalToTime = await getUserSetting(userId, "historicalToTime");

      return NextResponse.json({
        lastSyncTime: lastSyncTime ? parseInt(lastSyncTime, 10) : null,
        historicalDataLoaded: historicalDataLoaded === "true",
        historicalFromTime: historicalFromTime ? parseInt(historicalFromTime, 10) : null,
        historicalToTime: historicalToTime ? parseInt(historicalToTime, 10) : null,
      });
    }

    const transactions = await getAllUserTransactions(userId, accountId);
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
      accountId: tx.account_id,
    }));
    return NextResponse.json(formatted);
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json(
      { error: "Failed to read data" },
      { status: 500 }
    );
  }
}

// POST - save transactions or meta
export async function POST(request: Request) {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type") || "transactions";

  try {
    const userId = await requireAuth();
    const body = await request.json();

    if (type === "meta") {
      // Validate meta input
      const validatedMeta = validateInput(historicalMetaSchema, body);
      if (validatedMeta.lastSyncTime !== undefined) {
        await setUserSetting(userId, "lastSyncTime", String(validatedMeta.lastSyncTime ?? ""));
      }
      if (validatedMeta.historicalDataLoaded !== undefined) {
        await setUserSetting(userId, "historicalDataLoaded", String(validatedMeta.historicalDataLoaded));
      }
      if (validatedMeta.historicalFromTime !== undefined) {
        await setUserSetting(userId, "historicalFromTime", String(validatedMeta.historicalFromTime ?? ""));
      }
      if (validatedMeta.historicalToTime !== undefined) {
        await setUserSetting(userId, "historicalToTime", String(validatedMeta.historicalToTime ?? ""));
      }
      return NextResponse.json({ success: true });
    }

    // Validate transactions array with Zod
    const validatedTransactions = validateInput(historicalTransactionsSchema, body);

    // Convert from frontend format to DB format
    const dbTransactions: Omit<DbUserTransaction, "user_id">[] = validatedTransactions.map((tx) => ({
      id: tx.id,
      account_id: tx.accountId ?? null,
      time: tx.time,
      description: tx.description,
      mcc: tx.mcc,
      amount: tx.amount,
      balance: tx.balance,
      cashback_amount: tx.cashbackAmount ?? 0,
      currency_code: tx.currencyCode ?? 980,
      comment: tx.comment ?? null,
    }));

    await saveUserTransactions(userId, dbTransactions);
    return NextResponse.json({ success: true, count: dbTransactions.length });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error instanceof ValidationError) {
      return NextResponse.json({ error: "Validation failed", details: error.message }, { status: 400 });
    }
    return NextResponse.json(
      { error: "Failed to save data" },
      { status: 500 }
    );
  }
}

// DELETE - clear transactions after a timestamp or all
export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const afterTimestamp = searchParams.get("after");

  try {
    const userId = await requireAuth();

    if (afterTimestamp) {
      const timestamp = parseInt(afterTimestamp, 10);
      await deleteUserTransactionsAfter(userId, timestamp);
      return NextResponse.json({ success: true });
    }

    // Clear all user data
    await deleteUserTransactionsAfter(userId, 0);
    await clearUserExcludedTransactions(userId);
    await setUserSetting(userId, "lastSyncTime", "");
    await setUserSetting(userId, "historicalDataLoaded", "false");
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("DELETE /api/db/historical error:", error);
    return NextResponse.json(
      { error: "Failed to delete data", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
