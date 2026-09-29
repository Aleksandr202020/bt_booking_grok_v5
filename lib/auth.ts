import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";

const COOKIE = "bt_session";
const MAX_AGE = 60 * 60 * 24 * 30; // 30 days

function secretKey() {
  const s = process.env.AUTH_SECRET || process.env.SETUP_SECRET || "dev-secret-change-me";
  return new TextEncoder().encode(s);
}

export type SessionUser = {
  id: string;
  name: string;
  phone: string;
  role: "CLIENT" | "ADMIN";
};

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

export async function createSessionToken(user: SessionUser) {
  return new SignJWT({
    id: user.id,
    name: user.name,
    phone: user.phone,
    role: user.role,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE}s`)
    .sign(secretKey());
}

export async function setSessionCookie(token: string) {
  const jar = await cookies();
  jar.set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE,
  });
}

export async function clearSessionCookie() {
  const jar = await cookies();
  jar.delete(COOKIE);
}

export async function getSession(): Promise<SessionUser | null> {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secretKey());
    return {
      id: String(payload.id),
      name: String(payload.name),
      phone: String(payload.phone),
      role: payload.role === "ADMIN" ? "ADMIN" : "CLIENT",
    };
  } catch {
    return null;
  }
}

export async function requireUser(): Promise<SessionUser> {
  const user = await getSession();
  if (!user) throw new Error("UNAUTHORIZED");
  return user;
}

/** Normalize Latvian phone to digits */
export function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("371") && digits.length >= 11) return digits;
  if (digits.length === 8) return "371" + digits;
  return digits;
}

export async function findUserByPhone(phone: string) {
  return prisma.user.findUnique({ where: { phone: normalizePhone(phone) } });
}
