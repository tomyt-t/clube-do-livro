import type {
  Book,
  ClubSettings,
  Cycle,
  CycleId,
  DecisionMethod,
  MemberId,
  Nomination,
  NominationAnswer,
  NominationId,
  OwnAnswer,
  RankedChoices,
  VoteResults,
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
  uid: MemberId;
  /** First choice, then second choice. */
  choices: RankedChoices;
}

export interface ClubPort {
  watchCycles(subscriber: Subscriber<Cycle[]>): Unsubscribe;
  watchNominations(cycleId: CycleId, subscriber: Subscriber<Nomination[]>): Unsubscribe;
  watchOwnAnswer(
    cycleId: CycleId,
    uid: MemberId,
    subscriber: Subscriber<OwnAnswer | null>,
  ): Unsubscribe;
  watchHasVoted(cycleId: CycleId, uid: MemberId, subscriber: Subscriber<boolean>): Unsubscribe;
  watchMembers(subscriber: Subscriber<MemberProfile[]>): Unsubscribe;
  saveProfile(profile: MemberProfile): Promise<void>;
  /** Final: a member answers once per cycle. Returns the nomination id, if any. */
  answerNominationCall(input: AnswerInput): Promise<NominationId | null>;
  /** Final and anonymous: a member votes once per cycle. */
  castBallot(input: BallotInput): Promise<void>;
  /** The member count that "everyone" refers to; zero until the organizer sets it. */
  watchSettings(subscriber: Subscriber<ClubSettings>): Unsubscribe;
  watchHasFinished(cycleId: CycleId, uid: MemberId, subscriber: Subscriber<boolean>): Unsubscribe;
  /** "Acabei de ler!": final, and counted without saying who. */
  markFinished(input: { cycleId: CycleId; uid: MemberId }): Promise<void>;
}

// ------------------------------------------------------------------- flow

export interface StartVotingInput {
  cycleId: CycleId;
  options: readonly NominationId[];
  votingDeadline: Date | null;
}

export interface DeclareWinnerInput {
  cycleId: CycleId;
  nominationId: NominationId;
  book: Book;
  method: DecisionMethod;
  /** For a draw: the tied books in draw order; empty otherwise. */
  drawnFrom: readonly NominationId[];
  /** The tally exactly as read, kept on the cycle for history. */
  results: VoteResults;
  startReading: boolean;
}

/**
 * The steps that move a cycle along. Any member may take one once everyone
 * has done their part; the organizer may take one at any time.
 */
export interface FlowPort {
  /** Fixes the ballot's options and opens an empty tally. */
  startVoting(input: StartVotingInput): Promise<void>;
  closeVoting(cycleId: CycleId): Promise<void>;
  /** Reads the tally, readable only once voting has closed. */
  readResults(cycleId: CycleId): Promise<VoteResults>;
  declareWinner(input: DeclareWinnerInput): Promise<void>;
  /** Ends the book everyone finished and opens the next round, in one step. */
  finishAndOpenNext(input: { cycleId: CycleId; nextNumber: number }): Promise<CycleId>;
}

// ------------------------------------------------------------------ admin

export interface OpenCycleInput {
  number: number;
  nominationDeadline: Date | null;
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
  startReading(cycleId: CycleId): Promise<void>;
  finishReading(cycleId: CycleId): Promise<void>;
  watchAllowlist(subscriber: Subscriber<AllowlistEntry[]>): Unsubscribe;
  /** Emails must already be normalized (trimmed, lowercase). */
  allowEmails(emails: readonly string[]): Promise<void>;
  revokeEmail(email: string): Promise<void>;
  /** Keeps "everyone" in step with the allowlist. */
  setMemberCount(members: number): Promise<void>;
}

export interface Backend {
  kind: 'firebase' | 'demo';
  auth: AuthPort;
  club: ClubPort;
  flow: FlowPort;
  admin: AdminPort;
}
