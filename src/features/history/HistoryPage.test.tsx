import { screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { emptyClub } from '@/test/backend';
import { renderAsMember } from '@/test/render';

import { HistoryPage } from './HistoryPage';

async function record(title: string) {
  const heading = await screen.findByRole('heading', { level: 2, name: title });
  const section = heading.closest('section');
  if (!section) throw new Error(`Sem seção para ${title}`);
  return within(section);
}

describe('HistoryPage', () => {
  it('puts every chosen reading on the shelf and below it, newest first', async () => {
    renderAsMember(<HistoryPage />);

    const shelf = await screen.findByRole('navigation', { name: 'Estante' });
    expect(
      within(shelf)
        .getAllByRole('button')
        .map((button) => button.getAttribute('aria-label')),
    ).toEqual([
      'Leitura nº 3: Cem Anos de Solidão',
      'Leitura nº 2: Torto Arado',
      'Leitura nº 1: A Hora da Estrela',
    ]);
    expect(
      screen.getAllByRole('heading', { level: 2 }).map((heading) => heading.textContent),
    ).toEqual(['Cem Anos de Solidão', 'Torto Arado', 'A Hora da Estrela']);
  });

  it('charts each vote with first and second choices, and keeps the numbers at hand', async () => {
    renderAsMember(<HistoryPage />);
    const round = await record('Torto Arado');

    expect(round.getByText(/Escolhida no desempate\./)).toBeInTheDocument();
    expect(await round.findByText('6 de 6 votaram')).toBeInTheDocument();
    expect(
      await round.findByText('Torto Arado: 4 votos, 3 como 1ª opção, venceu.'),
    ).toBeInTheDocument();
    expect(
      round.getByText('Ensaio sobre a Cegueira: 4 votos, 1 como 1ª opção.'),
    ).toBeInTheDocument();

    const table = round.getByRole('table');
    expect(
      within(table).getByRole('rowheader', { name: 'Torto Arado' }).closest('tr'),
    ).toHaveTextContent('Torto Arado431');
  });

  it('explains how a draw came out, so anyone can check it', async () => {
    renderAsMember(<HistoryPage />);
    const round = await record('Cem Anos de Solidão');

    expect(round.getByText('Como foi o sorteio')).toBeInTheDocument();
    expect(
      await round.findByText(
        /nesta ordem fixa: O Avesso da Pele, Cem Anos de Solidão e Quarto de Despejo/,
      ),
    ).toHaveTextContent('deixa resto 1, então venceu a 2ª da lista');
  });

  it('opens a round from the shelf', async () => {
    const scrollIntoView = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoView;
    const { user } = renderAsMember(<HistoryPage />);

    await user.click(
      await screen.findByRole('button', { name: 'Leitura nº 1: A Hora da Estrela' }),
    );
    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth', block: 'start' });
  });

  it('says so when no reading was chosen yet', async () => {
    renderAsMember(<HistoryPage />, 'marina', { backend: emptyClub() });
    expect(
      await screen.findByRole('heading', { name: 'Nada no histórico ainda' }),
    ).toBeInTheDocument();
  });
});
