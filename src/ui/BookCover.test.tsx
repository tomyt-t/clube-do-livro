import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { makeBook } from '@/test/factories';

import { BookCover } from './BookCover';

describe('BookCover', () => {
  it('sets the title on cloth when there is no image', () => {
    const { container } = render(<BookCover book={makeBook({ coverUrl: null })} />);
    expect(screen.getByText('Torto Arado')).toBeInTheDocument();
    expect(container.querySelector('img')).toBeNull();
  });

  it('keeps the title underneath and drops an image that fails to load', () => {
    const { container } = render(<BookCover book={makeBook()} />);
    const image = container.querySelector('img');
    expect(image).toHaveAttribute('referrerpolicy', 'no-referrer');
    expect(screen.getByText('Torto Arado')).toBeInTheDocument();

    if (image) fireEvent.error(image);
    expect(container.querySelector('img')).toBeNull();
  });

  it('is hidden from assistive tech, since the title is written next to it', () => {
    const { container } = render(<BookCover book={makeBook()} />);
    expect(container.firstChild).toHaveAttribute('aria-hidden', 'true');
  });
});
