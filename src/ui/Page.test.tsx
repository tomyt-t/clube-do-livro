import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Page } from './Page';

describe('Page', () => {
  it('has one level-one title and its content', () => {
    render(<Page title="Votação">conteúdo</Page>);
    expect(screen.getByRole('heading', { level: 1, name: 'Votação' })).toBeInTheDocument();
    expect(screen.getByText('conteúdo')).toBeInTheDocument();
  });

  it('keeps the background art out of the accessibility tree', () => {
    const { container } = render(<Page title="Votação">conteúdo</Page>);
    const art = container.querySelector('img');
    expect(art).toHaveAttribute('alt', '');
    expect(art).toHaveAttribute('aria-hidden', 'true');
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it('can leave the art out', () => {
    const { container } = render(
      <Page title="Entrar" art={false}>
        conteúdo
      </Page>,
    );
    expect(container.querySelector('img')).toBeNull();
  });

  it('can hide the title visually while keeping it for screen readers', () => {
    render(
      <Page title="Lendo agora" hideTitle>
        conteúdo
      </Page>,
    );
    expect(screen.getByRole('heading', { level: 1, name: 'Lendo agora' })).toBeInTheDocument();
  });
});
