import type { Cycle, NominationId, OwnAnswer, VoteResults } from './types';

/**
 * The check between nominations and the vote. Nominations stay hidden while
 * they come in (nobody is stopped from nominating a reading twice); once
 * everyone answered, the list opens and is checked for the same work
 * nominated more than once. The same work beyond doubt is merged on its own
 * into its first nomination; anything uncertain waits for the organizer.
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
 * Nominations of the same work merged into its first one: later id → first
 * id. The first nomination goes on the ballot as usual, and its nominator
 * votes like everyone else. Each later nomination is annulled: it counts as
 * that member's first-choice vote for the reading (a head start), and they
 * then pick only a second choice.
 */
export type Merged = Readonly<Record<NominationId, NominationId>>;

/** What a duplicate check found. */
export interface DuplicateFindings {
  /** The same work beyond doubt (same book, same author): merged on their own. */
  same: ConflictGroup[];
  /** Maybe the same work: the organizer decides. */
  unsure: ConflictGroup[];
}

export const NO_FINDINGS: DuplicateFindings = { same: [], unsure: [] };

/**
 * Limits on what a check may flag, checked by the rules too. Flags let the
 * organizer see who nominated those readings, so a check that flags much is
 * not believed: few groups, few readings in each.
 */
export const MAX_CONFLICT_GROUPS = 3;
export const MAX_GROUP_SIZE = 3;
/** The most merges a round may hold (the rules check them one by one). */
export const MAX_MERGED = 8;
/** The most merges one check may make on its own (the rest wait for the organizer). */
export const MAX_AUTO_MERGES = 4;

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

/** First-choice votes a reading starts with: one per later nomination merged into it. */
export function headStart(kept: NominationId, merged: Merged): number {
  return Object.values(merged).filter((target) => target === kept).length;
}

/** The tally the vote opens with: zero, plus the head start of merged readings. */
export function openingResults(options: readonly NominationId[], merged: Merged): VoteResults {
  const start = Object.fromEntries(options.map((option) => [option, headStart(option, merged)]));
  return { votes: { ...start }, firsts: { ...start } };
}

/** A member's place on the ballot. */
export interface BallotSeat {
  /** The option holding their nomination, which they cannot vote for; null if they passed. */
  own: NominationId | null;
  /**
   * Their nomination came after an equal one and was annulled: it already
   * counts as their first choice. The first nominator votes as usual.
   */
  merged: boolean;
}

export function ballotSeat(ownNomination: NominationId | null, merged: Merged): BallotSeat {
  if (ownNomination === null) return { own: null, merged: false };
  const kept = merged[ownNomination];
  if (kept !== undefined) return { own: kept, merged: true };
  return { own: ownNomination, merged: false };
}

/**
 * A merge the check makes on its own: every later nomination into the first
 * one, in arrival order. Null when that would move an earlier merge (a later
 * nomination already took others in), which the organizer then decides.
 */
export function autoMerge(
  merged: Merged,
  group: readonly NominationId[],
  nominationIds: readonly NominationId[],
): Record<NominationId, NominationId> | null {
  const [kept, ...later] = nominationIds.filter((id) => group.includes(id) && !(id in merged));
  if (kept === undefined || later.length === 0) return null;
  if (later.some((id) => Object.values(merged).includes(id))) return null;
  return { ...merged, ...Object.fromEntries(later.map((id) => [id, kept])) };
}

/**
 * Whether flags fit what the rules accept: up to three groups of two or
 * three readings, apart, and over the whole round no more than one pair or
 * half the list (flags show the organizer who nominated them).
 */
export function fitsFlagLimits(
  groups: readonly ConflictGroup[],
  cycle: Pick<Cycle, 'flagged' | 'nominationIds'>,
): boolean {
  const ids = conflictIds(groups);
  const total = groups.reduce((sum, group) => sum + group.ids.length, 0);
  const sized = groups.every(({ ids: g }) => g.length >= 2 && g.length <= MAX_GROUP_SIZE);
  const round = new Set([...cycle.flagged, ...ids]).size;
  const capped = round <= 2 || round * 2 <= cycle.nominationIds.length;
  return groups.length <= MAX_CONFLICT_GROUPS && sized && total === ids.length && capped;
}

/**
 * What a check records: the same work merged on its own, up to
 * `MAX_AUTO_MERGES` (the rest, and anything a merge cannot settle, goes to
 * the organizer), and the uncertain groups flagged, if they fit the limits.
 */
export function settleFindings(
  findings: DuplicateFindings,
  cycle: Pick<Cycle, 'flagged' | 'nominationIds' | 'merged'>,
): { merged: Merged; flags: ConflictGroup[] } {
  let next: Merged = { ...cycle.merged };
  const flags = [...findings.unsure];
  for (const group of findings.same) {
    const merge = autoMerge(next, group.ids, cycle.nominationIds);
    const added = merge ? Object.keys(merge).length - Object.keys(cycle.merged).length : 0;
    const fits =
      merge !== null && added <= MAX_AUTO_MERGES && Object.keys(merge).length <= MAX_MERGED;
    if (fits) next = merge;
    else flags.push(group);
  }
  return { merged: next, flags: fitsFlagLimits(flags, cycle) ? flags : [] };
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
