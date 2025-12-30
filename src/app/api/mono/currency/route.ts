import { NextResponse } from "next/server";

export async function GET() {
  try {
    const response = await fetch("https://api.monobank.ua/bank/currency", {
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: `Monobank API error: ${response.status}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch currency rates" },
      { status: 500 }
    );
  }
}
