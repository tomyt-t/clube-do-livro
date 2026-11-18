import { INK } from './parts.js';

/** Yellow plastic bar furniture and what sits on the table. */

export const PLASTIC = '#e2ad22';
const PLASTIC_SIDE = '#c8951b';
const PLASTIC_DARK = '#b5851a';

const legs =
  `<g stroke="${PLASTIC_SIDE}" stroke-width="3" stroke-linecap="round">` +
  '<path d="M-10 2 L-11 30"/><path d="M10 2 L11 30"/></g>';

const seat =
  `<path d="M-13 0 L0 -5 L13 0 L0 5 Z" fill="${PLASTIC}"/>` +
  `<path d="M-13 0 L0 5 L13 0 L13 2.4 L0 7.4 L-13 2.4 Z" fill="${PLASTIC_SIDE}"/>`;

/** The three horizontal slots that make the chair read as "bar chair". */
const slots = (y) =>
  `<g fill="${PLASTIC_SIDE}">` +
  [0, 4, 8].map((dy) => `<rect x="-8.5" y="${y + dy}" width="17" height="2" rx="1"/>`).join('') +
  '</g>';

/** The red refresh mark on the backrest. */
const refresh =
  '<g fill="none" stroke="#c8372d" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" transform="translate(0 -14)">' +
  '<path d="M5.2 2.6 A 5.8 5.8 0 1 1 2.6 -5.2"/><path d="M1.4 -8.4 L3.2 -5 L-0.4 -3.6"/></g>';

/** Chair behind an animal that faces us: we see its front. */
export const chairBehind = () =>
  legs +
  `<rect x="-12.5" y="-44" width="25" height="40" rx="7" fill="${PLASTIC_SIDE}"/>` +
  slots(-40) +
  seat;

/** Chair in front of an animal seen from behind: we see the back, with the mark. */
export const chairFront = () =>
  legs +
  seat +
  `<rect x="-13" y="-31" width="26" height="30" rx="7" fill="${PLASTIC}"/>` +
  slots(-27) +
  refresh;

/**
 * One or four 8×8 tables joined into a size×size block, drawn with the
 * projection `P(x, y, z)` of the scene.
 */
export function tableBlock(P, size) {
  const pt = ([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`;
  const poly = (points, fill) => `<path d="M${points.map(pt).join(' L')} Z" fill="${fill}"/>`;
  const leg = ([x, y, axis]) => {
    const d = 0.5;
    const quad =
      axis === 'x'
        ? [P(x - d, y, 6.3), P(x + d, y, 6.3), P(x + d, y, 0), P(x - d, y, 0)]
        : [P(x, y - d, 6.3), P(x, y + d, 6.3), P(x, y + d, 0), P(x, y - d, 0)];
    return poly(quad, axis === 'x' ? PLASTIC_DARK : PLASTIC_SIDE);
  };
  const legSpots =
    size === 16
      ? [
          [0.6, 16, 'x'],
          [8, 16, 'x'],
          [15.4, 16, 'x'],
          [16, 0.6, 'y'],
          [16, 8, 'y'],
        ]
      : [
          [0.6, 8, 'x'],
          [7.4, 8, 'x'],
          [8, 0.6, 'y'],
        ];
  const seams =
    size === 16
      ? `<path d="M${pt(P(8, 0, 7))} L${pt(P(8, 16, 7))} M${pt(P(0, 8, 7))} L${pt(P(16, 8, 7))}" stroke="${PLASTIC_SIDE}" stroke-width="1"/>`
      : '';
  return [
    poly([P(0, 0, 0), P(size, 0, 0), P(size, size, 0), P(0, size, 0)], 'rgb(0 0 0 / .06)'),
    ...legSpots.map(leg),
    poly([P(0, size, 7), P(size, size, 7), P(size, size, 6.3), P(0, size, 6.3)], PLASTIC_DARK),
    poly([P(size, 0, 7), P(size, size, 7), P(size, size, 6.3), P(size, 0, 6.3)], PLASTIC_SIDE),
    poly([P(0, 0, 7), P(size, 0, 7), P(size, size, 7), P(0, size, 7)], PLASTIC),
    seams,
  ].join('');
}

// ── on the table ──────────────────────────────────────────────

/** A 600 ml bottle, without any brand. */
export const bottle = () =>
  '<rect x="-5" y="-28" width="10" height="28" rx="3" fill="#5a3a1f"/>' +
  '<rect x="-2.3" y="-39" width="4.6" height="12" rx="1.6" fill="#5a3a1f"/>' +
  '<rect x="-2.7" y="-41" width="5.4" height="2.6" rx=".8" fill="#b9b4a8"/>' +
  '<rect x="-2.3" y="-34" width="4.6" height="2" fill="#e9dfc8"/>' +
  '<rect x="-3.8" y="-19" width="7.6" height="9" rx="2" fill="#e9dfc8"/>';

export const closedBook = (color) =>
  `<path d="M-10 0 L0 -5 L10 0 L0 5 Z" fill="${color}"/>` +
  '<path d="M-10 0 L0 5 L10 0 L10 2.4 L0 7.4 L-10 2.4 Z" fill="#f6f3ea"/>';

export const plate = (food) =>
  '<ellipse cx="0" cy="0" rx="9" ry="4.6" fill="#fff" stroke="#d8d4ca" stroke-width=".8"/>' + food;

export const peanuts =
  '<g fill="#c79a5c"><ellipse cx="-3" cy="-1" rx="2" ry="1.2"/><ellipse cx="2" cy="-1.4" rx="2" ry="1.2"/>' +
  '<ellipse cx="0" cy="1" rx="2" ry="1.2"/><ellipse cx="4" cy="0.8" rx="2" ry="1.2"/></g>';

export const fries =
  '<g stroke="#e9b949" stroke-width="2" stroke-linecap="round"><path d="M-4 0 l2 -5"/><path d="M-1 1 l1 -6"/>' +
  '<path d="M2 0 l-1 -5"/><path d="M4 1 l2 -5"/><path d="M0 2 l3 -4"/></g>';

export const napkins =
  '<rect x="-5" y="-9" width="10" height="9" rx="1" fill="#c9ccd1"/><rect x="-4" y="-12" width="8" height="4" fill="#fff"/>';

// ── overhead ──────────────────────────────────────────────────

/** A string of bulbs along a quadratic curve. */
export function stringLights([x0, y0, cx, cy, x1, y1, count]) {
  const bulbs = Array.from({ length: count }, (_, i) => {
    const t = (i + 0.5) / count;
    const x = (1 - t) ** 2 * x0 + 2 * (1 - t) * t * cx + t ** 2 * x1;
    const y = (1 - t) ** 2 * y0 + 2 * (1 - t) * t * cy + t ** 2 * y1 + 3;
    const delay = ((i * 0.37) % 3).toFixed(2);
    return `<circle class="bulb" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="2.6" fill="#f3cf6b" style="animation-delay:${delay}s"/>`;
  });
  return `<path d="M${x0} ${y0} Q ${cx} ${cy} ${x1} ${y1}" fill="none" stroke="#8c8a84" stroke-width=".8"/>${bulbs.join('')}`;
}

/** A speech bubble with a short exclamation, anchored at a screen point. */
export function bubble([x, y], text, delay) {
  const w = 8 + text.length * 6;
  return (
    `<g class="bubble ${delay}" transform="translate(${x.toFixed(1)} ${y.toFixed(1)})">` +
    `<rect x="0" y="0" width="${w}" height="15" rx="5" fill="#fff" stroke="${INK}" stroke-width="1"/>` +
    `<path d="M5 14.4 L4 20 L10 14.4" fill="#fff" stroke="${INK}" stroke-width="1" stroke-linejoin="round"/>` +
    '<path d="M5.6 14 H9.4" stroke="#fff" stroke-width="1.6"/>' +
    `<text x="${w / 2}" y="11" text-anchor="middle" font-size="10" font-weight="800" fill="${INK}" font-family="sans-serif">${text}</text></g>`
  );
}
