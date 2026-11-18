import { BackendError } from '@/services/backend';

const BY_CODE = {
  unavailable: 'Sem conexão com o servidor. Confira a internet e tente de novo.',
  'permission-denied': 'Você não tem permissão para fazer isso.',
  'invalid-data': 'Algum dado não foi aceito. Confira e tente de novo.',
  unknown: 'Algo deu errado. Tente de novo.',
} as const;

/** A sentence the person can act on, in the interface's voice. */
export function describeError(error: unknown): string {
  if (!(error instanceof BackendError)) return BY_CODE.unknown;
  // Adapters attach readable Portuguese messages to errors the person can fix;
  // raw codes such as "auth/xyz" are never shown.
  const readable = error.message !== error.code && !error.message.includes('/');
  return readable ? error.message : BY_CODE[error.code];
}
