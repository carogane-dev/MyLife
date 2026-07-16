const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(email: string): boolean {
  return typeof email === "string" && EMAIL_RE.test(email);
}

// 72 = limite dure de bcrypt sur la taille de l'entrée (au-delà, elle est
// silencieusement tronquée) ; on préfère le rejeter explicitement.
export function isValidPassword(password: string): boolean {
  return typeof password === "string" && password.length >= 8 && password.length <= 72;
}
