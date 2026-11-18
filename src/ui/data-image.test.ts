import { describe, expect, it } from 'vitest';

import { dataImageSize, isSafeDataImage } from './data-image';

const toDataUrl = (type: string, bytes: number[]) =>
  `data:image/${type};base64,${btoa(String.fromCharCode(...bytes))}`;

const be32 = (n: number) => [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255];

function png(width: number, height: number) {
  const ihdr = [
    ...be32(13),
    0x49,
    0x48,
    0x44,
    0x52,
    ...be32(width),
    ...be32(height),
    8,
    2,
    0,
    0,
    0,
  ];
  return toDataUrl('png', [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, ...ihdr]);
}

function jpeg(width: number, height: number) {
  const app0 = [0xff, 0xe0, 0, 16, ...Array<number>(14).fill(0)];
  const sof0 = [0xff, 0xc0, 0, 17, 8, height >> 8, height & 255, width >> 8, width & 255, 3];
  return toDataUrl('jpeg', [0xff, 0xd8, ...app0, ...sof0, ...Array<number>(12).fill(0)]);
}

function webpVp8x(width: number, height: number) {
  const le24 = (n: number) => [n & 255, (n >> 8) & 255, (n >> 16) & 255];
  const head = Array.from('RIFF', (c) => c.charCodeAt(0));
  const kind = Array.from('WEBPVP8X', (c) => c.charCodeAt(0));
  return toDataUrl('webp', [
    ...head,
    0,
    0,
    0,
    0,
    ...kind,
    10,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    ...le24(width - 1),
    ...le24(height - 1),
  ]);
}

describe('dataImageSize', () => {
  it('reads PNG, JPEG and WebP headers without decoding the image', () => {
    expect(dataImageSize(png(600, 900))).toEqual({ width: 600, height: 900 });
    expect(dataImageSize(jpeg(640, 960))).toEqual({ width: 640, height: 960 });
    expect(dataImageSize(webpVp8x(500, 750))).toEqual({ width: 500, height: 750 });
  });

  it('gives up on anything else', () => {
    expect(dataImageSize('data:image/png;base64,!!!')).toBeNull();
    expect(dataImageSize(toDataUrl('png', [1, 2, 3]))).toBeNull();
    expect(dataImageSize('https://example.com/capa.jpg')).toBeNull();
  });
});

describe('isSafeDataImage', () => {
  it('lets a normal cover through and stops a decompression bomb', () => {
    expect(isSafeDataImage(jpeg(600, 900))).toBe(true);
    expect(isSafeDataImage(png(30000, 30000))).toBe(false);
    expect(isSafeDataImage(webpVp8x(16000, 16000))).toBe(false);
    expect(isSafeDataImage(toDataUrl('png', [1, 2, 3]))).toBe(false);
  });
});
