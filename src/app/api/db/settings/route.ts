import { NextRequest, NextResponse } from "next/server";
import { getAllUserSettings, setUserSetting } from "@/lib/db";
import { encryptToken, decryptToken } from "@/lib/crypto";
import { requireAuth } from "@/lib/auth-utils";
import { setSettingSchema, validateInput, ValidationError } from "@/lib/validation";

const SENSITIVE_KEYS = ["monoToken"];

export async function GET(request: NextRequest) {
  try {
    const userId = await requireAuth();
    const settings = await getAllUserSettings(userId);
    
    // Decrypt sensitive fields before sending to client
    const decryptedSettings = { ...settings };
    for (const key of SENSITIVE_KEYS) {
      if (decryptedSettings[key]) {
        try {
          decryptedSettings[key] = decryptToken(decryptedSettings[key]);
        } catch (err) {
          console.error(`Failed to decrypt ${key}:`, err);
          // If decryption fails, remove the field (corrupted data)
          delete decryptedSettings[key];
        }
      }
    }
    
    return NextResponse.json(decryptedSettings);
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
    
    let valueToStore = value;
    
    // Encrypt sensitive fields before storing
    if (SENSITIVE_KEYS.includes(key) && valueToStore) {
      valueToStore = encryptToken(valueToStore);
    }
    
    await setUserSetting(userId, key, valueToStore);
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
