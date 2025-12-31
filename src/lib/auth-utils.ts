import { auth } from "@/auth";

/**
 * Get the authenticated user's ID from the session.
 * Uses NextAuth v5 auth() function which works in API routes.
 * Returns null if not authenticated.
 */
export async function getUserIdFromRequest(): Promise<string | null> {
  const session = await auth();

  console.log("[AUTH-UTILS] auth() result:", {
    hasSession: !!session,
    hasUser: !!session?.user,
    userId: session?.user?.id,
    userEmail: session?.user?.email,
  });

  return session?.user?.id ?? null;
}

/**
 * Require authentication and return user ID.
 * Throws an error if not authenticated.
 */
export async function requireAuth(): Promise<string> {
  const userId = await getUserIdFromRequest();

  if (!userId) {
    throw new Error("Unauthorized");
  }

  return userId;
}
