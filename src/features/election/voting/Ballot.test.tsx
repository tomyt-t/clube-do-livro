import { screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';

import { createDemoBackend, createDemoState } from '@/services/demo';
import { renderAsMember } from '@/test/render';

import { ElectionPage } from '../ElectionPage';

beforeEach(() => {
  localStorage.clear();
});

/** The demo club with cycle 4 open for votes: Téo and Bruno already voted. */
function renderBallot(uid = 'marina') {
  const backend = createDemoBackend({ state: createDemoState(new Date(), 'voting') });
  return { ...renderAsMember(<ElectionPage />, uid, { backend }), backend };
}

const choice = (name: RegExp) => screen.getByRole('checkbox', { name });

describe('ballot, list view', () => {
  it('lists the readings alphabetically and locks your own nomination', async () => {
    renderBallot('rafa');

    expect(
      await screen.findByRole('heading', { name: 'Escolha duas leituras' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Cada escolha vale um voto; a 1ª só desempata.')).toBeInTheDocument();
    const names = screen.getAllByRole('checkbox').map((box) => box.closest('label')?.textContent);
    expect(
      names.map((name) => name?.replace(/^.*?(Dom|Ensaio|Memórias|Quarto|Vidas)/, '$1')),
    ).toEqual([
      expect.stringMatching(/^Dom Casmurro/),
      expect.stringMatching(/^Ensaio sobre a Cegueira/),
      expect.stringMatching(/^Memórias Póstumas/),
      expect.stringMatching(/^Quarto de Despejo/),
      expect.stringMatching(/^Vidas Secas/),
    ]);
    expect(choice(/Ensaio sobre a Cegueira/)).toBeDisabled();
    expect(choice(/Ensaio sobre a Cegueira/).closest('label')).toHaveTextContent('Sua indicação');
  });

  it('takes a first and a second choice in order, and no more', async () => {
    const { user } = renderBallot();
    await user.click(await screen.findByRole('checkbox', { name: /Dom Casmurro/ }));
    await user.click(choice(/Vidas Secas/));

    expect(choice(/Dom Casmurro.*\(1ª opção\)/)).toBeChecked();
    expect(choice(/Vidas Secas.*\(2ª opção\)/)).toBeChecked();
    expect(choice(/Quarto de Despejo/)).toBeDisabled();
    expect(screen.getByText(/de 2 escolhidas/)).toHaveTextContent('2 de 2 escolhidas');

    await user.click(choice(/Dom Casmurro/));
    expect(choice(/Vidas Secas.*\(1ª opção\)/)).toBeChecked();
    expect(choice(/Quarto de Despejo/)).toBeEnabled();
  });

  it('swaps the order and confirms an anonymous ballot', async () => {
    const { user, backend } = renderBallot();
    await user.click(await screen.findByRole('checkbox', { name: /Dom Casmurro/ }));
    await user.click(choice(/Vidas Secas/));
    await user.click(screen.getByRole('button', { name: 'Inverter a ordem' }));
    await user.click(screen.getByRole('button', { name: 'Confirmar voto' }));

    const dialog = screen.getByRole('dialog', { name: 'Confirmar seu voto?' });
    expect(
      within(dialog)
        .getAllByRole('listitem')
        .map((item) => item.textContent),
    ).toEqual(['1ª opção: Vidas Secas', '2ª opção: Dom Casmurro']);
    await user.click(within(dialog).getByRole('button', { name: 'Confirmar voto' }));

    expect(await screen.findByText('Seu voto foi registrado.')).toBeInTheDocument();
    await backend.flow.closeVoting('ciclo-4');
    const results = await backend.flow.readResults('ciclo-4');
    expect(results.firsts.vidas).toBe(1);
    expect(results.votes.dom).toBe(2);
  });

  it('tells members who already voted', async () => {
    renderBallot('teo');
    expect(await screen.findByText('Seu voto foi registrado.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Confirmar voto' })).not.toBeInTheDocument();
  });
});

describe('ballot, cards view', () => {
  it('reads one reading at a time and chooses with ✓', async () => {
    const { user } = renderBallot();
    await user.click(await screen.findByRole('button', { name: 'Cartas' }));

    expect(
      screen.getByRole('article', { name: 'Leitura 1 de 5: Dom Casmurro' }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Bento Santiago/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Escolher esta leitura' }));
    expect(screen.getByText('1ª opção')).toBeInTheDocument();

    await user.keyboard('{ArrowRight}');
    expect(screen.getByRole('article', { name: /Leitura 2 de 5: Ensaio/ })).toBeInTheDocument();
    await user.keyboard('{ArrowLeft}{ArrowLeft}');
    expect(
      screen.getByRole('article', { name: /Leitura 5 de 5: Vidas Secas/ }),
    ).toBeInTheDocument();
  });

  it('keeps "não curti" on this device and out of the ballot', async () => {
    const { user } = renderBallot();
    await user.click(await screen.findByRole('button', { name: 'Cartas' }));
    await user.click(screen.getByRole('button', { name: 'Escolher esta leitura' }));

    const dislike = screen.getByRole('button', { name: 'Não curti (só você vê)' });
    await user.click(dislike);
    expect(dislike).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText(/0/, { selector: 'b' }).parentElement).toHaveTextContent(
      '0 de 2 escolhidas',
    );

    await user.click(screen.getByRole('button', { name: 'Lista' }));
    expect(choice(/Dom Casmurro/).closest('label')).toHaveTextContent('Não curti');
  });

  it('remembers the chosen view on this device', async () => {
    const first = renderBallot();
    await first.user.click(await screen.findByRole('button', { name: 'Cartas' }));
    first.unmount();

    renderBallot();
    expect(await screen.findByRole('button', { name: 'Cartas' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });
});
