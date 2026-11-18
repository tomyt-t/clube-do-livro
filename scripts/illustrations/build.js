/**
 * Draws the boteco illustrations into src/assets/illustrations.
 * Run with `npm run illustrations` after changing anything in this folder.
 */
import { writeFileSync } from 'node:fs';
import { fileURLToPath, URL } from 'node:url';

import { bottle, closedBook, fries, napkins, peanuts, plate } from './furniture.js';
import { glass } from './parts.js';
import { buildScene } from './scene.js';

const seat = (x, y, name, facing, extra = {}) => ({ x, y, name, facing, ...extra });

/** Sign-in: fourteen animals around four joined tables. */
const club = buildScene({
  origin: [214, 118],
  size: 16,
  viewBox: '0 0 428 296',
  label:
    'Catorze bichos num boteco, em quatro mesas de plástico juntas: uns discutem livros tomando cerveja, outros leem.',
  seats: [
    seat(-2.6, 2, 'sapo', 'front', { smoking: 'cig' }),
    seat(-2.6, 6, 'coruja', 'front'),
    seat(-2.6, 10, 'gato', 'front', { smoking: 'pipe' }),
    seat(-2.6, 14, 'preguica', 'front', { smoking: 'cig' }),
    seat(2, -2.6, 'mico', 'front', { flip: true }),
    seat(6, -2.6, 'cachorro', 'front', { flip: true }),
    seat(10, -2.6, 'axolote', 'front', { flip: true }),
    seat(14, -2.6, 'lagartixa', 'front', { flip: true }),
    seat(3, 18.6, 'tatu', 'back'),
    seat(8, 18.6, 'coelho', 'back'),
    seat(13, 18.6, 'raposa', 'back'),
    seat(18.6, 3, 'tucano', 'back', { flip: true, smoking: 'cig' }),
    seat(18.6, 8, 'capivara', 'back'),
    seat(18.6, 13, 'pinguim', 'back'),
  ],
  onTable: [
    [8, 8, plate(peanuts)],
    [12.6, 11, plate(fries)],
    [4, 11.4, plate(peanuts)],
    [8.4, 3.4, napkins],
    [5, 7, bottle()],
    [11, 5.4, bottle()],
    [10, 13, bottle()],
    [2.2, 3, glass(0, 0)],
    [2.6, 13.6, glass(0, 0, 'b')],
    [14, 2.4, glass(0, 0)],
    [14.6, 14, glass(0, 0, 'b')],
    [6.4, 14.8, glass(0, 0)],
    [15, 7.6, glass(0, 0)],
    [7, 2.2, closedBook('#233a72')],
    [2.6, 7.6, closedBook('#2c7a4b')],
    [12.8, 15, closedBook('#8c4b3a')],
  ],
  bubbles: [
    { seat: 5, text: '!', delay: 'a', dx: 6 },
    { seat: 6, text: '?', delay: 'b', dx: 4 },
    { seat: 4, text: 'kkk', delay: 'c', dx: -36 },
    { seat: 11, text: '…', delay: 'd', dx: 10 },
  ],
  lights: [18, 26, 214, 64, 410, 22, 11],
});

/** Every other page: the first scene, one table, as background art. */
const table = buildScene({
  origin: [112, 114],
  size: 8,
  viewBox: '0 0 224 186',
  label:
    'Gato, cachorro, axolote e lagartixa num boteco: dois discutem um livro tomando cerveja, os outros leem.',
  seats: [
    seat(-2.6, 4, 'gato', 'front', { smoking: 'pipe' }),
    seat(2.2, -2.6, 'cachorro', 'front', { flip: true, smoking: 'cig' }),
    seat(5.8, -2.6, 'axolote', 'front', { flip: true }),
    seat(10.6, 4, 'lagartixa', 'perch'),
  ],
  onTable: [
    [3.6, 3.4, plate(peanuts)],
    [5.6, 5.8, bottle()],
    [1.8, 2.2, glass(0, 0)],
    [3.2, 6.6, glass(0, 0, 'b')],
    [1.6, 5.4, closedBook('#2c7a4b')],
  ],
  bubbles: [
    { seat: 1, text: '!', delay: 'a', dx: 6 },
    { seat: 2, text: '?', delay: 'b', dx: 4 },
  ],
  lights: [10, 30, 112, 56, 214, 26, 7],
});

const out = (file) =>
  fileURLToPath(new URL(`../../src/assets/illustrations/${file}`, import.meta.url));
writeFileSync(out('boteco-clube.svg'), club);
writeFileSync(out('boteco-mesa.svg'), table);
console.warn('Ilustrações geradas em src/assets/illustrations.');
