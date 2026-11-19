import {
  arrayRemove,
  arrayUnion,
  doc,
  FieldPath,
  getDoc,
  increment,
  setDoc,
  updateDoc,
  writeBatch,
  type Firestore,
} from 'firebase/firestore';

import { titleKey } from '@/domain/title-key';
import type {
  CycleId,
  MemberId,
  NominationAnswer,
  NominationId,
  ReadingMaterials,
} from '@/domain/types';

import { toBookData, toLinkData } from './book-data';
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

/**
 * Binds the member's allowlist entry to this account, the first time they
 * sign in. From then on only this account acts for that email: a second
 * account (say, after deleting the first) would otherwise vote again.
 */
export async function claimSeat(db: Firestore, email: string, uid: MemberId) {
  await updateDoc(refs.allowlistEntry(db, email), { uid });
}

export async function saveMemberProfile(db: Firestore, uid: MemberId, profile: MemberProfile) {
  await setDoc(refs.member(db, uid), toProfileData(profile));
}

interface AnswerInput {
  cycleId: CycleId;
  uid: MemberId;
  answer: NominationAnswer;
}

/** The nomination of an earlier answer, if the member had one (let go, or they could not answer). */
async function previousNomination(db: Firestore, cycleId: CycleId, uid: MemberId) {
  const previous = await getDoc(refs.answer(db, cycleId, uid));
  const id: unknown = previous.data()?.nominationId;
  return typeof id === 'string' ? id : null;
}

/**
 * Sends the member's final answer. Returns the new nomination id, if any.
 * After the organizer let their nomination go, the new answer replaces the
 * old one and takes it off the cycle's let-go list.
 */
export async function answerNominationCall(
  db: Firestore,
  { cycleId, uid, answer }: AnswerInput,
): Promise<NominationId | null> {
  const letGo = await previousNomination(db, cycleId, uid);
  const batch = writeBatch(db);
  let nominationId: NominationId | null = null;

  if (answer.kind === 'nominate') {
    const nomination = doc(refs.nominations(db, cycleId));
    const key = titleKey(answer.book.title);
    nominationId = nomination.id;
    batch.set(nomination, { book: toBookData(answer.book), titleKey: key });
  }
  batch.set(refs.answer(db, cycleId, uid), { nominationId });
  batch.update(refs.cycle(db, cycleId), {
    responses: increment(1),
    ...(nominationId ? { nominationIds: arrayUnion(nominationId) } : {}),
    ...(letGo ? { letGo: arrayRemove(letGo) } : {}),
  });

  await batch.commit();
  return nominationId;
}

interface BallotInput {
  cycleId: CycleId;
  uid: MemberId;
  /** First choice, then second choice. */
  choices: readonly NominationId[];
  /** False when the member's merged nomination already counts as their first choice. */
  countsFirst?: boolean;
}

/**
 * Casts an anonymous ballot: an empty receipt says *that* the member voted,
 * the tally says *what* was voted, and nothing connects the two. Every
 * choice adds a vote; the first one also adds a first choice, unless the
 * member's merged nomination already counts as theirs.
 */
export async function castBallot(
  db: Firestore,
  { cycleId, uid, choices, countsFirst = true }: BallotInput,
) {
  const [first] = choices;
  if (first === undefined) throw new Error('A cédula precisa de pelo menos uma escolha.');

  const batch = writeBatch(db);
  batch.set(refs.receipt(db, cycleId, uid), {});
  batch.update(refs.cycle(db, cycleId), { ballots: increment(1) });
  const [vote, ...more] = choices.map((choice) => new FieldPath('votes', choice));
  const firsts = countsFirst ? [new FieldPath('firsts', first), increment(1)] : [];
  batch.update(
    refs.tally(db, cycleId),
    vote ?? new FieldPath('votes', first),
    increment(1),
    ...more.flatMap((field) => [field, increment(1)]),
    ...firsts,
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

/**
 * The materials of the reading the member nominated (see
 * `isReadingNominator`): its link, whether the page shows the synopsis text
 * or only that link, and a link to its PDF.
 */
export async function setReadingMaterials(
  db: Firestore,
  cycleId: CycleId,
  { link, display, pdfUrl }: ReadingMaterials,
) {
  await updateDoc(refs.cycle(db, cycleId), {
    'winner.book.synopsisUrl': toLinkData(link),
    'winner.display': display,
    'winner.pdfUrl': toLinkData(pdfUrl),
  });
}
