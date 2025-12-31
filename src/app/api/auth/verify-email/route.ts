import { NextRequest, NextResponse } from "next/server";
import { getUserByVerificationToken, verifyUserEmail } from "@/lib/db";
import { checkRateLimit, getClientIdentifier, SENSITIVE_RATE_LIMIT } from "@/lib/rate-limit";

/**
 * GET /api/auth/verify-email?token=xxx
 * Validate verification token
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get("token");

    if (!token) {
      return NextResponse.json(
        { valid: false, error: "Токен відсутній" },
        { status: 400 }
      );
    }

    // Find user by verification token
    const user = await getUserByVerificationToken(token);

    if (!user) {
      return NextResponse.json({
        valid: false,
        error: "Посилання недійсне або вже використане",
      });
    }

    if (user.emailVerified) {
      return NextResponse.json({
        valid: false,
        error: "Email вже підтверджено",
      });
    }

    return NextResponse.json({
      valid: true,
      email: user.email,
    });
  } catch (error) {
    console.error("Verify email validation error:", error);
    return NextResponse.json(
      { valid: false, error: "Помилка перевірки токена" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/auth/verify-email
 * Verify email with token
 */
export async function POST(request: NextRequest) {
  try {
    // Rate limit
    const clientId = getClientIdentifier(request);
    const rateLimit = checkRateLimit(`verify-email:${clientId}`, SENSITIVE_RATE_LIMIT);

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
    const { token } = body;

    if (!token || typeof token !== "string") {
      return NextResponse.json(
        { error: "Токен відсутній" },
        { status: 400 }
      );
    }

    // Find user by verification token
    const user = await getUserByVerificationToken(token);

    if (!user) {
      return NextResponse.json(
        { error: "Посилання недійсне або вже використане" },
        { status: 400 }
      );
    }

    if (user.emailVerified) {
      return NextResponse.json({
        success: true,
        message: "Email вже підтверджено. Ви можете увійти.",
      });
    }

    // Verify email
    await verifyUserEmail(user.id);

    return NextResponse.json({
      success: true,
      message: "Email успішно підтверджено! Тепер ви можете увійти.",
    });
  } catch (error) {
    console.error("Verify email error:", error);
    return NextResponse.json(
      { error: "Помилка підтвердження email" },
      { status: 500 }
    );
  }
}
