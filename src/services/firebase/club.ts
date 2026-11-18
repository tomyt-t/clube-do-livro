import { orderBy, query } from 'firebase/firestore';

import type { ClubPort } from '../backend';

import type { FirebaseServices } from './app';
import { toCycle, toMember, toNomination, toOwnAnswer } from './converters';
import { guard } from './errors';
import { dataOf, listenToDoc, listenToQuery } from './listen';
import { answerNominationCall, castBallot, saveMemberProfile } from './member-writes';
import { refs } from './refs';

export function createFirebaseClub({ db }: FirebaseServices): ClubPort {
  return {
    watchCycles: (subscriber) =>
      listenToQuery(query(refs.cycles(db), orderBy('number', 'desc')), toCycle, subscriber),

    watchNominations: (cycleId, subscriber) =>
      listenToQuery(refs.nominations(db, cycleId), toNomination, subscriber),

    watchOwnAnswer: (cycleId, uid, subscriber) =>
      listenToDoc(
        refs.answer(db, cycleId, uid),
        (snapshot) => {
          const data = dataOf(snapshot);
          return data ? toOwnAnswer(data) : null;
        },
        subscriber,
      ),

    watchHasVoted: (cycleId, uid, subscriber) =>
      listenToDoc(refs.receipt(db, cycleId, uid), (snapshot) => snapshot.exists(), subscriber),

    watchMembers: (subscriber) => listenToQuery(refs.members(db), toMember, subscriber),

    saveProfile: ({ uid, name, photoURL }) => guard(saveMemberProfile(db, uid, { name, photoURL })),

    answerNominationCall: (input) => guard(answerNominationCall(db, input)),

    castBallot: (input) => guard(castBallot(db, input)),
  };
}
