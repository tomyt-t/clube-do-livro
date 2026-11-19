import { screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { Nomination, OwnAnswer } from '@/domain/types';
import { createDemoBackend, createDemoState, type DemoScenario } from '@/services/demo';
import { lookupBook, NOTHING_FOUND, type LookupResult } from '@/services/lookup';
import { firstValue, settle } from '@/test/backend';
import { renderAsMember } from '@/test/render';

import { ElectionPage } from './ElectionPage';
import { resizeCover } from './nomination/resize-cover';

vi.mock('@/services/lookup', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  lookupBook: vi.fn(),
}));
vi.mock('./nomination/resize-cover', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  resizeCover: vi.fn(),
}));

/** What the search finds for "Berserk": two covers and two synopses to switch between. */
const FOUND: LookupResult = {
  work: { title: 'Berserk', authors: ['Kentaro Miura'], details: 'Panini, 2005' },
  covers: [
    {
      url: 'https://s4.anilist.co/berserk.jpg',
      sourceUrl: 'https://anilist.co/manga/30002',
      source: 'anilist',
      label: 'AniList · 1989',
    },
    {
      url: 'https://covers.openlibrary.org/b/id/2-L.jpg',
      sourceUrl: 'https://openlibrary.org/works/OL2W',
      source: 'open-library',
      label: 'Open Library · Panini, 2005',
    },
  ],
  synopses: [
    {
      text: 'Guts é um guerreiro errante.',
      sourceUrl: 'https://pt.wikipedia.org/wiki/Berserk_(mang%C3%A1)',
      source: 'wikipedia',
      label: 'Wikipédia · início do enredo',
    },
    {
      text: 'Um mercenário enfrenta demônios.',
      sourceUrl: 'https://books.google.com/books?id=1',
      source: 'google-books',
      label: 'Google Livros · Panini',
    },
  ],
  others: [],
};

beforeEach(() => {
  vi.mocked(lookupBook).mockResolvedValue(FOUND);
});

function renderElection(uid = 'marina', scenario: DemoScenario = 'nominating') {
  const backend = createDemoBackend({ state: createDemoState(new Date(), scenario) });
  return { ...renderAsMember(<ElectionPage />, uid, { backend }), backend };
}

/** The book the member sent, read back the way the app may: their own nomination only. */
async function sentBook(backend: ReturnType<typeof createDemoBackend>, uid = 'marina') {
  const answer = await firstValue<OwnAnswer | null>((s) =>
    backend.club.watchOwnAnswer('ciclo-4', uid, s),
  );
  const id = answer?.kind === 'nominated' ? answer.nominationId : 'nenhuma';
  const nomination = await firstValue<Nomination | null>((s) =>
    backend.club.watchOwnNomination('ciclo-4', id, s),
  );
  return nomination?.book;
}

/** The rows of the nominations list, in the order shown, once they arrive. */
async function nominationRows() {
  const list = await screen.findByRole('region', { name: 'Indicações até agora' });
  return within(list).findAllByRole('listitem');
}

/** A whole row: the title also sits, hidden, on covers drawn without an image. */
async function rowOf(title: string) {
  const row = (await nominationRows()).find((item) => item.textContent.includes(title));
  if (!row) throw new Error(`Sem indicação "${title}"`);
  return row;
}

async function fillDetails(
  user: ReturnType<typeof renderElection>['user'],
  title: string,
  author = '',
) {
  await user.click(await screen.findByRole('button', { name: 'Indicar uma leitura' }));
  await user.type(screen.getByLabelText('Título'), title);
  if (author) await user.type(screen.getByLabelText('Autor (opcional)'), author);
  await user.click(screen.getByRole('button', { name: 'Continuar' }));
}

async function confirmSending(user: ReturnType<typeof renderElection>['user']) {
  await user.click(await screen.findByRole('button', { name: 'Enviar indicação' }));
  const dialog = screen.getByRole('dialog', { name: 'Enviar esta indicação?' });
  await user.click(within(dialog).getByRole('button', { name: 'Enviar indicação' }));
  expect(await screen.findByText('Sua indicação foi registrada.')).toBeInTheDocument();
}

describe('ElectionPage, nominations', () => {
  it('shows where the cycle is and how many nominated, keeping the books hidden', async () => {
    renderElection();

    const steps = await screen.findByRole('list', { name: 'Etapas da votação' });
    expect(within(steps).getByText('Indicações')).toHaveAttribute('aria-current', 'step');
    const list = await screen.findByRole('region', { name: 'Indicações até agora' });
    expect(list).toHaveTextContent('2 leituras');
    expect(list).toHaveTextContent(
      'Elas ficam escondidas. A lista completa aparece quando todos responderem.',
    );
    expect(within(list).queryByRole('listitem')).not.toBeInTheDocument();
    expect(screen.queryByText(/Ensaio sobre a Cegueira/)).not.toBeInTheDocument();
  });

  it('takes a title someone already nominated: the check after the call sorts it out', async () => {
    const { user } = renderElection();
    await fillDetails(user, 'ensaio sobre a cegueira', 'JOSÉ SARAMAGO');

    await waitFor(() => {
      expect(lookupBook).toHaveBeenCalledWith(
        'ensaio sobre a cegueira, JOSÉ SARAMAGO',
        expect.anything(),
      );
    });
    expect(screen.queryByText(/Já indicaram/)).not.toBeInTheDocument();
  });

  it('asks before passing, and passing is final', async () => {
    const { user } = renderElection();
    await user.click(await screen.findByRole('button', { name: 'Não quero indicar' }));

    const dialog = screen.getByRole('dialog', { name: 'Não indicar nesta rodada?' });
    await user.click(within(dialog).getByRole('button', { name: 'Não indicar' }));

    expect(await screen.findByText('Você não indicou nesta rodada.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Indicar uma leitura' })).not.toBeInTheDocument();
  });

  it('asks for the title before searching anything', async () => {
    const { user } = renderElection();
    await user.click(await screen.findByRole('button', { name: 'Indicar uma leitura' }));
    await user.type(screen.getByLabelText('Autor (opcional)'), 'Kentaro Miura');
    await user.click(screen.getByRole('button', { name: 'Continuar' }));

    expect(screen.getByText('Escreva o título da leitura.')).toBeInTheDocument();
    expect(lookupBook).not.toHaveBeenCalled();
  });

  it('nominates with what was found, switching sources, each with the page it came from', async () => {
    const { user, backend } = renderElection();
    await fillDetails(user, 'Berserk', 'Kentaro Miura');

    expect(await screen.findByText(/Encontramos:/)).toHaveTextContent(
      'Encontramos: Berserk, de Kentaro Miura (Panini, 2005).',
    );
    expect(screen.getByRole('radio', { name: 'AniList · 1989' })).toBeChecked();
    expect(screen.getByText('Guts é um guerreiro errante.')).toBeInTheDocument();

    await user.click(screen.getByRole('radio', { name: 'Open Library · Panini, 2005' }));
    await user.click(screen.getByRole('radio', { name: 'Google Livros · Panini' }));
    expect(screen.getByText('Um mercenário enfrenta demônios.')).toBeInTheDocument();
    expect(screen.queryByText('Guts é um guerreiro errante.')).not.toBeInTheDocument();
    await confirmSending(user);

    expect(await rowOf('Berserk')).toHaveTextContent('Sua indicação');
    expect(await sentBook(backend)).toEqual({
      title: 'Berserk, Kentaro Miura',
      synopsis: 'Um mercenário enfrenta demônios.',
      synopsisSource: 'google-books',
      synopsisUrl: 'https://books.google.com/books?id=1',
      coverUrl: 'https://covers.openlibrary.org/b/id/2-L.jpg',
      coverSourceUrl: 'https://openlibrary.org/works/OL2W',
    });
  });

  it('edits a synopsis found, keeping its source without asking for it', async () => {
    const { user, backend } = renderElection();
    await fillDetails(user, 'Berserk');

    await user.click(await screen.findByRole('button', { name: 'Editar este texto' }));
    const text = screen.getByRole('textbox', { name: 'Sinopse' });
    await user.clear(text);
    await user.type(text, 'Um espadachim contra o destino.');
    expect(screen.queryByLabelText(/Link de onde veio/)).not.toBeInTheDocument();
    await confirmSending(user);

    expect(await sentBook(backend)).toMatchObject({
      synopsis: 'Um espadachim contra o destino.',
      synopsisSource: 'wikipedia',
      synopsisUrl: 'https://pt.wikipedia.org/wiki/Berserk_(mang%C3%A1)',
    });
  });

  it('sends a pasted synopsis without a source when the catalogs find none', async () => {
    vi.mocked(lookupBook).mockResolvedValue(NOTHING_FOUND);
    const { user, backend } = renderElection();
    await fillDetails(user, 'Zine do bairro');

    expect(await screen.findByText(/Não encontramos uma sinopse/)).toBeInTheDocument();
    expect(screen.queryByRole('radio', { name: 'Sem sinopse' })).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Link de onde veio/)).not.toBeInTheDocument();
    await user.type(screen.getByRole('textbox', { name: 'Sinopse' }), 'Histórias da rua de cima.');
    await confirmSending(user);

    expect(await sentBook(backend)).toMatchObject({
      synopsis: 'Histórias da rua de cima.',
      synopsisSource: null,
      synopsisUrl: null,
    });
  });

  it('pastes another synopsis over the ones found', async () => {
    const { user, backend } = renderElection();
    await fillDetails(user, 'Berserk');

    await user.click(await screen.findByRole('radio', { name: 'Colar outra' }));
    await user.type(screen.getByRole('textbox', { name: 'Sinopse' }), 'Da contracapa.');
    await user.click(screen.getByRole('radio', { name: 'Google Livros · Panini' }));
    await user.click(screen.getByRole('radio', { name: 'Colar outra' }));
    expect(screen.getByRole('textbox', { name: 'Sinopse' })).toHaveValue('Da contracapa.');
    await confirmSending(user);

    expect(await sentBook(backend)).toMatchObject({
      synopsis: 'Da contracapa.',
      synopsisSource: null,
      synopsisUrl: null,
    });
  });

  it('goes on without a cover or synopsis when the catalogs find nothing', async () => {
    vi.mocked(lookupBook).mockResolvedValue(NOTHING_FOUND);
    const { user, backend } = renderElection();
    await fillDetails(user, 'Zine do bairro');

    expect(
      await screen.findByText('Nenhuma capa encontrada. Envie uma imagem ou siga sem capa.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Sem capa' })).toBeChecked();
    expect(screen.getByRole('textbox', { name: 'Sinopse' })).toHaveValue('');
    await confirmSending(user);

    expect(await sentBook(backend)).toMatchObject({
      title: 'Zine do bairro',
      coverUrl: null,
      coverSourceUrl: null,
      synopsis: null,
      synopsisSource: null,
    });
  });

  it('uses an image the member uploads, with the page it came from', async () => {
    vi.mocked(resizeCover).mockResolvedValue('data:image/jpeg;base64,AAAA');
    const { user, backend } = renderElection();
    await fillDetails(user, 'Berserk');

    const photo = new File(['capa'], 'capa.jpg', { type: 'image/jpeg' });
    await user.upload(await screen.findByLabelText(/Enviar imagem/), photo);
    expect(await screen.findByRole('radio', { name: 'Sua imagem' })).toBeChecked();
    await user.click(screen.getByRole('button', { name: 'Enviar indicação' }));
    expect(screen.getByText('Cole o link da página de onde veio a imagem.')).toBeInTheDocument();

    await user.type(
      screen.getByLabelText('Link da página de onde veio a imagem'),
      'https://loja.com/berserk',
    );
    await confirmSending(user);
    expect(await sentBook(backend)).toMatchObject({
      coverUrl: 'data:image/jpeg;base64,AAAA',
      coverSourceUrl: 'https://loja.com/berserk',
    });
  });

  it('goes back from the review to change the reading, with what was typed', async () => {
    const { user } = renderElection();
    await fillDetails(user, 'Berserk', 'Kentaro Miura');
    await user.click(await screen.findByRole('radio', { name: 'Google Livros · Panini' }));

    await user.click(screen.getByRole('button', { name: 'Voltar e trocar o livro' }));
    expect(screen.getByLabelText('Título')).toHaveValue('Berserk');
    expect(screen.getByLabelText('Autor (opcional)')).toHaveValue('Kentaro Miura');

    // Another reading: the picks made for the last one start over.
    await user.type(screen.getByLabelText('Título'), ' Deluxe');
    await user.click(screen.getByRole('button', { name: 'Continuar' }));
    expect(
      await screen.findByRole('radio', { name: 'Wikipédia · início do enredo' }),
    ).toBeChecked();
  });

  it('keeps the nomination in progress while the member visits another tab', async () => {
    const { user, backend, unmount } = renderElection();
    await fillDetails(user, 'Berserk', 'Kentaro Miura');
    await user.click(await screen.findByRole('radio', { name: 'Google Livros · Panini' }));
    await user.click(screen.getByRole('radio', { name: 'Open Library · Panini, 2005' }));

    unmount();
    // The search runs again on return, with new copies of what it finds.
    vi.mocked(lookupBook).mockResolvedValue(structuredClone(FOUND));
    renderAsMember(<ElectionPage />, 'marina', { backend });

    expect(await screen.findByRole('radio', { name: 'Google Livros · Panini' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'Open Library · Panini, 2005' })).toBeChecked();
    await confirmSending(user);

    expect(await sentBook(backend)).toMatchObject({
      synopsisUrl: 'https://books.google.com/books?id=1',
      coverUrl: 'https://covers.openlibrary.org/b/id/2-L.jpg',
    });
    expect(sessionStorage.getItem('clube:indicacao:ciclo-4:marina')).toBeNull();
  });

  it('treats a failed search as nothing found, and still lets the member go on', async () => {
    vi.mocked(lookupBook).mockRejectedValue(new Error('offline'));
    const { user } = renderElection();
    await fillDetails(user, 'Berserk');

    expect(
      await screen.findByText('Nenhuma capa encontrada. Envie uma imagem ou siga sem capa.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Enviar indicação' })).toBeEnabled();
  });

  it('shows members what they already answered, and only their own book', async () => {
    renderElection('rafa');

    expect(await screen.findByText('Sua indicação foi registrada.')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Indicações abertas' })).toBeInTheDocument();
    const [own, ...others] = await nominationRows();
    expect(own).toHaveTextContent('Ensaio sobre a Cegueira');
    expect(own).toHaveTextContent('Sua indicação');
    expect(others).toEqual([]);
    expect(screen.getByText(/Você vê só a sua\./)).toBeInTheDocument();
  });
});

describe('ElectionPage, the review before the vote', () => {
  it('shows everyone the whole list, and only that there was a conflict', async () => {
    renderElection('rafa', 'reviewing');
    expect(await screen.findByText('Houve um conflito')).toBeInTheDocument();
    const list = await screen.findByRole('region', { name: 'Indicações' });
    expect(await within(list).findAllByRole('listitem')).toHaveLength(5);
    expect(screen.queryByText(/Téo|Lia/)).not.toBeInTheDocument();
  });

  it('gives a merged nominator one choice, never their own reading', async () => {
    const backend = createDemoBackend({ state: createDemoState(new Date(), 'reviewing') });
    backend.auth.signInAs('marina');
    await backend.admin.updateReview({
      cycleId: 'ciclo-4',
      groups: [],
      merged: { casmurro: 'dom' },
    });
    await settle(backend);
    renderAsMember(<ElectionPage />, 'lia', { backend });

    expect(await screen.findByRole('heading', { name: 'Escolha uma leitura' })).toBeInTheDocument();
    expect(screen.getByText(/já conta como sua 1ª opção/)).toBeInTheDocument();
    const own = screen.getByRole('checkbox', { name: /Dom Casmurro/ });
    expect(own).toBeDisabled();
  });

  it('asks a nominator whose reading was let go for a new one', async () => {
    const backend = createDemoBackend({ state: createDemoState(new Date(), 'reviewing') });
    backend.auth.signInAs('marina');
    await backend.admin.reopenNominations({ cycleId: 'ciclo-4', nominationIds: ['casmurro'] });
    renderAsMember(<ElectionPage />, 'lia', { backend });

    expect(await screen.findByText('Sua indicação foi liberada para trocar')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Indique uma leitura' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Indicar uma leitura' })).toBeInTheDocument();
    // They choose again knowing the list (everyone saw it during the review); theirs left it.
    const list = await screen.findByRole('region', { name: 'Indicações até agora' });
    expect(await within(list).findAllByRole('listitem')).toHaveLength(4);
  });
});
