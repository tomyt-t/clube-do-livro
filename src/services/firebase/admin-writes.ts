import {
  deleteDoc,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
  type Firestore,
} from 'firebase/firestore';

import { cycleIdFor } from '@/domain/flow';
import type { CycleId } from '@/domain/types';

import { newCycleData } from './cycle-data';
import { refs } from './refs';

/**
 * Writes reserved to the organizer. `firestore.rules` checks each one as a
 * step of the cycle's state machine, so these mirror its transitions 1:1.
 */

interface OpenCycleInput {
  number: number;
  nominationDeadline: Date | null;
}

/** Cycles are named by number, so the same round can never open twice. */
export async function openCycle(db: Firestore, input: OpenCycleInput): Promise<CycleId> {
  const id = cycleIdFor(input.number);
  await setDoc(refs.cycle(db, id), newCycleData(input.number, input.nominationDeadline));
  return id;
}

export type DeadlineField = 'nominationDeadline' | 'votingDeadline';

export async function setDeadline(
  db: Firestore,
  cycleId: CycleId,
  field: DeadlineField,
  deadline: Date | null,
) {
  await updateDoc(refs.cycle(db, cycleId), { [field]: deadline });
}

/** Only allowed while the cycle is still collecting nominations. */
export async function deleteCycle(db: Firestore, cycleId: CycleId) {
  await deleteDoc(refs.cycle(db, cycleId));
}

export async function startReading(db: Firestore, cycleId: CycleId) {
  await updateDoc(refs.cycle(db, cycleId), {
    status: 'reading',
    readingStartedAt: serverTimestamp(),
  });
}

export async function finishReading(db: Firestore, cycleId: CycleId) {
  await updateDoc(refs.cycle(db, cycleId), {
    status: 'finished',
    finishedAt: serverTimestamp(),
  });
}

/** Emails must already be normalized (trimmed, lowercase). */
export async function allowEmails(db: Firestore, emails: readonly string[]) {
  const batch = writeBatch(db);
  emails.forEach((email) => {
    batch.set(refs.allowlistEntry(db, email), {});
  });
  await batch.commit();
}

export async function revokeEmail(db: Firestore, email: string) {
  await deleteDoc(refs.allowlistEntry(db, email));
}

/** How many members "everyone" means; kept in step with the allowlist. */
export async function setMemberCount(db: Firestore, members: number) {
  await setDoc(refs.settings(db), { members });
}
