import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { getUserByEmail, setUserResetToken } from "@/lib/db";
import { sendPasswordResetEmail } from "@/lib/email";
import { checkRateLimit, getClientIdentifier, SENSITIVE_RATE_LIMIT } from "@/lib/rate-limit";

/**
 * POST /api/auth/forgot-password
 * Request password reset email
 */
export async function POST(request: NextRequest) {
  try {
    // Rate limit - very strict for password reset
    const clientId = getClientIdentifier(request);
    const rateLimit = checkRateLimit(`forgot-password:${clientId}`, SENSITIVE_RATE_LIMIT);

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
    const { email } = body;

    if (!email || typeof email !== "string") {
      return NextResponse.json(
        { error: "Email is required" },
        { status: 400 }
      );
    }

    // Normalize email
    const normalizedEmail = email.toLowerCase().trim();

    // Always return success to prevent email enumeration
    const successResponse = NextResponse.json({
      success: true,
      message: "Якщо цей email зареєстрований, ви отримаєте лист з інструкціями.",
    });

    // Find user
    const user = await getUserByEmail(normalizedEmail);
    if (!user) {
      // Don't reveal that user doesn't exist
      return successResponse;
    }

    // Check if user has a password (not OAuth-only)
    if (!user.password_hash) {
      // User signed up with OAuth, can't reset password
      return successResponse;
    }

    // Generate reset token
    const resetToken = randomBytes(32).toString("hex");
    const expiryDate = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    // Save token to database
    await setUserResetToken(user.id, resetToken, expiryDate);

    // Send email
    const emailResult = await sendPasswordResetEmail(normalizedEmail, resetToken);
    if (!emailResult.success) {
      console.error("Failed to send password reset email:", emailResult.error);
      // Still return success to prevent enumeration
    }

    return successResponse;
  } catch (error) {
    console.error("Forgot password error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
