import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-utils";

/**
 * POST /api/db/transaction-comments
 * Save or update a transaction comment
 */
export async function POST(request: NextRequest) {
  try {
    const userId = await requireAuth();
    const body = await request.json();

    const { transactionId, comment } = body;

    if (!transactionId) {
      return NextResponse.json(
        { error: "transactionId is required" },
        { status: 400 }
      );
    }

    // For now, we'll store comments in a simple key-value format in settings
    // In a production app, you might want a separate table for this
    const key = `transaction_comment_${transactionId}`;
    const value = comment || null; // null to delete

    await fetch(`${process.env.NEXTAUTH_URL}/api/db/settings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key, value: value ? String(value) : null }),
      credentials: "include",
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Error saving transaction comment:", error);
    return NextResponse.json(
      { error: "Failed to save transaction comment" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/db/transaction-comments?transactionId=xxx
 * Get a specific transaction comment
 */
export async function GET(request: NextRequest) {
  try {
    const userId = await requireAuth();
    const { searchParams } = new URL(request.url);
    const transactionId = searchParams.get("transactionId");

    if (!transactionId) {
      return NextResponse.json(
        { error: "transactionId is required" },
        { status: 400 }
      );
    }

    // Get comment from settings
    const key = `transaction_comment_${transactionId}`;
    const response = await fetch(`${process.env.NEXTAUTH_URL}/api/db/settings?key=${key}`, {
      credentials: "include",
    });

    if (response.ok) {
      const data = await response.json();
      return NextResponse.json({ comment: data[key] });
    } else {
      return NextResponse.json({ comment: null });
    }
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Error getting transaction comment:", error);
    return NextResponse.json(
      { error: "Failed to get transaction comment" },
      { status: 500 }
    );
  }
}
