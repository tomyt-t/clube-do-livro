import {
  ballotOptions,
  conflictIds,
  MAX_CONFLICT_GROUPS,
  MAX_GROUP_SIZE,
  MAX_MERGED,
  canLetGo,
  mergeGroup,
  type ConflictGroup,
  type Merged,
} from '@/domain/review';
import type { Cycle, CycleId, NominationId } from '@/domain/types';
import { ownNominationOf } from '@/domain/voting';

import { everyone } from '@/domain/flow';

import type { AdminPort, FlowPort } from '../backend';

import { deny, pause, requireAdmin, requireMember, type DemoContext } from './context';
import type { DemoState } from './state';

/** Mirrors `firestore.rules`: the review is open while nominating, once it has started. */
export function reviewingCycle(state: DemoState, cycleId: CycleId): Cycle {
  const cycle = state.cycles[cycleId];
  if (cycle?.status !== 'nominating' || cycle.review === null) deny();
  return cycle;
}

/** Mirrors `isReviewData`: few small groups, apart, of readings not merged yet. */
export function isValidGroups(cycle: Cycle, groups: readonly ConflictGroup[]): boolean {
  const ids = conflictIds(groups);
  const flagged = groups.reduce((sum, group) => sum + group.ids.length, 0);
  return (
    groups.length <= MAX_CONFLICT_GROUPS &&
    groups.every(
      ({ ids: group, reason }) =>
        group.length >= 2 && group.length <= MAX_GROUP_SIZE && reason.length <= 200,
    ) &&
    new Set(ids).size === flagged &&
    ids.every((id) => cycle.nominationIds.includes(id) && !(id in cycle.merged))
  );
}

/** Mirrors `recordsReview`: over the whole round, one pair or half the list at most. */
function flaggedAfter(cycle: Cycle, groups: readonly ConflictGroup[]): NominationId[] | null {
  const all = [...new Set([...cycle.flagged, ...conflictIds(groups)])];
  return all.length <= 2 || all.length * 2 <= cycle.nominationIds.length ? all : null;
}

/** Mirrors `editsReview`: groups only leave; a merge takes exactly the group that left. */
function isValidEdit(cycle: Cycle, groups: readonly ConflictGroup[], merged: Merged): boolean {
  const before = cycle.review?.conflicts ?? [];
  const kept = groups.every((group) =>
    before.some((old) => JSON.stringify(old) === JSON.stringify(group)),
  );
  if (!kept || !isValidGroups(cycle, groups)) return false;
  if (JSON.stringify(merged) === JSON.stringify(cycle.merged)) return true;
  const left = conflictIds(before).filter((id) => !conflictIds(groups).includes(id));
  const expected = mergeGroup(cycle.merged, left, cycle.nominationIds);
  return expected !== null && JSON.stringify(expected) === JSON.stringify(merged);
}

/** Merges point from a nomination to another ballot option, never in chains. */
export function isValidMerge(cycle: Cycle, merged: Merged): boolean {
  const removed = Object.keys(merged);
  const kept = Object.values(merged);
  const known = [...removed, ...kept].every((id) => cycle.nominationIds.includes(id));
  return known && removed.length <= MAX_MERGED && !kept.some((id) => removed.includes(id));
}

/** Whether the ballot is exactly the nominations left after merges, in arrival order. */
export function isFullBallot(cycle: Cycle, options: readonly NominationId[]): boolean {
  return options.join() === ballotOptions(cycle.nominationIds, cycle.merged).join();
}

function nominatorsIn(state: DemoState, cycleId: CycleId, ids: readonly NominationId[]) {
  const found: Record<NominationId, string[]> = {};
  for (const [uid, answer] of Object.entries(state.answers[cycleId] ?? {})) {
    const id = ownNominationOf(answer);
    if (id !== null && ids.includes(id)) found[id] = [...(found[id] ?? []), uid];
  }
  return found;
}

type ReviewActions = Pick<AdminPort, 'findNominators' | 'updateReview' | 'reopenNominations'>;

export function reviewActions(context: DemoContext): ReviewActions {
  const { store } = context;
  const flagged = (cycle: Cycle) => conflictIds(cycle.review?.conflicts ?? []);

  return {
    findNominators: async (cycleId, ids) => {
      await pause(context);
      requireAdmin(context);
      const cycle = reviewingCycle(store.current, cycleId);
      const allowed = ids.filter((id) => flagged(cycle).includes(id));
      return nominatorsIn(store.current, cycleId, allowed);
    },

    updateReview: async ({ cycleId, groups, merged }) => {
      await pause(context);
      requireAdmin(context);
      const cycle = reviewingCycle(store.current, cycleId);
      if (cycle.review?.conflicts === null) deny();
      if (!isValidEdit(cycle, groups, merged) || !isValidMerge(cycle, merged)) deny();
      store.update((state) => {
        const target = reviewingCycle(state, cycleId);
        target.review = { conflicts: structuredClone([...groups]) };
        target.merged = { ...merged };
      });
    },

    reopenNominations: async ({ cycleId, nominationIds: ids }) => {
      await pause(context);
      requireAdmin(context);
      const cycle = reviewingCycle(store.current, cycleId);
      const allowed = ids.every((id) => flagged(cycle).includes(id) && canLetGo(id, cycle.merged));
      if (ids.length === 0 || ids.length > MAX_GROUP_SIZE || !allowed) deny();
      // The answers stay: their members answer again (see isLetGo).
      store.update((state) => {
        const target = reviewingCycle(state, cycleId);
        target.review = null;
        target.responses -= ids.length;
        target.nominationIds = target.nominationIds.filter((id) => !ids.includes(id));
        target.letGo = [...target.letGo, ...ids];
        target.letGoAt = new Date();
        state.nominations[cycleId] = (state.nominations[cycleId] ?? []).filter(
          ({ id }) => !ids.includes(id),
        );
      });
    },
  };
}

type ReviewSteps = Pick<FlowPort, 'startReview' | 'recordReview'>;

/** The member-taken steps: open the list once everyone answered, record the check once. */
export function reviewSteps(context: DemoContext, members: () => number): ReviewSteps {
  const { store } = context;
  return {
    startReview: async (cycleId) => {
      await pause(context);
      const cycle = nominatingCycle(store.current, cycleId);
      if (cycle.review !== null || cycle.nominationIds.length === 0 || cycle.letGo.length > 0) {
        deny();
      }
      requireMember(context);
      if (!everyone(cycle.responses, members())) deny();
      store.update((state) => {
        nominatingCycle(state, cycleId).review = { conflicts: null };
      });
    },

    recordReview: async (cycleId, groups) => {
      await pause(context);
      requireMember(context);
      const cycle = reviewingCycle(store.current, cycleId);
      if (cycle.review?.conflicts !== null || !isValidGroups(cycle, groups)) deny();
      const flagged = flaggedAfter(cycle, groups) ?? deny();
      store.update((state) => {
        const target = reviewingCycle(state, cycleId);
        target.review = { conflicts: structuredClone([...groups]) };
        target.flagged = flagged;
      });
    },
  };
}

function nominatingCycle(state: DemoState, cycleId: CycleId): Cycle {
  const cycle = state.cycles[cycleId];
  if (cycle?.status !== 'nominating') deny();
  return cycle;
}
