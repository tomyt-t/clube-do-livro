import { orderBy, query } from 'firebase/firestore';

import type { ClubPort } from '../backend';

import type { FirebaseServices } from './app';
import { toCycle, toMember, toNomination, toOwnAnswer, toSettings } from './converters';
import { guard } from './errors';
import { dataOf, listenToDoc, listenToQuery } from './listen';
import {
  answerNominationCall,
  castBallot,
  markFinished,
  saveMemberProfile,
  setReadingMaterials,
} from './member-writes';
import { refs } from './refs';

export function createFirebaseClub({ db }: FirebaseServices): ClubPort {
  return {
    watchCycles: (subscriber) =>
      listenToQuery(query(refs.cycles(db), orderBy('number', 'desc')), toCycle, subscriber),

    watchNominations: (cycleId, subscriber) =>
      listenToQuery(refs.nominations(db, cycleId), toNomination, subscriber),

    watchOwnNomination: (cycleId, nominationId, subscriber) =>
      listenToDoc(
        refs.nomination(db, cycleId, nominationId),
        (snapshot) => {
          const data = dataOf(snapshot);
          return data ? toNomination(snapshot.id, data) : null;
        },
        subscriber,
      ),

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

    setReadingMaterials: ({ cycleId, link, display, pdfUrl }) =>
      guard(setReadingMaterials(db, cycleId, { link, display, pdfUrl })),

    castBallot: (input) => guard(castBallot(db, input)),

    watchSettings: (subscriber) =>
      listenToDoc(refs.settings(db), (snapshot) => toSettings(dataOf(snapshot)), subscriber),

    watchHasFinished: (cycleId, uid, subscriber) =>
      listenToDoc(refs.reader(db, cycleId, uid), (snapshot) => snapshot.exists(), subscriber),

    markFinished: ({ cycleId, uid }) => guard(markFinished(db, cycleId, uid)),
  };
}
