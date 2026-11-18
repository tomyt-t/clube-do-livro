import type { NominationId, OwnAnswer, RankedChoices } from './types';

/**
 * Upper bound of options on a ballot. Firestore rules validate each option
 * slot explicitly (they have no loops), so this must match `firestore.rules`.
 */
export const MAX_OPTIONS = 30;

/** Each member picks a first and a second choice, never their own nomination. */
export const VOTES_PER_MEMBER = 2;

/** The nomination a member must not vote for, if any. */
export function ownNominationOf(answer: OwnAnswer | null): NominationId | null {
  return answer?.kind === 'nominated' ? answer.nominationId : null;
}

/** Options this member may pick, given the book they nominated (if any). */
export function eligibleOptions(
  options: readonly NominationId[],
  ownNomination: NominationId | null,
): NominationId[] {
  return options.filter((option) => option !== ownNomination);
}

/**
 * Exact number of choices a ballot must carry: two, or fewer when there are
 * not enough eligible options.
 */
export function requiredChoices(
  options: readonly NominationId[],
  ownNomination: NominationId | null,
): number {
  return Math.min(VOTES_PER_MEMBER, eligibleOptions(options, ownNomination).length);
}

export type BallotError = 'wrong-count' | 'duplicate' | 'not-an-option' | 'own-nomination';

export function validateBallot(
  options: readonly NominationId[],
  ownNomination: NominationId | null,
  choices: RankedChoices,
): BallotError | null {
  if (new Set(choices).size !== choices.length) return 'duplicate';
  if (choices.some((choice) => !options.includes(choice))) return 'not-an-option';
  if (ownNomination !== null && choices.includes(ownNomination)) return 'own-nomination';
  if (choices.length !== requiredChoices(options, ownNomination)) return 'wrong-count';
  return null;
}
