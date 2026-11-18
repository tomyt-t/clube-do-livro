import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { renderWithSession } from '@/test/render';

import { DemoBar } from './DemoBar';
import { SessionGate } from './SessionGate';

describe('DemoBar', () => {
  it('says the data is fake and switches between members', async () => {
    const { user } = renderWithSession(
      <>
        <DemoBar />
        <SessionGate>
          <p>Área dos membros</p>
        </SessionGate>
      </>,
    );
    expect(screen.getByRole('complementary', { name: 'Demonstração' })).toHaveTextContent(
      'Os dados voltam ao início',
    );

    const select = screen.getByRole('combobox', { name: 'Entrar como' });
    await user.selectOptions(select, 'Marina (organiza)');
    expect(await screen.findByText('Área dos membros')).toBeInTheDocument();

    await user.selectOptions(screen.getByRole('combobox', { name: 'Etapa' }), 'Votação');
    expect(screen.getByRole('combobox', { name: 'Etapa' })).toHaveValue('voting');

    await user.selectOptions(select, 'Ninguém');
    expect(await screen.findByRole('button', { name: 'Entrar com Google' })).toBeInTheDocument();
  });
});
