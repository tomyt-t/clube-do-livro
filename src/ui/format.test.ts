import { describe, expect, it } from 'vitest';

import { countOf, formatDay, formatWeekday, peopleWho, RESPONDED, until } from './format';

const friday = new Date(2026, 10, 20, 12);

describe('format', () => {
  it('writes short dates in Portuguese', () => {
    expect(formatDay(new Date(2026, 9, 8, 12))).toBe('8 de out.');
  });

  it('names the weekday the way people say it', () => {
    expect(formatWeekday(friday)).toBe('sexta, 20 de nov.');
    expect(formatWeekday(new Date(2026, 10, 22, 12))).toBe('domingo, 22 de nov.');
  });

  it('writes deadlines without a doubled period', () => {
    expect(until(friday)).toBe('Até sexta, 20 de nov.');
    expect(until(null)).toBeNull();
  });

  it('counts people who did something', () => {
    expect(peopleWho(0, RESPONDED)).toBe('Ninguém respondeu ainda.');
    expect(peopleWho(1, RESPONDED)).toBe('1 pessoa respondeu.');
    expect(peopleWho(3, RESPONDED)).toBe('3 pessoas responderam.');
  });

  it('pluralizes counts', () => {
    expect(countOf(1, 'leitura', 'leituras')).toBe('1 leitura');
    expect(countOf(4, 'leitura', 'leituras')).toBe('4 leituras');
    expect(countOf(0, 'voto', 'votos')).toBe('0 votos');
  });
});
