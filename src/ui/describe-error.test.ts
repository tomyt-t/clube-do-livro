import { describe, expect, it } from 'vitest';

import { BackendError } from '@/services/backend';

import { describeError } from './describe-error';

describe('describeError', () => {
  it('uses the readable message an adapter attached', () => {
    const error = new BackendError('unknown', 'O navegador bloqueou a janela de login.');
    expect(describeError(error)).toBe('O navegador bloqueou a janela de login.');
  });

  it('falls back to a message per code, never a raw code', () => {
    expect(describeError(new BackendError('unavailable'))).toContain('Sem conexão');
    expect(describeError(new BackendError('unknown', 'auth/internal-error'))).toBe(
      'Algo deu errado. Tente de novo.',
    );
  });

  it('handles anything else', () => {
    expect(describeError(new Error('boom'))).toBe('Algo deu errado. Tente de novo.');
  });
});
