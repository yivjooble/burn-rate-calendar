import { NextRequest, NextResponse } from "next/server";
import { randomBytes, scryptSync, timingSafeEqual } from "crypto";
import { auth } from "@/auth";
import { getUserByEmail, updateUserPassword } from "@/lib/db";
import { checkRateLimit, getClientIdentifier, SENSITIVE_RATE_LIMIT } from "@/lib/rate-limit";
import { passwordSchema } from "@/lib/validation";
import { z } from "zod";

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Поточний пароль обов'язковий"),
  newPassword: passwordSchema,
});

/**
 * Hash password using scrypt (OWASP recommended).
 */
function hashPassword(password: string, salt?: string): { hash: string; salt: string } {
  const passwordSalt = salt || randomBytes(16).toString("hex");
  const hash = scryptSync(password, passwordSalt, 64).toString("hex");
  return { hash, salt: passwordSalt };
}

/**
 * Verify password against stored hash using constant-time comparison.
 */
function verifyPassword(password: string, storedHash: string, salt: string): boolean {
  const { hash } = hashPassword(password, salt);
  const storedBuffer = Buffer.from(storedHash, "hex");
  const hashBuffer = Buffer.from(hash, "hex");

  if (storedBuffer.length !== hashBuffer.length) {
    return false;
  }

  return timingSafeEqual(storedBuffer, hashBuffer);
}

/**
 * POST /api/auth/change-password
 * Change password for authenticated user
 */
export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json(
        { error: "Необхідна авторизація" },
        { status: 401 }
      );
    }

    // Rate limit
    const clientId = getClientIdentifier(request);
    const rateLimit = checkRateLimit(`change-password:${clientId}`, SENSITIVE_RATE_LIMIT);

    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: "Забагато спроб. Зачекайте 5 хвилин." },
        {
          status: 429,
          headers: {
            "X-RateLimit-Remaining": rateLimit.remaining.toString(),
            "X-RateLimit-Reset": rateLimit.resetTime.toString(),
          },
        }
      );
    }

    const body = await request.json();

    // Validate input
    const validation = changePasswordSchema.safeParse(body);
    if (!validation.success) {
      const errors = validation.error.issues.map((i) => i.message);
      return NextResponse.json(
        { error: errors[0] },
        { status: 400 }
      );
    }

    const { currentPassword, newPassword } = validation.data;

    // Get user from database
    const user = await getUserByEmail(session.user.email);
    if (!user) {
      return NextResponse.json(
        { error: "Користувача не знайдено" },
        { status: 404 }
      );
    }

    // Check if user has a password (not OAuth-only)
    if (!user.password_hash || !user.password_salt) {
      return NextResponse.json(
        { error: "Цей акаунт використовує Google OAuth. Встановіть пароль через 'Забули пароль?'" },
        { status: 400 }
      );
    }

    // Verify current password
    if (!verifyPassword(currentPassword, user.password_hash, user.password_salt)) {
      return NextResponse.json(
        { error: "Поточний пароль невірний" },
        { status: 400 }
      );
    }

    // Hash new password
    const { hash, salt } = hashPassword(newPassword);

    // Update password
    await updateUserPassword(user.id, hash, salt);

    console.log("[AUTH] Password changed successfully for:", session.user.email);

    return NextResponse.json({
      success: true,
      message: "Пароль успішно змінено",
    });
  } catch (error) {
    console.error("Change password error:", error);
    return NextResponse.json(
      { error: "Помилка зміни пароля. Спробуйте ще раз." },
      { status: 500 }
    );
  }
}
