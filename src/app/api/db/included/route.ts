import { NextResponse } from "next/server";
import { getUserIncludedTransactionIds, addUserIncludedTransaction, removeUserIncludedTransaction } from "@/lib/db";
import { requireAuth } from "@/lib/auth-utils";
import { includedTransactionSchema, validateInput, ValidationError } from "@/lib/validation";

export async function GET() {
  try {
    const userId = await requireAuth();
    const ids = await getUserIncludedTransactionIds(userId);
    return NextResponse.json(ids);
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Error getting included transactions:", error);
    return NextResponse.json({ error: "Failed to get included transactions" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const userId = await requireAuth();
    const body = await request.json();

    // Validate input
    const { id, action } = validateInput(includedTransactionSchema, body);

    if (action === "remove") {
      await removeUserIncludedTransaction(userId, id);
    } else {
      await addUserIncludedTransaction(userId, id);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Error updating included transaction:", error);
    return NextResponse.json({ error: "Failed to update included transaction" }, { status: 500 });
  }
}
