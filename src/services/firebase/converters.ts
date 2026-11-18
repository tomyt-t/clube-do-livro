import { Timestamp } from 'firebase/firestore';

import { SYNOPSIS_SOURCES } from '@/domain/book';
import type {
  Book,
  Cycle,
  CycleStatus,
  DecisionMethod,
  Nomination,
  OwnAnswer,
  Tally,
  VoteResults,
  Winner,
} from '@/domain/types';

import type { AllowlistEntry, MemberProfile } from '../backend';

/**
 * Turns raw Firestore data into domain objects. Readers never throw:
 * a malformed document becomes `null` and is skipped by the caller.
 */

type Data = Record<string, unknown>;

const CYCLE_STATUSES: readonly CycleStatus[] = [
  'nominating',
  'voting',
  'tallying',
  'upcoming',
  'reading',
  'finished',
];
const METHODS: readonly DecisionMethod[] = ['votes', 'first-choices', 'draw', 'unopposed'];

function isRecord(value: unknown): value is Data {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function oneOf<T extends string>(value: unknown, allowed: readonly T[]): T | null {
  return allowed.find((option) => option === value) ?? null;
}

function text(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function textOrNull(value: unknown): string | null {
  return typeof value === 'string' && value !== '' ? value : null;
}

function count(value: unknown): number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 ? value : 0;
}

function dateOrNull(value: unknown): Date | null {
  return value instanceof Timestamp ? value.toDate() : null;
}

function textList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item) => typeof item === 'string') : [];
}

function toTally(value: unknown): Tally | null {
  if (!isRecord(value)) return null;
  return Object.fromEntries(Object.entries(value).map(([key, votes]) => [key, count(votes)]));
}

export function toResults(value: unknown): VoteResults | null {
  if (!isRecord(value)) return null;
  const votes = toTally(value.votes);
  const firsts = toTally(value.firsts);
  return votes && firsts ? { votes, firsts } : null;
}

export function toBook(value: unknown): Book | null {
  if (!isRecord(value) || text(value.title) === '') return null;
  const synopsis = textOrNull(value.synopsis);
  return {
    title: text(value.title),
    synopsis,
    synopsisSource: synopsis === null ? null : oneOf(value.synopsisSource, SYNOPSIS_SOURCES),
    synopsisUrl: textOrNull(value.synopsisUrl),
    coverUrl: textOrNull(value.coverUrl),
  };
}

function toWinner(value: unknown): Winner | null {
  if (!isRecord(value)) return null;
  const book = toBook(value.book);
  const method = oneOf(value.method, METHODS);
  const decidedAt = dateOrNull(value.decidedAt);
  const nominationId = text(value.nominationId);
  if (!book || !method || !decidedAt || nominationId === '') return null;
  return { nominationId, book, method, decidedAt };
}

export function toCycle(id: string, data: Data): Cycle | null {
  const status = oneOf(data.status, CYCLE_STATUSES);
  const createdAt = dateOrNull(data.createdAt);
  if (!status || !createdAt) return null;
  return {
    id,
    number: count(data.number),
    status,
    responses: count(data.responses),
    nominationDeadline: dateOrNull(data.nominationDeadline),
    votingDeadline: dateOrNull(data.votingDeadline),
    createdAt,
    options: textList(data.options),
    ballots: count(data.ballots),
    votingOpenedAt: dateOrNull(data.votingOpenedAt),
    votingClosedAt: dateOrNull(data.votingClosedAt),
    results: toResults(data.results),
    winner: toWinner(data.winner),
    readingStartedAt: dateOrNull(data.readingStartedAt),
    finishedAt: dateOrNull(data.finishedAt),
  };
}

export function toNomination(id: string, data: Data): Nomination | null {
  const book = toBook(data.book);
  return book ? { id, book } : null;
}

export function toOwnAnswer(data: Data): OwnAnswer {
  const nominationId = textOrNull(data.nominationId);
  return nominationId ? { kind: 'nominated', nominationId } : { kind: 'passed' };
}

export function toMember(uid: string, data: Data): MemberProfile {
  return { uid, name: text(data.name) || 'Leitor', photoURL: textOrNull(data.photoURL) };
}

export function toAllowlistEntry(email: string, data: Data): AllowlistEntry {
  return { email, isAdmin: data.admin === true };
}
