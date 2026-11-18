import { screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { BackendError } from '@/services/backend';
import { createDemoBackend } from '@/services/demo';
import { renderWithSession } from '@/test/render';

import { SignInPage } from './SignInPage';

describe('SignInPage', () => {
  it('shows the club, the scene and both ways in', () => {
    renderWithSession(<SignInPage />);
    expect(screen.getByRole('heading', { level: 1, name: 'Clube de Teste' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: /bichos lendo/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Entrar com Google' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Enviar link de acesso' })).toBeInTheDocument();
  });

  it('rejects an invalid email before sending anything', async () => {
    const backend = createDemoBackend();
    const send = vi.spyOn(backend.auth, 'sendSignInLink');
    const { user } = renderWithSession(<SignInPage />, { backend });

    await user.type(screen.getByLabelText('Email'), 'marina');
    await user.click(screen.getByRole('button', { name: 'Enviar link de acesso' }));

    expect(screen.getByRole('alert')).toHaveTextContent('Digite um email válido');
    expect(screen.getByLabelText('Email')).toHaveAttribute('aria-invalid', 'true');
    expect(send).not.toHaveBeenCalled();
  });

  it('sends the link to the normalized address and says where it went', async () => {
    const backend = createDemoBackend();
    const send = vi.spyOn(backend.auth, 'sendSignInLink');
    const { user } = renderWithSession(<SignInPage />, { backend });

    await user.type(screen.getByLabelText('Email'), '  Marina@Example.com ');
    await user.click(screen.getByRole('button', { name: 'Enviar link de acesso' }));

    expect(await screen.findByText('marina@example.com')).toBeInTheDocument();
    expect(send).toHaveBeenCalledWith('marina@example.com');

    await user.click(screen.getByRole('button', { name: 'Usar outro email' }));
    expect(screen.getByLabelText('Email')).toBeInTheDocument();
  });

  it('explains a Google sign-in failure', async () => {
    const backend = createDemoBackend();
    vi.spyOn(backend.auth, 'signInWithGoogle').mockRejectedValue(
      new BackendError('unknown', 'O navegador bloqueou a janela de login.'),
    );
    const { user } = renderWithSession(<SignInPage />, { backend });

    await user.click(screen.getByRole('button', { name: 'Entrar com Google' }));
    expect(await screen.findByText('O navegador bloqueou a janela de login.')).toBeInTheDocument();
  });
});
