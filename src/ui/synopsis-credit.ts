import type { SynopsisSource } from '@/domain/types';

const SOURCE_NAMES: Record<SynopsisSource, string> = {
  wikipedia: 'Wikipédia',
  'open-library': 'Open Library',
  'google-books': 'Google Livros',
  anilist: 'AniList',
};

/** "Sinopse: Wikipédia." Nothing when the member wrote it. */
export function synopsisCredit(source: SynopsisSource | null): string | null {
  return source ? `Sinopse: ${SOURCE_NAMES[source]}.` : null;
}
