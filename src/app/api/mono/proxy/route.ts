import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getUserSetting } from "@/lib/db";
import { decryptToken } from "@/lib/crypto";

const MONOBANK_API = "https://api.monobank.ua";

/**
 * POST /api/mono/proxy
 * Server-side proxy for Monobank API calls
 * Token is retrieved from database and never exposed to client
 *
 * Body: { endpoint: string, method?: "GET" | "POST", body?: object }
 *
 * Supported endpoints:
 * - /personal/client-info - Get account info
 * - /personal/statement/{account}/{from}/{to} - Get transactions
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;

    // Get encrypted token from database
    const encryptedToken = await getUserSetting(userId, "monoToken");
    if (!encryptedToken) {
      return NextResponse.json(
        { error: "Monobank токен не налаштовано" },
        { status: 400 }
      );
    }

    // Decrypt token (server-side only)
    const token = decryptToken(encryptedToken);

    // Parse request body
    const body = await request.json();
    const { endpoint, method = "GET", data } = body;

    if (!endpoint || typeof endpoint !== "string") {
      return NextResponse.json(
        { error: "Endpoint is required" },
        { status: 400 }
      );
    }

    // Validate endpoint to prevent arbitrary API calls
    const allowedEndpoints = [
      /^\/personal\/client-info$/,
      /^\/personal\/statement\/[\w-]+\/\d+\/\d+$/,
      /^\/personal\/statement\/[\w-]+\/\d+$/,
    ];

    const isAllowed = allowedEndpoints.some((pattern) => pattern.test(endpoint));
    if (!isAllowed) {
      return NextResponse.json(
        { error: "Endpoint not allowed" },
        { status: 403 }
      );
    }

    // Make request to Monobank API
    const monoUrl = `${MONOBANK_API}${endpoint}`;
    const fetchOptions: RequestInit = {
      method,
      headers: {
        "X-Token": token,
        "Content-Type": "application/json",
      },
    };

    if (method === "POST" && data) {
      fetchOptions.body = JSON.stringify(data);
    }

    const response = await fetch(monoUrl, fetchOptions);

    // Handle rate limiting
    if (response.status === 429) {
      return NextResponse.json(
        { error: "Too many requests to Monobank API. Please wait 60 seconds." },
        { status: 429 }
      );
    }

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Monobank API error:", response.status, errorText);
      return NextResponse.json(
        { error: `Monobank API error: ${response.status}` },
        { status: response.status }
      );
    }

    const responseData = await response.json();
    return NextResponse.json(responseData);
  } catch (error) {
    console.error("Mono proxy error:", error);
    return NextResponse.json(
      { error: "Failed to proxy Monobank request" },
      { status: 500 }
    );
  }
}
