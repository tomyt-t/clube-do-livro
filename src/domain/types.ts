/**
 * Core vocabulary of the club. A *cycle* is one pass of
 * nominate → vote → (runoff) → (draw) → read, and produces one book.
 */

export type MemberId = string;
export type CycleId = string;
export type NominationId = string;

/**
 * Anything the club reads: a novel, a manga volume, a comic, an essay...
 * Described in free text; nothing checks it against a catalog.
 */
export interface Book {
  /** Free text from the "Título / autor" field, e.g. "Berserk, Kentaro Miura". */
  title: string;
  /** Optional link to a synopsis, pasted by the member. */
  synopsisUrl: string | null;
  /** An https image suggested by a catalog, or a small uploaded image (`data:image/...`). */
  coverUrl: string | null;
}

export type CycleStatus =
  | 'nominating'
  | 'voting'
  /** The runoff also ended tied; waiting for the animated draw. */
  | 'tiebreak'
  /** Decided while another book was still being read. */
  | 'upcoming'
  | 'reading'
  | 'finished';

export type DecisionMethod = 'votes' | 'draw' | 'unopposed';

export interface Winner {
  nominationId: NominationId;
  book: Book;
  method: DecisionMethod;
  decidedAt: Date;
}

export interface Cycle {
  id: CycleId;
  number: number;
  status: CycleStatus;
  /** 0 while nominating; 1 for the first round, 2+ for runoffs. */
  currentRound: number;
  /** Members who answered the nomination call, whether they nominated or not. */
  responses: number;
  nominationDeadline: Date | null;
  votingDeadline: Date | null;
  createdAt: Date;
  winner: Winner | null;
  readingStartedAt: Date | null;
  finishedAt: Date | null;
}

/** A nominated book. Who nominated it is never part of this record. */
export interface Nomination {
  id: NominationId;
  book: Book;
}

/** What a member sends during nominations. Final once confirmed. */
export type NominationAnswer = { kind: 'nominate'; book: Book } | { kind: 'pass' };

/** The member's own answer, visible only to them. */
export type OwnAnswer = { kind: 'nominated'; nominationId: NominationId } | { kind: 'passed' };

export type RoundKind = 'first' | 'runoff';

/** Votes per option. Only readable once the round is closed. */
export type Tally = Readonly<Record<NominationId, number>>;

export interface Round {
  number: number;
  kind: RoundKind;
  options: readonly NominationId[];
  votesPerMember: number;
  status: 'open' | 'closed';
  /** How many members have voted; never who or for what. */
  ballots: number;
  openedAt: Date;
  closedAt: Date | null;
  results: Tally | null;
}
