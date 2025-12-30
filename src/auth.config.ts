import Google from "next-auth/providers/google";
import type { NextAuthConfig } from "next-auth";

/**
 * Edge-compatible NextAuth configuration.
 * Does not include database adapter or Node.js-only modules.
 * Used by middleware for session checking.
 *
 * Note: Credentials provider is NOT included here because it requires
 * Node.js crypto module for password verification.
 */
export default {
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
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
    jwt({ token, user }) {
      // When user signs in, add their id to the token
      // Note: For Google OAuth, the actual DB userId is set in auth.ts jwt callback
      // This callback runs for Edge runtime (middleware), so just preserve existing token.id
      if (user?.id) {
        token.id = user.id;
      }
      return token;
    },
    session({ session, token }) {
      // Add user id to session from token
      if (session.user && token.id) {
        session.user.id = token.id as string;
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
