import { blob, book, closedEye, eye, glass, head, INK, paws, smile, smokeAt } from './parts.js';

/**
 * The cast. Each sprite is drawn around its seat at (0, 0) and receives what
 * it is smoking ('cig', 'pipe' or false), if anything.
 */

/** Animals facing the camera, on the far side of the table. */
export const FRONT = {
  sapo: (smoking) => {
    const g = '#7db46c';
    return (
      blob(g, 12, 11) +
      `<ellipse cx="0" cy="-29" rx="13" ry="9" fill="${g}"/>` +
      `<circle cx="-7" cy="-37" r="4.6" fill="${g}"/><circle cx="7" cy="-37" r="4.6" fill="${g}"/>` +
      eye(-7, -37.5, 1.9) +
      eye(7, -37.5, 1.9) +
      '<path class="line" d="M-7 -27 q 7 5.4 14 0"/>' +
      '<ellipse cx="-9" cy="-26" rx="2" ry="1.2" fill="#e88b8b" opacity=".6"/>' +
      '<ellipse cx="9" cy="-26" rx="2" ry="1.2" fill="#e88b8b" opacity=".6"/>' +
      `<g class="cheers"><path d="M8 -18 Q 14 -24 15 -31" fill="none" stroke="${g}" stroke-width="4.6" stroke-linecap="round"/>${glass(15, -31)}</g>` +
      smokeAt(smoking, -6, -26.4, 168)
    );
  },

  coruja: () => {
    const b = '#8e6e52';
    const lens = (x) =>
      `<circle cx="${x}" cy="-33" r="5" fill="#eadcc4"/>` +
      `<circle cx="${x}" cy="-33" r="4.6" fill="none" stroke="${INK}" stroke-width="1.1"/>`;
    return (
      blob(b, 11, 13) +
      '<ellipse cx="0" cy="-11" rx="7" ry="8" fill="#c9ad8b"/>' +
      head(b) +
      `<path d="M-9 -40 L-11 -50 L-3.6 -43 Z M9 -40 L11 -50 L3.6 -43 Z" fill="${b}"/>` +
      lens(-4.6) +
      lens(4.6) +
      `<path d="M-0.4 -33.4 h0.8" stroke="${INK}" stroke-width="1.1"/>` +
      eye(-4.6, -32.6, 1.5, 'b') +
      eye(4.6, -32.6, 1.5, 'b') +
      '<path d="M-1.6 -28.4 L1.6 -28.4 L0 -25.8 Z" fill="#e39a3b"/>' +
      book('#2c7a4b') +
      paws(b)
    );
  },

  gato: (smoking) => {
    const c = '#a19a90';
    return (
      `<g class="sway"><path d="M10 -5 C 22 -6, 24 -20, 16 -25" fill="none" stroke="${c}" stroke-width="4" stroke-linecap="round"/></g>` +
      blob(c) +
      head(c) +
      `<path d="M-10 -37 L-11 -50 L-2.5 -42 Z M10 -37 L11 -50 L2.5 -42 Z" fill="${c}"/>` +
      '<path d="M-8.6 -40 L-9 -46 L-5 -42.4 Z M8.6 -40 L9 -46 L5 -42.4 Z" fill="#e9a9a2"/>' +
      closedEye(-4.5, -33) +
      closedEye(4.5, -33, 'c') +
      '<circle cx="0" cy="-29.4" r="1.2" fill="#d98a86"/>' +
      book('#233a72') +
      paws('#b2aba1') +
      smokeAt(smoking, 2.2, -27.6, 16)
    );
  },

  preguica: (smoking) => {
    const b = '#b5a089';
    return (
      blob(b) +
      head('#c4b29a') +
      '<ellipse cx="0" cy="-32" rx="9" ry="7.4" fill="#ecdec8"/>' +
      '<ellipse cx="-4.6" cy="-33.4" rx="3.6" ry="2.1" fill="#6b5a48" transform="rotate(-18 -4.6 -33.4)"/>' +
      '<ellipse cx="4.6" cy="-33.4" rx="3.6" ry="2.1" fill="#6b5a48" transform="rotate(18 4.6 -33.4)"/>' +
      '<path d="M-6 -33.6 q 1.4 1 2.8 0 M3.2 -33.6 q 1.4 1 2.8 0" fill="none" stroke="#efe4d2" stroke-width="1"/>' +
      '<circle cx="0" cy="-30" r="1.4" fill="#4a3d31"/>' +
      smile(0, -27.6, 5) +
      book('#8c4b3a') +
      paws(b) +
      smokeAt(smoking, 11, -23, -52) +
      `<text class="zzz" x="12" y="-46" font-size="9" font-weight="700" fill="${INK}" font-family="sans-serif">z</text>`
    );
  },

  mico: () => {
    const o = '#e8892e';
    return (
      blob(o) +
      '<circle cx="0" cy="-33" r="14" fill="#f0a24a"/>' +
      head(o, 11) +
      '<ellipse cx="0" cy="-32" rx="7.4" ry="8.4" fill="#5a3b2a"/>' +
      '<circle cx="-3" cy="-34.6" r="2" fill="#f4e4cc"/><circle cx="3" cy="-34.6" r="2" fill="#f4e4cc"/>' +
      eye(-3, -34.6, 1.1) +
      eye(3, -34.6, 1.1) +
      '<ellipse class="laugh" cx="0" cy="-28.4" rx="2.6" ry="2.2" fill="#2a1a12"/>' +
      book('#d0743a') +
      paws('#5a3b2a')
    );
  },

  cachorro: (smoking) => {
    const t = '#c8925c';
    const ear = (s) =>
      `<path d="M${s * 9} -40 C ${s * 17} -38, ${s * 17} -26, ${s * 12.5} -22 C ${s * 8} -26, ${s * 6} -34, ${s * 9} -40 Z" fill="#94643a"/>`;
    return (
      blob(t) +
      `<g class="nod">${head(t)}` +
      '<ellipse cx="0" cy="-28.5" rx="6.6" ry="5" fill="#e3bd8f"/>' +
      `<ellipse cx="0" cy="-31" rx="2.4" ry="1.8" fill="${INK}"/>` +
      `<path d="M-3 -26.6 q 3 4.4 6 0 Z" fill="${INK}"/>` +
      eye(-4.4, -36.4) +
      eye(4.4, -36.4, 1.7, 'c') +
      `<g class="flick">${ear(-1)}</g>${ear(1)}</g>` +
      `<g class="gesture"><path d="M8 -18 Q 16 -22 17 -33" fill="none" stroke="${t}" stroke-width="5" stroke-linecap="round"/>` +
      `<ellipse cx="17" cy="-35" rx="3.4" ry="3" fill="#d6a673"/>${smokeAt(smoking, 18.4, -36, -38)}</g>`
    );
  },

  axolote: () => {
    const p = '#f3b0c0';
    const gills = (s) =>
      `<g class="gills ${s > 0 ? 'r' : 'l'}" fill="none" stroke="#e5718d" stroke-width="3" stroke-linecap="round">` +
      `<path d="M${s * 10} -36 q ${s * 7} -6 ${s * 10} -2"/>` +
      `<path d="M${s * 11.5} -31 q ${s * 8} -1 ${s * 11} 3"/>` +
      `<path d="M${s * 10} -26 q ${s * 6} 3 ${s * 7} 8"/></g>`;
    return (
      blob(p) +
      gills(-1) +
      gills(1) +
      `<ellipse cx="0" cy="-31" rx="12" ry="9.6" fill="${p}"/>` +
      eye(-5, -32, 1.7, 'd') +
      eye(5, -32, 1.7, 'd') +
      smile(0, -27.4, 7) +
      '<ellipse cx="-8" cy="-28" rx="2" ry="1.1" fill="#ec8aa1" opacity=".7"/>' +
      '<ellipse cx="8" cy="-28" rx="2" ry="1.1" fill="#ec8aa1" opacity=".7"/>' +
      `<path d="M-9 -16 Q -14 -18 -15 -22" fill="none" stroke="${p}" stroke-width="4.6" stroke-linecap="round"/>` +
      glass(-15, -21)
    );
  },

  lagartixa: () => {
    const l = '#e4c8a6';
    const toes = (s) =>
      `<circle cx="${s * 12.4}" cy="-23" r="1"/><circle cx="${s * 12.2}" cy="-20.6" r="1"/>`;
    return (
      `<g class="sway"><path d="M8 -4 C 20 -4, 23 -14, 18 -22" fill="none" stroke="${l}" stroke-width="3.4" stroke-linecap="round"/></g>` +
      blob(l, 9, 12) +
      `<ellipse cx="0" cy="-31" rx="11" ry="8" fill="${l}"/>` +
      `<circle cx="-8" cy="-35" r="3.4" fill="${l}"/><circle cx="8" cy="-35" r="3.4" fill="${l}"/>` +
      eye(-8, -35, 2.1, 'b') +
      eye(8, -35, 2.1, 'b') +
      '<circle cx="-8.6" cy="-35.7" r=".6" fill="#fff"/><circle cx="7.4" cy="-35.7" r=".6" fill="#fff"/>' +
      smile(0, -28.6, 7) +
      '<g fill="#d3b18a"><circle cx="-3" cy="-36" r=".9"/><circle cx="3" cy="-36.4" r=".9"/></g>' +
      book('#2c7a4b') +
      `<circle cx="-10" cy="-22" r="2.6" fill="${l}"/><circle cx="10" cy="-22" r="2.6" fill="${l}"/>` +
      `<g fill="#d3b18a">${toes(-1)}${toes(1)}</g>`
    );
  },
};

/** Animals seen from behind, on the near side of the table. */
export const BACK = {
  tatu: () =>
    '<ellipse cx="0" cy="-40" rx="5.6" ry="6" fill="#c9b49c"/>' +
    '<path d="M-4 -44 l-2 -5 l3 3 Z M4 -44 l2 -5 l-3 3 Z" fill="#c9b49c"/>' +
    '<ellipse cx="0" cy="-20" rx="13" ry="16" fill="#b7a08a"/>' +
    '<g fill="none" stroke="#9d8670" stroke-width="1.6">' +
    '<path d="M-12 -26 Q 0 -30 12 -26"/><path d="M-13 -20 Q 0 -24 13 -20"/>' +
    '<path d="M-12.6 -14 Q 0 -18 12.6 -14"/><path d="M-11 -8 Q 0 -12 11 -8"/></g>',

  coelho: () =>
    '<g class="ears">' +
    '<ellipse cx="-5" cy="-51" rx="3.6" ry="11" fill="#ece6dc" transform="rotate(-9 -5 -51)"/>' +
    '<ellipse cx="5" cy="-51" rx="3.6" ry="11" fill="#ece6dc" transform="rotate(9 5 -51)"/></g>' +
    blob('#ece6dc') +
    head('#ece6dc'),

  raposa: () =>
    '<g class="sway"><path d="M8 -8 C 26 -10, 30 -26, 20 -34 C 18 -26, 12 -20, 6 -18 Z" fill="#e07b39"/>' +
    '<path d="M20 -34 C 24 -31, 25 -28, 24 -25 C 22 -28, 20 -30, 18.6 -30.6 Z" fill="#fbf3e8"/></g>' +
    blob('#e07b39') +
    head('#e07b39') +
    '<path d="M-10 -38 L-9 -50 L-2.5 -42 Z M10 -38 L9 -50 L2.5 -42 Z" fill="#e07b39"/>' +
    `<path d="M-9.6 -46 L-9 -50 L-7 -47.4 Z M9.6 -46 L9 -50 L7 -47.4 Z" fill="${INK}"/>`,

  tucano: (smoking) =>
    blob('#232326') +
    head('#232326') +
    '<path d="M8 -34 C 18 -40, 30 -38, 33 -30 C 26 -29, 16 -28, 8 -28 Z" fill="#f2a03d"/>' +
    `<path d="M29 -34.6 C 31.6 -33.4, 33 -31.6, 33 -30 C 31 -30.2, 29.6 -30.4, 28.6 -30.6 Z" fill="${INK}"/>` +
    '<ellipse cx="8" cy="-27" rx="4" ry="3.4" fill="#f6efe2"/>' +
    eye(6, -36, 1.4) +
    smokeAt(smoking, 31.6, -30.2, 8),

  capivara: () =>
    blob('#9a7351', 12, 12) +
    '<rect x="-11" y="-45" width="22" height="19" rx="7.5" fill="#9a7351"/>' +
    '<circle cx="-8" cy="-44.6" r="2.6" fill="#86603f"/><circle cx="8" cy="-44.6" r="2.6" fill="#86603f"/>' +
    '<circle cx="0" cy="-49" r="4.6" fill="#f08a24"/>' +
    '<path d="M0 -53.4 q 3 -3 5.4 -1.6 q -2.4 2.2 -5.4 1.6 Z" fill="#4f8a3c"/>' +
    '<path d="M-13 -16 Q -18 -20 -18 -24" fill="none" stroke="#9a7351" stroke-width="4.6" stroke-linecap="round"/>' +
    glass(-18, -23),

  pinguim: () =>
    blob('#232326', 11, 13) +
    head('#232326') +
    '<path d="M-10 -18 Q -16 -12 -13 -4" fill="none" stroke="#232326" stroke-width="4" stroke-linecap="round"/>' +
    '<path d="M10 -18 Q 16 -12 13 -4" fill="none" stroke="#232326" stroke-width="4" stroke-linecap="round"/>' +
    '<path d="M9.6 -34 L15 -32 L9.6 -30.6 Z" fill="#f2a03d"/>',
};

/** Animals perched on top of an empty chair's backrest. */
export const PERCHED = {
  lagartixa: () => `<g transform="translate(0 -29) scale(.82)">${FRONT.lagartixa()}</g>`,
};
