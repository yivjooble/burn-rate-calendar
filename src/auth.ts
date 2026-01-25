import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";
import { getUserByEmail, updateUserBackupCodes, isEmailVerified, createUser } from "@/lib/db";
import { scryptSync, timingSafeEqual, randomBytes } from "crypto";
import { verifyTotpCode, verifyBackupCode, decrypt, encrypt } from "@/lib/totp";

/**
 * Hash password using scrypt (OWASP recommended).
 * Cost parameters follow OWASP guidelines for 2024.
 */
function hashPassword(password: string, salt?: string): { hash: string; salt: string } {
  const passwordSalt = salt || randomBytes(16).toString("hex");
  const hash = scryptSync(password, passwordSalt, 64, {
    N: 2 ** 17,  // CPU/memory cost (OWASP 2024)
    r: 8,        // Block size
    p: 1,        // Parallelization
  }).toString("hex");
  return { hash, salt: passwordSalt };
}

/**
 * Hash password using legacy scrypt parameters (Node.js defaults).
 * Used for backwards compatibility with existing passwords.
 */
function hashPasswordLegacy(password: string, salt: string): string {
  return scryptSync(password, salt, 64).toString("hex");
}

/**
 * Verify password against stored hash using constant-time comparison.
 * Supports both new OWASP 2024 parameters and legacy defaults for backwards compatibility.
 */
function verifyPassword(password: string, storedHash: string, salt: string): boolean {
  const storedBuffer = Buffer.from(storedHash, "hex");

  // Try new OWASP 2024 parameters first
  const { hash: newHash } = hashPassword(password, salt);
  const newHashBuffer = Buffer.from(newHash, "hex");

  if (storedBuffer.length === newHashBuffer.length && timingSafeEqual(storedBuffer, newHashBuffer)) {
    return true;
  }

  // Fallback: try legacy parameters (for existing passwords)
  const legacyHash = hashPasswordLegacy(password, salt);
  const legacyHashBuffer = Buffer.from(legacyHash, "hex");

  if (storedBuffer.length === legacyHashBuffer.length && timingSafeEqual(storedBuffer, legacyHashBuffer)) {
    // Password verified with legacy params - consider upgrading hash in production
    return true;
  }

  return false;
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }),
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
        totpCode: { label: "2FA Code", type: "text" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        const email = (credentials.email as string).toLowerCase().trim();
        const password = credentials.password as string;
        const totpCode = credentials.totpCode as string | undefined;

        // Check if user exists
        const existingUser = await getUserByEmail(email);

        if (existingUser) {
          // Check if this is an OAuth-only user (placeholder password)
          if (existingUser.password_hash.length === 64 && existingUser.password_salt.length === 64) {
            // This is likely an OAuth user (placeholder is 32 bytes = 64 hex chars)
            // Try to verify anyway in case it's a real password
            const isValid = verifyPassword(password, existingUser.password_hash, existingUser.password_salt);
            if (!isValid) {
              return null;
            }
          } else {
            // Verify password for existing user
            if (!verifyPassword(password, existingUser.password_hash, existingUser.password_salt)) {
              return null;
            }
          }

          // Check 2FA if enabled
          if (existingUser.totp_enabled && existingUser.totp_secret) {
            // Check for truly empty/missing totpCode (handle serialization issues)
            const hasValidTotpCode = totpCode && totpCode.trim() !== "" && totpCode !== "undefined";

            if (!hasValidTotpCode) {
              // Throw a special error that the client can detect
              throw new Error("2FA_REQUIRED");
            }

            const decryptedSecret = decrypt(existingUser.totp_secret);

            // Try TOTP code first
            if (verifyTotpCode(decryptedSecret, totpCode)) {
              // Valid TOTP
            } else if (existingUser.backup_codes) {
              // Try backup code
              const backupCodes = JSON.parse(decrypt(existingUser.backup_codes)) as string[];
              const { valid, remainingCodes } = verifyBackupCode(backupCodes, totpCode);

              if (valid) {
                // Update remaining backup codes
                const encryptedCodes = encrypt(JSON.stringify(remainingCodes));
                await updateUserBackupCodes(existingUser.id, encryptedCodes);
              } else {
                return null;
              }
            } else {
              return null;
            }
          }

          // Check if email is verified (skip for legacy users created before email verification feature)
          const emailVerified = await isEmailVerified(email);
          // Email verification feature was added on 2025-12-31 12:28:28 UTC
          // Users created before this timestamp are considered "legacy" and don't need verification
          const EMAIL_VERIFICATION_CUTOFF = 1767184108; // 2025-12-31 12:28:28 UTC (fixed from 2024)
          if (!emailVerified && existingUser.created_at > EMAIL_VERIFICATION_CUTOFF) {
            throw new Error("EMAIL_NOT_VERIFIED");
          }

          return {
            id: existingUser.id,
            email: existingUser.email,
            name: existingUser.email.split("@")[0],
          };
        }

        // No auto-registration - user must register first
        return null;
      },
    }),
  ],
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
    maxAge: 7 * 24 * 60 * 60, // 7 days
  },
  callbacks: {
    async signIn({ user, account }) {
      // Handle Google OAuth sign-in
      if (account?.provider === "google" && user.email) {
        const email = user.email.toLowerCase().trim();
        try {
          const existingUser = await getUserByEmail(email);

          if (!existingUser) {
            // Create new user for Google OAuth (no password needed)
            const newUserId = randomBytes(16).toString("hex");
            // Use a placeholder for OAuth users (they can't login with password)
            const placeholder = randomBytes(32).toString("hex");
            await createUser(newUserId, email, placeholder, placeholder);
            // Set the user id for the JWT callback
            user.id = newUserId;
          } else {
            // Set the user id from database for the JWT callback
            user.id = existingUser.id;
          }
        } catch {
          return false;
        }
      }
      return true;
    },
    async jwt({ token, user, account }) {
      // On initial sign-in, user object is present
      if (user?.id) {
        token.id = user.id;
      }

      // For Google OAuth, if token.id is not set but we have email, fetch from DB
      // This handles cases where user.id wasn't properly passed from signIn callback
      if (!token.id && token.email) {
        try {
          const dbUser = await getUserByEmail(token.email as string);
          if (dbUser) {
            token.id = dbUser.id;
          }
        } catch {
          // Silently fail - JWT callback error should not block login
        }
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user && token.id) {
        session.user.id = token.id as string;
      }
      return session;
    },
  },
});
