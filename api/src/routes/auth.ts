import { Router } from "express";
import rateLimit from "express-rate-limit";
import { prisma } from "../db.js";
import {
  clearSessionCookie,
  createSession,
  deleteSession,
  hashPassword,
  SESSION_COOKIE_NAME,
  setSessionCookie,
  verifyDummyPassword,
  verifyPassword,
} from "../auth.js";
import { isValidEmail, isValidPassword } from "../validation.js";
import { requireAuth } from "../middleware/requireAuth.js";

export const authRouter = Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => {
    res.status(429).json({ error: "Trop de tentatives, réessaie plus tard." });
  },
});

const signupLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => {
    res.status(429).json({ error: "Trop de tentatives, réessaie plus tard." });
  },
});

function toPublicUser(user: { id: string; email: string; createdAt: Date }) {
  return { id: user.id, email: user.email, createdAt: user.createdAt };
}

authRouter.post("/signup", signupLimiter, async (req, res) => {
  const { email, password } = req.body ?? {};

  if (!isValidEmail(email)) {
    res.status(400).json({ error: "Adresse email invalide." });
    return;
  }
  if (!isValidPassword(password)) {
    res.status(400).json({ error: "Le mot de passe doit contenir entre 8 et 72 caractères." });
    return;
  }

  const normalizedEmail = email.trim().toLowerCase();

  const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });
  if (existing) {
    res.status(409).json({ error: "Cet email est déjà utilisé." });
    return;
  }

  const passwordHash = await hashPassword(password);
  const user = await prisma.user.create({
    data: { email: normalizedEmail, passwordHash },
  });

  const { token, expiresAt } = await createSession(user.id);
  setSessionCookie(res, token, expiresAt);
  res.status(201).json({ user: toPublicUser(user) });
});

authRouter.post("/login", loginLimiter, async (req, res) => {
  const { email, password } = req.body ?? {};

  if (typeof email !== "string" || typeof password !== "string") {
    res.status(400).json({ error: "Email et mot de passe requis." });
    return;
  }

  const normalizedEmail = email.trim().toLowerCase();
  const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });

  const passwordOk = user
    ? await verifyPassword(password, user.passwordHash)
    : await verifyDummyPassword(password);

  if (!user || !passwordOk) {
    res.status(401).json({ error: "Email ou mot de passe incorrect." });
    return;
  }

  const { token, expiresAt } = await createSession(user.id);
  setSessionCookie(res, token, expiresAt);
  res.status(200).json({ user: toPublicUser(user) });
});

authRouter.post("/logout", async (req, res) => {
  const token = req.signedCookies?.[SESSION_COOKIE_NAME];
  if (token) {
    await deleteSession(token);
  }
  clearSessionCookie(res);
  res.status(204).send();
});

authRouter.get("/me", requireAuth, (req, res) => {
  res.status(200).json({ user: req.user });
});
