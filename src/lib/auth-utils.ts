import { getToken } from "next-auth/jwt";
import { NextRequest } from "next/server";

/**
 * Get the authenticated user's ID from the request.
 * Returns null if not authenticated.
 */
export async function getUserIdFromRequest(request: NextRequest): Promise<string | null> {
  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
  });
  
  return (token?.id as string) ?? null;
}

/**
 * Require authentication and return user ID.
 * Throws an error if not authenticated.
 */
export async function requireAuth(request: NextRequest): Promise<string> {
  const userId = await getUserIdFromRequest(request);
  
  if (!userId) {
    throw new Error("Unauthorized");
  }
  
  return userId;
}
