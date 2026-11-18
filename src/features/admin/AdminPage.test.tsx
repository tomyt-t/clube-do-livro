import { screen, within } from '@testing-library/react';
import { Route, Routes } from 'react-router';
import { describe, expect, it } from 'vitest';

import type { ClubSettings } from '@/domain/types';
import { createDemoBackend, createDemoState, type DemoScenario } from '@/services/demo';
import { emptyClub, firstValue } from '@/test/backend';
import { renderAsMember } from '@/test/render';

import { AdminPage } from './AdminPage';

function renderAdmin(scenario: DemoScenario = 'nominating', uid = 'marina') {
  const backend = createDemoBackend({ state: createDemoState(new Date(), scenario) });
  return { ...renderAsMember(<AdminPage />, uid, { backend }), backend };
}

async function confirm(user: ReturnType<typeof renderAdmin>['user'], title: string, label: string) {
  const dialog = screen.getByRole('dialog', { name: title });
  await user.click(within(dialog).getByRole('button', { name: label }));
}

const memberCount = async (backend: ReturnType<typeof createDemoBackend>) =>
  (await firstValue<ClubSettings>((s) => backend.club.watchSettings(s))).members;

describe('AdminPage, access', () => {
  it('sends members who do not organize back to the club', async () => {
    renderAsMember(
      <Routes>
        <Route path="/organizar" element={<AdminPage />} />
        <Route path="/" element={<p>Início do clube</p>} />
      </Routes>,
      'rafa',
      { route: '/organizar' },
    );
    expect(await screen.findByText('Início do clube')).toBeInTheDocument();
  });
});

describe('AdminPage, members', () => {
  it('lists the emails, marking the organizer and you', async () => {
    renderAdmin();

    expect(await screen.findByText('6 pessoas no clube')).toBeInTheDocument();
    const own = screen.getByText('marina@example.com').closest('li');
    expect(own).toHaveTextContent('organiza');
    expect(own).toHaveTextContent('você');
    expect(
      screen.queryByRole('button', { name: 'Remover marina@example.com' }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Remover rafa@example.com' })).toBeInTheDocument();
  });

  it('adds pasted emails and keeps "everyone" in step', async () => {
    const { user, backend } = renderAdmin();
    const field = await screen.findByLabelText('Adicionar emails');
    await user.type(field, 'Nova Pessoa <nova@example.com>, rafa@example.com');
    await user.click(screen.getByRole('button', { name: 'Adicionar' }));

    expect(await screen.findByText('1 email adicionado.')).toBeInTheDocument();
    expect(screen.getByText('nova@example.com')).toBeInTheDocument();
    expect(await screen.findByText('7 pessoas no clube')).toBeInTheDocument();
    await expect.poll(() => memberCount(backend)).toBe(7);
  });

  it('says what is wrong with a paste', async () => {
    const { user } = renderAdmin();
    const field = await screen.findByLabelText('Adicionar emails');

    await user.type(field, 'fulano@');
    await user.click(screen.getByRole('button', { name: 'Adicionar' }));
    expect(screen.getByText('Estes não parecem emails: fulano@.')).toBeInTheDocument();

    await user.clear(field);
    await user.type(field, 'rafa@example.com');
    await user.click(screen.getByRole('button', { name: 'Adicionar' }));
    expect(screen.getByText('Nenhum email novo para adicionar.')).toBeInTheDocument();
  });

  it('removes someone after confirming', async () => {
    const { user, backend } = renderAdmin();
    await user.click(await screen.findByRole('button', { name: 'Remover lia@example.com' }));
    await confirm(user, 'Remover do clube?', 'Remover');

    expect(await screen.findByText('5 pessoas no clube')).toBeInTheDocument();
    expect(screen.queryByText('lia@example.com')).not.toBeInTheDocument();
    await expect.poll(() => memberCount(backend)).toBe(5);
  });
});

describe('AdminPage, the round', () => {
  it('opens the first round', async () => {
    const { user } = renderAsMember(<AdminPage />, 'marina', { backend: emptyClub() });
    expect(await screen.findByText('Nenhuma rodada em andamento')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Abrir indicações' }));
    expect(await screen.findByText('Rodada 1: indicações abertas')).toBeInTheDocument();
  });

  it('opens the vote without waiting for everyone, after confirming', async () => {
    const { user } = renderAdmin('nominating');
    expect(await screen.findByText('Rodada 4: indicações abertas')).toBeInTheDocument();
    expect(screen.getByText(/A votação abre quando todos responderem/)).toHaveTextContent(
      '3 de 6 responderam.',
    );
    await user.click(screen.getByRole('button', { name: 'Abrir a votação agora' }));
    await confirm(user, 'Abrir a votação sem esperar todos?', 'Abrir a votação agora');
    expect(await screen.findByText('Rodada 4: votação aberta')).toBeInTheDocument();
  });

  it('closes the vote early and counts it', async () => {
    const { user } = renderAdmin('voting');
    await user.click(await screen.findByRole('button', { name: 'Encerrar a votação agora' }));
    await confirm(user, 'Encerrar a votação sem esperar todos?', 'Encerrar a votação agora');
    expect(await screen.findByText('Rodada 4: apurando')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Apurar agora' }));
    expect(await screen.findByText('Lendo: Cem Anos de Solidão')).toBeInTheDocument();
    // The queued book starts once the current one ends.
    expect(screen.getByText(/A próxima leitura, .+, começa em seguida\./)).toBeInTheDocument();
  });

  it('ends the book early and opens the next round', async () => {
    const { user } = renderAdmin('reading');
    await user.click(await screen.findByRole('button', { name: 'Encerrar a leitura agora' }));
    await confirm(user, 'Encerrar a leitura sem esperar todos?', 'Encerrar a leitura agora');
    expect(await screen.findByText('Rodada 4: indicações abertas')).toBeInTheDocument();
  });
});
