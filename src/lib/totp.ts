import * as OTPAuth from "otpauth";
import { randomBytes, createCipheriv, createDecipheriv } from "crypto";

const ENCRYPTION_KEY = process.env.TOTP_ENCRYPTION_KEY || process.env.ENCRYPTION_KEY;
const ALGORITHM = "aes-256-gcm";
const APP_NAME = "BurnRateCalendar";

/**
 * Encrypt sensitive data (TOTP secret, backup codes)
 */
export function encrypt(text: string): string {
  if (!ENCRYPTION_KEY) {
    throw new Error("TOTP_ENCRYPTION_KEY or ENCRYPTION_KEY environment variable is required");
  }

  const key = Buffer.from(ENCRYPTION_KEY, "hex");
  const iv = randomBytes(16);
  const cipher = createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");

  const authTag = cipher.getAuthTag();

  // Format: iv:authTag:encrypted
  return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted}`;
}

/**
 * Decrypt sensitive data
 */
export function decrypt(encryptedText: string): string {
  if (!ENCRYPTION_KEY) {
    throw new Error("TOTP_ENCRYPTION_KEY or ENCRYPTION_KEY environment variable is required");
  }

  const [ivHex, authTagHex, encrypted] = encryptedText.split(":");
  if (!ivHex || !authTagHex || !encrypted) {
    throw new Error("Invalid encrypted data format");
  }

  const key = Buffer.from(ENCRYPTION_KEY, "hex");
  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(authTagHex, "hex");

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encrypted, "hex", "utf8");
  decrypted += decipher.final("utf8");

  return decrypted;
}

/**
 * Generate a new TOTP secret
 */
export function generateTotpSecret(): string {
  const secret = new OTPAuth.Secret({ size: 20 });
  return secret.base32;
}

/**
 * Generate TOTP URI for QR code
 */
export function generateTotpUri(email: string, secret: string): string {
  const totp = new OTPAuth.TOTP({
    issuer: APP_NAME,
    label: email,
    algorithm: "SHA1",
    digits: 6,
    period: 30,
    secret: OTPAuth.Secret.fromBase32(secret),
  });

  return totp.toString();
}

/**
 * Verify a TOTP code
 */
export function verifyTotpCode(secret: string, code: string): boolean {
  const totp = new OTPAuth.TOTP({
    issuer: APP_NAME,
    algorithm: "SHA1",
    digits: 6,
    period: 30,
    secret: OTPAuth.Secret.fromBase32(secret),
  });

  // Allow 1 period of drift in each direction
  const delta = totp.validate({ token: code, window: 1 });

  return delta !== null;
}

/**
 * Generate backup codes (8 codes, 8 characters each)
 */
export function generateBackupCodes(): string[] {
  const codes: string[] = [];
  for (let i = 0; i < 8; i++) {
    const code = randomBytes(4).toString("hex").toUpperCase();
    codes.push(code);
  }
  return codes;
}

/**
 * Verify a backup code and return updated list (with used code removed)
 */
export function verifyBackupCode(
  codes: string[],
  inputCode: string
): { valid: boolean; remainingCodes: string[] } {
  const normalizedInput = inputCode.toUpperCase().replace(/\s/g, "");
  const index = codes.findIndex((c) => c === normalizedInput);

  if (index === -1) {
    return { valid: false, remainingCodes: codes };
  }

  // Remove used code
  const remainingCodes = [...codes];
  remainingCodes.splice(index, 1);

  return { valid: true, remainingCodes };
}
