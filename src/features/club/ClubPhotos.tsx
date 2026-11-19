import { cx } from '@/ui/cx';

import styles from './ClubPhotos.module.css';
import { CLUB_PHOTOS, type ClubPhoto } from './photos';

interface ClubPhotosProps {
  /** Defaults to the photos in `src/assets/photos/`. */
  photos?: readonly ClubPhoto[];
  className?: string;
}

/**
 * The club's photos as a quiet strip, toned in the site's two colors so
 * they sit with the page instead of competing with it. Nothing without photos.
 */
export function ClubPhotos({ photos = CLUB_PHOTOS, className }: ClubPhotosProps) {
  if (photos.length === 0) return null;
  return (
    <ul className={cx(styles.strip, className)} aria-label="Fotos do clube">
      {photos.map((photo) => (
        <li key={photo.src} className={styles.photo}>
          <img src={photo.src} alt={photo.alt} loading="lazy" decoding="async" />
        </li>
      ))}
    </ul>
  );
}
