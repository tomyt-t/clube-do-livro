/** How far (px) or how fast (px/s) a sideways drag must go to change cards. */
const SWIPE_DISTANCE = 70;
const SWIPE_SPEED = 400;

interface Drag {
  offset: { x: number };
  velocity: { x: number };
}

/** 1 to go to the next card (dragged left), -1 for the previous, 0 to stay. */
export function swipeDirection({ offset, velocity }: Drag): -1 | 0 | 1 {
  if (offset.x < -SWIPE_DISTANCE || velocity.x < -SWIPE_SPEED) return 1;
  if (offset.x > SWIPE_DISTANCE || velocity.x > SWIPE_SPEED) return -1;
  return 0;
}

/** The card `step` away from `index`, wrapping around both ends. */
export function cardAfter(index: number, step: number, total: number): number {
  return total === 0 ? 0 : (((index + step) % total) + total) % total;
}

/** Keys that move between cards, unless the person is typing somewhere. */
export function deckStep(event: KeyboardEvent): -1 | 0 | 1 {
  const target = event.target;
  const typing =
    target instanceof HTMLElement &&
    (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName));
  if (typing || event.altKey || event.ctrlKey || event.metaKey) return 0;
  if (event.key === 'ArrowRight') return 1;
  return event.key === 'ArrowLeft' ? -1 : 0;
}
