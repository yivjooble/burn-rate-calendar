import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-utils";

export async function GET(request: NextRequest) {
  try {
    await requireAuth(request);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const token = request.headers.get("x-token");

  if (!token) {
    return NextResponse.json(
      { error: "Token is required" },
      { status: 401 }
    );
  }

  try {
    const response = await fetch(
      "https://api.monobank.ua/personal/client-info",
      {
        headers: {
          "X-Token": token,
        },
      }
    );

    if (!response.ok) {
      const error = await response.text();
      return NextResponse.json(
        { error: `Monobank API error: ${response.status}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch client info" },
      { status: 500 }
    );
  }
}
