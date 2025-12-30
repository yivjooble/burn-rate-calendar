import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { getUserByEmail, createUser } from "@/lib/db";
import { scryptSync, randomBytes, timingSafeEqual } from "crypto";

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
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
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
    }),
  ],
  pages: {
    signIn: "/login",
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
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
  session: {
    strategy: "jwt",
    maxAge: 7 * 24 * 60 * 60, // 7 days (financial app - shorter sessions)
  },
});
