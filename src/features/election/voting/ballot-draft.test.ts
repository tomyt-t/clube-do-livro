import { describe, expect, it } from 'vitest';

import {
  EMPTY_BALLOT,
  isComplete,
  rankLabel,
  rankOf,
  swapPicks,
  toggleDislike,
  togglePick,
} from './ballot-draft';

describe('ballot draft', () => {
  it('picks in order, up to the number of choices', () => {
    let ballot = togglePick(EMPTY_BALLOT, 'a', 2);
    ballot = togglePick(ballot, 'b', 2);
    ballot = togglePick(ballot, 'c', 2);
    expect(ballot.picks).toEqual(['a', 'b']);
    expect([rankOf(ballot, 'a'), rankOf(ballot, 'b'), rankOf(ballot, 'c')]).toEqual([1, 2, null]);
    expect(isComplete(ballot, 2)).toBe(true);
  });

  it('moves the second choice up when the first is dropped', () => {
    const ballot = togglePick(togglePick(togglePick(EMPTY_BALLOT, 'a', 2), 'b', 2), 'a', 2);
    expect(ballot.picks).toEqual(['b']);
    expect(rankOf(ballot, 'b')).toBe(1);
  });

  it('swaps the order of the two choices', () => {
    const ballot = swapPicks({ picks: ['a', 'b'], disliked: [] });
    expect(ballot.picks).toEqual(['b', 'a']);
  });

  it('keeps a book from being both picked and disliked', () => {
    const disliked = toggleDislike({ picks: ['a', 'b'], disliked: [] }, 'a');
    expect(disliked).toEqual({ picks: ['b'], disliked: ['a'] });
    expect(togglePick(disliked, 'a', 2)).toEqual({ picks: ['b', 'a'], disliked: [] });
    expect(toggleDislike(disliked, 'a').disliked).toEqual([]);
  });

  it('is never complete when there is nothing to choose', () => {
    expect(isComplete(EMPTY_BALLOT, 0)).toBe(false);
    expect(rankLabel(1)).toBe('1ª opção');
  });
});
