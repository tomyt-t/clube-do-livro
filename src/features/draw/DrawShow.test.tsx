import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { Cycle } from '@/domain/types';
import { makeBook, makeCycle } from '@/test/factories';
import { renderAsMember } from '@/test/render';

import { DrawGate } from './DrawGate';
import { DrawShow } from './DrawShow';

const TIED = [
  makeBook({ title: 'O Avesso da Pele, Jeferson Tenório' }),
  makeBook({ title: 'Cem Anos de Solidão, Gabriel García Márquez' }),
  makeBook({ title: 'Quarto de Despejo, Carolina Maria de Jesus' }),
];

function show(onClose = vi.fn()) {
  const user = userEvent.setup();
  render(
    <DrawShow
      heading="O sorteio da leitura nº 3"
      tied={TIED}
      winner={1}
      seed="ciclo-3:1700000000001"
      drawnAt={new Date('2026-11-19T15:31:00')}
      onClose={onClose}
    />,
  );
  return { user, onClose };
}

afterEach(() => {
  localStorage.clear();
});

describe('DrawShow', () => {
  it('shows the tie first, and Pular goes straight to the winner', async () => {
    const { user, onClose } = show();
    expect(screen.getByRole('dialog', { name: 'O sorteio da leitura nº 3' })).toBeInTheDocument();
    expect(screen.getByText(/3 leituras empataram/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Pular' }));
    expect(screen.getByText('Venceu o sorteio')).toBeInTheDocument();
    expect(screen.getByText('Cem Anos de Solidão', { selector: 'p' })).toBeInTheDocument();
    expect(
      screen.getByText(/Sorteio entre 3 leituras empatadas, em 19 de novembro de 2026/),
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Fechar' }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('plays the match after the tie, with Pausar', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      const { user } = show();
      await vi.advanceTimersByTimeAsync(3000);
      const pause = await screen.findByRole('button', { name: 'Pausar' });
      await user.click(pause);
      expect(screen.getByRole('button', { name: 'Continuar' })).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it('goes straight to the result with reduced motion', () => {
    // Restored after the test (`restoreMocks` in the Vitest config).
    vi.spyOn(window, 'matchMedia').mockImplementation(
      (query: string) =>
        ({
          matches: query.includes('reduce'),
          media: query,
          addEventListener: () => undefined,
          removeEventListener: () => undefined,
        }) as unknown as MediaQueryList,
    );
    show();
    expect(screen.getByText('Venceu o sorteio')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Pular' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Ver de novo' })).not.toBeInTheDocument();
  });
});

/** The demo's round 3 (Avesso, Cem anos, Quarto), as if decided just now. */
function freshDraw(): Cycle {
  return makeCycle({
    id: 'ciclo-3',
    number: 3,
    status: 'reading',
    options: ['avesso', 'cem', 'quarto'],
    winner: {
      nominationId: 'cem',
      book: TIED[1] ?? makeBook(),
      method: 'draw',
      decidedAt: new Date(),
      drawnFrom: ['avesso', 'cem', 'quarto'],
    },
  });
}

describe('DrawGate', () => {
  it('opens once by itself, and not again on this device', async () => {
    const first = renderAsMember(<DrawGate cycles={[freshDraw()]} />);
    expect(
      await screen.findByRole('dialog', { name: 'O sorteio da leitura nº 3' }),
    ).toBeInTheDocument();
    await first.user.click(screen.getByRole('button', { name: 'Pular' }));
    await first.user.click(screen.getByRole('button', { name: 'Fechar' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    first.unmount();

    renderAsMember(<DrawGate cycles={[freshDraw()]} />);
    // The gate decides on its first render: nothing to wait for.
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('leaves an old draw to Histórico', () => {
    const old = freshDraw();
    if (old.winner) old.winner.decidedAt = new Date(Date.now() - 40 * 24 * 60 * 60 * 1000);
    renderAsMember(<DrawGate cycles={[old]} />);
    // The gate decides on its first render: nothing to wait for.
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
