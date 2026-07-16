import crypto from "node:crypto";
import bcrypt from "bcrypt";
import type { Response } from "express";
import { prisma } from "./db.js";

const BCRYPT_COST = 12;

// Hash bcrypt valide d'un mot de passe factice : sert à égaliser le temps de
// réponse du login quand l'email n'existe pas, pour ne pas révéler par timing
// si un compte existe.
const DUMMY_HASH = "$2b$12$nFzDRrPyqHfK0PBtvF/hSeZVNSuSG7JHE5WLkUa..Q3b5BBA4.3Qe";

export const SESSION_COOKIE_NAME = "monapp_session";
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 jours

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_COST);
}

export function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function verifyDummyPassword(password: string): Promise<boolean> {
  return bcrypt.compare(password, DUMMY_HASH);
}

export async function createSession(userId: string) {
  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await prisma.session.create({ data: { id: token, userId, expiresAt } });
  return { token, expiresAt };
}

export async function getSessionUser(token: string) {
  const session = await prisma.session.findUnique({
    where: { id: token },
    include: { user: true },
  });
  if (!session) return null;
  if (session.expiresAt <= new Date()) {
    await prisma.session.delete({ where: { id: token } }).catch(() => {});
    return null;
  }
  return session.user;
}

export async function deleteSession(token: string) {
  await prisma.session.delete({ where: { id: token } }).catch(() => {});
}

function cookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    signed: true,
    path: "/",
    maxAge,
  };
}

export function setSessionCookie(res: Response, token: string, expiresAt: Date) {
  res.cookie(SESSION_COOKIE_NAME, token, cookieOptions(expiresAt.getTime() - Date.now()));
}

export function clearSessionCookie(res: Response) {
  res.clearCookie(SESSION_COOKIE_NAME, { ...cookieOptions(0), maxAge: undefined });
}
