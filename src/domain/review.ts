import type { Cycle, NominationId, OwnAnswer, VoteResults } from './types';

/**
 * The check between nominations and the vote. Nominations stay hidden while
 * they come in; once everyone answered, the list opens and is checked for
 * readings nominated twice under different titles. The checker only flags:
 * the organizer decides, after talking to whoever nominated them.
 */

/** Readings the checker thinks are the same work, and why. */
export interface ConflictGroup {
  ids: NominationId[];
  reason: string;
}

export interface CycleReview {
  /** Null while the check runs; the groups it found (maybe none) after. */
  conflicts: ConflictGroup[] | null;
}

/**
 * Nominations the organizer merged into an equal one: removed id → kept id.
 * The kept one goes on the ballot with a head start of one first-choice vote
 * per member who nominated the reading, and those members then pick only a
 * second choice.
 */
export type Merged = Readonly<Record<NominationId, NominationId>>;

/**
 * Limits on what a check may flag, checked by the rules too. Flags let the
 * organizer see who nominated those readings, so a check that flags much is
 * not believed: few groups, few readings in each.
 */
export const MAX_CONFLICT_GROUPS = 3;
export const MAX_GROUP_SIZE = 3;
/** The most merges a round may hold (the rules check them one by one). */
export const MAX_MERGED = 8;

export function conflictIds(groups: readonly ConflictGroup[]): NominationId[] {
  return [...new Set(groups.flatMap((group) => group.ids))];
}

/** Whether the vote may open on its own: checked, and nothing left to sort out. */
export function isReviewClear(review: CycleReview | null): boolean {
  return review?.conflicts?.length === 0;
}

/** The ballot: every nomination in arrival order, minus the ones merged away. */
export function ballotOptions(
  nominationIds: readonly NominationId[],
  merged: Merged,
): NominationId[] {
  return nominationIds.filter((id) => !(id in merged));
}

/** Members whose nomination ended up as `kept`: its own nominator and every merged one. */
export function nominatorsOf(kept: NominationId, merged: Merged): number {
  return 1 + Object.values(merged).filter((target) => target === kept).length;
}

/** The tally the vote opens with: zero, plus the head start of merged readings. */
export function openingResults(options: readonly NominationId[], merged: Merged): VoteResults {
  const targets = new Set(Object.values(merged));
  const start = Object.fromEntries(
    options.map((option) => [option, targets.has(option) ? nominatorsOf(option, merged) : 0]),
  );
  return { votes: { ...start }, firsts: { ...start } };
}

/** A member's place on the ballot. */
export interface BallotSeat {
  /** The option holding their nomination, which they cannot vote for; null if they passed. */
  own: NominationId | null;
  /** Their nomination was merged with an equal one, so it already counts as their first choice. */
  merged: boolean;
}

export function ballotSeat(ownNomination: NominationId | null, merged: Merged): BallotSeat {
  if (ownNomination === null) return { own: null, merged: false };
  const kept = merged[ownNomination];
  if (kept !== undefined) return { own: kept, merged: true };
  return { own: ownNomination, merged: Object.values(merged).includes(ownNomination) };
}

/**
 * Merges a group into one nomination: the one that already took others in,
 * if any, otherwise the first in arrival order. Null when the group cannot
 * be merged (fewer than two readings left, or two that already took others).
 */
export function mergeGroup(
  merged: Merged,
  group: readonly NominationId[],
  nominationIds: readonly NominationId[],
): Record<NominationId, NominationId> | null {
  const ordered = nominationIds.filter((id) => group.includes(id) && !(id in merged));
  // A reading that already took others in stays; two of them cannot merge
  // (the rules never move an earlier merge).
  const targets = ordered.filter((id) => Object.values(merged).includes(id));
  if (targets.length > 1 || ordered.length < 2) return null;
  const kept = targets[0] ?? ordered[0] ?? '';
  const next: Record<NominationId, NominationId> = { ...merged };
  for (const id of ordered) if (id !== kept) next[id] = kept;
  return next;
}

/**
 * A nomination the organizer let go: the member's answer still points at
 * it, but it left the list (into `letGo`), so the member may answer again.
 */
export function isLetGo(answer: OwnAnswer | null, cycle: Pick<Cycle, 'letGo'>): boolean {
  return answer?.kind === 'nominated' && cycle.letGo.includes(answer.nominationId);
}

/** How long the vote waits for members whose nominations were let go (the rules check it). */
export const LET_GO_WAIT_MS = 3 * 24 * 60 * 60 * 1000;

/** Whether the vote may open: nobody let go is still choosing again, or they had their wait. */
export function isLetGoSettled(cycle: Pick<Cycle, 'letGo' | 'letGoAt'>, now = new Date()): boolean {
  if (cycle.letGo.length === 0) return true;
  return cycle.letGoAt !== null && now.getTime() > cycle.letGoAt.getTime() + LET_GO_WAIT_MS;
}

/** Whether a flagged reading can be let go: merged readings stay. */
export function canLetGo(id: NominationId, merged: Merged): boolean {
  return !(id in merged) && !Object.values(merged).includes(id);
}

/** The groups left after one is merged or dismissed. */
export function withoutGroup(groups: readonly ConflictGroup[], index: number): ConflictGroup[] {
  return groups.filter((_, at) => at !== index);
}

/**
 * Whether the member nominated the reading the round chose (or a reading
 * merged into it): they may change its link. Known only to themselves.
 */
export function isReadingNominator(
  answer: OwnAnswer | null,
  cycle: Pick<Cycle, 'merged' | 'winner'>,
): boolean {
  if (answer?.kind !== 'nominated' || cycle.winner === null) return false;
  const own = answer.nominationId;
  return (cycle.merged[own] ?? own) === cycle.winner.nominationId;
}
