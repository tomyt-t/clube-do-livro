import { BOOK_LIMITS } from '@/domain/book';

/**
 * Uploaded covers are stored in Firestore as small JPEG data URLs (Firebase
 * Storage needs a paid plan). The photo is shrunk in the browser first.
 */

export const COVER_BOX = { width: 600, height: 900 } as const;

const ACCEPTED = /^image\/(?:jpeg|png|webp)$/;

/** Every size and quality to try, best first. */
const ATTEMPTS = [1, 0.75, 0.5].flatMap((scale) =>
  [0.85, 0.7, 0.55].map((quality) => ({ scale, quality })),
);

export class CoverImageError extends Error {
  constructor() {
    super('Não deu para usar essa imagem. Tente uma foto em JPG, PNG ou WebP.');
    this.name = 'CoverImageError';
  }
}

interface Size {
  width: number;
  height: number;
}

/** Fits a size inside the cover box, never enlarging it. */
export function fitInside(size: Size, box: Size = COVER_BOX): Size {
  const scale = Math.min(1, box.width / size.width, box.height / size.height);
  return {
    width: Math.max(1, Math.round(size.width * scale)),
    height: Math.max(1, Math.round(size.height * scale)),
  };
}

/** The first encoding that fits the stored limit, or null if none does. */
export function encodeUnderLimit(
  encode: (scale: number, quality: number) => string,
  limit: number = BOOK_LIMITS.uploadedCover,
): string | null {
  for (const { scale, quality } of ATTEMPTS) {
    const url = encode(scale, quality);
    if (url.length <= limit) return url;
  }
  return null;
}

function drawer(bitmap: ImageBitmap) {
  const size = fitInside(bitmap);
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  if (!context) throw new CoverImageError();

  return (scale: number, quality: number) => {
    canvas.width = Math.max(1, Math.round(size.width * scale));
    canvas.height = Math.max(1, Math.round(size.height * scale));
    // JPEG has no transparency: a transparent PNG would turn black.
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', quality);
  };
}

export async function resizeCover(file: Blob): Promise<string> {
  if (!ACCEPTED.test(file.type)) throw new CoverImageError();
  const bitmap = await createImageBitmap(file).catch(() => {
    throw new CoverImageError();
  });
  try {
    const url = encodeUnderLimit(drawer(bitmap));
    if (!url) throw new CoverImageError();
    return url;
  } finally {
    bitmap.close();
  }
}
