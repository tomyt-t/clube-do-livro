/**
 * Small SVG building blocks shared by every character and prop.
 * Coordinates are local to a sprite: (0, 0) is the seat, y grows downward.
 */

export const INK = '#1d1d20';

const fixed = (n) => n.toFixed(1);

/** Places `body` at a screen point, optionally mirrored. */
export const at = ([x, y], body, flip = false) =>
  `<g transform="translate(${fixed(x)} ${fixed(y)})${flip ? ' scale(-1 1)' : ''}">${body}</g>`;

export const eye = (x, y, r = 1.7, delay = '') =>
  `<circle class="eye ${delay}" cx="${x}" cy="${y}" r="${r}" fill="${INK}"/>`;

export const closedEye = (x, y, delay = '') =>
  `<path class="line eye ${delay}" d="M${x - 2.4} ${y} q 2.4 2 4.8 0"/>`;

export const smile = (x, y, w = 6) =>
  `<path class="line" d="M${x - w / 2} ${y} q ${w / 2} 2.6 ${w} 0"/>`;

export const blob = (fill, rx = 11, ry = 12) =>
  `<ellipse cx="0" cy="-12" rx="${rx}" ry="${ry}" fill="${fill}"/>`;

export const head = (fill, r = 11) => `<circle cx="0" cy="-33" r="${r}" fill="${fill}"/>`;

/** An open book held up, back cover towards the viewer. */
export const book = (color, y = -26) =>
  `<path d="M-10 ${y - 3} L0 ${y} L10 ${y - 3} L10 ${y + 8} L0 ${y + 11} L-10 ${y + 8} Z" fill="${color}"/>` +
  `<path d="M0 ${y} V${y + 11}" stroke="rgb(0 0 0 / .25)" stroke-width="1"/>`;

export const paws = (color, y = -22) =>
  `<ellipse cx="-10" cy="${y}" rx="3.4" ry="2.8" fill="${color}"/>` +
  `<ellipse cx="10" cy="${y}" rx="3.4" ry="2.8" fill="${color}"/>`;

/** A "copo americano" of beer with breathing foam. */
export const glass = (x, y, delay = '') =>
  `<g transform="translate(${x} ${y})"><path d="M-4.5 -12 L4.5 -12 L3.4 0 L-3.4 0 Z" fill="#fff" opacity=".6"/>` +
  `<path d="M-3.8 -7.4 L3.8 -7.4 L3.3 0 L-3.3 0 Z" fill="#d08c2e"/>` +
  `<path class="foam ${delay}" d="M-4.2 -10 L4.2 -10 L3.9 -7.2 L-3.9 -7.2 Z" fill="#fbf6e8"/></g>`;

/** Two alternating wisps of smoke rising straight up from (x, y). */
const wisps = (x, y) => {
  const wisp = (delay, d) =>
    `<path class="smoke ${delay}" d="${d}" fill="none" stroke="#b9b5ad" stroke-width="1.2" stroke-linecap="round"/>`;
  return (
    `<g transform="translate(${fixed(x)} ${fixed(y)})">` +
    wisp('', 'M0 -1.4 q -2.6 -4 0 -7.6 q 2.6 -3.6 0 -7.2') +
    wisp('late', 'M0 -1.4 q 2.4 -4 0 -7.4 q -2.4 -3.6 0 -7') +
    '</g>'
  );
};

const cigarette = (x, y, angle) => {
  const r = (angle * Math.PI) / 180;
  return (
    `<g transform="translate(${x} ${y}) rotate(${angle})">` +
    '<rect x="0" y="-0.8" width="8" height="1.6" rx=".5" fill="#f4f1ea"/>' +
    '<rect x="0" y="-0.8" width="2.6" height="1.6" fill="#d39b5f"/>' +
    '<circle class="ember" cx="8" cy="0" r="1" fill="#e2532d"/></g>' +
    wisps(x + 8 * Math.cos(r), y + 8 * Math.sin(r))
  );
};

const pipe = (x, y) =>
  `<g transform="translate(${x} ${y})">` +
  '<path d="M0 0 q 4 2.4 7.6 1.6" fill="none" stroke="#3b2a1c" stroke-width="1.7" stroke-linecap="round"/>' +
  '<path d="M6.4 -3.6 h5 v3.8 a2.5 2.5 0 0 1 -5 0 Z" fill="#6b4226"/>' +
  '<ellipse class="ember" cx="8.9" cy="-3.6" rx="2.2" ry=".8" fill="#e2532d"/></g>' +
  wisps(x + 8.9, y - 4.2);

/** Something lit at (x, y): `kind` is 'cig', 'pipe' or false. */
export const smokeAt = (kind, x, y, angle = 0) => {
  if (kind === 'pipe') return pipe(x, y);
  return kind ? cigarette(x, y, angle) : '';
};
