import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";
import { getUserByEmail, createUser, updateUserBackupCodes } from "@/lib/db";
import { scryptSync, randomBytes, timingSafeEqual } from "crypto";
import { verifyTotpCode, verifyBackupCode, decrypt, encrypt } from "@/lib/totp";

/**
 * Hash password using scrypt (OWASP recommended).
 * Cost parameters follow OWASP guidelines for 2024.
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
          console.log("[AUTH] Credentials missing");
          return null;
        }

        const email = (credentials.email as string).toLowerCase().trim();
        const password = credentials.password as string;
        const totpCode = credentials.totpCode as string | undefined;

        console.log("[AUTH] Attempting login for:", email);

        // Check if user exists
        const existingUser = await getUserByEmail(email);

        if (existingUser) {
          // Check if this is an OAuth-only user (placeholder password)
          if (existingUser.password_hash.length === 64 && existingUser.password_salt.length === 64) {
            // This is likely an OAuth user (placeholder is 32 bytes = 64 hex chars)
            // Try to verify anyway in case it's a real password
            const isValid = verifyPassword(password, existingUser.password_hash, existingUser.password_salt);
            if (!isValid) {
              console.log("[AUTH] OAuth user trying password login or wrong password");
              return null;
            }
          } else {
            // Verify password for existing user
            if (!verifyPassword(password, existingUser.password_hash, existingUser.password_salt)) {
              console.log("[AUTH] Invalid password for:", email);
              return null;
            }
          }

          // Check 2FA if enabled
          if (existingUser.totp_enabled && existingUser.totp_secret) {
            if (!totpCode) {
              console.log("[AUTH] 2FA required but no code provided for:", email);
              // Throw a special error that the client can detect
              throw new Error("2FA_REQUIRED");
            }

            const decryptedSecret = decrypt(existingUser.totp_secret);

            // Try TOTP code first
            if (verifyTotpCode(decryptedSecret, totpCode)) {
              console.log("[AUTH] 2FA TOTP verified for:", email);
            } else if (existingUser.backup_codes) {
              // Try backup code
              const backupCodes = JSON.parse(decrypt(existingUser.backup_codes)) as string[];
              const { valid, remainingCodes } = verifyBackupCode(backupCodes, totpCode);

              if (valid) {
                console.log("[AUTH] 2FA backup code used for:", email);
                // Update remaining backup codes
                const encryptedCodes = encrypt(JSON.stringify(remainingCodes));
                await updateUserBackupCodes(existingUser.id, encryptedCodes);
              } else {
                console.log("[AUTH] Invalid 2FA code for:", email);
                return null;
              }
            } else {
              console.log("[AUTH] Invalid 2FA code for:", email);
              return null;
            }
          }

          console.log("[AUTH] Login successful for:", email);
          return {
            id: existingUser.id,
            email: existingUser.email,
            name: existingUser.email.split("@")[0],
          };
        }

        // Create new user (first-time registration)
        console.log("[AUTH] Creating new user:", email);
        const newUserId = randomBytes(16).toString("hex");
        const { hash, salt } = hashPassword(password);

        try {
          await createUser(newUserId, email, hash, salt);
          console.log("[AUTH] User created successfully:", email);

          return {
            id: newUserId,
            email: email,
            name: email.split("@")[0],
          };
        } catch (error) {
          console.error("[AUTH] Failed to create user:", error);
          return null;
        }
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
      console.log("[AUTH] signIn callback:", { provider: account?.provider, email: user.email });
      // Handle Google OAuth sign-in
      if (account?.provider === "google" && user.email) {
        const email = user.email.toLowerCase().trim();
        try {
          const existingUser = await getUserByEmail(email);
          console.log("[AUTH] Existing user:", !!existingUser);

          if (!existingUser) {
            // Create new user for Google OAuth (no password needed)
            const newUserId = randomBytes(16).toString("hex");
            // Use a placeholder for OAuth users (they can't login with password)
            const placeholder = randomBytes(32).toString("hex");
            await createUser(newUserId, email, placeholder, placeholder);
            console.log("[AUTH] Created new user for Google OAuth with id:", newUserId);
            // Set the user id for the JWT callback
            user.id = newUserId;
          } else {
            // Set the user id from database for the JWT callback
            user.id = existingUser.id;
            console.log("[AUTH] Set existing user id:", existingUser.id);
          }
        } catch (error) {
          console.error("[AUTH] Error in signIn callback:", error);
          return false;
        }
      }
      return true;
    },
    async jwt({ token, user, account }) {
      console.log("[AUTH] jwt callback:", {
        hasUser: !!user,
        provider: account?.provider,
        userId: user?.id,
        userEmail: user?.email,
        tokenId: token.id,
        tokenEmail: token.email
      });

      // On initial sign-in, user object is present
      if (user?.id) {
        token.id = user.id;
        console.log("[AUTH] jwt - set token.id from user:", user.id);
      }

      // For Google OAuth, if token.id is not set but we have email, fetch from DB
      // This handles cases where user.id wasn't properly passed from signIn callback
      if (!token.id && token.email) {
        console.log("[AUTH] jwt - token.id missing, looking up by email:", token.email);
        try {
          const dbUser = await getUserByEmail(token.email as string);
          if (dbUser) {
            token.id = dbUser.id;
            console.log("[AUTH] jwt - set token.id from database:", dbUser.id);
          } else {
            console.log("[AUTH] jwt - no user found in database for email");
          }
        } catch (error) {
          console.error("[AUTH] jwt - error fetching user by email:", error);
        }
      }

      console.log("[AUTH] jwt returning token with id:", token.id);
      return token;
    },
    async session({ session, token }) {
      console.log("[AUTH] session callback:", { hasSession: !!session, tokenId: token.id });
      if (session.user && token.id) {
        session.user.id = token.id as string;
      }
      return session;
    },
  },
});
