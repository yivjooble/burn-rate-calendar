import { NextRequest, NextResponse } from "next/server";
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

// GET - retrieve transactions and meta
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type") || "transactions";

  try {
    const userId = await requireAuth(request);

    if (type === "meta") {
      const lastSyncTime = await getUserSetting(userId, "lastSyncTime");
      const historicalDataLoaded = await getUserSetting(userId, "historicalDataLoaded");
      
      return NextResponse.json({
        lastSyncTime: lastSyncTime ? parseInt(lastSyncTime, 10) : null,
        historicalDataLoaded: historicalDataLoaded === "true",
      });
    }

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
    return NextResponse.json(
      { error: "Failed to read data" },
      { status: 500 }
    );
  }
}

// POST - save transactions or meta
export async function POST(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type") || "transactions";

  try {
    const userId = await requireAuth(request);
    const body = await request.json();

    if (type === "meta") {
      if (body.lastSyncTime !== undefined) {
        await setUserSetting(userId, "lastSyncTime", String(body.lastSyncTime));
      }
      if (body.historicalDataLoaded !== undefined) {
        await setUserSetting(userId, "historicalDataLoaded", String(body.historicalDataLoaded));
      }
      return NextResponse.json({ success: true });
    }

    // Validate body is an array
    if (!Array.isArray(body)) {
      console.error("Body is not an array:", typeof body, body);
      return NextResponse.json({ error: "Invalid data format - expected array" }, { status: 400 });
    }

    // Convert from frontend format to DB format
    const dbTransactions: Omit<DbUserTransaction, "user_id">[] = body.map((tx: Record<string, unknown>) => ({
      id: tx.id as string,
      time: tx.time as number,
      description: tx.description as string,
      mcc: tx.mcc as number,
      amount: tx.amount as number,
      balance: tx.balance as number,
      cashback_amount: (tx.cashbackAmount as number) || 0,
      currency_code: (tx.currencyCode as number) || 980,
      comment: (tx.comment as string) || null,
    }));

    console.log("Saving transactions:", dbTransactions.length, "first:", dbTransactions[0]);
    await saveUserTransactions(userId, dbTransactions);
    return NextResponse.json({ success: true, count: dbTransactions.length });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Error saving historical data:", error);
    return NextResponse.json(
      { error: "Failed to save data", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

// DELETE - clear transactions after a timestamp or all
export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const afterTimestamp = searchParams.get("after");

  try {
    const userId = await requireAuth(request);

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
    return NextResponse.json(
      { error: "Failed to delete data" },
      { status: 500 }
    );
  }
}
