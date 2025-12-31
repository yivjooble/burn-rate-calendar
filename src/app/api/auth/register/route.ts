import { NextRequest, NextResponse } from "next/server";
import { randomBytes, scryptSync } from "crypto";
import { getUserByEmail, createUnverifiedUser } from "@/lib/db";
import { sendVerificationEmail } from "@/lib/email";
import { checkRateLimit, getClientIdentifier, SENSITIVE_RATE_LIMIT } from "@/lib/rate-limit";
import { registerSchema } from "@/lib/validation";

/**
 * Hash password using scrypt (OWASP recommended).
 */
function hashPassword(password: string): { hash: string; salt: string } {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return { hash, salt };
}

/**
 * POST /api/auth/register
 * Register a new user with email verification
 */
export async function POST(request: NextRequest) {
  try {
    // Rate limit - strict for registration
    const clientId = getClientIdentifier(request);
    const rateLimit = checkRateLimit(`register:${clientId}`, SENSITIVE_RATE_LIMIT);

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
    const validation = registerSchema.safeParse(body);
    if (!validation.success) {
      const errors = validation.error.issues.map((i) => i.message);
      return NextResponse.json(
        { error: errors[0] },
        { status: 400 }
      );
    }

    const { email, password } = validation.data;
    const normalizedEmail = email.toLowerCase().trim();

    // Check if user already exists
    const existingUser = await getUserByEmail(normalizedEmail);
    if (existingUser) {
      // Don't reveal that user exists - just say email sent
      // But actually don't send anything for security
      return NextResponse.json({
        success: true,
        message: "Якщо цей email ще не зареєстрований, ви отримаєте лист для підтвердження.",
      });
    }

    // Generate user ID and verification token
    const userId = randomBytes(16).toString("hex");
    const verificationToken = randomBytes(32).toString("hex");
    const verificationExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    // Hash password
    const { hash, salt } = hashPassword(password);

    // Create unverified user
    await createUnverifiedUser(
      userId,
      normalizedEmail,
      hash,
      salt,
      verificationToken,
      verificationExpiry
    );

    // Send verification email
    const emailResult = await sendVerificationEmail(normalizedEmail, verificationToken);
    if (!emailResult.success) {
      console.error("Failed to send verification email:", emailResult.error);
      // Still return success to prevent enumeration
    }

    return NextResponse.json({
      success: true,
      message: "Якщо цей email ще не зареєстрований, ви отримаєте лист для підтвердження.",
    });
  } catch (error) {
    console.error("Registration error:", error);
    return NextResponse.json(
      { error: "Помилка реєстрації. Спробуйте ще раз." },
      { status: 500 }
    );
  }
}
