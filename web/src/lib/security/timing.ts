/**
 * Timing-safe string comparison utilities.
 * Prevents timing attacks that could be used to guess secret values.
 */

/**
 * Timing-safe string comparison.
 * Compares two strings in constant time to prevent timing attacks.
 *
 * This is crucial for comparing API keys, JWT tokens, and other secrets
 * where timing differences could leak information to attackers.
 *
 * @param a - First string to compare
 * @param b - Second string to compare
 * @returns true if strings are equal, false otherwise
 *
 * @example
 * ```ts
 * const isValidSecret = timingSafeEqual(
 *   providedSecret,
 *   storedSecret
 * );
 * ```
 */
export function timingSafeEqual(a: string, b: string): boolean {
  // Early exit for different lengths (safe because length is not secret info)
  if (a.length !== b.length) {
    return false;
  }

  // Use crypto.subtle.timingSafeEqual if available (modern browsers/Cloudflare)
  if (typeof crypto !== 'undefined' && (crypto.subtle as any)?.timingSafeEqual) {
    try {
      const encoder = new TextEncoder();
      const bufferA = encoder.encode(a);
      const bufferB = encoder.encode(b);
      return (crypto.subtle as any).timingSafeEqual(bufferA, bufferB);
    } catch {
      // Fall through to manual implementation
    }
  }

  // Manual timing-safe implementation using XOR
  // This ensures all comparisons take the same time regardless of input
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

/**
 * Compares a secret against a candidate with constant-time behavior.
 * Returns false immediately if the candidate is obviously invalid (wrong type, empty),
 * but uses timing-safe comparison for the actual secret check.
 *
 * @param actualSecret - The stored/expected secret
 * @param candidateSecret - The provided secret to validate
 * @returns true if secrets match, false otherwise
 */
export function compareSecrets(
  actualSecret: string | undefined,
  candidateSecret: string | null | undefined
): boolean {
  // Fast-path invalid candidates (safe because these are obvious failures)
  if (!candidateSecret || !actualSecret) {
    return false;
  }

  // Use timing-safe comparison for the actual secret
  return timingSafeEqual(actualSecret, candidateSecret);
}

/**
 * Hash a secret for comparison purposes.
 * This is useful for storing secret hashes instead of plaintext.
 *
 * Note: In Cloudflare Workers, we use Web Crypto API.
 * This uses SHA-256 which is fast and secure for this purpose.
 *
 * @param secret - The secret to hash
 * @returns Hex-encoded hash of the secret
 */
export async function hashSecret(secret: string): Promise<string> {
  if (typeof crypto === 'undefined' || !crypto.subtle) {
    throw new Error('Web Crypto API is not available in this environment');
  }

  const encoder = new TextEncoder();
  const data = encoder.encode(secret);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);

  // Convert to hex string
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Verifies a secret against a pre-computed hash.
 *
 * @param secret - The secret to verify
 * @param hash - The pre-computed hash to compare against
 * @returns true if the secret matches the hash
 */
export async function verifySecretAgainstHash(secret: string, hash: string): Promise<boolean> {
  const secretHash = await hashSecret(secret);
  return timingSafeEqual(secretHash, hash);
}
