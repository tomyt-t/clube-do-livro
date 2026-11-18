import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { Page, PageSide } from './Page';

function matchWide(wide: boolean) {
  vi.spyOn(window, 'matchMedia').mockImplementation(
    (query: string) =>
      ({
        matches: wide,
        media: query,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
      }) as unknown as MediaQueryList,
  );
}

afterEach(() => {
  vi.restoreAllMocks();
});

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

  it('can keep the title for screen readers only on phones', () => {
    render(
      <Page title="Lendo agora" titleOnPhones={false}>
        conteúdo
      </Page>,
    );
    expect(screen.getByRole('heading', { level: 1, name: 'Lendo agora' })).toBeInTheDocument();
  });

  it('leaves sidebar parts where they are written on phones', () => {
    matchWide(false);
    render(
      <Page title="Votação">
        <p>antes</p>
        <PageSide>
          <p>etapas</p>
        </PageSide>
        <p>depois</p>
      </Page>,
    );
    const order = screen.getAllByText(/antes|etapas|depois/).map((p) => p.textContent);
    expect(order).toEqual(['antes', 'etapas', 'depois']);
  });

  it('moves sidebar parts under the title on desktop, in the order they render', () => {
    matchWide(true);
    render(
      <Page title="Votação">
        <PageSide>
          <p>etapas</p>
        </PageSide>
        <p>lista</p>
        <PageSide>
          <p>resumo</p>
        </PageSide>
      </Page>,
    );
    const title = screen.getByRole('heading', { level: 1 });
    const side = title.parentElement;
    expect(side?.textContent).toContain('etapasresumo');
    expect(side?.textContent).not.toContain('lista');
  });
});
