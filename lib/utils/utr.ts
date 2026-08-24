import { createHash } from "crypto";

/**
 * Hashes a UTR string using SHA-256 for idempotent storage.
 * The raw UTR is never stored — only its hash.
 */
export function hashUtr(utr: string): string {
  return createHash("sha256").update(utr.trim()).digest("hex");
}

/**
 * Validates that a UTR is strictly 12 numeric digits.
 * UPI UTRs are always exactly 12 digits.
 */
export function validateUtr(utr: string): boolean {
  return /^\d{12}$/.test(utr.trim());
}

/**
 * Generates a cryptographically random API key.
 * Format: prefix_k_<32 hex chars>
 */
export function generateApiKey(prefix: "client" | "device"): string {
  const randomBytes = createHash("sha256")
    .update(Math.random().toString() + Date.now().toString())
    .digest("hex")
    .slice(0, 32);
  return `${prefix}_k_${randomBytes}`;
}
