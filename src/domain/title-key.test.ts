import { describe, expect, it } from 'vitest';

import { titleKey } from './title-key';

describe('titleKey', () => {
  it('ignores case, accents and punctuation', () => {
    expect(titleKey('Dom Casmurro / Machado de Assis')).toBe('dom casmurro machado de assis');
    expect(titleKey('  dom casmurro, MACHADO DE ASSIS!  ')).toBe('dom casmurro machado de assis');
    expect(titleKey('Cem Anos de Solidão')).toBe(titleKey('cem anos de solidao'));
    expect(titleKey('Ensaio sobre a cegueira — José Saramago')).toBe(
      titleKey('Ensaio Sobre A Cegueira, Jose Saramago'),
    );
  });

  it('keeps titles written differently apart', () => {
    expect(titleKey('Dom Casmurro')).not.toBe(titleKey('Dom Casmurro, Machado de Assis'));
    expect(titleKey('1984')).not.toBe(titleKey('1985'));
  });

  it('keeps letters from any script', () => {
    expect(titleKey('ベルセルク')).toBe('ベルセルク');
    expect(titleKey('Eu, Robô')).toBe('eu robo');
  });

  it('is empty when there is nothing but punctuation', () => {
    expect(titleKey('!!! ...')).toBe('');
  });
});
