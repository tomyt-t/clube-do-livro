/**
 * The club's photos: every image dropped into `src/assets/photos/`, as
 * URLs, in name order. The repo is public, so these photos are too. With
 * the folder empty, the list is empty and nothing is shown or bundled.
 */

export interface ClubPhoto {
  src: string;
  alt: string;
}

const FILES = import.meta.glob<string>(
  '../../assets/photos/*.{jpg,jpeg,png,webp,avif,gif,JPG,JPEG,PNG,WEBP,AVIF,GIF}',
  { eager: true, query: '?url', import: 'default' },
);

/** Phone and camera names ("IMG_2034", "PXL_20250301") say nothing about the picture. */
const CAMERA_NAME = /^(img|dsc|dscn|pxl|wa|photo|foto|image|imagem)?[\s\d]*$/i;

/** "encontro-de-marco.jpg" → "Foto do clube: encontro de marco". */
export function describePhoto(path: string): string {
  const file = path.split('/').pop() ?? '';
  const words = file
    .replace(/\.[^.]+$/, '')
    .replace(/[-_.]+/g, ' ')
    .trim();
  return words === '' || CAMERA_NAME.test(words) ? 'Foto do clube' : `Foto do clube: ${words}`;
}

export function photosFrom(files: Record<string, string>): ClubPhoto[] {
  return Object.entries(files)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([path, src]) => ({ src, alt: describePhoto(path) }));
}

export const CLUB_PHOTOS: readonly ClubPhoto[] = photosFrom(FILES);
