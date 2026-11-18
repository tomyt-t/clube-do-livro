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

/** "1 leitura", "3 leituras". */
export function countOf(count: number, one: string, many: string): string {
  return `${String(count)} ${count === 1 ? one : many}`;
}
