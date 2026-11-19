import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { ClubPhotos } from './ClubPhotos';
import { describePhoto, photosFrom } from './photos';

describe('ClubPhotos', () => {
  it('renders nothing without photos', () => {
    const { container } = render(<ClubPhotos photos={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('shows each photo, lazily, out of the tab order', () => {
    const photos = photosFrom({
      '../../assets/photos/IMG_2034.jpg': '/fotos/b.jpg',
      '../../assets/photos/encontro-de-marco.jpg': '/fotos/a.jpg',
    });
    render(<ClubPhotos photos={photos} />);

    const strip = screen.getByRole('list', { name: 'Fotos do clube' });
    const images = screen.getAllByRole('img');
    expect(strip).toContainElement(images[0] ?? null);
    expect(images.map((image) => image.getAttribute('alt'))).toEqual([
      'Foto do clube: encontro de marco',
      'Foto do clube',
    ]);
    for (const image of images) {
      expect(image).toHaveAttribute('loading', 'lazy');
      expect(image).not.toHaveAttribute('tabindex');
    }
  });
});

describe('describePhoto', () => {
  it('reads the file name, and nothing from camera names', () => {
    expect(describePhoto('x/aniversario_do_clube.webp')).toBe(
      'Foto do clube: aniversario do clube',
    );
    expect(describePhoto('x/PXL_20250301_1234.jpg')).toBe('Foto do clube');
    expect(describePhoto('x/DSC 0042.JPG')).toBe('Foto do clube');
  });
});
