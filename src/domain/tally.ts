import type { NominationId, RoundKind, Tally } from './types';

export interface Standing {
  nominationId: NominationId;
  votes: number;
  /** Fraction of all votes cast in the round, from 0 to 1. */
  share: number;
}

export type RoundOutcome =
  { kind: 'winner'; nominationId: NominationId } | { kind: 'tie'; tied: NominationId[] };

/** What the election does after a round closes. */
export type NextStep =
  | { kind: 'declare-winner'; nominationId: NominationId }
  | { kind: 'open-runoff'; options: NominationId[] }
  | { kind: 'draw'; candidates: NominationId[] };

export function emptyTally(options: readonly NominationId[]): Tally {
  return Object.fromEntries(options.map((option) => [option, 0]));
}

function votesFor(results: Tally, option: NominationId): number {
  return results[option] ?? 0;
}

/** Options ordered by votes (desc). Ties keep the round's option order. */
export function rankStandings(options: readonly NominationId[], results: Tally): Standing[] {
  const total = options.reduce((sum, option) => sum + votesFor(results, option), 0);
  return options
    .map((nominationId) => {
      const votes = votesFor(results, nominationId);
      return { nominationId, votes, share: total === 0 ? 0 : votes / total };
    })
    .sort((a, b) => b.votes - a.votes);
}

export function decideRound(options: readonly NominationId[], results: Tally): RoundOutcome {
  if (options.length === 0) throw new Error('Não há opções para apurar.');

  const top = Math.max(...options.map((option) => votesFor(results, option)));
  const leaders = options.filter((option) => votesFor(results, option) === top);
  const [first] = leaders;

  if (leaders.length === 1 && first !== undefined) return { kind: 'winner', nominationId: first };
  return { kind: 'tie', tied: leaders };
}

/** A first-round tie goes to a runoff; a runoff tie goes to a draw. */
export function nextStep(kind: RoundKind, outcome: RoundOutcome): NextStep {
  if (outcome.kind === 'winner') {
    return { kind: 'declare-winner', nominationId: outcome.nominationId };
  }
  return kind === 'first'
    ? { kind: 'open-runoff', options: outcome.tied }
    : { kind: 'draw', candidates: outcome.tied };
}
