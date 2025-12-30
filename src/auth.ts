import NextAuth from "next-auth";
import { getUserByEmail, createUser } from "@/lib/db";
import { scryptSync, randomBytes, timingSafeEqual } from "crypto";
import authConfig from "./auth.config";

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
  ...authConfig,
  providers: [
    // Override providers to add actual authorize logic
    ...authConfig.providers.map((provider) => {
      if (provider.id === "credentials") {
        return {
          ...provider,
          authorize: async (credentials: Record<string, unknown> | undefined) => {
            if (!credentials?.email || !credentials?.password) {
              return null;
            }

            const email = (credentials.email as string).toLowerCase().trim();
            const password = credentials.password as string;

            // Check if user exists
            const existingUser = await getUserByEmail(email);

            if (existingUser) {
              // Verify password for existing user
              if (!verifyPassword(password, existingUser.password_hash, existingUser.password_salt)) {
                return null;
              }

              return {
                id: existingUser.id,
                email: existingUser.email,
                name: existingUser.email.split("@")[0],
              };
            }

            // Create new user (first-time registration)
            const newUserId = randomBytes(16).toString("hex");
            const { hash, salt } = hashPassword(password);

            try {
              await createUser(newUserId, email, hash, salt);

              return {
                id: newUserId,
                email: email,
                name: email.split("@")[0],
              };
            } catch (error) {
              console.error("Failed to create user:", error);
              return null;
            }
          },
        };
      }
      return provider;
    }),
  ],
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
            console.log("[AUTH] Created new user for Google OAuth");
          }
        } catch (error) {
          console.error("[AUTH] Error in signIn callback:", error);
          return false;
        }
      }
      return true;
    },
    async jwt({ token, user, account }) {
      console.log("[AUTH] jwt callback:", { hasUser: !!user, provider: account?.provider, tokenId: token.id });
      if (user) {
        // For OAuth providers, we need to get the user ID from our database
        if (account?.provider === "google" && user.email) {
          const dbUser = await getUserByEmail(user.email.toLowerCase().trim());
          console.log("[AUTH] jwt - dbUser found:", !!dbUser);
          if (dbUser) {
            token.id = dbUser.id;
          }
        } else {
          token.id = user.id;
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
