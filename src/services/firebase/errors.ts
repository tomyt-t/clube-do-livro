import { BackendError, type BackendErrorCode } from '../backend';

import { InvalidBookError } from './book-data';

const CODES: Record<string, BackendErrorCode> = {
  'permission-denied': 'permission-denied',
  unauthenticated: 'permission-denied',
  unavailable: 'unavailable',
  'deadline-exceeded': 'unavailable',
  'resource-exhausted': 'unavailable',
  'invalid-argument': 'invalid-data',
  'failed-precondition': 'invalid-data',
  'auth/network-request-failed': 'unavailable',
  'auth/too-many-requests': 'unavailable',
  'auth/invalid-email': 'invalid-data',
  'auth/invalid-action-code': 'invalid-data',
  'auth/expired-action-code': 'invalid-data',
};

/** Messages for auth failures the person can act on. */
const MESSAGES: Record<string, string> = {
  'auth/popup-blocked': 'O navegador bloqueou a janela de login. Permita pop-ups para este site.',
  'auth/unauthorized-domain': 'Este endereço não está autorizado no Firebase.',
  'auth/invalid-action-code': 'Este link de acesso já foi usado ou é inválido. Peça um novo.',
  'auth/expired-action-code': 'Este link de acesso expirou. Peça um novo.',
  'auth/too-many-requests': 'Muitas tentativas seguidas. Espere alguns minutos.',
};

function codeOf(error: unknown): string | null {
  if (typeof error !== 'object' || error === null || !('code' in error)) return null;
  return typeof error.code === 'string' ? error.code : null;
}

/** Translates Firebase errors into the backend's error vocabulary. */
export function toBackendError(error: unknown): BackendError {
  if (error instanceof BackendError) return error;
  if (error instanceof InvalidBookError) return new BackendError('invalid-data', error.message);

  const code = codeOf(error) ?? '';
  const mapped = CODES[code] ?? 'unknown';
  return new BackendError(mapped, MESSAGES[code] ?? code);
}

export async function guard<T>(operation: Promise<T>): Promise<T> {
  try {
    return await operation;
  } catch (error) {
    throw toBackendError(error);
  }
}

/** The person closed the Google popup: not an error worth showing. */
export function isCancelledSignIn(error: unknown): boolean {
  const code = codeOf(error);
  return code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request';
}
