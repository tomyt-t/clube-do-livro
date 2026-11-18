import type { NominationId } from '@/domain/types';

/**
 * The ballot while the member fills it in. Picks are in order: the first one
 * tapped is the first choice. "Não curti" marks never leave this device and
 * vanish once the vote is sent.
 */
export interface BallotDraft {
  picks: readonly NominationId[];
  disliked: readonly NominationId[];
}

export const EMPTY_BALLOT: BallotDraft = { picks: [], disliked: [] };

/** Picks a book (and forgets a "não curti" on it), or drops the pick. */
export function togglePick(ballot: BallotDraft, id: NominationId, required: number): BallotDraft {
  if (ballot.picks.includes(id)) {
    return { ...ballot, picks: ballot.picks.filter((pick) => pick !== id) };
  }
  if (ballot.picks.length >= required) return ballot;
  return {
    picks: [...ballot.picks, id],
    disliked: ballot.disliked.filter((other) => other !== id),
  };
}

/** Marks "não curti" (dropping a pick on it), or clears the mark. */
export function toggleDislike(ballot: BallotDraft, id: NominationId): BallotDraft {
  if (ballot.disliked.includes(id)) {
    return { ...ballot, disliked: ballot.disliked.filter((other) => other !== id) };
  }
  return {
    picks: ballot.picks.filter((pick) => pick !== id),
    disliked: [...ballot.disliked, id],
  };
}

/** The second choice becomes the first, and the other way around. */
export function swapPicks(ballot: BallotDraft): BallotDraft {
  return { ...ballot, picks: [...ballot.picks].reverse() };
}

/** 1 for the first choice, 2 for the second, null if not picked. */
export function rankOf(ballot: BallotDraft, id: NominationId): number | null {
  const index = ballot.picks.indexOf(id);
  return index < 0 ? null : index + 1;
}

export function isComplete(ballot: BallotDraft, required: number): boolean {
  return required > 0 && ballot.picks.length === required;
}

/** "1ª opção", "2ª opção". */
export function rankLabel(rank: number): string {
  return `${String(rank)}ª opção`;
}
