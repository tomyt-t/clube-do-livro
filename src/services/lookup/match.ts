/**
 * Telling whether a catalog result is the reading the member typed. Free
 * text on both sides, so titles are compared loosely (accents, articles,
 * subtitles and small typos do not matter) but never so loosely that a
 * different volume or a different author gets through.
 */

/** Lowercase, no accents, "&" as "e", letters and digits only. */
export function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, ' e ')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

const ARTICLES = new Set(['o', 'a', 'os', 'as', 'um', 'uma', 'the', 'an', 'el', 'la', 'le', 'les']);

/** The title before any subtitle ("Sapiens: uma breve história" → "sapiens"), no leading article. */
export function mainTitle(title: string): string {
  const [head = title] = title.split(/\s*(?::|\s[-–—]\s|\(|\[)\s*/);
  const words = normalize(head).split(' ').filter(Boolean);
  if (words.length > 1 && ARTICLES.has(words[0] ?? '')) words.shift();
  return words.join(' ');
}

/** Volume and edition numbers: "Mercenários 2" and "Mercenários 1" are different readings. */
export function numbersIn(text: string): string[] {
  return normalize(text).match(/\b\d{1,4}\b/g) ?? [];
}

/** Edit distance, stopping early once it exceeds `limit`. */
export function editDistance(a: string, b: string, limit: number): number {
  if (Math.abs(a.length - b.length) > limit) return limit + 1;
  let previous = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i += 1) {
    const current = [i];
    let best = i;
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      const value = Math.min(
        (previous[j] ?? 0) + 1,
        (current[j - 1] ?? 0) + 1,
        (previous[j - 1] ?? 0) + cost,
      );
      current.push(value);
      best = Math.min(best, value);
    }
    if (best > limit) return limit + 1;
    previous = current;
  }
  return previous[b.length] ?? limit + 1;
}

/** Typos allowed for a title of this length (Komf's scale): none for very short titles. */
function allowedEdits(length: number): number {
  if (length <= 3) return 0;
  if (length <= 6) return 1;
  if (length <= 9) return 2;
  return 3;
}

export interface TitleMatch {
  matches: boolean;
  exact: boolean;
}

function matchOne(query: string, candidate: string): TitleMatch {
  const q = mainTitle(query);
  const c = mainTitle(candidate);
  if (!q || !c) return { matches: false, exact: false };
  // A volume number the member typed must be the candidate's too.
  const wanted = numbersIn(query);
  if (wanted.length > 0 && !wanted.every((n) => numbersIn(candidate).includes(n))) {
    return { matches: false, exact: false };
  }
  if (q === c) return { matches: true, exact: true };
  if (editDistance(q, c, allowedEdits(q.length)) <= allowedEdits(q.length)) {
    return { matches: true, exact: false };
  }
  // Every word of a longer query in the candidate's main title ("cem anos solidao").
  const words = q.split(' ');
  const inside = new Set(c.split(' '));
  return {
    matches: q.length > 4 && words.length > 1 && words.every((w) => inside.has(w)),
    exact: false,
  };
}

/** Whether any of a candidate's titles is the reading the member typed. */
export function matchTitle(query: string, titles: readonly string[]): TitleMatch {
  let best: TitleMatch = { matches: false, exact: false };
  for (const title of titles) {
    const found = matchOne(query, title);
    if (found.exact) return found;
    if (found.matches) best = found;
  }
  return best;
}

/** Surnames and other long words of a name: "J. R. R. Tolkien" → ["tolkien"]. */
function nameWords(name: string): string[] {
  return normalize(name)
    .split(' ')
    .filter(
      (word) => word.length >= 3 && !['de', 'da', 'do', 'dos', 'das', 'van', 'von'].includes(word),
    );
}

/**
 * Whether the author the member typed is among the candidate's (by surname).
 * Null when either side has no author, so it neither helps nor hurts.
 */
export function matchAuthor(typed: string | null, authors: readonly string[]): boolean | null {
  if (!typed || authors.length === 0) return null;
  const wanted = nameWords(typed);
  if (wanted.length === 0) return null;
  const known = new Set(authors.flatMap(nameWords));
  const surname = wanted[wanted.length - 1] ?? '';
  return known.has(surname) || wanted.some((word) => word.length >= 4 && known.has(word));
}

/** Brazilian ISBNs start with 978-85 or 978-65 (85 or 65 in ten digits). */
export function isBrazilianIsbn(isbn: string | null): boolean {
  const digits = (isbn ?? '').replace(/\D/g, '');
  if (digits.length === 13) return /^978(85|65)/.test(digits);
  return digits.length === 10 && /^(85|65)/.test(digits);
}

/** Portugal: 972 or 989. */
export function isPortugueseIsbn(isbn: string | null): boolean {
  const digits = (isbn ?? '').replace(/\D/g, '');
  if (digits.length === 13) return /^978(972|989)/.test(digits);
  return digits.length === 10 && /^(972|989)/.test(digits);
}

/** Adaptations share the title but are other works: "Torto Arado: romance em quadrinhos". */
export function isAdaptation(text: string): boolean {
  return /\b(quadrinhos|graphic novel|hq|adaptacao|adaptado|manga|filme|movie|screenplay|roteiro)\b/.test(
    normalize(text),
  );
}
