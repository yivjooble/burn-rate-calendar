import { NextResponse } from "next/server";
import { getUserExcludedTransactionIds, addUserExcludedTransaction, removeUserExcludedTransaction } from "@/lib/db";
import { requireAuth } from "@/lib/auth-utils";
import { excludedTransactionSchema, validateInput, ValidationError } from "@/lib/validation";

export async function GET() {
  try {
    const userId = await requireAuth();
    const ids = await getUserExcludedTransactionIds(userId);
    return NextResponse.json(ids);
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Error getting excluded transactions:", error);
    return NextResponse.json({ error: "Failed to get excluded transactions" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const userId = await requireAuth();
    const body = await request.json();
    
    // Validate input
    const { id, action } = validateInput(excludedTransactionSchema, body);
    
    if (action === "remove") {
      await removeUserExcludedTransaction(userId, id);
    } else {
      await addUserExcludedTransaction(userId, id);
    }
    
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Error updating excluded transaction:", error);
    return NextResponse.json({ error: "Failed to update excluded transaction" }, { status: 500 });
  }
}
