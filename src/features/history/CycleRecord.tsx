import { useId } from 'react';

import { splitTitle } from '@/domain/book';
import type { Nomination } from '@/domain/types';
import { CHOSEN } from '@/features/club/methods';
import { useMemberCount, useNominations } from '@/features/club/use-club';
import { BookCover } from '@/ui/BookCover';
import { peopleOutOf, VOTED } from '@/ui/format';

import styles from './CycleRecord.module.css';
import {
  chartRows,
  formatClosingTime,
  joinNames,
  readingPeriod,
  type DecidedCycle,
} from './history';
import { VoteChart } from './VoteChart';

/** Ends with one period, even after an abbreviation like "out.". */
const asSentence = (text: string) => (text.endsWith('.') ? text : `${text}.`);

/** How a draw came out, so anyone can redo the arithmetic. */
function DrawNote({ cycle, nominations }: { cycle: DecidedCycle; nominations: Nomination[] }) {
  const { drawnFrom, nominationId } = cycle.winner;
  const closedAt = cycle.votingClosedAt;
  if (drawnFrom.length < 2 || !closedAt) return null;
  const titleOf = (id: string) =>
    splitTitle(nominations.find((n) => n.id === id)?.book.title ?? 'Leitura indicada').title;
  const position = drawnFrom.indexOf(nominationId) + 1;

  return (
    <details className={styles.draw}>
      <summary>Como foi o sorteio</summary>
      <p>
        Empataram em votos e em 1ª opção, nesta ordem fixa: {joinNames(drawnFrom.map(titleOf))}. A
        votação fechou às {formatClosingTime(closedAt)}; esse instante em milissegundos, dividido
        por {drawnFrom.length}, deixa resto {position - 1}, então venceu a {position}ª da lista.
      </p>
    </details>
  );
}

/** One round of the club: the book it chose and how the vote went. */
export function CycleRecord({ cycle, anchor }: { cycle: DecidedCycle; anchor: string }) {
  const headingId = useId();
  const nominations = useNominations(cycle.id);
  const members = useMemberCount();
  const loaded = nominations.status === 'ready' ? nominations.value : [];
  const { title, author } = splitTitle(cycle.winner.book.title);
  const showChart = cycle.results !== null && cycle.options.length > 1;

  return (
    <section id={anchor} className={styles.record} aria-labelledby={headingId}>
      <header className={styles.header}>
        <BookCover book={cycle.winner.book} className={styles.cover} />
        <div>
          <p className={styles.number}>Leitura nº {cycle.number}</p>
          <h2 id={headingId} className={styles.title}>
            {title}
          </h2>
          {author && <p className={styles.author}>{author}</p>}
          <p className={styles.meta}>
            {asSentence(readingPeriod(cycle))} Escolhida {CHOSEN[cycle.winner.method]}.
          </p>
        </div>
      </header>
      {showChart && (
        <VoteChart
          rows={chartRows(cycle, loaded)}
          caption={peopleOutOf(cycle.ballots, members, VOTED).replace(/\.$/, '')}
        />
      )}
      {cycle.winner.method === 'draw' && <DrawNote cycle={cycle} nominations={loaded} />}
    </section>
  );
}
