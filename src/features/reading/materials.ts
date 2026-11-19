import type { SynopsisDisplay, Winner } from '@/domain/types';

/** What the reading's nominator chose, with the defaults of readings chosen before. */
export function materialsOf(winner: Winner): { display: SynopsisDisplay; pdfUrl: string | null } {
  return { display: winner.display ?? 'text', pdfUrl: winner.pdfUrl ?? null };
}

/**
 * The synopsis text the reading page shows: none when there is no text, or
 * when its nominator chose to show only the link (and there is a link).
 */
export function shownSynopsis(winner: Winner): string | null {
  const { synopsis, synopsisUrl } = winner.book;
  const onlyLink = materialsOf(winner).display === 'link' && synopsisUrl !== null;
  return onlyLink ? null : synopsis;
}
