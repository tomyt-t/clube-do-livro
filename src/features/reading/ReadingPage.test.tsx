import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { createDemoBackend, createDemoState } from '@/services/demo';
import { openNominations } from '@/services/election';
import { MEMBERS, answerAs, emptyClub, settle, soloRound, voteAs } from '@/test/backend';
import { makeBook } from '@/test/factories';
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

    expect(screen.getByText(/Sete gerações da família Buendía/)).toBeInTheDocument();
    const link = screen.getByRole('link', { name: /Abrir o link/ });
    expect(link).toHaveAttribute('href', expect.stringContaining('pt.wikipedia.org'));
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('folds a long synopsis and credits where it came from', async () => {
    const backend = emptyClub();
    const synopsis = `${'Uma frase da sinopse. '.repeat(30)}Fim.`;
    await soloRound(backend, makeBook({ synopsis, synopsisSource: 'wikipedia' }));

    const { user } = renderAsMember(<ReadingPage />, 'marina', { backend });
    const more = await screen.findByRole('button', { name: 'Ler mais' });
    expect(more).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByText('Sinopse: Wikipédia.')).toBeInTheDocument();

    await user.click(more);
    expect(screen.getByRole('button', { name: 'Mostrar menos' })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
  });

  it('offers the link as a button when there is no synopsis text', async () => {
    const backend = emptyClub();
    await soloRound(backend, makeBook({ synopsis: null }));

    renderAsMember(<ReadingPage />, 'marina', { backend });
    expect(await screen.findByRole('link', { name: /Ler sinopse/ })).toHaveAttribute(
      'href',
      'https://example.com/torto-arado',
    );
  });

  it('invites members to nominate while nominations are open', async () => {
    renderAsMember(<ReadingPage />);
    const next = await nextSection();

    expect(next.getByText('Indicações abertas')).toBeInTheDocument();
    expect(await next.findByText(/3 de 6 responderam\./)).toBeInTheDocument();
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
    for (const uid of ['marina', 'teo', 'bruno', 'lia'])
      await answerAs(backend, cycleId, uid, null);
    await settle(backend);
    await voteAs(backend, { cycleId, uid: 'lia', choices: [rafa, julia] });

    renderAsMember(<ReadingPage />, 'lia', { backend });
    const next = await nextSection();

    expect(
      await screen.findByRole('heading', { name: 'Nenhuma leitura em andamento' }),
    ).toBeInTheDocument();
    expect(next.getByText('Votação aberta')).toBeInTheDocument();
    expect(await next.findByText('1 de 6 votou. Você já votou.')).toBeInTheDocument();
  });

  it('shows the book already chosen to come next', async () => {
    const backend = emptyClub();
    await soloRound(backend, makeBook({ title: 'Livro de rafa' }));
    await soloRound(backend, makeBook({ title: 'Livro seguinte' }));

    renderAsMember(<ReadingPage />, 'marina', { backend });
    const next = await nextSection();

    expect(await screen.findByRole('heading', { name: 'Livro de rafa' })).toBeInTheDocument();
    expect(screen.getByText('sem disputa')).toBeInTheDocument();
    expect(next.getByText('Livro seguinte')).toBeInTheDocument();
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

describe('Acabei de ler!', () => {
  const readingClub = () => createDemoBackend({ state: createDemoState(new Date(), 'reading') });

  it('asks before marking, then counts the reader without naming anyone', async () => {
    const { user } = renderAsMember(<ReadingPage />, 'marina', { backend: readingClub() });

    expect(await screen.findByText('5 de 6 terminaram.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Acabei de ler!' }));
    const dialog = screen.getByRole('dialog', { name: 'Terminou a leitura?' });
    await user.click(within(dialog).getByRole('button', { name: 'Acabei de ler!' }));

    expect(await screen.findByText('Você terminou de ler.')).toBeInTheDocument();
    expect(screen.getByText('6 de 6 terminaram.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Acabei de ler!' })).not.toBeInTheDocument();
  });

  it('remembers who already finished', async () => {
    renderAsMember(<ReadingPage />, 'rafa', { backend: readingClub() });
    expect(await screen.findByText('Você terminou de ler.')).toBeInTheDocument();
  });

  it('only shows up for the book being read', async () => {
    const backend = emptyClub();
    await soloRound(backend);
    await soloRound(backend, makeBook({ title: 'Livro seguinte' }));
    renderAsMember(<ReadingPage />, 'marina', { backend });

    expect(await screen.findByRole('button', { name: 'Acabei de ler!' })).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Acabei de ler!' })).toHaveLength(1);
    expect(MEMBERS).toHaveLength(6);
  });
});

describe('ReadingPage, the link of the reading', () => {
  async function readingBy(uid: string) {
    const backend = emptyClub();
    await soloRound(backend, makeBook({ title: 'Torto Arado', synopsisUrl: null }));
    return { ...renderAsMember(<ReadingPage />, uid, { backend }), backend };
  }

  it('lets only whoever nominated the reading add or change its link', async () => {
    const { user } = await readingBy('rafa');
    await user.click(await screen.findByRole('button', { name: 'Adicionar um link' }));
    const field = screen.getByLabelText('Link da leitura');

    await user.type(field, 'pt.wikipedia.org/wiki/Torto_Arado');
    await user.click(screen.getByRole('button', { name: 'Salvar' }));
    expect(screen.getByText('Use um link completo, começando com https://.')).toBeInTheDocument();

    await user.clear(field);
    await user.type(field, 'https://pt.wikipedia.org/wiki/Torto_Arado');
    await user.click(screen.getByRole('button', { name: 'Salvar' }));
    const link = await screen.findByRole('link', { name: /pt\.wikipedia\.org/ });
    expect(link).toHaveAttribute('href', 'https://pt.wikipedia.org/wiki/Torto_Arado');
    expect(screen.getByRole('button', { name: 'Trocar o link' })).toBeInTheDocument();
  });

  it('shows nothing to edit to anyone else', async () => {
    await readingBy('lia');
    expect(
      await screen.findByRole('heading', { level: 2, name: 'Torto Arado' }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /link/ })).not.toBeInTheDocument();
  });
});
