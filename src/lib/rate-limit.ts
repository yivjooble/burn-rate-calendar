/**
 * Simple in-memory rate limiter using sliding window algorithm.
 *
 * ⚠️ PRODUCTION WARNING: This in-memory rate limiter does NOT work with:
 * - Multiple server instances (each has separate state)
 * - Server restarts (state is lost)
 *
 * For production deployments, implement Redis-based rate limiting.
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
const MAX_STORE_SIZE = 10000;
let lastCleanup = Date.now();

function cleanup(): void {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL) return;

  lastCleanup = now;

  // Remove expired entries
  for (const [key, entry] of rateLimitStore.entries()) {
    if (entry.resetTime < now) {
      rateLimitStore.delete(key);
    }
  }

  // Emergency cleanup if store is too large
  if (rateLimitStore.size > MAX_STORE_SIZE) {
    const entries = Array.from(rateLimitStore.entries());
    entries.sort((a, b) => a[1].resetTime - b[1].resetTime);
    const toRemove = entries.slice(0, Math.floor(MAX_STORE_SIZE / 2));
    toRemove.forEach(([key]) => rateLimitStore.delete(key));
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
 * Rate limit for authentication endpoints.
 * 50 requests per minute - allows OAuth flows while preventing brute-force.
 */
export const AUTH_RATE_LIMIT: RateLimitConfig = {
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 50,
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
 * Validate IP address format (IPv4 or IPv6).
 */
function isValidIP(ip: string): boolean {
  const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
  const ipv6Regex =
    /^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$|^::1$|^([0-9a-fA-F]{1,4}:)*::([0-9a-fA-F]{1,4}:)*[0-9a-fA-F]{1,4}$/;
  return ipv4Regex.test(ip) || ipv6Regex.test(ip);
}

/**
 * Simple hash function for fallback identifier.
 */
function hashString(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(36);
}

/**
 * Get client identifier from request.
 * Uses X-Forwarded-For header if behind proxy, otherwise falls back to user-agent hash.
 */
export function getClientIdentifier(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    // Take LAST IP in chain (added by our trusted proxy)
    const ips = forwarded.split(",").map((ip) => ip.trim());
    const clientIP = ips[ips.length - 1];
    if (isValidIP(clientIP)) {
      return clientIP;
    }
  }

  // Fallback: use a hash of user-agent + accept-language for some differentiation
  const ua = request.headers.get("user-agent") || "";
  const lang = request.headers.get("accept-language") || "";
  if (ua || lang) {
    return `ua:${hashString(ua + lang)}`;
  }

  return "unknown-client";
}
