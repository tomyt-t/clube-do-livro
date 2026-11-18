/**
 * Covers members upload are stored as `data:image/...;base64` URLs. The app
 * shrinks them before sending, but anyone can write one directly, and a few
 * kilobytes of PNG can declare 30000×30000 pixels: decoding it would freeze
 * every member's tab. So a data-URL cover is shown only if its header says
 * it is a reasonable size; it is read without decoding the image.
 */

/** About 8.6 megapixels: far above any cover the app produces (~600px wide). */
export const MAX_COVER_PIXELS = 2400 * 3600;

interface Size {
  width: number;
  height: number;
}

function bytesOf(dataUrl: string): Uint8Array | null {
  const comma = dataUrl.indexOf(',');
  if (!dataUrl.startsWith('data:image/') || comma < 0) return null;
  try {
    return Uint8Array.from(atob(dataUrl.slice(comma + 1)), (char) => char.charCodeAt(0));
  } catch {
    return null;
  }
}

const u16be = (b: Uint8Array, at: number) => ((b[at] ?? 0) << 8) | (b[at + 1] ?? 0);
const u16le = (b: Uint8Array, at: number) => (b[at] ?? 0) | ((b[at + 1] ?? 0) << 8);
const u24le = (b: Uint8Array, at: number) => u16le(b, at) | ((b[at + 2] ?? 0) << 16);
const u32be = (b: Uint8Array, at: number) => u16be(b, at) * 65536 + u16be(b, at + 2);
const ascii = (b: Uint8Array, at: number, length: number) =>
  String.fromCharCode(...b.subarray(at, at + length));

function pngSize(b: Uint8Array): Size | null {
  const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (!signature.every((byte, i) => b[i] === byte) || ascii(b, 12, 4) !== 'IHDR') return null;
  return { width: u32be(b, 16), height: u32be(b, 20) };
}

/** Start-of-frame markers (baseline, progressive, lossless...) carry the size. */
const JPEG_FRAMES = new Set([
  0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf,
]);

function jpegSize(b: Uint8Array): Size | null {
  if (b[0] !== 0xff || b[1] !== 0xd8) return null;
  let at = 2;
  while (at + 9 < b.length) {
    if (b[at] !== 0xff) return null;
    const marker = b[at + 1] ?? 0;
    if (marker === 0xff) {
      at += 1;
      continue;
    }
    if (JPEG_FRAMES.has(marker)) return { width: u16be(b, at + 7), height: u16be(b, at + 5) };
    at += 2 + u16be(b, at + 2);
  }
  return null;
}

function webpSize(b: Uint8Array): Size | null {
  if (ascii(b, 0, 4) !== 'RIFF' || ascii(b, 8, 4) !== 'WEBP') return null;
  const chunk = ascii(b, 12, 4);
  if (chunk === 'VP8X') return { width: u24le(b, 24) + 1, height: u24le(b, 27) + 1 };
  if (chunk === 'VP8 ') return { width: u16le(b, 26) & 0x3fff, height: u16le(b, 28) & 0x3fff };
  if (chunk === 'VP8L') {
    const bits = u16le(b, 21) | (u16le(b, 23) << 16);
    return { width: (bits & 0x3fff) + 1, height: ((bits >>> 14) & 0x3fff) + 1 };
  }
  return null;
}

/** The image's declared size, or null if it cannot be read. */
export function dataImageSize(dataUrl: string): Size | null {
  const bytes = bytesOf(dataUrl);
  if (!bytes) return null;
  return pngSize(bytes) ?? jpegSize(bytes) ?? webpSize(bytes);
}

/** Whether an uploaded (data-URL) cover is safe to decode. */
export function isSafeDataImage(dataUrl: string): boolean {
  const size = dataImageSize(dataUrl);
  return (
    size !== null &&
    size.width > 0 &&
    size.height > 0 &&
    size.width * size.height <= MAX_COVER_PIXELS
  );
}
