import type { NominationId, OwnAnswer, Round, RoundKind } from './types';

/**
 * Upper bound of options in a round. Firestore rules validate each option
 * slot explicitly (they have no loops), so this must match `firestore.rules`.
 */
export const MAX_ROUND_OPTIONS = 30;

interface RoundRules {
  votesPerMember: number;
  /** Whether a member may vote for the book they nominated. */
  allowsOwnNomination: boolean;
}

const RULES: Record<RoundKind, RoundRules> = {
  first: { votesPerMember: 2, allowsOwnNomination: false },
  runoff: { votesPerMember: 1, allowsOwnNomination: true },
};

export function rulesFor(kind: RoundKind): RoundRules {
  return RULES[kind];
}

type BallotRound = Pick<Round, 'kind' | 'options' | 'votesPerMember'>;

/** The nomination a member must not vote for in the first round, if any. */
export function ownNominationOf(answer: OwnAnswer | null): NominationId | null {
  return answer?.kind === 'nominated' ? answer.nominationId : null;
}

/** Options this member may pick, given the book they nominated (if any). */
export function eligibleOptions(
  round: BallotRound,
  ownNomination: NominationId | null,
): NominationId[] {
  if (rulesFor(round.kind).allowsOwnNomination || ownNomination === null) {
    return [...round.options];
  }
  return round.options.filter((option) => option !== ownNomination);
}

/**
 * Exact number of choices a ballot must carry. Normally `votesPerMember`,
 * fewer only when there are not enough eligible options.
 */
export function requiredChoices(round: BallotRound, ownNomination: NominationId | null): number {
  return Math.min(round.votesPerMember, eligibleOptions(round, ownNomination).length);
}

export type BallotError = 'wrong-count' | 'duplicate' | 'not-an-option' | 'own-nomination';

export function validateBallot(
  round: BallotRound,
  ownNomination: NominationId | null,
  choices: readonly NominationId[],
): BallotError | null {
  if (new Set(choices).size !== choices.length) return 'duplicate';
  if (choices.some((choice) => !round.options.includes(choice))) return 'not-an-option';

  const eligible = eligibleOptions(round, ownNomination);
  if (choices.some((choice) => !eligible.includes(choice))) return 'own-nomination';
  if (choices.length !== requiredChoices(round, ownNomination)) return 'wrong-count';
  return null;
}
