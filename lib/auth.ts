import crypto from "crypto";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { getDb } from "./db";

const COOKIE_NAME = "session_token";
const SESSION_MAX_AGE = 30 * 24 * 60 * 60; // 30 days in seconds

function getJwtSecret(): Uint8Array {
  const secret = process.env.ENCRYPTION_KEY || process.env.SESSION_SECRET || "fallback_development_secret_key_at_least_32_bytes_long";
  return new TextEncoder().encode(secret);
}

/**
 * Hashes a password using crypto.scrypt with a unique 16-byte random salt.
 */
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

/**
 * Verifies password against stored salt:hash using timing-safe comparison.
 */
export function verifyPassword(password: string, storedHash: string): boolean {
  try {
    const [salt, key] = storedHash.split(":");
    if (!salt || !key) return false;
    const keyBuffer = Buffer.from(key, "hex");
    const derivedKey = crypto.scryptSync(password, salt, 64);
    return crypto.timingSafeEqual(keyBuffer, derivedKey);
  } catch {
    return false;
  }
}

/**
 * Creates a signed JWT session token.
 */
export async function createSessionToken(userId: string): Promise<string> {
  return await new SignJWT({ sub: userId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(getJwtSecret());
}

/**
 * Sets the secure HTTP-only session cookie in the response.
 */
export async function setSessionCookie(userId: string): Promise<void> {
  const token = await createSessionToken(userId);
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
}

/**
 * Deletes the session cookie (logout).
 */
export async function destroySession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

export interface AuthUser {
  id: string;
  full_name: string;
  email: string;
  role: "student" | "admin";
  approval_status: "pending" | "approved" | "rejected";
  is_active: boolean;
  credentials_invalid: boolean;
}

/**
 * Gets currently authenticated user from session cookie and Neon database.
 */
export async function getCurrentUser(): Promise<AuthUser | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(COOKIE_NAME)?.value;
    if (!token) return null;

    const { payload } = await jwtVerify(token, getJwtSecret());
    const userId = payload.sub as string;
    if (!userId) return null;

    const sql = getDb();
    const rows = await sql`
      SELECT id, full_name, email, role, approval_status, is_active, credentials_invalid
      FROM profiles
      WHERE id = ${userId}
      LIMIT 1
    `;

    if (!rows || rows.length === 0) return null;

    return rows[0] as AuthUser;
  } catch {
    return null;
  }
}
