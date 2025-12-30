/**
 * Simple in-memory rate limiter using sliding window algorithm.
 * 
 * For production with multiple instances, consider Redis-based solution.
 * 
 * References:
 * - OWASP Rate Limiting Guidelines (2024)
 * - RFC 6585 - Additional HTTP Status Codes (429 Too Many Requests)
 */

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();

// Cleanup old entries every 5 minutes
const CLEANUP_INTERVAL = 5 * 60 * 1000;
let lastCleanup = Date.now();

function cleanup(): void {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL) return;
  
  lastCleanup = now;
  for (const [key, entry] of rateLimitStore.entries()) {
    if (entry.resetTime < now) {
      rateLimitStore.delete(key);
    }
  }
}

/**
 * Check if request should be rate limited.
 * 
 * @param identifier - Unique identifier (IP, user ID, etc.)
 * @param config - Rate limit configuration
 * @returns Object with allowed status and remaining requests
 */
export function checkRateLimit(
  identifier: string,
  config: RateLimitConfig
): { allowed: boolean; remaining: number; resetTime: number } {
  cleanup();
  
  const now = Date.now();
  const key = identifier;
  const entry = rateLimitStore.get(key);
  
  if (!entry || entry.resetTime < now) {
    // New window
    rateLimitStore.set(key, {
      count: 1,
      resetTime: now + config.windowMs,
    });
    return {
      allowed: true,
      remaining: config.maxRequests - 1,
      resetTime: now + config.windowMs,
    };
  }
  
  if (entry.count >= config.maxRequests) {
    return {
      allowed: false,
      remaining: 0,
      resetTime: entry.resetTime,
    };
  }
  
  entry.count++;
  return {
    allowed: true,
    remaining: config.maxRequests - entry.count,
    resetTime: entry.resetTime,
  };
}

// =============================================================================
// PREDEFINED RATE LIMIT CONFIGS
// =============================================================================

/**
 * Strict rate limit for authentication endpoints.
 * 5 requests per minute to prevent brute-force.
 */
export const AUTH_RATE_LIMIT: RateLimitConfig = {
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 5,
};

/**
 * Standard rate limit for API endpoints.
 * 100 requests per minute.
 */
export const API_RATE_LIMIT: RateLimitConfig = {
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 100,
};

/**
 * Relaxed rate limit for read-only endpoints.
 * 300 requests per minute.
 */
export const READ_RATE_LIMIT: RateLimitConfig = {
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 300,
};

/**
 * Very strict rate limit for sensitive operations.
 * 3 requests per 5 minutes.
 */
export const SENSITIVE_RATE_LIMIT: RateLimitConfig = {
  windowMs: 5 * 60 * 1000, // 5 minutes
  maxRequests: 3,
};

/**
 * Get client identifier from request.
 * Uses X-Forwarded-For header if behind proxy, otherwise falls back to a default.
 */
export function getClientIdentifier(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    // Take the first IP in the chain (original client)
    return forwarded.split(",")[0].trim();
  }
  
  // Fallback - in production, configure your reverse proxy properly
  return "unknown-client";
}
