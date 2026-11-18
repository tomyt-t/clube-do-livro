import {
  arrayUnion,
  doc,
  FieldPath,
  increment,
  setDoc,
  writeBatch,
  type Firestore,
} from 'firebase/firestore';

import type { CycleId, MemberId, NominationAnswer, NominationId } from '@/domain/types';

import { toBookData } from './book-data';
import { refs } from './refs';

/**
 * Writes a member can make. Each multi-document write is a single batch, the
 * unit `firestore.rules` validates as a whole.
 */

export interface MemberProfile {
  name: string;
  photoURL: string | null;
}

const NAME_LIMIT = 80;
const FALLBACK_NAME = 'Leitor';

export function toProfileData(profile: MemberProfile): MemberProfile {
  const name = profile.name.trim().slice(0, NAME_LIMIT) || FALLBACK_NAME;
  const photoURL = profile.photoURL?.startsWith('https://') ? profile.photoURL : null;
  return { name, photoURL };
}

export async function saveMemberProfile(db: Firestore, uid: MemberId, profile: MemberProfile) {
  await setDoc(refs.member(db, uid), toProfileData(profile));
}

interface AnswerInput {
  cycleId: CycleId;
  uid: MemberId;
  answer: NominationAnswer;
}

/** Sends the member's final answer. Returns the new nomination id, if any. */
export async function answerNominationCall(
  db: Firestore,
  { cycleId, uid, answer }: AnswerInput,
): Promise<NominationId | null> {
  const batch = writeBatch(db);
  let nominationId: NominationId | null = null;

  if (answer.kind === 'nominate') {
    const nomination = doc(refs.nominations(db, cycleId));
    nominationId = nomination.id;
    batch.set(nomination, { book: toBookData(answer.book) });
  }
  batch.set(refs.answer(db, cycleId, uid), { nominationId });
  batch.update(
    refs.cycle(db, cycleId),
    nominationId
      ? { responses: increment(1), nominationIds: arrayUnion(nominationId) }
      : { responses: increment(1) },
  );

  await batch.commit();
  return nominationId;
}

interface BallotInput {
  cycleId: CycleId;
  uid: MemberId;
  /** First choice, then second choice. */
  choices: readonly NominationId[];
}

/**
 * Casts an anonymous ballot: an empty receipt says *that* the member voted,
 * the tally says *what* was voted, and nothing connects the two. Every
 * choice adds a vote; the first one also adds a first choice.
 */
export async function castBallot(db: Firestore, { cycleId, uid, choices }: BallotInput) {
  const [first] = choices;
  if (first === undefined) throw new Error('A cédula precisa de pelo menos uma escolha.');

  const batch = writeBatch(db);
  batch.set(refs.receipt(db, cycleId, uid), {});
  batch.update(refs.cycle(db, cycleId), { ballots: increment(1) });
  batch.update(
    refs.tally(db, cycleId),
    new FieldPath('firsts', first),
    increment(1),
    ...choices.flatMap((choice) => [new FieldPath('votes', choice), increment(1)]),
  );
  await batch.commit();
}

/** "Acabei de ler!": an empty mark says *that* the member finished, the count says how many. */
export async function markFinished(db: Firestore, cycleId: CycleId, uid: MemberId) {
  const batch = writeBatch(db);
  batch.set(refs.reader(db, cycleId, uid), {});
  batch.update(refs.cycle(db, cycleId), { finishedReaders: increment(1) });
  await batch.commit();
}
