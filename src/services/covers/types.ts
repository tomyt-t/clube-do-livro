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
}

export type Fetcher = typeof fetch;

export interface SourceRequest {
  fetcher: Fetcher;
  signal?: AbortSignal;
}
