import type { CycleReview, Merged } from './review';

/**
 * Core vocabulary of the club. A *cycle* is one pass of
 * nominate → vote → count → read, and produces one book.
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
  /** Synopsis text, found automatically and possibly edited by the member. */
  synopsis: string | null;
  /** Where the synopsis text came from, for credit; null when the member wrote it. */
  synopsisSource: SynopsisSource | null;
  /** Optional link to a synopsis, pasted by the member. */
  synopsisUrl: string | null;
  /** An https image suggested by a catalog, or a small uploaded image (`data:image/...`). */
  coverUrl: string | null;
}

export type SynopsisSource = 'wikipedia' | 'open-library' | 'google-books' | 'anilist';

export type CycleStatus =
  | 'nominating'
  | 'voting'
  /** Voting closed; the organizer is counting. */
  | 'tallying'
  /** Decided while another book was still being read. */
  | 'upcoming'
  | 'reading'
  | 'finished';

/**
 * Why the winner won: most votes; a tie broken by first choices; a tie
 * that remained and was drawn; or the only nomination.
 */
export type DecisionMethod = 'votes' | 'first-choices' | 'draw' | 'unopposed';

export interface Winner {
  nominationId: NominationId;
  book: Book;
  method: DecisionMethod;
  decidedAt: Date;
  /** For a draw: the tied books in draw order, so anyone can check it. */
  drawnFrom: NominationId[];
}

/** Counts per nomination. */
export type Tally = Readonly<Record<NominationId, number>>;

/** Readable only once voting has closed. */
export interface VoteResults {
  /** Every vote, first and second choices alike. */
  votes: Tally;
  /** First choices only: they break ties. */
  firsts: Tally;
}

export interface Cycle {
  id: CycleId;
  number: number;
  status: CycleStatus;
  /** Members who answered the nomination call, whether they nominated or not. */
  responses: number;
  /**
   * The nominations so far, in the order they arrived (never who sent them).
   * The vote opens with exactly these, so the server can check the ballot.
   */
  nominationIds: NominationId[];
  nominationDeadline: Date | null;
  votingDeadline: Date | null;
  createdAt: Date;
  /** The nominations on the ballot, fixed when voting opens. */
  options: NominationId[];
  /** How many members have voted; never who or for what. */
  ballots: number;
  votingOpenedAt: Date | null;
  votingClosedAt: Date | null;
  results: VoteResults | null;
  winner: Winner | null;
  readingStartedAt: Date | null;
  /** Members who marked "Acabei de ler!"; never who. */
  finishedReaders: number;
  finishedAt: Date | null;
  /** Once everyone answered: the check for readings nominated twice; null before. */
  review: CycleReview | null;
  /** Nominations merged into an equal one before the vote. */
  merged: Merged;
  /** Nominations the organizer let go whose members have not answered again yet. */
  letGo: NominationId[];
  /** When the last nominations were let go; the vote waits up to three days for them. */
  letGoAt: Date | null;
  /** Every nomination flagged by a check this round (the rules cap how many). */
  flagged: NominationId[];
}

/** Club-wide settings everyone can read; only the organizer changes them. */
export interface ClubSettings {
  /** How many people are on the allowlist: "everyone" in the cycle's flow. */
  members: number;
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

/** A ballot in order of preference: first choice, then second choice. */
export type RankedChoices = readonly NominationId[];
