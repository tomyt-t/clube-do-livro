import { splitTitle } from '@/domain/book';
import type { Cycle, Nomination, NominationId, Winner } from '@/domain/types';
import { formatDay } from '@/ui/format';

/** A cycle whose book was chosen: read, being read or queued. */
export type DecidedCycle = Cycle & { winner: Winner };

/** Every cycle that chose a book, newest first. */
export function decidedCycles(cycles: readonly Cycle[]): DecidedCycle[] {
  return cycles
    .filter((cycle): cycle is DecidedCycle => cycle.winner !== null)
    .sort((a, b) => b.number - a.number);
}

export interface ChartRow {
  id: NominationId;
  title: string;
  author: string | null;
  votes: number;
  firsts: number;
  /** Votes as a second choice: every vote that was not a first choice. */
  seconds: number;
  winner: boolean;
}

const TITLE_ORDER = new Intl.Collator('pt-BR', { sensitivity: 'base' });

/** One row per book on the ballot: most votes first, then most first choices. */
export function chartRows(cycle: Cycle, nominations: readonly Nomination[]): ChartRow[] {
  const votes = cycle.results?.votes ?? {};
  const firsts = cycle.results?.firsts ?? {};
  return cycle.options
    .map((id) => {
      const book = nominations.find((nomination) => nomination.id === id)?.book;
      const { title, author } = splitTitle(book?.title ?? 'Leitura indicada');
      const total = votes[id] ?? 0;
      const first = firsts[id] ?? 0;
      return {
        id,
        title,
        author,
        votes: total,
        firsts: first,
        seconds: Math.max(total - first, 0),
        winner: cycle.winner?.nominationId === id,
      };
    })
    .sort(
      (a, b) => b.votes - a.votes || b.firsts - a.firsts || TITLE_ORDER.compare(a.title, b.title),
    );
}

/** "Lida de 9 de out. a 12 de nov.", "Lendo desde 9 de out." or "Na fila". */
export function readingPeriod(cycle: Cycle): string {
  if (cycle.status === 'upcoming' || !cycle.readingStartedAt) return 'Na fila para ser lida';
  const start = formatDay(cycle.readingStartedAt);
  if (!cycle.finishedAt) return `Lendo desde ${start}`;
  return `Lida de ${start} a ${formatDay(cycle.finishedAt)}`;
}

export { joinNames } from '@/ui/format';

/** "21:03:12,004": the closing time down to the millisecond that fixed the draw. */
export function formatClosingTime(date: Date): string {
  const time = date.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  return `${time},${String(date.getMilliseconds()).padStart(3, '0')}`;
}
