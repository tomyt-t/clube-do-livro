import { normalize } from './match';

/**
 * Judging a synopsis by its text, since catalogs mislabel languages (a
 * Portugal edition tagged "pt-BR" is common). Counts words that belong to
 * one language only: no model.
 */

export type TextLanguage = 'pt-BR' | 'pt-PT' | 'en' | 'other';

const wordsOf = (list: string) => new Set(list.split(' '));

/** Common words found in one of these languages and not the others. */
const PORTUGUESE = wordsOf(
  'nao uma um com do da dos das ao aos pelo pela pelos pelas seu sua seus suas ele ela eles elas sao foi mas e o os em no na nos nas ate tambem quando',
);
const SPANISH = wordsOf('el los las y del es una pero muy lo al su sus con hasta tambien cuando');
const FRENCH = wordsOf(
  'le les des du et est une il elle qui dans pour sur pas au aux ce cette son sa ses avec mais',
);
const ENGLISH = wordsOf(
  'the and of to in is his her that with for as was on he she it by from at an this their they be are',
);

/** Spellings and words of Portugal, rare in Brazil. */
const PORTUGAL =
  /\b(facto|equipa|ecra|registo|connosco|accao|actual|optimo|contacto|objectivo|direccao|telemovel|comboio|autocarro|rapariga|miuda)\b/;

export function detectLanguage(text: string): TextLanguage {
  const words = normalize(text).split(' ');
  if (words.length < 8) return 'other';
  const share = (set: Set<string>) => words.filter((word) => set.has(word)).length / words.length;
  const pt = share(PORTUGUESE);
  const en = share(ENGLISH);
  const rivals = Math.max(share(SPANISH), share(FRENCH), en);
  if (pt > rivals && pt > 0.08) return PORTUGAL.test(normalize(text)) ? 'pt-PT' : 'pt-BR';
  if (en === rivals && en > 0.08) return 'en';
  return 'other';
}

/** Phrases that give the ending away. */
const SPOILERS = [
  /\bno final\b/,
  /\bao final do livro\b/,
  /\bno desfecho\b/,
  /\bacaba (por )?morre/,
  /\be revelado que\b/,
  /\bdescobre se que\b/,
  /\bin the end\b/,
  /\beventually dies\b/,
  /\bat the end of the (book|novel)\b/,
];

export function spoilerCount(text: string): number {
  const plain = normalize(text);
  return SPOILERS.filter((cue) => cue.test(plain)).length;
}
