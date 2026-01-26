import { NextResponse } from "next/server";
import { getUserIncludedTransactionIds, addUserIncludedTransaction, removeUserIncludedTransaction } from "@/lib/db";
import { requireAuth } from "@/lib/auth-utils";
import { includedTransactionSchema, validateInput, ValidationError } from "@/lib/validation";

// Helper to check if error is due to missing table/column
function isMissingSchemaError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const message = error.message.toLowerCase();
  // Prisma error codes: P2021 = table doesn't exist, P2022 = column doesn't exist
  return (
    message.includes("does not exist") ||
    message.includes("p2021") ||
    message.includes("p2022") ||
    message.includes("relation") && message.includes("does not exist")
  );
}

export async function GET() {
  try {
    const userId = await requireAuth();
    const ids = await getUserIncludedTransactionIds(userId);
    return NextResponse.json(ids);
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    // Handle missing table gracefully - return empty array
    if (isMissingSchemaError(error)) {
      console.warn("UserIncludedTransaction table not yet created, returning empty array");
      return NextResponse.json([]);
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
    // Handle missing table gracefully - return success but log warning
    if (isMissingSchemaError(error)) {
      console.warn("UserIncludedTransaction table not yet created, skipping operation");
      return NextResponse.json({ success: true, warning: "Table not yet created" });
    }
    console.error("Error updating included transaction:", error);
    return NextResponse.json({ error: "Failed to update included transaction" }, { status: 500 });
  }
}
