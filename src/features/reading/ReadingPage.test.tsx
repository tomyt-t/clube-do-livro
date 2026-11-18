import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { Cycle } from '@/domain/types';
import { openNominations, startVoting } from '@/services/election';
import { answerAs, electionContext, emptyClub, firstValue, voteAs } from '@/test/backend';
import { renderAsMember } from '@/test/render';

import { ReadingPage } from './ReadingPage';

async function nextSection() {
  const heading = await screen.findByRole('heading', { name: 'Próxima leitura' });
  const section = heading.closest('section');
  if (!section) throw new Error('Próxima leitura sem seção');
  return within(section);
}

describe('ReadingPage', () => {
  it('shows the book being read and how the club chose it', async () => {
    renderAsMember(<ReadingPage />);

    expect(
      await screen.findByRole('heading', { level: 2, name: 'Cem Anos de Solidão' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Gabriel García Márquez')).toBeInTheDocument();
    expect(screen.getByText('Leitura nº 3')).toBeInTheDocument();
    expect(screen.getByText('no sorteio')).toBeInTheDocument();
    expect(screen.getByText('3 leituras')).toBeInTheDocument();

    const synopsis = screen.getByRole('link', { name: /Ler sinopse/ });
    expect(synopsis).toHaveAttribute('href', expect.stringContaining('pt.wikipedia.org'));
    expect(synopsis).toHaveAttribute('target', '_blank');
    expect(synopsis).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('invites members to nominate while nominations are open', async () => {
    renderAsMember(<ReadingPage />);
    const next = await nextSection();

    expect(next.getByText('Indicações abertas')).toBeInTheDocument();
    expect(next.getByText(/3 pessoas responderam\./)).toBeInTheDocument();
    expect(await next.findByRole('link', { name: 'Indicar' })).toHaveAttribute('href', '/votacao');
  });

  it('tells members who already answered, without asking again', async () => {
    renderAsMember(<ReadingPage />, 'rafa');
    const next = await nextSection();

    expect(await next.findByText(/Você já respondeu\./)).toBeInTheDocument();
    expect(next.getByRole('link', { name: 'Acompanhar' })).toBeInTheDocument();
    expect(next.queryByRole('link', { name: 'Indicar' })).not.toBeInTheDocument();
  });

  it('points to the vote and remembers who voted', async () => {
    const backend = emptyClub();
    const cycleId = await openNominations(backend.admin, [], null);
    const rafa = `${await answerAs(backend, cycleId, 'rafa')}`;
    const julia = `${await answerAs(backend, cycleId, 'julia')}`;
    await startVoting(backend.admin, await electionContext(backend, cycleId), null);
    await voteAs(backend, { cycleId, uid: 'lia', choices: [rafa, julia] });

    renderAsMember(<ReadingPage />, 'lia', { backend });
    const next = await nextSection();

    expect(
      await screen.findByRole('heading', { name: 'Nenhuma leitura em andamento' }),
    ).toBeInTheDocument();
    expect(next.getByText('Votação aberta')).toBeInTheDocument();
    expect(await next.findByText('1 pessoa votou. Você já votou.')).toBeInTheDocument();
  });

  it('shows the book already chosen to come next', async () => {
    const backend = emptyClub();
    const first = await openNominations(backend.admin, [], null);
    await answerAs(backend, first, 'rafa');
    await startVoting(backend.admin, await electionContext(backend, first), null);
    const cycles = await firstValue<Cycle[]>((s) => backend.club.watchCycles(s));
    const second = await openNominations(backend.admin, cycles, null);
    await answerAs(backend, second, 'julia');
    await startVoting(backend.admin, await electionContext(backend, second), null);

    renderAsMember(<ReadingPage />, 'marina', { backend });
    const next = await nextSection();

    expect(await screen.findByRole('heading', { name: 'Livro de rafa' })).toBeInTheDocument();
    expect(screen.getByText('sem disputa')).toBeInTheDocument();
    expect(next.getByText('Livro de julia')).toBeInTheDocument();
    expect(next.getByText(/Começa quando a leitura atual terminar/)).toBeInTheDocument();
  });

  it('says plainly when nothing is going on', async () => {
    renderAsMember(<ReadingPage />, 'marina', { backend: emptyClub() });

    expect(
      await screen.findByRole('heading', { name: 'Nenhuma leitura em andamento' }),
    ).toBeInTheDocument();
    expect((await nextSection()).getByText('Nenhuma votação aberta')).toBeInTheDocument();
  });
});
