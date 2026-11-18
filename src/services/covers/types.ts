export type CoverSource = 'google-books' | 'open-library' | 'anilist';

/** A cover suggestion. Only the image is kept; the rest helps pick the right one. */
export interface CoverOption {
  /** Unique across sources, for list keys. */
  id: string;
  /** Always https. */
  imageUrl: string;
  title: string;
  /** Author, format and year, to tell editions apart. */
  details: string;
  source: CoverSource;
  /** The synopsis as the catalog sent it with the search (HTML or Markdown), if any. */
  synopsis: string | null;
  /** Open Library keeps synopses on the work page, fetched only if this cover is picked. */
  workKey: string | null;
}

export type Fetcher = typeof fetch;

export interface SourceRequest {
  fetcher: Fetcher;
  signal?: AbortSignal;
}
