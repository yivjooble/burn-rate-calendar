import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

/**
 * Get encryption key from environment variable.
 * Requires a 64-character hex string (32 bytes / 256 bits).
 * Generate with: openssl rand -hex 32
 */
function getEncryptionKey(): Buffer {
  const masterKey = process.env.ENCRYPTION_KEY;

  if (!masterKey) {
    throw new Error(
      "ENCRYPTION_KEY environment variable is not set. " +
      "Generate one with: openssl rand -hex 32"
    );
  }

  // Require exactly 64 hex chars (32 bytes / 256 bits)
  if (!/^[a-fA-F0-9]{64}$/.test(masterKey)) {
    throw new Error(
      "ENCRYPTION_KEY must be exactly 64 hex characters (32 bytes). " +
      "Generate one with: openssl rand -hex 32"
    );
  }

  return Buffer.from(masterKey, "hex");
}

/**
 * Encrypt sensitive data using AES-256-GCM.
 * 
 * Output format: base64(iv + authTag + ciphertext)
 * 
 * @param plaintext - The string to encrypt
 * @returns Base64 encoded encrypted string
 */
export function encrypt(plaintext: string): string {
  const key = getEncryptionKey();
  const iv = randomBytes(IV_LENGTH);
  
  const cipher = createCipheriv(ALGORITHM, key, iv);
  
  let encrypted = cipher.update(plaintext, "utf8");
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  
  const authTag = cipher.getAuthTag();
  
  // Combine: IV (16) + AuthTag (16) + Ciphertext
  const combined = Buffer.concat([iv, authTag, encrypted]);
  
  return combined.toString("base64");
}

/**
 * Decrypt data encrypted with encrypt().
 * 
 * @param encryptedData - Base64 encoded encrypted string
 * @returns Decrypted plaintext string
 * @throws Error if decryption fails (wrong key, tampered data, etc.)
 */
export function decrypt(encryptedData: string): string {
  const key = getEncryptionKey();
  
  const combined = Buffer.from(encryptedData, "base64");
  
  if (combined.length < IV_LENGTH + AUTH_TAG_LENGTH + 1) {
    throw new Error("Invalid encrypted data: too short");
  }
  
  const iv = combined.subarray(0, IV_LENGTH);
  const authTag = combined.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const ciphertext = combined.subarray(IV_LENGTH + AUTH_TAG_LENGTH);
  
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  
  let decrypted = decipher.update(ciphertext);
  decrypted = Buffer.concat([decrypted, decipher.final()]);
  
  return decrypted.toString("utf8");
}

/**
 * Encryption marker prefix to distinguish encrypted data from plaintext.
 * This is prepended to all encrypted values.
 */
const ENCRYPTION_PREFIX = "enc:v1:";

/**
 * Check if a string appears to be encrypted.
 * Uses a prefix marker for reliable detection.
 */
export function isEncrypted(value: string): boolean {
  return value?.startsWith(ENCRYPTION_PREFIX) ?? false;
}

/**
 * Internal encrypt function that adds the prefix marker.
 */
function encryptWithMarker(plaintext: string): string {
  const key = getEncryptionKey();
  const iv = randomBytes(IV_LENGTH);
  
  const cipher = createCipheriv(ALGORITHM, key, iv);
  
  let encrypted = cipher.update(plaintext, "utf8");
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  
  const authTag = cipher.getAuthTag();
  
  // Combine: IV (16) + AuthTag (16) + Ciphertext
  const combined = Buffer.concat([iv, authTag, encrypted]);
  
  return ENCRYPTION_PREFIX + combined.toString("base64");
}

/**
 * Internal decrypt function that handles the prefix marker.
 */
function decryptWithMarker(encryptedData: string): string {
  if (!encryptedData.startsWith(ENCRYPTION_PREFIX)) {
    throw new Error("Invalid encrypted data: missing prefix");
  }
  
  const base64Data = encryptedData.slice(ENCRYPTION_PREFIX.length);
  const key = getEncryptionKey();
  
  const combined = Buffer.from(base64Data, "base64");
  
  if (combined.length < IV_LENGTH + AUTH_TAG_LENGTH + 1) {
    throw new Error("Invalid encrypted data: too short");
  }
  
  const iv = combined.subarray(0, IV_LENGTH);
  const authTag = combined.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const ciphertext = combined.subarray(IV_LENGTH + AUTH_TAG_LENGTH);
  
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  
  let decrypted = decipher.update(ciphertext);
  decrypted = Buffer.concat([decrypted, decipher.final()]);
  
  return decrypted.toString("utf8");
}

/**
 * Safely encrypt a token, handling already-encrypted values.
 */
export function encryptToken(token: string): string {
  if (isEncrypted(token)) {
    // Already encrypted, return as-is
    return token;
  }
  return encryptWithMarker(token);
}

/**
 * Safely decrypt a token, handling plaintext legacy values.
 */
export function decryptToken(encryptedToken: string): string {
  if (!isEncrypted(encryptedToken)) {
    // Legacy plaintext token, return as-is (will be re-encrypted on next save)
    return encryptedToken;
  }
  return decryptWithMarker(encryptedToken);
}
