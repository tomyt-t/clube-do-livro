import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { Cycle, OwnAnswer } from '@/domain/types';
import { createDemoBackend, createDemoState } from '@/services/demo';
import { cycleOf, firstValue } from '@/test/backend';
import { isLetGo } from '@/domain/review';
import { renderAsMember } from '@/test/render';
import { makeBook } from '@/test/factories';

import { AdminPage } from './AdminPage';

const CURRENT = 'ciclo-4';

function renderReview(uid = 'marina') {
  const backend = createDemoBackend({ state: createDemoState(new Date(), 'reviewing') });
  return { ...renderAsMember(<AdminPage />, uid, { backend }), backend };
}

async function confirm(user: ReturnType<typeof renderReview>['user'], label: string) {
  const dialog = await screen.findByRole('dialog');
  await user.click(within(dialog).getByRole('button', { name: label }));
}

const panel = () => screen.findByRole('region', { name: 'Conferência' });

describe('ConflictsPanel', () => {
  it('shows the organizer who nominated each flagged reading', async () => {
    renderReview();
    const conflicts = await panel();
    expect(await within(conflicts).findByText(/indicada por Téo/)).toBeInTheDocument();
    expect(within(conflicts).getByText(/indicada por Lia/)).toBeInTheDocument();
    expect(within(conflicts).getByText('Mesmo título: Dom Casmurro.')).toBeInTheDocument();
  });

  it('merges a group into one reading with a head start, and clears the review', async () => {
    const { user, backend } = renderReview();
    await user.click(await within(await panel()).findByRole('button', { name: 'Juntar numa só' }));
    expect(screen.getByText(/já começa com 2 votos de 1ª opção/)).toBeInTheDocument();
    await confirm(user, 'Juntar');

    expect(await screen.findByText(/Nenhuma indicação repetida/)).toBeInTheDocument();
    const cycle: Cycle = await cycleOf(backend, CURRENT);
    expect(cycle.merged).toEqual({ casmurro: 'dom' });
    expect(cycle.review).toEqual({ conflicts: [] });
  });

  it('keeps them apart when they are not the same reading', async () => {
    const { user, backend } = renderReview();
    await user.click(await within(await panel()).findByRole('button', { name: 'Não são a mesma' }));
    await confirm(user, 'Manter separadas');
    expect(await screen.findByText(/Nenhuma indicação repetida/)).toBeInTheDocument();
    expect((await cycleOf(backend, CURRENT)).merged).toEqual({});
  });

  it('lets a nominator choose again, reopening the nomination call for them', async () => {
    const { user, backend } = renderReview();
    const conflicts = await panel();
    await within(conflicts).findByText(/indicada por Lia/);
    const [, lia] = within(conflicts).getAllByRole('button', { name: 'Liberar para trocar' });
    if (!lia) throw new Error('Sem botão para Lia');
    await user.click(lia);
    expect(screen.getByRole('dialog', { name: 'Liberar Lia para trocar?' })).toBeInTheDocument();
    await confirm(user, 'Liberar');

    expect(await screen.findByText(/indicações abertas/)).toBeInTheDocument();
    const cycle = await cycleOf(backend, CURRENT);
    expect(cycle.review).toBeNull();
    expect(cycle.nominationIds).not.toContain('casmurro');
    // Her answer stays, let go: only she can replace it.
    const answer = await firstValue<OwnAnswer | null>((s) =>
      backend.club.watchOwnAnswer(CURRENT, 'lia', s),
    );
    expect(isLetGo(answer, cycle)).toBe(true);

    // The vote waits for her: no opening it early meanwhile.
    expect(screen.getByText(/Esperando 1 pessoa indicar de novo/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Abrir a votação agora' })).not.toBeInTheDocument();
    backend.auth.signInAs('lia');
    await backend.club.answerNominationCall({
      cycleId: CURRENT,
      uid: 'lia',
      answer: { kind: 'nominate', book: makeBook({ title: 'Grande Sertão: Veredas' }) },
    });
    expect((await cycleOf(backend, CURRENT)).letGo).toEqual([]);
  });
});
