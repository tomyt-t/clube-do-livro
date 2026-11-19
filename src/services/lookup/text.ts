import { BOOK_LIMITS } from '@/domain/book';

/**
 * Catalog synopses arrive as HTML or Markdown with credits at the end.
 * This keeps only readable text; React escapes it again when shown.
 */

const ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  mdash: '—',
  ndash: '–',
  hellip: '…',
  lsquo: '‘',
  rsquo: '’',
  ldquo: '“',
  rdquo: '”',
};

function decodeEntities(text: string): string {
  return text.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (entity, code: string) => {
    const name = code.toLowerCase();
    if (name.startsWith('#x')) return String.fromCodePoint(parseInt(name.slice(2), 16));
    if (name.startsWith('#')) return String.fromCodePoint(parseInt(name.slice(1), 10));
    return ENTITIES[name] ?? entity;
  });
}

function stripMarkup(text: string): string {
  return text
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<[^>]*>/g, '')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/(\*\*|__)(.+?)\1/g, '$2');
}

/** Credits and extras that catalogs append after the synopsis itself. */
function dropTrailers(text: string): string {
  const [body = ''] = text.split(/\n\s*-{3,}/);
  return body.replace(/\s*\((?:Source|Fonte):[^)]*\)\s*$/i, '');
}

/** Cuts at the last full sentence that fits, so the text never stops mid-word. */
export function fitToLimit(text: string, limit: number = BOOK_LIMITS.synopsis): string {
  if (text.length <= limit) return text;
  const room = text.slice(0, limit - 1);
  const lastStop = Math.max(room.lastIndexOf('. '), room.lastIndexOf('.\n'));
  return lastStop > limit / 2 ? room.slice(0, lastStop + 1) : `${room.trimEnd()}…`;
}

export function toPlainText(raw: string): string {
  const text = dropTrailers(decodeEntities(stripMarkup(raw)))
    .replace(/[ \t]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  return fitToLimit(text);
}
