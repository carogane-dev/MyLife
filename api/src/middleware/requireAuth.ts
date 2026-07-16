import type { NextFunction, Request, Response } from "express";
import { clearSessionCookie, getSessionUser, SESSION_COOKIE_NAME } from "../auth.js";

declare global {
  namespace Express {
    interface Request {
      user?: { id: string; email: string; createdAt: Date };
    }
  }
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token = req.signedCookies?.[SESSION_COOKIE_NAME];
  if (!token) {
    res.status(401).json({ error: "Non authentifié" });
    return;
  }

  const user = await getSessionUser(token);
  if (!user) {
    clearSessionCookie(res);
    res.status(401).json({ error: "Non authentifié" });
    return;
  }

  req.user = { id: user.id, email: user.email, createdAt: user.createdAt };
  next();
}
