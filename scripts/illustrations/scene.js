import { BACK, FRONT, PERCHED } from './animals.js';
import { bubble, chairBehind, chairFront, stringLights, tableBlock } from './furniture.js';
import { at, INK } from './parts.js';

/**
 * Isometric scene builder. World units sit on the floor plane (x, y) with
 * height z; the camera looks down from the front, slightly above.
 */

const UNIT = 9;
const SEAT_HEIGHT = 3.6;
const TABLE_HEIGHT = 7;

const projection =
  (ox, oy) =>
  (x, y, z = 0) => [ox + (x - y) * UNIT * 0.866, oy + (x + y) * UNIT * 0.5 - z * UNIT];

function seatSprite({ name, facing, smoking }) {
  if (facing === 'front') return chairBehind() + FRONT[name](smoking);
  if (facing === 'perch') return chairFront() + PERCHED[name]();
  return BACK[name](smoking) + chairFront();
}

const STYLE = `<style>
  .line { fill: none; stroke: ${INK}; stroke-width: 1.2; stroke-linecap: round; }
  .eye { transform-box: fill-box; transform-origin: center; animation: blink 5.2s infinite; }
  .eye.b { animation-delay: 1.7s; } .eye.c { animation-delay: 3.1s; } .eye.d { animation-delay: .6s; animation-duration: 6.4s; }
  @keyframes blink { 0%, 93%, 100% { transform: scaleY(1); } 96% { transform: scaleY(.1); } }
  .sway { transform-box: fill-box; transform-origin: 0% 100%; animation: sway 3.4s ease-in-out infinite alternate; }
  @keyframes sway { from { transform: rotate(-6deg); } to { transform: rotate(6deg); } }
  .gesture { transform-box: fill-box; transform-origin: 0% 100%; animation: gesture 1.3s ease-in-out infinite; }
  @keyframes gesture { 0%, 100% { transform: rotate(0); } 50% { transform: rotate(-12deg) translateY(-1px); } }
  .nod { animation: nod 1.3s ease-in-out infinite; }
  @keyframes nod { 50% { transform: translateY(-1px); } }
  .flick { transform-box: fill-box; transform-origin: 50% 0%; animation: flick 4.6s infinite; }
  @keyframes flick { 0%, 84%, 100% { transform: rotate(0); } 90% { transform: rotate(14deg); } }
  .gills.l { transform-box: fill-box; transform-origin: 100% 50%; animation: gills 1.8s ease-in-out infinite alternate; }
  .gills.r { transform-box: fill-box; transform-origin: 0% 50%; animation: gills 1.8s ease-in-out infinite alternate-reverse; }
  @keyframes gills { from { transform: rotate(-7deg); } to { transform: rotate(7deg); } }
  .cheers { transform-box: fill-box; transform-origin: 0% 100%; animation: cheers 2.4s ease-in-out infinite; }
  @keyframes cheers { 0%, 60%, 100% { transform: rotate(0); } 75% { transform: rotate(-10deg); } }
  .laugh { transform-box: fill-box; transform-origin: center; animation: laugh .5s ease-in-out infinite alternate; }
  @keyframes laugh { from { transform: scaleY(.6); } to { transform: scaleY(1.15); } }
  .ears { transform-box: fill-box; transform-origin: 50% 100%; animation: ears 5s ease-in-out infinite; }
  @keyframes ears { 0%, 80%, 100% { transform: rotate(0); } 88% { transform: rotate(-6deg); } }
  .zzz { animation: zzz 3s ease-in-out infinite; }
  @keyframes zzz { 0% { opacity: 0; transform: translate(0, 4px); } 30%, 70% { opacity: 1; } 100% { opacity: 0; transform: translate(4px, -6px); } }
  .foam { transform-box: fill-box; transform-origin: bottom; animation: breathe 2.6s ease-in-out infinite; }
  .foam.b { animation-delay: 1.2s; }
  @keyframes breathe { 50% { transform: scaleY(1.2); } }
  .bubble { opacity: 0; animation: talk 8s ease-in-out infinite; }
  .bubble.b { animation-delay: 2s; } .bubble.c { animation-delay: 4s; } .bubble.d { animation-delay: 6s; }
  @keyframes talk { 0% { opacity: 0; } 4%, 22% { opacity: 1; } 26%, 100% { opacity: 0; } }
  .smoke { opacity: 0; transform-box: fill-box; transform-origin: 50% 100%; animation: smoke 3.4s ease-out infinite; }
  .smoke.late { animation-delay: 1.7s; }
  @keyframes smoke { 0% { opacity: 0; transform: translateY(2px) scale(.5); } 25% { opacity: .8; } 100% { opacity: 0; transform: translateY(-9px) scale(1.2); } }
  .ember { animation: ember 2.2s ease-in-out infinite; }
  @keyframes ember { 50% { fill: #ff8a3d; } }
  .bulb { animation: twinkle 3s ease-in-out infinite; }
  @keyframes twinkle { 50% { opacity: .45; } }
  @media (prefers-reduced-motion: reduce) {
    * { animation: none !important; }
    .bubble.a { opacity: 1; }
    .smoke:not(.late) { opacity: .6; }
  }
</style>`;

/**
 * @param {object} scene
 * @param {[number, number]} scene.origin screen position of world (0, 0, 0)
 * @param {8 | 16} scene.size side of the table block (one or four tables)
 * @param {{ x: number, y: number, name: string, facing: 'front' | 'back' | 'perch', flip?: boolean, smoking?: 'cig' | 'pipe' }[]} scene.seats
 * @param {[number, number, string][]} scene.onTable [x, y, svg] on the table top
 * @param {{ seat: number, text: string, delay: string, dx: number }[]} scene.bubbles
 * @param {number[]} scene.lights quadratic curve and bulb count
 */
export function buildScene({ origin, size, seats, onTable, bubbles, lights, viewBox, label }) {
  const P = projection(...origin);
  const layers = [];
  const add = (depth, svg) => layers.push({ depth, svg });

  seats.forEach((seat) => {
    const [fx, fy] = P(seat.x, seat.y, 0);
    const shadow = `<ellipse cx="${fx.toFixed(1)}" cy="${fy.toFixed(1)}" rx="15" ry="5" fill="rgb(0 0 0 / .07)"/>`;
    const sprite = at(P(seat.x, seat.y, SEAT_HEIGHT), seatSprite(seat), seat.flip);
    add(seat.x + seat.y, shadow + sprite);
  });
  add(size, tableBlock(P, size));
  onTable.forEach(([x, y, svg]) => add(size + (x + y) / 100, at(P(x, y, TABLE_HEIGHT), svg)));
  bubbles.forEach(({ seat, text, delay, dx }) => {
    const [x, y] = P(seats[seat].x, seats[seat].y, SEAT_HEIGHT);
    add(100, bubble([x + dx, y - 66], text, delay));
  });

  const body = layers
    .sort((a, b) => a.depth - b.depth)
    .map((layer) => layer.svg)
    .join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" role="img" aria-label="${label}">${STYLE}${stringLights(lights)}${body}</svg>\n`;
}
