const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(email: string): boolean {
  return typeof email === "string" && EMAIL_RE.test(email);
}

// 72 = limite dure de bcrypt sur la taille de l'entrée (au-delà, elle est
// silencieusement tronquée) ; on préfère le rejeter explicitement.
export function isValidPassword(password: string): boolean {
  return typeof password === "string" && password.length >= 8 && password.length <= 72;
}

export function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

export function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

export function isValidDateString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && !Number.isNaN(Date.parse(value));
}
