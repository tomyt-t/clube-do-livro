/** What each catalog returns, in one shape, so results can be compared. */

export type LookupSource = 'publisher' | 'google-books' | 'open-library' | 'wikipedia' | 'anilist';

export type ReadingKind = 'book' | 'manga' | 'other';

export interface FoundCover {
  url: string;
  /** The page it came from, kept as its source. */
  sourceUrl: string;
}

/** A synopsis as a source gives it, with the page it came from. */
export interface FoundSynopsis {
  /** As the source sent it (HTML allowed); cleaned before it is shown. */
  raw: string;
  sourceUrl: string;
}

export interface Candidate {
  source: LookupSource;
  /** Every title this result answers to (edition, original, alternative). */
  titles: string[];
  title: string;
  authors: string[];
  /** Text that may name the author when no author is listed (an encyclopedia lead). */
  mentions: string | null;
  publisher: string | null;
  year: number | null;
  isbn: string | null;
  kind: ReadingKind;
  cover: FoundCover | null;
  synopsis: FoundSynopsis | null;
  /** A Wikipedia article, whose plot section opening is offered too (fetched for the chosen work). */
  article?: { title: string; url: string };
  /** An Open Library work, whose description is fetched for the chosen work. */
  work?: { json: string; url: string };
}

export type Fetcher = typeof fetch;

export interface SourceRequest {
  fetcher: Fetcher;
  signal?: AbortSignal;
}

/** What the member typed, split. */
export interface Query {
  title: string;
  author: string | null;
}

/** A ranked choice shown to the member, always with where it came from. */
export interface CoverChoice {
  url: string;
  sourceUrl: string;
  source: LookupSource;
  /** "Google Livros · Todavia, 2019". */
  label: string;
}

export interface SynopsisChoice {
  text: string;
  sourceUrl: string;
  source: LookupSource;
  /** "Site da Rocco", "Google Livros · Rocco" or "Wikipédia · início do enredo". */
  label: string;
  /** Not in Portuguese: the member may ask for a translation. */
  foreign?: boolean;
}

export interface WorkSummary {
  title: string;
  authors: string[];
  /** "Todavia, 2019". */
  details: string;
}

export interface LookupResult {
  /** The reading found, or null when nothing matched. */
  work: WorkSummary | null;
  covers: CoverChoice[];
  synopses: SynopsisChoice[];
  /** Other readings with the same title, when the choice was close. */
  others: WorkSummary[];
  /**
   * Nothing had the title typed: this is the typed author's book with the
   * closest title, often the same book in another translation.
   */
  approximate?: boolean;
}

/** An image's size, or null if it did not load. */
export type MeasureImage = (url: string) => Promise<{ width: number; height: number } | null>;
