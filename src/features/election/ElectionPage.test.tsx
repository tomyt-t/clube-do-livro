import { screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { Nomination, OwnAnswer } from '@/domain/types';
import { searchCovers, type CoverOption } from '@/services/covers';
import { createDemoBackend, createDemoState, type DemoScenario } from '@/services/demo';
import { findSynopsis } from '@/services/synopsis';
import { firstValue, settle } from '@/test/backend';
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

async function fillDetails(user: ReturnType<typeof renderElection>['user'], title: string) {
  await user.click(await screen.findByRole('button', { name: 'Indicar uma leitura' }));
  await user.type(screen.getByLabelText('Título / autor'), title);
  await user.click(screen.getByRole('button', { name: 'Continuar' }));
}

async function confirmSending(user: ReturnType<typeof renderElection>['user']) {
  await user.click(screen.getByRole('button', { name: 'Enviar indicação' }));
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
    await fillDetails(user, 'ensaio sobre a cegueira — JOSÉ SARAMAGO');

    await waitFor(() => {
      expect(searchCovers).toHaveBeenCalled();
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
    // The synopsis arrives after the cover is chosen.
    const synopsis = await screen.findByDisplayValue('Sinopse do anilist');
    expect(synopsis).toBe(screen.getByLabelText('Sinopse (opcional)'));

    await user.click(screen.getByRole('radio', { name: /Kentaro Miura · 1990/ }));
    expect(await screen.findByDisplayValue('Sinopse do open-library')).toBeInTheDocument();
    expect(screen.getByText('Sinopse: Open Library. Dá para editar.')).toBeInTheDocument();
    await user.clear(synopsis);
    await user.type(synopsis, 'Um espadachim contra o destino.');
    await confirmSending(user);

    expect(await rowOf('Berserk')).toHaveTextContent('Sua indicação');
    expect(await sentBook(backend)).toEqual({
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

    expect(await sentBook(backend)).toMatchObject({
      title: 'Zine do bairro',
      coverUrl: null,
      synopsis: null,
      synopsisSource: null,
    });
  });

  it('uses an image the member uploads', async () => {
    vi.mocked(resizeCover).mockResolvedValue('data:image/jpeg;base64,AAAA');
    const { user, backend } = renderElection();
    await fillDetails(user, 'Berserk');

    const photo = new File(['capa'], 'capa.jpg', { type: 'image/jpeg' });
    await user.upload(await screen.findByLabelText(/Enviar imagem/), photo);
    expect(await screen.findByRole('radio', { name: 'Sua imagem' })).toBeChecked();
    await confirmSending(user);

    expect((await sentBook(backend))?.coverUrl).toBe('data:image/jpeg;base64,AAAA');
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
