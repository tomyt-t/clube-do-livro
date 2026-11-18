import {
  arrayRemove,
  arrayUnion,
  getDoc,
  getDocs,
  increment,
  serverTimestamp,
  updateDoc,
  writeBatch,
  type Firestore,
} from 'firebase/firestore';

import type { ConflictGroup, Merged } from '@/domain/review';
import type { CycleId, MemberId, NominationId } from '@/domain/types';

import { reviewData } from './flow-writes';
import { refs } from './refs';

/**
 * The organizer sorting out readings the check flagged. `firestore.rules`
 * lets the organizer read only the answers behind flagged readings, and let
 * those readings go so their members can nominate again.
 */

/**
 * Who nominated each flagged reading. Every member's answer is asked for;
 * the rules refuse all but the flagged ones, and a refusal looks the same
 * whether the member passed, nominated something else or never answered.
 */
export async function findNominators(
  db: Firestore,
  cycleId: CycleId,
  nominationIds: readonly NominationId[],
): Promise<Record<NominationId, MemberId[]>> {
  const members = await getDocs(refs.members(db));
  const found: Record<NominationId, MemberId[]> = {};
  await Promise.all(
    members.docs.map(async ({ id: uid }) => {
      try {
        const answer = await getDoc(refs.answer(db, cycleId, uid));
        const nominationId: unknown = answer.data()?.nominationId;
        if (typeof nominationId === 'string' && nominationIds.includes(nominationId)) {
          found[nominationId] = [...(found[nominationId] ?? []), uid];
        }
      } catch {
        // Not a flagged reading's answer: the rules keep it private.
      }
    }),
  );
  return found;
}

export async function updateReview(
  db: Firestore,
  input: { cycleId: CycleId; groups: readonly ConflictGroup[]; merged: Merged },
) {
  await updateDoc(refs.cycle(db, input.cycleId), {
    review: reviewData(input.groups),
    merged: { ...input.merged },
  });
}

/**
 * Lets flagged readings go: each nomination and its title record are
 * deleted, the count drops and the list closes again until everyone
 * answered. The answers stay; their members see the nomination was let go
 * and answer again (only they can replace their own answer).
 */
export async function reopenNominations(
  db: Firestore,
  input: { cycleId: CycleId; nominationIds: readonly NominationId[] },
) {
  const { cycleId, nominationIds } = input;
  const keys = await Promise.all(
    nominationIds.map(async (nominationId) => {
      const nomination = await getDoc(refs.nomination(db, cycleId, nominationId));
      const key: unknown = nomination.data()?.titleKey;
      return typeof key === 'string' ? key : null;
    }),
  );
  const batch = writeBatch(db);
  nominationIds.forEach((nominationId, index) => {
    batch.delete(refs.nomination(db, cycleId, nominationId));
    const key = keys[index];
    if (key) batch.delete(refs.title(db, cycleId, key));
  });
  batch.update(refs.cycle(db, cycleId), {
    review: null,
    responses: increment(-nominationIds.length),
    nominationIds: arrayRemove(...nominationIds),
    letGo: arrayUnion(...nominationIds),
    letGoAt: serverTimestamp(),
  });
  await batch.commit();
}
