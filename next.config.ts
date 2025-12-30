import type { NextConfig } from "next";

/**
 * Security headers configuration following OWASP guidelines.
 * 
 * References:
 * - OWASP Secure Headers Project (2024)
 * - MDN Web Security Guidelines
 */
const securityHeaders = [
  {
    // Prevent clickjacking attacks
    key: "X-Frame-Options",
    value: "DENY",
  },
  {
    // Prevent MIME type sniffing
    key: "X-Content-Type-Options",
    value: "nosniff",
  },
  {
    // Enable XSS filter in older browsers
    key: "X-XSS-Protection",
    value: "1; mode=block",
  },
  {
    // Control referrer information
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin",
  },
  {
    // Restrict browser features
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
  },
  {
    // Content Security Policy - restrict resource loading
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'", // Required for Next.js
      "style-src 'self' 'unsafe-inline'", // Required for styled-components/emotion
      "img-src 'self' data: blob:",
      "font-src 'self'",
      "connect-src 'self' https://api.monobank.ua", // Allow Monobank API
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; "),
  },
];

// Add HSTS only in production
if (process.env.NODE_ENV === "production") {
  securityHeaders.push({
    // HTTP Strict Transport Security
    key: "Strict-Transport-Security",
    value: "max-age=31536000; includeSubDomains; preload",
  });
}

const nextConfig: NextConfig = {
  reactCompiler: true,
  
  async headers() {
    return [
      {
        // Apply security headers to all routes
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
