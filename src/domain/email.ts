/** Same shape `firestore.rules` accepts for allowlist entries. */
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/** Allowlist entries and sign-in links always use this form. */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function isEmail(value: string): boolean {
  return EMAIL.test(value);
}

export interface ParsedEmails {
  valid: string[];
  /** Pieces that look like an email (they have an @) but are not one. */
  invalid: string[];
}

/**
 * Emails pasted from anywhere: separated by commas, semicolons, spaces or
 * lines, or written as "Nome <email>" by mail apps. Names are ignored;
 * emails come back normalized and without repeats.
 */
export function parseEmails(text: string): ParsedEmails {
  const candidates = text
    .split(/[\s,;]+/)
    .map((piece) => normalizeEmail(piece.replace(/^[<("']+|[>)"'.]+$/g, '')))
    .filter((piece) => piece.includes('@'));
  const unique = [...new Set(candidates)];
  return { valid: unique.filter(isEmail), invalid: unique.filter((piece) => !isEmail(piece)) };
}
