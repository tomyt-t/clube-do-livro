import { drawOrder, drawWinner } from './draw';
import type { DecisionMethod, NominationId, RankedChoices, Tally, VoteResults } from './types';

export interface Standing {
  nominationId: NominationId;
  votes: number;
  firsts: number;
  /** Fraction of all votes cast, from 0 to 1. */
  share: number;
}

export interface Decision {
  nominationId: NominationId;
  method: DecisionMethod;
  /** The books still tied when a draw was needed, in draw order. */
  drawnFrom: NominationId[];
}

const count = (tally: Tally, option: NominationId) => tally[option] ?? 0;

export function emptyResults(options: readonly NominationId[]): VoteResults {
  const zeros = Object.fromEntries(options.map((option) => [option, 0]));
  return { votes: { ...zeros }, firsts: { ...zeros } };
}

/**
 * Adds one ballot to the results: every choice is a vote, the first is also a
 * first choice, unless the member's first choice is already counted (their
 * nomination was merged with an equal one).
 */
export function addBallot(
  results: VoteResults,
  choices: RankedChoices,
  countsFirst = true,
): VoteResults {
  const [first] = choices;
  const votes = { ...results.votes };
  const firsts = { ...results.firsts };
  choices.forEach((choice) => {
    votes[choice] = count(votes, choice) + 1;
  });
  if (countsFirst && first !== undefined) firsts[first] = count(firsts, first) + 1;
  return { votes, firsts };
}

/** Most votes first; ties ordered by first choices, then by ballot order. */
export function rankStandings(options: readonly NominationId[], results: VoteResults): Standing[] {
  const total = options.reduce((sum, option) => sum + count(results.votes, option), 0);
  return options
    .map((nominationId) => {
      const votes = count(results.votes, nominationId);
      const firsts = count(results.firsts, nominationId);
      return { nominationId, votes, firsts, share: total === 0 ? 0 : votes / total };
    })
    .sort((a, b) => b.votes - a.votes || b.firsts - a.firsts);
}

function topBy(options: readonly NominationId[], tally: Tally): NominationId[] {
  const best = Math.max(...options.map((option) => count(tally, option)));
  return options.filter((option) => count(tally, option) === best);
}

/**
 * The books still tied after both criteria (most votes, then most first
 * choices): one book, or the ones that went to the draw.
 */
export function finalists(options: readonly NominationId[], results: VoteResults): NominationId[] {
  return topBy(topBy(options, results.votes), results.firsts);
}

/**
 * The club's rule: the most votes wins. A tie goes to the most first
 * choices; if still tied, a draw among the books left, fixed by `drawSeed`
 * (the milliseconds when voting closed).
 */
export function decide(
  options: readonly NominationId[],
  results: VoteResults,
  drawSeed: number,
): Decision {
  if (options.length === 0) throw new Error('Não há opções para apurar.');
  const [only] = options;
  if (options.length === 1 && only !== undefined) {
    return { nominationId: only, method: 'unopposed', drawnFrom: [] };
  }

  const byVotes = topBy(options, results.votes);
  const [leader] = byVotes;
  if (byVotes.length === 1 && leader !== undefined) {
    return { nominationId: leader, method: 'votes', drawnFrom: [] };
  }

  const byFirsts = finalists(byVotes, results);
  const [firstChoice] = byFirsts;
  if (byFirsts.length === 1 && firstChoice !== undefined) {
    return { nominationId: firstChoice, method: 'first-choices', drawnFrom: [] };
  }
  return {
    nominationId: drawWinner(byFirsts, options, drawSeed),
    method: 'draw',
    drawnFrom: drawOrder(byFirsts, options),
  };
}
