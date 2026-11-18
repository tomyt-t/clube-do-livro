import { splitTitle } from '@/domain/book';
import type { ConflictGroup, DuplicateFindings } from '@/domain/review';
import { titleKey } from '@/domain/title-key';
import type { Nomination } from '@/domain/types';

import type { DuplicateChecker } from '../backend';

/**
 * The check that needs no language model: readings written the same way.
 * Same title and the same author as written (ignoring case, accents and
 * punctuation) is the same work. The same title with a different or missing
 * author may not be (two books can share a title), so the organizer
 * decides. Translations need the model: "Os Miseráveis" and "Les
 * Misérables" look nothing alike here.
 */
export function exactFindings(nominations: readonly Nomination[]): DuplicateFindings {
  const byTitle = new Map<string, Nomination[]>();
  for (const nomination of nominations) {
    const key = titleKey(splitTitle(nomination.book.title).title);
    byTitle.set(key, [...(byTitle.get(key) ?? []), nomination]);
  }
  const same: ConflictGroup[] = [];
  const unsure: ConflictGroup[] = [];
  for (const group of byTitle.values()) {
    if (group.length < 2) continue;
    const title = splitTitle(group[0]?.book.title ?? '').title;
    const ids = group.map(({ id }) => id);
    const written = new Set(group.map(({ book }) => titleKey(book.title)));
    if (written.size === 1) same.push({ ids, reason: `Mesmo título e autor: ${title}.` });
    else unsure.push({ ids, reason: `Mesmo título, com autor diferente ou sem autor: ${title}.` });
  }
  return { same, unsure };
}

export const exactChecker: DuplicateChecker = {
  findDuplicates: (nominations) => Promise.resolve(exactFindings(nominations)),
};
