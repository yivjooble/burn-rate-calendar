import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-utils";
import { getUserById, enableUserTotp, disableUserTotp, updateUserBackupCodes } from "@/lib/db";
import {
  generateTotpSecret,
  generateTotpUri,
  generateBackupCodes,
  verifyTotpCode,
  encrypt,
  decrypt,
} from "@/lib/totp";
import QRCode from "qrcode";

/**
 * GET /api/auth/2fa - Get 2FA status
 */
export async function GET(request: NextRequest) {
  try {
    const userId = await requireAuth();
    const user = await getUserById(userId);

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json({
      enabled: user.totp_enabled,
      hasBackupCodes: !!user.backup_codes,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Error getting 2FA status:", error);
    return NextResponse.json({ error: "Failed to get 2FA status" }, { status: 500 });
  }
}

/**
 * POST /api/auth/2fa - Enable, verify, or disable 2FA
 *
 * Actions:
 * - { action: "setup" } - Generate new TOTP secret and QR code
 * - { action: "enable", code: "123456" } - Verify code and enable 2FA
 * - { action: "disable", code: "123456" } - Verify code and disable 2FA
 * - { action: "regenerate-backup" } - Generate new backup codes
 */
export async function POST(request: NextRequest) {
  try {
    const userId = await requireAuth();
    const user = await getUserById(userId);

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const body = await request.json();
    const { action, code } = body;

    switch (action) {
      case "setup": {
        if (user.totp_enabled) {
          return NextResponse.json(
            { error: "2FA is already enabled" },
            { status: 400 }
          );
        }

        // Generate new secret
        const secret = generateTotpSecret();
        const uri = generateTotpUri(user.email, secret);
        const qrCode = await QRCode.toDataURL(uri);

        // Store secret temporarily (encrypted) - will be confirmed on enable
        // We use the setup session by returning the secret to the client
        // and they must verify it works before we save

        return NextResponse.json({
          secret,
          qrCode,
          uri,
        });
      }

      case "enable": {
        if (user.totp_enabled) {
          return NextResponse.json(
            { error: "2FA is already enabled" },
            { status: 400 }
          );
        }

        const { secret } = body;
        if (!secret || !code) {
          return NextResponse.json(
            { error: "Secret and code are required" },
            { status: 400 }
          );
        }

        // Verify the code works with the secret
        if (!verifyTotpCode(secret, code)) {
          return NextResponse.json(
            { error: "Invalid verification code" },
            { status: 400 }
          );
        }

        // Generate backup codes
        const backupCodes = generateBackupCodes();

        // Encrypt and save
        const encryptedSecret = encrypt(secret);
        const encryptedBackupCodes = encrypt(JSON.stringify(backupCodes));

        await enableUserTotp(userId, encryptedSecret, encryptedBackupCodes);

        return NextResponse.json({
          success: true,
          backupCodes, // Show once, user must save them
        });
      }

      case "disable": {
        if (!user.totp_enabled) {
          return NextResponse.json(
            { error: "2FA is not enabled" },
            { status: 400 }
          );
        }

        if (!code) {
          return NextResponse.json(
            { error: "Verification code is required" },
            { status: 400 }
          );
        }

        // Verify the code
        const decryptedSecret = decrypt(user.totp_secret!);
        if (!verifyTotpCode(decryptedSecret, code)) {
          return NextResponse.json(
            { error: "Invalid verification code" },
            { status: 400 }
          );
        }

        await disableUserTotp(userId);

        return NextResponse.json({ success: true });
      }

      case "regenerate-backup": {
        if (!user.totp_enabled) {
          return NextResponse.json(
            { error: "2FA is not enabled" },
            { status: 400 }
          );
        }

        if (!code) {
          return NextResponse.json(
            { error: "Verification code is required" },
            { status: 400 }
          );
        }

        // Verify the code
        const decryptedSecret = decrypt(user.totp_secret!);
        if (!verifyTotpCode(decryptedSecret, code)) {
          return NextResponse.json(
            { error: "Invalid verification code" },
            { status: 400 }
          );
        }

        // Generate new backup codes
        const backupCodes = generateBackupCodes();
        const encryptedBackupCodes = encrypt(JSON.stringify(backupCodes));

        await updateUserBackupCodes(userId, encryptedBackupCodes);

        return NextResponse.json({
          success: true,
          backupCodes,
        });
      }

      default:
        return NextResponse.json(
          { error: "Invalid action" },
          { status: 400 }
        );
    }
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Error in 2FA operation:", error);
    return NextResponse.json({ error: "Failed to process 2FA request" }, { status: 500 });
  }
}
