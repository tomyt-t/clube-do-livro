/**
 * What says two nominations name the same reading: the title as typed,
 * without case, accents or punctuation ("Dom Casmurro / Machado de Assis"
 * and "dom casmurro, machado de assis" match). Exact on purpose: a title
 * written differently ("Dom Casmurro" alone) is a different key, because a
 * wrong block costs more than a duplicate the organizer can sort out.
 */
export function titleKey(title: string): string {
  return (
    title
      .normalize('NFD')
      // Latin accents only: ベ keeps its mark, so it stays apart from ヘ.
      .replace(/[\u0300-\u036f]/g, '')
      .normalize('NFC')
      .toLowerCase()
      .replace(/[^\p{L}\p{N}]+/gu, ' ')
      .trim()
  );
}
