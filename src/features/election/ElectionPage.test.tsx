import { screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { Nomination } from '@/domain/types';
import { searchCovers, type CoverOption } from '@/services/covers';
import { createDemoBackend } from '@/services/demo';
import { findSynopsis } from '@/services/synopsis';
import { firstValue } from '@/test/backend';
import { renderAsMember } from '@/test/render';

import { ElectionPage } from './ElectionPage';
import { resizeCover } from './nomination/resize-cover';

vi.mock('@/services/covers', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  searchCovers: vi.fn(),
}));
vi.mock('@/services/synopsis', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  findSynopsis: vi.fn(),
}));
vi.mock('./nomination/resize-cover', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  resizeCover: vi.fn(),
}));

const fromAniList: CoverOption = {
  id: 'anilist:1',
  imageUrl: 'https://s4.anilist.co/berserk.jpg',
  title: 'Berserk',
  details: 'Kentarou Miura · Mangá',
  source: 'anilist',
  synopsis: 'Guts.',
  workKey: null,
};

const fromOpenLibrary: CoverOption = {
  ...fromAniList,
  id: 'open-library:2',
  imageUrl: 'https://covers.openlibrary.org/b/id/2-L.jpg',
  details: 'Kentaro Miura · 1990',
  source: 'open-library',
  synopsis: null,
  workKey: '/works/OL2W',
};

beforeEach(() => {
  vi.mocked(searchCovers).mockResolvedValue([fromAniList, fromOpenLibrary]);
  vi.mocked(findSynopsis).mockImplementation(({ option }) =>
    Promise.resolve(option ? { text: `Sinopse do ${option.source}`, source: option.source } : null),
  );
});

function renderElection(uid = 'marina') {
  const backend = createDemoBackend();
  return { ...renderAsMember(<ElectionPage />, uid, { backend }), backend };
}

async function storedNominations(backend: ReturnType<typeof createDemoBackend>) {
  return firstValue<Nomination[]>((s) => backend.club.watchNominations('c4', s));
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

async function fillDetails(user: ReturnType<typeof renderElection>['user'], title: string) {
  await user.click(await screen.findByRole('button', { name: 'Indicar uma leitura' }));
  await user.type(screen.getByLabelText('Título / autor'), title);
  await user.click(screen.getByRole('button', { name: 'Continuar' }));
}

async function confirmSending(user: ReturnType<typeof renderElection>['user']) {
  await user.click(screen.getByRole('button', { name: 'Enviar indicação' }));
  const dialog = screen.getByRole('dialog', { name: 'Enviar esta indicação?' });
  await user.click(within(dialog).getByRole('button', { name: 'Enviar indicação' }));
  expect(await screen.findByText('Sua indicação está na lista.')).toBeInTheDocument();
}

describe('ElectionPage, nominations', () => {
  it('shows where the cycle is and the nominations so far, alphabetically', async () => {
    renderElection();

    const steps = await screen.findByRole('list', { name: 'Etapas da votação' });
    expect(within(steps).getByText('Indicações')).toHaveAttribute('aria-current', 'step');
    const [first, second, ...rest] = await nominationRows();
    expect(first).toHaveTextContent(/Ensaio sobre a Cegueira\s*José Saramago$/);
    expect(second).toHaveTextContent(/Memórias Póstumas de Brás Cubas\s*Machado de Assis$/);
    expect(rest).toEqual([]);
  });

  it('asks before passing, and passing is final', async () => {
    const { user } = renderElection();
    await user.click(await screen.findByRole('button', { name: 'Não quero indicar' }));

    const dialog = screen.getByRole('dialog', { name: 'Não indicar nesta rodada?' });
    await user.click(within(dialog).getByRole('button', { name: 'Não indicar' }));

    expect(await screen.findByText('Você não indicou nesta rodada.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Indicar uma leitura' })).not.toBeInTheDocument();
  });

  it('checks the title and the link before searching anything', async () => {
    const { user } = renderElection();
    await user.click(await screen.findByRole('button', { name: 'Indicar uma leitura' }));
    await user.type(screen.getByLabelText('Link para a sinopse (opcional)'), 'wikipedia.org');
    await user.click(screen.getByRole('button', { name: 'Continuar' }));

    expect(screen.getByText('Escreva o título e, se quiser, o autor.')).toBeInTheDocument();
    expect(screen.getByText('Use um link completo, começando com https://.')).toBeInTheDocument();
    expect(searchCovers).not.toHaveBeenCalled();
  });

  it('nominates with the chosen cover and the synopsis found for it, edited', async () => {
    const { user, backend } = renderElection();
    await fillDetails(user, 'Berserk, Kentaro Miura');

    expect(await screen.findByRole('radio', { name: /Kentarou Miura/ })).toBeChecked();
    const synopsis = screen.getByLabelText('Sinopse (opcional)');
    expect(synopsis).toHaveValue('Sinopse do anilist');

    await user.click(screen.getByRole('radio', { name: /Kentaro Miura · 1990/ }));
    expect(await screen.findByDisplayValue('Sinopse do open-library')).toBeInTheDocument();
    expect(screen.getByText('Sinopse: Open Library. Dá para editar.')).toBeInTheDocument();
    await user.clear(synopsis);
    await user.type(synopsis, 'Um espadachim contra o destino.');
    await confirmSending(user);

    expect(await rowOf('Berserk')).toHaveTextContent('Sua indicação');
    const sent = (await storedNominations(backend)).find((n) => n.book.title.startsWith('Berserk'));
    expect(sent?.book).toEqual({
      title: 'Berserk, Kentaro Miura',
      synopsis: 'Um espadachim contra o destino.',
      synopsisSource: 'open-library',
      synopsisUrl: null,
      coverUrl: 'https://covers.openlibrary.org/b/id/2-L.jpg',
    });
  });

  it('goes on without a cover when the catalogs find nothing', async () => {
    vi.mocked(searchCovers).mockResolvedValue([]);
    const { user, backend } = renderElection();
    await fillDetails(user, 'Zine do bairro');

    expect(
      await screen.findByText('Nenhuma capa encontrada. Envie uma imagem ou siga sem capa.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Sem capa' })).toBeChecked();
    await confirmSending(user);

    const sent = (await storedNominations(backend)).find((n) => n.book.title === 'Zine do bairro');
    expect(sent?.book).toMatchObject({ coverUrl: null, synopsis: null, synopsisSource: null });
  });

  it('uses an image the member uploads', async () => {
    vi.mocked(resizeCover).mockResolvedValue('data:image/jpeg;base64,AAAA');
    const { user, backend } = renderElection();
    await fillDetails(user, 'Berserk');

    const photo = new File(['capa'], 'capa.jpg', { type: 'image/jpeg' });
    await user.upload(await screen.findByLabelText(/Enviar imagem/), photo);
    expect(await screen.findByRole('radio', { name: 'Sua imagem' })).toBeChecked();
    await confirmSending(user);

    const sent = (await storedNominations(backend)).find((n) => n.book.title === 'Berserk');
    expect(sent?.book.coverUrl).toBe('data:image/jpeg;base64,AAAA');
  });

  it('says when the cover search fails, and still lets the member go on', async () => {
    vi.mocked(searchCovers).mockRejectedValue(new Error('offline'));
    const { user } = renderElection();
    await fillDetails(user, 'Berserk');

    expect(
      await screen.findByText(
        'Não foi possível buscar capas agora. Envie uma imagem ou siga sem capa.',
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Enviar indicação' })).toBeEnabled();
  });

  it('shows members what they already answered, and marks only their own book', async () => {
    renderElection('rafa');

    expect(await screen.findByText('Sua indicação está na lista.')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Indicações abertas' })).toBeInTheDocument();
    expect(await rowOf('Ensaio sobre a Cegueira')).toHaveTextContent('Sua indicação');
    expect(await rowOf('Memórias Póstumas')).not.toHaveTextContent('Sua indicação');
  });
});
