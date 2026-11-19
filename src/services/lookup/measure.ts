import type { MeasureImage } from './types';

/** Longest wait for one image; a slow catalog's cover is simply left out. */
const MEASURE_TIMEOUT_MS = 8000;

/**
 * An image's natural size, as the browser loads it (no CORS needed), or
 * null when it fails or takes too long. Catalog placeholders and broken
 * links are told apart by this size.
 */
export const measureInBrowser: MeasureImage = (url) =>
  new Promise((resolve) => {
    const image = new Image();
    const finish = (size: { width: number; height: number } | null) => {
      clearTimeout(timer);
      image.onload = null;
      image.onerror = null;
      resolve(size);
    };
    const timer = setTimeout(() => {
      finish(null);
    }, MEASURE_TIMEOUT_MS);
    image.referrerPolicy = 'no-referrer';
    image.onload = () => {
      const { naturalWidth: width, naturalHeight: height } = image;
      finish(width > 0 ? { width, height } : null);
    };
    image.onerror = () => {
      finish(null);
    };
    image.src = url;
  });
