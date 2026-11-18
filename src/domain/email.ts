/** Same shape `firestore.rules` accepts for allowlist entries. */
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/** Allowlist entries and sign-in links always use this form. */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function isEmail(value: string): boolean {
  return EMAIL.test(value);
}
