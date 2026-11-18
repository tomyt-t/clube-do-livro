import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { renderAsMember } from '@/test/render';

import { AppRoutes } from './AppRoutes';
import { AppShell } from './AppShell';

function renderShell(route = '/') {
  return renderAsMember(
    <AppShell clubName="Clube de Teste" account={<button type="button">Conta</button>}>
      <AppRoutes />
    </AppShell>,
    'marina',
    { route },
  );
}

describe('AppShell', () => {
  it('shows the club name, the three sections and the account slot', async () => {
    renderShell();
    expect(await screen.findByRole('link', { name: 'Clube de Teste' })).toBeInTheDocument();
    const nav = screen.getByRole('navigation', { name: 'Principal' });
    expect(
      within(nav)
        .getAllByRole('link')
        .map((link) => link.textContent),
    ).toEqual(['Lendo', 'Votação', 'Histórico']);
    expect(screen.getByRole('button', { name: 'Conta' })).toBeInTheDocument();
  });

  it('marks the current section and moves between sections', async () => {
    const { user } = renderShell();
    expect(await screen.findByRole('link', { name: 'Lendo' })).toHaveAttribute(
      'aria-current',
      'page',
    );

    await user.click(screen.getByRole('link', { name: 'Votação' }));

    expect(await screen.findByRole('heading', { name: 'Votação', level: 1 })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Votação' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Lendo' })).not.toHaveAttribute('aria-current');
  });

  it('sends unknown addresses to the current reading', async () => {
    renderShell('/nao-existe');
    expect(await screen.findByRole('heading', { name: 'Cem Anos de Solidão' })).toBeInTheDocument();
  });
});
