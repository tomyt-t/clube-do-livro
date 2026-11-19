import type { ConflictGroup, DuplicateFindings, Merged } from '@/domain/review';
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
  ReadingMaterials,
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

export type Access =
  | { status: 'member'; isAdmin: boolean }
  /** `taken`: the email is on the list, but another account already uses it. */
  | { status: 'denied'; taken?: boolean };

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
  /**
   * False when the member's first choice is already counted: their
   * nomination was merged with an equal one. Defaults to true.
   */
  countsFirst?: boolean;
}

export interface ClubPort {
  watchCycles(subscriber: Subscriber<Cycle[]>): Unsubscribe;
  /** Every nomination, once the nomination call is over; refused before that. */
  watchNominations(cycleId: CycleId, subscriber: Subscriber<Nomination[]>): Unsubscribe;
  /** One nomination: during the nomination call, only the member's own. */
  watchOwnNomination(
    cycleId: CycleId,
    nominationId: NominationId,
    subscriber: Subscriber<Nomination | null>,
  ): Unsubscribe;
  /** Whether a reading with this title (see `titleKey`) was already nominated. */
  watchOwnAnswer(
    cycleId: CycleId,
    uid: MemberId,
    subscriber: Subscriber<OwnAnswer | null>,
  ): Unsubscribe;
  watchHasVoted(cycleId: CycleId, uid: MemberId, subscriber: Subscriber<boolean>): Unsubscribe;
  watchMembers(subscriber: Subscriber<MemberProfile[]>): Unsubscribe;
  saveProfile(profile: MemberProfile): Promise<void>;
  /**
   * The chosen reading's link, how its synopsis shows and its PDF link; only
   * its nominator may set them (see `isReadingNominator`).
   */
  setReadingMaterials(input: { cycleId: CycleId; uid: MemberId } & ReadingMaterials): Promise<void>;
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
  /** The tally the vote opens with: zero, plus merged readings' head start. */
  opening: VoteResults;
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
  /** Everyone answered: the list opens and no more nominations come in. */
  startReview(cycleId: CycleId): Promise<void>;
  /** Records what the duplicate check found (maybe nothing); once per check. */
  /** What the check found, for the organizer to validate. */
  recordReview(cycleId: CycleId, groups: readonly ConflictGroup[]): Promise<void>;
  /** Fixes the ballot's options and opens the tally. */
  startVoting(input: StartVotingInput): Promise<void>;
  closeVoting(cycleId: CycleId): Promise<void>;
  /** Reads the tally, readable only once voting has closed. */
  readResults(cycleId: CycleId): Promise<VoteResults>;
  declareWinner(input: DeclareWinnerInput): Promise<void>;
  /** Ends the book everyone finished and opens the next round, in one step. */
  finishAndOpenNext(input: { cycleId: CycleId; nextNumber: number }): Promise<CycleId>;
}

/**
 * Finds readings nominated twice under different titles. It only flags: the
 * organizer decides. Runs in the browser of whoever takes the step.
 */
export interface DuplicateChecker {
  findDuplicates(nominations: readonly Nomination[]): Promise<DuplicateFindings>;
}

/**
 * Translates a synopsis found in another language into Portuguese, only
 * when a member asks; they review it before sending.
 */
export interface SynopsisTranslator {
  /** `title` is how the member wrote it, so the text names the book that way. */
  translate(text: string, title: string): Promise<string>;
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
  /** Ends a round nobody nominated in (see `isEmptyRoundOver`). */
  endEmptyRound(cycleId: CycleId): Promise<void>;
  watchAllowlist(subscriber: Subscriber<AllowlistEntry[]>): Unsubscribe;
  /**
   * Who nominated each flagged reading, so the organizer can talk to them:
   * only readings in the review's conflicts, and only while it is open.
   */
  findNominators(
    cycleId: CycleId,
    nominationIds: readonly NominationId[],
  ): Promise<Record<NominationId, MemberId[]>>;
  /** Dismisses or merges flagged groups: what remains flagged, and every merge so far. */
  updateReview(input: {
    cycleId: CycleId;
    groups: readonly ConflictGroup[];
    merged: Merged;
  }): Promise<void>;
  /**
   * Lets members nominate again, now seeing the list: their answers and
   * nominations go, and the nomination call reopens for them.
   */
  reopenNominations(input: {
    cycleId: CycleId;
    nominationIds: readonly NominationId[];
  }): Promise<void>;
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
  checker: DuplicateChecker;
  /** Null where no model is configured: the button does not show. */
  translator: SynopsisTranslator | null;
}
