import type { Book, Cycle, Nomination } from '@/domain/types';

/** What the show needs about one draw. */
export interface DrawCast {
  tied: Book[];
  winner: number;
  seed: string;
  drawnAt: Date;
}

const MISSING: Book = {
  title: 'Leitura indicada',
  synopsis: null,
  synopsisSource: null,
  synopsisUrl: null,
  coverUrl: null,
  coverSourceUrl: null,
};

/** The show for a cycle decided by a draw, once its nominations are loaded; null otherwise. */
export function drawCastOf(cycle: Cycle, nominations: readonly Nomination[]): DrawCast | null {
  const won = cycle.winner;
  if (won?.method !== 'draw' || won.drawnFrom.length < 2) return null;
  const winner = won.drawnFrom.indexOf(won.nominationId);
  if (winner < 0) return null;
  const bookOf = (id: string) =>
    nominations.find((nomination) => nomination.id === id)?.book ??
    (id === won.nominationId ? won.book : MISSING);
  return {
    tied: won.drawnFrom.map(bookOf),
    winner,
    // The decision time comes from the server: every device stages the same match.
    seed: `${cycle.id}:${String(won.decidedAt.getTime())}`,
    drawnAt: cycle.votingClosedAt ?? won.decidedAt,
  };
}

/** A draw older than this does not open by itself (it stays in Histórico). */
const FRESH_MS = 14 * 24 * 60 * 60 * 1000;

const keyOf = (cycleId: string) => `clube:sorteio-visto:${cycleId}`;

/** Without storage (private mode, blocked site data) it counts as seen: no show every visit. */
export function wasSeen(cycleId: string): boolean {
  try {
    return localStorage.getItem(keyOf(cycleId)) !== null;
  } catch {
    return true;
  }
}

export function markSeen(cycleId: string) {
  try {
    localStorage.setItem(keyOf(cycleId), '1');
  } catch {
    // Storage blocked: the show may open again next time.
  }
}

/**
 * The draw that opens by itself: the reading being read or next in line,
 * won by a draw in the last two weeks, and not yet shown on this device.
 */
export function unseenDraw(cycles: readonly Cycle[], now = Date.now()): Cycle | null {
  return (
    cycles
      .filter((cycle) => cycle.status === 'reading' || cycle.status === 'upcoming')
      .filter((cycle) => cycle.winner?.method === 'draw' && cycle.winner.drawnFrom.length > 1)
      .filter((cycle) => now - (cycle.winner?.decidedAt.getTime() ?? 0) < FRESH_MS)
      .sort((a, b) => b.number - a.number)
      .find((cycle) => !wasSeen(cycle.id)) ?? null
  );
}
