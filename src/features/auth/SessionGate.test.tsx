import { screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { createDemoBackend } from '@/services/demo';
import { renderWithSession } from '@/test/render';

import { SessionGate } from './SessionGate';

const clubContent = <p>Área dos membros</p>;

describe('SessionGate', () => {
  it('asks signed-out visitors to sign in', async () => {
    renderWithSession(<SessionGate>{clubContent}</SessionGate>);
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Clube de Teste' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Entrar com Google' })).toBeInTheDocument();
    expect(screen.queryByText('Área dos membros')).not.toBeInTheDocument();
  });

  it('opens the club after signing in with Google', async () => {
    const { user } = renderWithSession(<SessionGate>{clubContent}</SessionGate>);
    await user.click(await screen.findByRole('button', { name: 'Entrar com Google' }));
    expect(await screen.findByText('Área dos membros')).toBeInTheDocument();
  });

  it('keeps out emails that are not on the list, and lets them switch account', async () => {
    const backend = createDemoBackend();
    backend.auth.signInAs('visitante');
    const { user } = renderWithSession(<SessionGate>{clubContent}</SessionGate>, { backend });

    expect(
      await screen.findByRole('heading', { name: 'Este email não está na lista do clube' }),
    ).toBeInTheDocument();
    expect(screen.getByText('visitante@example.com')).toBeInTheDocument();
    expect(screen.queryByText('Área dos membros')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Entrar com outra conta' }));
    expect(await screen.findByRole('button', { name: 'Entrar com Google' })).toBeInTheDocument();
  });

  it('asks for the email when a sign-in link is opened on another device', async () => {
    const backend = createDemoBackend();
    const completeLink = vi.fn((email?: string) => {
      if (!email) return Promise.resolve('needs-email' as const);
      backend.auth.signInAs('rafa');
      return Promise.resolve('signed-in' as const);
    });
    backend.auth.completeSignInLink = completeLink;
    const { user } = renderWithSession(<SessionGate>{clubContent}</SessionGate>, { backend });

    await user.type(await screen.findByLabelText('Email'), 'Rafa@Example.com');
    await user.click(screen.getByRole('button', { name: 'Entrar' }));

    expect(await screen.findByText('Área dos membros')).toBeInTheDocument();
    expect(completeLink).toHaveBeenLastCalledWith('rafa@example.com');
  });
});
