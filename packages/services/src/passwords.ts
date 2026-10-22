// Booking passwords. A short shared code, not an account credential, so a
// salted SHA-256 (Web Crypto, which the Worker has) is enough.

const encoder = new TextEncoder();

const toHex = (bytes: Uint8Array): string =>
  Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");

async function digest(salt: string, password: string): Promise<string> {
  const data = encoder.encode(`${salt}:${password}`);
  return toHex(new Uint8Array(await crypto.subtle.digest("SHA-256", data)));
}

/** Returns "salt:hash". */
export async function hashPassword(password: string): Promise<string> {
  const salt = toHex(crypto.getRandomValues(new Uint8Array(16)));
  return `${salt}:${await digest(salt, password)}`;
}

export async function verifyPassword(
  password: string,
  stored: string
): Promise<boolean> {
  const [salt = "", expected = ""] = stored.split(":");
  const actual = await digest(salt, password);
  // Count every mismatch instead of stopping at the first, so the time does
  // not reveal where they differ.
  let mismatches = Math.abs(actual.length - expected.length);
  for (let i = 0; i < actual.length; i += 1) {
    if (actual[i] !== expected[i]) {
      mismatches += 1;
    }
  }
  return mismatches === 0;
}
