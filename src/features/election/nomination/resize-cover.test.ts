import { describe, expect, it, vi } from 'vitest';

import { CoverImageError, encodeUnderLimit, fitInside, resizeCover } from './resize-cover';

describe('fitInside', () => {
  it('shrinks big photos into the cover box, keeping the proportion', () => {
    expect(fitInside({ width: 3000, height: 4000 })).toEqual({ width: 600, height: 800 });
    expect(fitInside({ width: 1200, height: 1800 })).toEqual({ width: 600, height: 900 });
  });

  it('never enlarges small images', () => {
    expect(fitInside({ width: 200, height: 300 })).toEqual({ width: 200, height: 300 });
  });
});

describe('encodeUnderLimit', () => {
  it('lowers quality, then size, until the image fits', () => {
    const encode = vi.fn((scale: number, quality: number) =>
      'x'.repeat(Math.round(1000 * scale * quality)),
    );
    // 1000 × scale × quality characters: the first under 400 is 0.5 × 0.7 = 350.
    expect(encodeUnderLimit(encode, 400)?.length).toBe(350);
    expect(encode).toHaveBeenNthCalledWith(1, 1, 0.85);
    expect(encode).toHaveBeenLastCalledWith(0.5, 0.7);
  });

  it('gives up when nothing fits', () => {
    expect(encodeUnderLimit(() => 'x'.repeat(10), 5)).toBeNull();
  });
});

describe('resizeCover', () => {
  it('refuses files that are not JPEG, PNG or WebP', async () => {
    await expect(resizeCover(new Blob(['<svg/>'], { type: 'image/svg+xml' }))).rejects.toThrow(
      CoverImageError,
    );
  });
});
