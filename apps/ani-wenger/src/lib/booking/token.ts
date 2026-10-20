/**
 * The secret in a client's "manage your appointment" link. Only its SHA-256
 * hash is stored with the appointment, so a leaked database backup cannot be
 * used to cancel anyone's booking.
 */
const toHex = (bytes: ArrayBuffer) =>
  [...new Uint8Array(bytes)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");

const toBase64Url = (bytes: Uint8Array) =>
  btoa(String.fromCodePoint(...bytes))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");

/** 24 random bytes, URL-safe. */
export const newToken = (): string =>
  toBase64Url(crypto.getRandomValues(new Uint8Array(24)));

export const hashToken = async (token: string): Promise<string> =>
  toHex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token)));

/**
 * Compares two secrets in time that does not depend on where they differ:
 * every character is visited, and the result is only read at the end.
 */
export const sameSecret = (a: string, b: string): boolean => {
  if (a.length !== b.length || a.length === 0) {
    return false;
  }
  let mismatches = 0;
  for (let index = 0; index < a.length; index += 1) {
    mismatches += a.codePointAt(index) === b.codePointAt(index) ? 0 : 1;
  }
  return mismatches === 0;
};

export const tokenMatches = async (
  token: string,
  storedHash: string | undefined
): Promise<boolean> =>
  storedHash !== undefined && sameSecret(await hashToken(token), storedHash);
