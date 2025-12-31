import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getUserSetting, setUserSetting, deleteUserSetting } from "@/lib/db";
import { encryptToken, isEncrypted } from "@/lib/crypto";

/**
 * GET /api/db/mono-token
 * Check if user has a Monobank token saved
 * Never returns the actual token for security
 */
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;
    const encryptedToken = await getUserSetting(userId, "monoToken");

    return NextResponse.json({
      hasToken: !!encryptedToken,
      // Never return the actual token
    });
  } catch (error) {
    console.error("Get mono token status error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/db/mono-token
 * Save a new Monobank token (encrypted)
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;
    const body = await request.json();
    const { token } = body;

    if (!token || typeof token !== "string") {
      return NextResponse.json(
        { error: "Token is required" },
        { status: 400 }
      );
    }

    // Basic validation - Monobank tokens are typically 44 characters
    const trimmedToken = token.trim();
    if (trimmedToken.length < 20 || trimmedToken.length > 100) {
      return NextResponse.json(
        { error: "Invalid token format" },
        { status: 400 }
      );
    }

    // Encrypt the token if not already encrypted
    const encryptedToken = isEncrypted(trimmedToken)
      ? trimmedToken
      : encryptToken(trimmedToken);

    // Save to database
    await setUserSetting(userId, "monoToken", encryptedToken);

    return NextResponse.json({
      success: true,
      message: "Токен збережено",
    });
  } catch (error) {
    console.error("Save mono token error:", error);
    return NextResponse.json(
      { error: "Failed to save token" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/db/mono-token
 * Remove the Monobank token
 */
export async function DELETE() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;

    // Delete the token
    await deleteUserSetting(userId, "monoToken");

    return NextResponse.json({
      success: true,
      message: "Токен видалено",
    });
  } catch (error) {
    console.error("Delete mono token error:", error);
    return NextResponse.json(
      { error: "Failed to delete token" },
      { status: 500 }
    );
  }
}
