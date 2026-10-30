import "server-only";
import { createHmac, scryptSync, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

// Admin-Login für den Pilot: E-Mail + Passwort, geprüft gegen einen scrypt-Hash aus der Umgebung
// (ADMIN_PASSWORD_HASH), Session als HMAC-signiertes Cookie (ADMIN_SESSION_SECRET). Kein Passwort
// im Code oder Repo. Später ablösbar durch Supabase Magic Link.

const COOKIE = "leans_admin";
const SESSION_DAYS = 30;

function config() {
  const emails = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  const hash = process.env.ADMIN_PASSWORD_HASH ?? "";
  const secret = process.env.ADMIN_SESSION_SECRET ?? "";
  return emails.length && hash && secret.length >= 32 ? { emails, hash, secret } : null;
}

export function adminConfigured() {
  return config() !== null;
}

/** Format: scrypt:<salt base64>:<hash base64>, N=16384, r=8, p=1, 64 Byte. ":" statt "$", weil
 *  Next.js "$…" in .env-Dateien als Variable expandiert. */
function verifyPassword(password: string, stored: string) {
  const [scheme, saltB64, hashB64] = stored.split(":");
  if (scheme !== "scrypt" || !saltB64 || !hashB64) return false;
  const expected = Buffer.from(hashB64, "base64");
  const actual = scryptSync(password, Buffer.from(saltB64, "base64"), expected.length, { N: 16384, r: 8, p: 1 });
  return timingSafeEqual(actual, expected);
}

function sign(payload: string, secret: string) {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

function readToken(token: string | undefined, secret: string): { email: string } | null {
  if (!token) return null;
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;
  const expected = Buffer.from(sign(payload, secret));
  const given = Buffer.from(signature);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString()) as { e: string; x: number };
    return data.x > Date.now() ? { email: data.e } : null;
  } catch {
    return null;
  }
}

/** Prüft die Zugangsdaten und setzt bei Erfolg das Session-Cookie. */
export async function signIn(email: string, password: string): Promise<boolean> {
  const c = config();
  const normalized = email.trim().toLowerCase();
  const valid = !!c && c.emails.includes(normalized) && verifyPassword(password, c.hash);
  if (!valid || !c) {
    // Gleichmäßige Verzögerung bremst Durchprobieren.
    await new Promise((r) => setTimeout(r, 600));
    return false;
  }
  const payload = Buffer.from(JSON.stringify({ e: normalized, x: Date.now() + SESSION_DAYS * 86_400_000 })).toString("base64url");
  (await cookies()).set(COOKIE, `${payload}.${sign(payload, c.secret)}`, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DAYS * 86_400,
  });
  return true;
}

export async function signOut() {
  (await cookies()).delete(COOKIE);
}

export async function getAdmin(): Promise<{ email: string } | null> {
  const c = config();
  if (!c) return null;
  const session = readToken((await cookies()).get(COOKIE)?.value, c.secret);
  return session && c.emails.includes(session.email) ? session : null;
}

/** Für Seiten und Server Actions: ohne gültige Session zurück zum Login. */
export async function requireAdmin() {
  const admin = await getAdmin();
  if (!admin) redirect("/admin/login");
  return admin;
}
