/** Dates and counts the way the club reads them, in Brazilian Portuguese. */

const DAY_MONTH = new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'short' });
const WEEKDAY_DAY_MONTH = new Intl.DateTimeFormat('pt-BR', {
  weekday: 'long',
  day: 'numeric',
  month: 'short',
});

/** "8 de out." */
export function formatDay(date: Date): string {
  return DAY_MONTH.format(date);
}

/** "sexta, 21 de nov.": weekday without "-feira", as people say it. */
export function formatWeekday(date: Date): string {
  return WEEKDAY_DAY_MONTH.format(date).replace('-feira', '');
}

/** "Até sábado, 21 de nov." (the month abbreviation already ends the sentence). */
export function until(deadline: Date | null): string | null {
  if (!deadline) return null;
  const day = formatWeekday(deadline);
  return `Até ${day}${day.endsWith('.') ? '' : '.'}`;
}

export interface Verb {
  one: string;
  many: string;
  nobody: string;
}

export const RESPONDED: Verb = {
  one: 'respondeu',
  many: 'responderam',
  nobody: 'Ninguém respondeu ainda.',
};

export const VOTED: Verb = { one: 'votou', many: 'votaram', nobody: 'Ninguém votou ainda.' };

export const FINISHED: Verb = {
  one: 'terminou',
  many: 'terminaram',
  nobody: 'Ninguém terminou ainda.',
};

/** "Ninguém votou ainda.", "1 pessoa votou.", "3 pessoas votaram." */
export function peopleWho(count: number, verb: Verb): string {
  if (count === 0) return verb.nobody;
  return count === 1 ? `1 pessoa ${verb.one}.` : `${String(count)} pessoas ${verb.many}.`;
}

/**
 * "3 de 6 responderam.", as in the prototype; without a known total it
 * falls back to "3 pessoas responderam.".
 */
export function peopleOutOf(count: number, total: number, verb: Verb): string {
  if (total <= 0) return peopleWho(count, verb);
  if (count === 0) return verb.nobody;
  return `${String(count)} de ${String(total)} ${count === 1 ? verb.one : verb.many}.`;
}

/** "1 leitura", "3 leituras". */
export function countOf(count: number, one: string, many: string): string {
  return `${String(count)} ${count === 1 ? one : many}`;
}

/** "A, B e C". */
export function joinNames(names: readonly string[]): string {
  if (names.length <= 1) return names.join('');
  return `${names.slice(0, -1).join(', ')} e ${names.at(-1) ?? ''}`;
}
