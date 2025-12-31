import { NextRequest, NextResponse } from "next/server";
import { getUserByEmail } from "@/lib/db";
import { scryptSync, timingSafeEqual } from "crypto";
import { checkRateLimit, getClientIdentifier, AUTH_RATE_LIMIT } from "@/lib/rate-limit";

/**
 * Verify password against stored hash using constant-time comparison.
 */
function verifyPassword(password: string, storedHash: string, salt: string): boolean {
  const hash = scryptSync(password, salt, 64).toString("hex");
  const storedBuffer = Buffer.from(storedHash, "hex");
  const hashBuffer = Buffer.from(hash, "hex");

  if (storedBuffer.length !== hashBuffer.length) {
    return false;
  }

  return timingSafeEqual(storedBuffer, hashBuffer);
}

/**
 * POST /api/auth/pre-login
 * Check if credentials are valid and if 2FA is required.
 * This endpoint is called before the actual signIn to determine if 2FA form should be shown.
 */
export async function POST(request: NextRequest) {
  try {
    // Rate limit
    const clientId = getClientIdentifier(request);
    const rateLimit = checkRateLimit(`pre-login:${clientId}`, AUTH_RATE_LIMIT);

    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: "Забагато спроб. Зачекайте хвилину." },
        { status: 429 }
      );
    }

    const body = await request.json();
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email та пароль обов'язкові" },
        { status: 400 }
      );
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Get user
    const user = await getUserByEmail(normalizedEmail);

    if (!user) {
      // Don't reveal that user doesn't exist
      return NextResponse.json(
        { valid: false, requires2FA: false },
        { status: 200 }
      );
    }

    // Check if this is an OAuth-only user (placeholder password)
    const isOAuthUser = user.password_hash.length === 64 && user.password_salt.length === 64;

    // Verify password
    const passwordValid = verifyPassword(password, user.password_hash, user.password_salt);

    if (!passwordValid) {
      // If OAuth user and wrong password, still return generic response
      if (isOAuthUser) {
        return NextResponse.json(
          { valid: false, requires2FA: false },
          { status: 200 }
        );
      }
      return NextResponse.json(
        { valid: false, requires2FA: false },
        { status: 200 }
      );
    }

    // Password is valid - check if 2FA is required
    const requires2FA = !!(user.totp_enabled && user.totp_secret);

    console.log("[PRE-LOGIN] Credentials valid for:", normalizedEmail, "requires2FA:", requires2FA);

    return NextResponse.json({
      valid: true,
      requires2FA,
    });
  } catch (error) {
    console.error("Pre-login error:", error);
    return NextResponse.json(
      { error: "Помилка перевірки" },
      { status: 500 }
    );
  }
}
