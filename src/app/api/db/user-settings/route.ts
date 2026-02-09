import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getAllUserSettings, setUserSetting, getUserSetting, setUserSetting as saveUserSetting } from "@/lib/db";
import { requireAuth } from "@/lib/auth-utils";

// Sensitive keys that should NEVER be returned to client
const SENSITIVE_KEYS = ["monoToken"];

// Map database keys to response format
interface UserSettingsResponse {
  accountId?: string;
  accountBalance?: number;
  accountCurrency?: number;
  financialMonthStart?: number;
  useAIBudget?: boolean;
  [key: string]: string | number | boolean | undefined;
}

export async function GET() {
  try {
    const userId = await requireAuth();
    const settings = await getAllUserSettings(userId);

    // Transform database format to response format
    const response: UserSettingsResponse = {};
    
    if (settings.accountId) response.accountId = settings.accountId;
    if (settings.accountBalance) response.accountBalance = Number(settings.accountBalance);
    if (settings.accountCurrency) response.accountCurrency = Number(settings.accountCurrency);
    if (settings.financialMonthStart) response.financialMonthStart = Number(settings.financialMonthStart);
    if (settings.useAIBudget !== undefined) response.useAIBudget = settings.useAIBudget === "true";

    // Never return sensitive fields
    delete response.monoToken;

    return NextResponse.json(response);
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Error getting user settings:", error);
    return NextResponse.json({ error: "Failed to get settings" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = await requireAuth();
    const body = await request.json();

    // Handle bulk update
    if (body.settings && typeof body.settings === "object") {
      const settings = body.settings as Record<string, string | number | boolean>;
      
      await Promise.all(
        Object.entries(settings).map(async ([key, value]) => {
          // Block sensitive keys
          if (SENSITIVE_KEYS.includes(key)) {
            throw new Error(`Cannot set sensitive key: ${key}`);
          }
          // Convert value to string for storage
          await saveUserSetting(userId, key, String(value));
        })
      );
      
      return NextResponse.json({ success: true });
    }

    // Handle single key update (backward compatibility)
    if (body.key && body.value !== undefined) {
      const { key, value } = body;

      // Block sensitive keys
      if (SENSITIVE_KEYS.includes(key)) {
        return NextResponse.json(
          { error: "Cannot set sensitive key via this endpoint" },
          { status: 400 }
        );
      }

      await saveUserSetting(userId, key, String(value));
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Error saving user settings:", error);
    return NextResponse.json({ error: "Failed to save settings" }, { status: 500 });
  }
}
