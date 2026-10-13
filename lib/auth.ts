import { cookies } from "next/headers";

// One shared password (SITE_PASSWORD) locks the whole site. The session cookie holds an HMAC of a fixed label keyed
// by the password: no server-side state, and changing the password signs everyone out.
export const COOKIE = "rb_session";
export const COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

const encoder = new TextEncoder();

export async function sessionToken(password: string) {
  const key = await crypto.subtle.importKey("raw", encoder.encode(password), { name: "HMAC", hash: "SHA-256" }, false, [
    "sign",
  ]);
  const mac = await crypto.subtle.sign("HMAC", key, encoder.encode("renewables-browser-session"));
  return Buffer.from(mac).toString("hex");
}

// constant-time comparison of two strings
export function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// False when the cookie is missing or wrong, and when no password is configured (fail closed).
export async function isValidSession(value: string | undefined) {
  const password = process.env.SITE_PASSWORD;
  if (!password || !value) return false;
  return safeEqual(value, await sessionToken(password));
}

// Data-layer guard: throws unless the current request carries a valid session cookie.
export async function requireSession() {
  const value = (await cookies()).get(COOKIE)?.value;
  if (!(await isValidSession(value))) throw new Error("unauthorized");
}
