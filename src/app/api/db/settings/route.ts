import { NextRequest, NextResponse } from "next/server";
import { getAllUserSettings, setUserSetting } from "@/lib/db";
import { requireAuth } from "@/lib/auth-utils";
import { setSettingSchema, validateInput, ValidationError } from "@/lib/validation";

// Sensitive keys that should NEVER be returned to client
// Token status is checked via /api/db/mono-token instead
const SENSITIVE_KEYS = ["monoToken"];

export async function GET() {
  try {
    const userId = await requireAuth();
    const settings = await getAllUserSettings(userId);

    // NEVER return sensitive fields to client
    // Remove monoToken entirely - client should use /api/db/mono-token to check status
    const safeSettings = { ...settings };
    for (const key of SENSITIVE_KEYS) {
      delete safeSettings[key];
    }

    return NextResponse.json(safeSettings);
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Error getting settings:", error);
    return NextResponse.json({ error: "Failed to get settings" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = await requireAuth();
    const body = await request.json();

    // Validate input
    const { key, value } = validateInput(setSettingSchema, body);

    // Block sensitive keys - monoToken must be saved via /api/db/mono-token only
    if (SENSITIVE_KEYS.includes(key)) {
      return NextResponse.json(
        { error: "Use dedicated API endpoint for this setting" },
        { status: 400 }
      );
    }

    await setUserSetting(userId, key, value);
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Error setting value:", error);
    return NextResponse.json({ error: "Failed to set value" }, { status: 500 });
  }
}
