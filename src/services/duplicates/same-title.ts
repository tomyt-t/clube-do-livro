import { splitTitle } from '@/domain/book';
import { MAX_CONFLICT_GROUPS, type ConflictGroup } from '@/domain/review';
import { titleKey } from '@/domain/title-key';
import type { Nomination } from '@/domain/types';

import type { DuplicateChecker } from '../backend';

/**
 * A plain stand-in for the language model: readings whose title, without
 * the author, is the same ("Dom Casmurro" and "Dom Casmurro, Machado de
 * Assis"). Used by the demo and in tests.
 */
export function sameTitleGroups(nominations: readonly Nomination[]): ConflictGroup[] {
  const byTitle = new Map<string, Nomination[]>();
  for (const nomination of nominations) {
    const key = titleKey(splitTitle(nomination.book.title).title);
    byTitle.set(key, [...(byTitle.get(key) ?? []), nomination]);
  }
  return [...byTitle.values()]
    .filter((group) => group.length >= 2)
    .map((group) => ({
      ids: group.map(({ id }) => id),
      reason: `Mesmo título: ${splitTitle(group[0]?.book.title ?? '').title}.`,
    }))
    .slice(0, MAX_CONFLICT_GROUPS);
}

export const sameTitleChecker: DuplicateChecker = {
  findDuplicates: (nominations) => Promise.resolve(sameTitleGroups(nominations)),
};
