import type {
  Book,
  Cycle,
  CycleId,
  DecisionMethod,
  MemberId,
  Nomination,
  NominationAnswer,
  NominationId,
  OwnAnswer,
  Round,
  RoundKind,
  Tally,
} from '@/domain/types';

/**
 * The contract between the UI and whatever stores the club's data.
 * `firebase/` implements it for production and `demo/` in memory, so the UI
 * and its tests never import Firebase directly.
 */

export type Unsubscribe = () => void;

export interface Subscriber<T> {
  next: (value: T) => void;
  error: (error: BackendError) => void;
}

export type BackendErrorCode = 'permission-denied' | 'unavailable' | 'invalid-data' | 'unknown';

export class BackendError extends Error {
  readonly code: BackendErrorCode;

  constructor(code: BackendErrorCode, message: string = code) {
    super(message);
    this.name = 'BackendError';
    this.code = code;
  }
}

// ---------------------------------------------------------------- session

export interface SessionUser {
  uid: MemberId;
  email: string;
  name: string;
  photoURL: string | null;
}

export type Access = { status: 'member'; isAdmin: boolean } | { status: 'denied' };

export type LinkSignInResult = 'not-a-link' | 'needs-email' | 'signed-in';

export interface AuthPort {
  /** Emits the restored session first (or null), then every change. */
  watchUser(listener: (user: SessionUser | null) => void): Unsubscribe;
  signInWithGoogle(): Promise<void>;
  sendSignInLink(email: string): Promise<void>;
  /** Finishes an email-link sign-in when the page was opened from the link. */
  completeSignInLink(email?: string): Promise<LinkSignInResult>;
  signOut(): Promise<void>;
  checkAccess(user: SessionUser): Promise<Access>;
}

// ------------------------------------------------------------------- club

export interface MemberProfile {
  uid: MemberId;
  name: string;
  photoURL: string | null;
}

export interface AnswerInput {
  cycleId: CycleId;
  uid: MemberId;
  answer: NominationAnswer;
}

export interface BallotInput {
  cycleId: CycleId;
  round: number;
  uid: MemberId;
  choices: readonly NominationId[];
}

export interface ClubPort {
  watchCycles(subscriber: Subscriber<Cycle[]>): Unsubscribe;
  watchNominations(cycleId: CycleId, subscriber: Subscriber<Nomination[]>): Unsubscribe;
  watchRounds(cycleId: CycleId, subscriber: Subscriber<Round[]>): Unsubscribe;
  watchOwnAnswer(
    cycleId: CycleId,
    uid: MemberId,
    subscriber: Subscriber<OwnAnswer | null>,
  ): Unsubscribe;
  watchHasVoted(
    cycleId: CycleId,
    round: number,
    uid: MemberId,
    subscriber: Subscriber<boolean>,
  ): Unsubscribe;
  watchMembers(subscriber: Subscriber<MemberProfile[]>): Unsubscribe;
  saveProfile(profile: MemberProfile): Promise<void>;
  /** Final: a member answers once per cycle. Returns the nomination id, if any. */
  answerNominationCall(input: AnswerInput): Promise<NominationId | null>;
  /** Final and anonymous: a member votes once per round. */
  castBallot(input: BallotInput): Promise<void>;
}

// ------------------------------------------------------------------ admin

export interface OpenCycleInput {
  number: number;
  nominationDeadline: Date | null;
}

export interface OpenRoundInput {
  cycleId: CycleId;
  number: number;
  kind: RoundKind;
  options: readonly NominationId[];
  votingDeadline: Date | null;
}

export interface DeclareWinnerInput {
  cycleId: CycleId;
  nominationId: NominationId;
  book: Book;
  method: DecisionMethod;
  startReading: boolean;
}

export type DeadlineField = 'nominationDeadline' | 'votingDeadline';

export interface AllowlistEntry {
  email: string;
  isAdmin: boolean;
}

export interface AdminPort {
  openCycle(input: OpenCycleInput): Promise<CycleId>;
  setDeadline(cycleId: CycleId, field: DeadlineField, deadline: Date | null): Promise<void>;
  deleteCycle(cycleId: CycleId): Promise<void>;
  openRound(input: OpenRoundInput): Promise<void>;
  closeRound(cycleId: CycleId, round: number): Promise<void>;
  /** Copies the tally into the closed round and returns it. */
  recordResults(cycleId: CycleId, round: number): Promise<Tally>;
  enterTiebreak(cycleId: CycleId): Promise<void>;
  declareWinner(input: DeclareWinnerInput): Promise<void>;
  startReading(cycleId: CycleId): Promise<void>;
  finishReading(cycleId: CycleId): Promise<void>;
  watchAllowlist(subscriber: Subscriber<AllowlistEntry[]>): Unsubscribe;
  /** Emails must already be normalized (trimmed, lowercase). */
  allowEmails(emails: readonly string[]): Promise<void>;
  revokeEmail(email: string): Promise<void>;
}

export interface Backend {
  kind: 'firebase' | 'demo';
  auth: AuthPort;
  club: ClubPort;
  admin: AdminPort;
}
