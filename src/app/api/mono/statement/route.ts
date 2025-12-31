import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-utils";

export async function GET(request: Request) {
  try {
    await requireAuth();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const token = request.headers.get("x-token");
  const { searchParams } = new URL(request.url);
  const accountId = searchParams.get("account") || "0";
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const currencyCode = searchParams.get("currencyCode");

  if (!token) {
    return NextResponse.json({ error: "Token is required" }, { status: 401 });
  }

  if (!from) {
    return NextResponse.json(
      { error: "From timestamp is required" },
      { status: 400 }
    );
  }

  try {
    const url = to
      ? `https://api.monobank.ua/personal/statement/${accountId}/${from}/${to}`
      : `https://api.monobank.ua/personal/statement/${accountId}/${from}`;

    const response = await fetch(url, {
      headers: {
        "X-Token": token,
      },
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: `Monobank API error: ${response.status}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    // Add currencyCode to each transaction if provided
    if (currencyCode && Array.isArray(data)) {
      const code = parseInt(currencyCode, 10);
      data.forEach((tx: Record<string, unknown>) => {
        tx.currencyCode = code;
      });
    }
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch statement" },
      { status: 500 }
    );
  }
}
